import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Organization,
  Workspace,
  OrganizationMember,
  WorkspaceRole,
  AgencyClient,
  AgencyBranding,
  CustomDomainConfig,
  WorkspaceInvitation,
  SupportTicket,
  AuditLogEntry,
  PlanTier,
  SaasError,
} from './types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface ITenantStore {
  // Organizations
  createOrganization(name: string, ownerId: string, planId?: PlanTier): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | null>;
  updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization>;
  listOrganizations(userId: string): Promise<Organization[]>;
  getAllOrganizations(): Promise<Organization[]>;
  deleteOrganization(id: string): Promise<boolean>;

  // Workspaces
  createWorkspace(organizationId: string, name: string, clientId?: string): Promise<Workspace>;
  getWorkspace(id: string): Promise<Workspace | null>;
  listWorkspaces(organizationId: string): Promise<Workspace[]>;
  getAllWorkspaces(): Promise<Workspace[]>;
  updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace>;
  deleteWorkspace(id: string): Promise<boolean>;

  // Memberships
  addMember(organizationId: string, workspaceId: string, userId: string, email: string, name: string, role: WorkspaceRole): Promise<OrganizationMember>;
  getMember(workspaceId: string, userId: string): Promise<OrganizationMember | null>;
  listMembers(workspaceId: string): Promise<OrganizationMember[]>;
  updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<OrganizationMember>;
  removeMember(workspaceId: string, userId: string): Promise<boolean>;

  // Invitations
  createInvitation(organizationId: string, workspaceId: string, email: string, role: WorkspaceRole, invitedBy: string): Promise<WorkspaceInvitation>;
  getInvitationByToken(token: string): Promise<WorkspaceInvitation | null>;
  acceptInvitation(token: string, userId: string, name: string): Promise<OrganizationMember>;

  // Clients
  createClient(organizationId: string, workspaceId: string, data: Partial<AgencyClient>): Promise<AgencyClient>;
  getClient(id: string): Promise<AgencyClient | null>;
  listClients(workspaceId: string): Promise<AgencyClient[]>;
  updateClient(id: string, updates: Partial<AgencyClient>): Promise<AgencyClient>;
  deleteClient(id: string): Promise<boolean>;

  // Branding & Domains
  getBranding(workspaceId: string): Promise<AgencyBranding>;
  saveBranding(branding: AgencyBranding): Promise<AgencyBranding>;
  configureDomain(workspaceId: string, hostname: string): Promise<CustomDomainConfig>;
  verifyDomain(domainId: string): Promise<CustomDomainConfig>;
  getDomainConfig(workspaceId: string): Promise<CustomDomainConfig | null>;

  // Audit Log
  recordAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry>;
  listAuditLogs(organizationId: string, limit?: number): Promise<AuditLogEntry[]>;

  // Support
  createTicket(ticket: Omit<SupportTicket, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<SupportTicket>;
  listTickets(organizationId: string): Promise<SupportTicket[]>;
}

export class LocalTenantStore implements ITenantStore {
  private baseDir = path.join(process.cwd(), 'data', 'saas');
  private orgsFile = path.join(process.cwd(), 'data', 'saas', 'organizations.json');
  private workspacesFile = path.join(process.cwd(), 'data', 'saas', 'workspaces.json');
  private membersFile = path.join(process.cwd(), 'data', 'saas', 'members.json');
  private clientsFile = path.join(process.cwd(), 'data', 'saas', 'clients.json');
  private invitationsFile = path.join(process.cwd(), 'data', 'saas', 'invitations.json');
  private brandingFile = path.join(process.cwd(), 'data', 'saas', 'branding.json');
  private domainsFile = path.join(process.cwd(), 'data', 'saas', 'domains.json');
  private auditFile = path.join(process.cwd(), 'data', 'saas', 'audit.json');
  private ticketsFile = path.join(process.cwd(), 'data', 'saas', 'tickets.json');

  constructor() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private read<T>(filePath: string): T[] {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private write<T>(filePath: string, data: T[]): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // --- ORGANIZATIONS ---

  async createOrganization(name: string, ownerId: string, planId: PlanTier = 'starter'): Promise<Organization> {
    const orgs = this.read<Organization>(this.orgsFile);
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const org: Organization = {
      id: crypto.randomUUID(),
      name,
      slug: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerId,
      planId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    orgs.push(org);
    this.write(this.orgsFile, orgs);

    // Auto-create default workspace
    await this.createWorkspace(org.id, `${name} Main`);
    return org;
  }

  async getOrganization(id: string): Promise<Organization | null> {
    const orgs = this.read<Organization>(this.orgsFile);
    return orgs.find(o => o.id === id) || null;
  }

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const orgs = this.read<Organization>(this.orgsFile);
    const idx = orgs.findIndex(o => o.id === id);
    if (idx === -1) throw new SaasError('NOT_FOUND', `Organization ${id} not found`, 404);

    orgs[idx] = { ...orgs[idx], ...updates, updatedAt: new Date().toISOString() };
    this.write(this.orgsFile, orgs);
    return orgs[idx];
  }

  async listOrganizations(userId: string): Promise<Organization[]> {
    const orgs = this.read<Organization>(this.orgsFile);
    const members = this.read<OrganizationMember>(this.membersFile);
    const userOrgIds = new Set(members.filter(m => m.userId === userId).map(m => m.organizationId));
    return orgs.filter(o => o.ownerId === userId || userOrgIds.has(o.id));
  }

  async getAllOrganizations(): Promise<Organization[]> {
    return this.read<Organization>(this.orgsFile);
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    return this.read<Workspace>(this.workspacesFile);
  }

  async deleteOrganization(id: string): Promise<boolean> {
    let orgs = this.read<Organization>(this.orgsFile);
    const initialLen = orgs.length;
    orgs = orgs.filter(o => o.id !== id);
    this.write(this.orgsFile, orgs);

    // Cascade delete associated workspaces & members
    const workspaces = this.read<Workspace>(this.workspacesFile);
    const survivingWorkspaces = workspaces.filter(w => w.organizationId !== id);
    this.write(this.workspacesFile, survivingWorkspaces);

    const members = this.read<OrganizationMember>(this.membersFile);
    const survivingMembers = members.filter(m => m.organizationId !== id);
    this.write(this.membersFile, survivingMembers);

    return orgs.length < initialLen;
  }

  // --- WORKSPACES ---

  async createWorkspace(organizationId: string, name: string, clientId?: string): Promise<Workspace> {
    const org = await this.getOrganization(organizationId);
    if (!org) throw new SaasError('NOT_FOUND', `Parent organization ${organizationId} not found`, 404);

    const workspaces = this.read<Workspace>(this.workspacesFile);
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const ws: Workspace = {
      id: crypto.randomUUID(),
      organizationId,
      name,
      slug: `${slug}-${Math.floor(1000 + Math.random() * 9000)}`,
      timezone: 'UTC',
      defaultLanguage: 'en',
      clientId,
      settings: {
        allowClientComments: true,
        requireApprovalBeforePublish: true,
        autoTranscribeUploads: true,
        watermarkPreview: false,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    workspaces.push(ws);
    this.write(this.workspacesFile, workspaces);

    // Add organization owner as OWNER of this workspace
    await this.addMember(organizationId, ws.id, org.ownerId, 'owner@clipper.ai', 'Organization Owner', 'OWNER');
    return ws;
  }

  async getWorkspace(id: string): Promise<Workspace | null> {
    const workspaces = this.read<Workspace>(this.workspacesFile);
    return workspaces.find(w => w.id === id) || null;
  }

  async listWorkspaces(organizationId: string): Promise<Workspace[]> {
    const workspaces = this.read<Workspace>(this.workspacesFile);
    return workspaces.filter(w => w.organizationId === organizationId);
  }

  async updateWorkspace(id: string, updates: Partial<Workspace>): Promise<Workspace> {
    const workspaces = this.read<Workspace>(this.workspacesFile);
    const idx = workspaces.findIndex(w => w.id === id);
    if (idx === -1) throw new SaasError('NOT_FOUND', `Workspace ${id} not found`, 404);

    workspaces[idx] = { ...workspaces[idx], ...updates, updatedAt: new Date().toISOString() };
    this.write(this.workspacesFile, workspaces);
    return workspaces[idx];
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    let workspaces = this.read<Workspace>(this.workspacesFile);
    const initialLen = workspaces.length;
    workspaces = workspaces.filter(w => w.id !== id);
    this.write(this.workspacesFile, workspaces);

    // Clean up members for this workspace
    let members = this.read<OrganizationMember>(this.membersFile);
    members = members.filter(m => m.workspaceId !== id);
    this.write(this.membersFile, members);

    return workspaces.length < initialLen;
  }

  // --- MEMBERSHIPS ---

  async addMember(
    organizationId: string,
    workspaceId: string,
    userId: string,
    email: string,
    name: string,
    role: WorkspaceRole
  ): Promise<OrganizationMember> {
    const members = this.read<OrganizationMember>(this.membersFile);
    const existing = members.find(m => m.workspaceId === workspaceId && m.userId === userId);
    if (existing) {
      existing.role = role;
      this.write(this.membersFile, members);
      return existing;
    }

    const member: OrganizationMember = {
      id: crypto.randomUUID(),
      organizationId,
      workspaceId,
      userId,
      email,
      name,
      role,
      joinedAt: new Date().toISOString(),
      status: 'active',
    };

    members.push(member);
    this.write(this.membersFile, members);
    return member;
  }

  async getMember(workspaceId: string, userId: string): Promise<OrganizationMember | null> {
    const members = this.read<OrganizationMember>(this.membersFile);
    return members.find(m => m.workspaceId === workspaceId && m.userId === userId) || null;
  }

  async listMembers(workspaceId: string): Promise<OrganizationMember[]> {
    const members = this.read<OrganizationMember>(this.membersFile);
    return members.filter(m => m.workspaceId === workspaceId);
  }

  async updateMemberRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<OrganizationMember> {
    const members = this.read<OrganizationMember>(this.membersFile);
    const member = members.find(m => m.workspaceId === workspaceId && m.userId === userId);
    if (!member) throw new SaasError('NOT_FOUND', `Member not found in workspace`, 404);

    member.role = role;
    this.write(this.membersFile, members);
    return member;
  }

  async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    let members = this.read<OrganizationMember>(this.membersFile);
    const initialLen = members.length;
    members = members.filter(m => !(m.workspaceId === workspaceId && m.userId === userId));
    this.write(this.membersFile, members);
    return members.length < initialLen;
  }

  // --- INVITATIONS ---

  async createInvitation(
    organizationId: string,
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    invitedBy: string
  ): Promise<WorkspaceInvitation> {
    const invitations = this.read<WorkspaceInvitation>(this.invitationsFile);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const invitation: WorkspaceInvitation = {
      id: crypto.randomUUID(),
      organizationId,
      workspaceId,
      email,
      role,
      token,
      invitedBy,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    invitations.push(invitation);
    this.write(this.invitationsFile, invitations);
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<WorkspaceInvitation | null> {
    const invitations = this.read<WorkspaceInvitation>(this.invitationsFile);
    const inv = invitations.find(i => i.token === token);
    if (!inv) return null;
    if (new Date(inv.expiresAt).getTime() < Date.now()) {
      return null; // Expired
    }
    return inv;
  }

  async acceptInvitation(token: string, userId: string, name: string): Promise<OrganizationMember> {
    const inv = await this.getInvitationByToken(token);
    if (!inv) throw new SaasError('NOT_FOUND', 'Invalid or expired invitation token', 400);

    const member = await this.addMember(inv.organizationId, inv.workspaceId, userId, inv.email, name, inv.role);

    // Invalidate invitation
    let invitations = this.read<WorkspaceInvitation>(this.invitationsFile);
    invitations = invitations.filter(i => i.token !== token);
    this.write(this.invitationsFile, invitations);

    return member;
  }

  // --- CLIENTS ---

  async createClient(organizationId: string, workspaceId: string, data: Partial<AgencyClient>): Promise<AgencyClient> {
    const clients = this.read<AgencyClient>(this.clientsFile);
    const client: AgencyClient = {
      id: crypto.randomUUID(),
      organizationId,
      workspaceId,
      name: data.name || 'New Client',
      company: data.company || 'Client Co',
      logoUrl: data.logoUrl,
      contactEmail: data.contactEmail || 'contact@client.com',
      contactPhone: data.contactPhone,
      notes: data.notes,
      status: data.status || 'active',
      monthlyRetainerUSD: data.monthlyRetainerUSD || 0,
      allocatedCredits: data.allocatedCredits || 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    clients.push(client);
    this.write(this.clientsFile, clients);
    return client;
  }

  async getClient(id: string): Promise<AgencyClient | null> {
    const clients = this.read<AgencyClient>(this.clientsFile);
    return clients.find(c => c.id === id) || null;
  }

  async listClients(workspaceId: string): Promise<AgencyClient[]> {
    const clients = this.read<AgencyClient>(this.clientsFile);
    return clients.filter(c => c.workspaceId === workspaceId);
  }

  async updateClient(id: string, updates: Partial<AgencyClient>): Promise<AgencyClient> {
    const clients = this.read<AgencyClient>(this.clientsFile);
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) throw new SaasError('NOT_FOUND', `Client ${id} not found`, 404);

    clients[idx] = { ...clients[idx], ...updates, updatedAt: new Date().toISOString() };
    this.write(this.clientsFile, clients);
    return clients[idx];
  }

  async deleteClient(id: string): Promise<boolean> {
    let clients = this.read<AgencyClient>(this.clientsFile);
    const initialLen = clients.length;
    clients = clients.filter(c => c.id !== id);
    this.write(this.clientsFile, clients);
    return clients.length < initialLen;
  }

  // --- BRANDING & DOMAINS ---

  async getBranding(workspaceId: string): Promise<AgencyBranding> {
    const brandingList = this.read<AgencyBranding>(this.brandingFile);
    const match = brandingList.find(b => b.workspaceId === workspaceId);
    if (match) return match;

    // Default branding
    return {
      workspaceId,
      brandName: 'Clipper Studio',
      portalName: 'Client Review Portal',
      primaryColorHex: '#6366f1',
      accentColorHex: '#8b5cf6',
      supportEmail: 'support@clipper.ai',
      removePlatformAttribution: false,
    };
  }

  async saveBranding(branding: AgencyBranding): Promise<AgencyBranding> {
    let brandingList = this.read<AgencyBranding>(this.brandingFile);
    brandingList = brandingList.filter(b => b.workspaceId !== branding.workspaceId);
    brandingList.push(branding);
    this.write(this.brandingFile, brandingList);
    return branding;
  }

  async configureDomain(workspaceId: string, hostname: string): Promise<CustomDomainConfig> {
    const domains = this.read<CustomDomainConfig>(this.domainsFile);
    const verificationToken = `clipper-verify-${crypto.randomBytes(16).toString('hex')}`;
    const domain: CustomDomainConfig = {
      id: crypto.randomUUID(),
      workspaceId,
      hostname: hostname.toLowerCase().trim(),
      verificationToken,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    domains.push(domain);
    this.write(this.domainsFile, domains);
    return domain;
  }

  async verifyDomain(domainId: string): Promise<CustomDomainConfig> {
    const domains = this.read<CustomDomainConfig>(this.domainsFile);
    const domain = domains.find(d => d.id === domainId);
    if (!domain) throw new SaasError('NOT_FOUND', `Domain config ${domainId} not found`, 404);

    // Rule Zero: Only verify if hostname format is valid
    if (!domain.hostname.includes('.') || domain.hostname.includes('localhost')) {
      domain.status = 'failed';
    } else {
      domain.status = 'verified';
      domain.verifiedAt = new Date().toISOString();
    }

    this.write(this.domainsFile, domains);
    return domain;
  }

  async getDomainConfig(workspaceId: string): Promise<CustomDomainConfig | null> {
    const domains = this.read<CustomDomainConfig>(this.domainsFile);
    return domains.find(d => d.workspaceId === workspaceId) || null;
  }

  // --- AUDIT LOGS ---

  async recordAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    const logs = this.read<AuditLogEntry>(this.auditFile);
    const fullEntry: AuditLogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    logs.unshift(fullEntry); // Prepend for recency
    // Keep last 1,000 logs
    if (logs.length > 1000) {
      logs.length = 1000;
    }
    this.write(this.auditFile, logs);
    return fullEntry;
  }

  async listAuditLogs(organizationId: string, limit: number = 50): Promise<AuditLogEntry[]> {
    const logs = this.read<AuditLogEntry>(this.auditFile);
    return logs.filter(l => l.organizationId === organizationId).slice(0, limit);
  }

  // --- SUPPORT ---

  async createTicket(ticket: Omit<SupportTicket, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<SupportTicket> {
    const tickets = this.read<SupportTicket>(this.ticketsFile);
    const fullTicket: SupportTicket = {
      ...ticket,
      id: crypto.randomUUID(),
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tickets.push(fullTicket);
    this.write(this.ticketsFile, tickets);
    return fullTicket;
  }

  async listTickets(organizationId: string): Promise<SupportTicket[]> {
    const tickets = this.read<SupportTicket>(this.ticketsFile);
    return tickets.filter(t => t.organizationId === organizationId);
  }
}

// Singleton provider
let tenantStoreInstance: ITenantStore | null = null;

export function getTenantStore(): ITenantStore {
  if (!tenantStoreInstance) {
    tenantStoreInstance = new LocalTenantStore();
  }
  return tenantStoreInstance;
}
