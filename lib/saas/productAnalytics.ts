import fs from 'fs';
import path from 'path';
import { getTenantStore } from './tenantStore';
import { SupportService } from './supportService';
import { getEnterpriseJobQueue } from '../enterprise/jobQueue';

const DATA_DIR = path.join(process.cwd(), 'data', 'saas');
const EVENTS_FILE = path.join(DATA_DIR, 'product_events.json');

export type ProductEventType =
  | 'signup'
  | 'workspace_created'
  | 'project_created'
  | 'upload_started'
  | 'analysis_completed'
  | 'clip_created'
  | 'render_completed'
  | 'publish_completed'
  | 'support_ticket_created';

export interface ProductEvent {
  id: string;
  organizationId: string;
  workspaceId?: string;
  userId: string;
  eventType: ProductEventType;
  metadata?: Record<string, string | number | boolean>;
  timestamp: string;
}

export interface ProductHealthMetrics {
  activeOrganizations: number;
  activeWorkspaces: number;
  projectsCreated: number;
  rendersCompleted: number;
  publishesCompleted: number;
  failedJobs: number;
  totalAiUsageTokens: number;
  totalStorageBytes: number;
  openSupportTickets: number;
  timestamp: string;
}

export interface FeatureAdoptionMetrics {
  studioAdoptionCount: number;
  contentFactoryAdoptionCount: number;
  publishingAdoptionCount: number;
  analyticsAdoptionCount: number;
  agencyAdoptionCount: number;
  automationAdoptionCount: number;
  totalWorkspaces: number;
  timestamp: string;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadEvents(): ProductEvent[] {
  ensureDataDir();
  if (!fs.existsSync(EVENTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveEvents(events: ProductEvent[]): void {
  ensureDataDir();
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf-8');
}

export class ProductAnalytics {
  /**
   * Track high-level product usage events without capturing sensitive PII
   */
  static async trackEvent(
    organizationId: string,
    userId: string,
    eventType: ProductEventType,
    workspaceId?: string,
    metadata?: Record<string, string | number | boolean>
  ): Promise<ProductEvent> {
    const events = loadEvents();
    const event: ProductEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId,
      workspaceId,
      userId,
      eventType,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    };

    events.push(event);
    saveEvents(events);
    return event;
  }

  /**
   * Retrieve logged product events for a tenant
   */
  static async getEvents(organizationId?: string, workspaceId?: string): Promise<ProductEvent[]> {
    let events = loadEvents();
    if (organizationId) {
      events = events.filter((e) => e.organizationId === organizationId);
    }
    if (workspaceId) {
      events = events.filter((e) => e.workspaceId === workspaceId);
    }
    return events;
  }

  /**
   * Compute real product health metrics directly from underlying stores
   * Rule Zero: No fabricated numbers.
   */
  static async getProductHealthMetrics(): Promise<ProductHealthMetrics> {
    // 1. Organizations & Workspaces
    const tenantStore = getTenantStore();
    const orgs = await tenantStore.getAllOrganizations();
    const activeOrgs = orgs.filter((o: any) => o.status === 'active').length;

    const allWorkspaces = await tenantStore.getAllWorkspaces();
    const totalWorkspaces = allWorkspaces.length;

    // 2. Projects count
    let projectsCreated = 0;
    const projectsFile = path.join(process.cwd(), 'data', 'projects.json');
    if (fs.existsSync(projectsFile)) {
      try {
        const prjs = JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
        projectsCreated = Array.isArray(prjs) ? prjs.length : 0;
      } catch {
        // Fallback to event logs
      }
    }
    const events = loadEvents();
    const projectEventsCount = events.filter((e) => e.eventType === 'project_created').length;
    projectsCreated = Math.max(projectsCreated, projectEventsCount);

    // 3. Jobs & Renders & Publishes from Job Queue
    const jobQueue = getEnterpriseJobQueue();
    const jobs = await jobQueue.listJobs();
    const rendersCompleted = jobs.filter(
      (j) => j.type === 'RENDER' && j.status === 'COMPLETED'
    ).length;
    const publishesCompleted = jobs.filter(
      (j) => j.type === 'PUBLISH' && j.status === 'COMPLETED'
    ).length;
    const failedJobs = jobs.filter(
      (j) => j.status === 'FAILED' || j.status === 'DEAD_LETTER'
    ).length;

    // 4. Token usage & Storage from metering ledger
    let totalAiTokens = 0;
    let totalStorageBytes = 0;
    const ledgerFile = path.join(DATA_DIR, 'usage_ledger.json');
    if (fs.existsSync(ledgerFile)) {
      try {
        const entries = JSON.parse(fs.readFileSync(ledgerFile, 'utf-8'));
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            if (entry.metric === 'ai_tokens') totalAiTokens += entry.amount || 0;
            if (entry.metric === 'storage_bytes') totalStorageBytes += entry.amount || 0;
          }
        }
      } catch {
        // Ignore
      }
    }

    // 5. Open support tickets
    const tickets = await SupportService.listTickets();
    const openSupportTickets = tickets.filter(
      (t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'WAITING'
    ).length;

    return {
      activeOrganizations: activeOrgs,
      activeWorkspaces: totalWorkspaces,
      projectsCreated,
      rendersCompleted,
      publishesCompleted,
      failedJobs,
      totalAiUsageTokens: totalAiTokens,
      totalStorageBytes: totalStorageBytes,
      openSupportTickets,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Measure feature adoption across distinct functional modules
   */
  static async getFeatureAdoptionMetrics(): Promise<FeatureAdoptionMetrics> {
    const tenantStore = getTenantStore();
    const allWorkspaces = await tenantStore.getAllWorkspaces();
    const totalWorkspaces = allWorkspaces.length;

    const events = loadEvents();
    const jobQueue = getEnterpriseJobQueue();
    const jobs = await jobQueue.listJobs();

    // Studio adoption: clips created or timeline versions
    const studioEvents = events.filter((e) => e.eventType === 'clip_created');
    const studioAdoptionCount = new Set(studioEvents.map((e) => e.workspaceId || e.organizationId)).size;

    // Content Factory: analysis completed or opportunities extracted
    const factoryEvents = events.filter((e) => e.eventType === 'analysis_completed');
    const contentFactoryAdoptionCount = new Set(factoryEvents.map((e) => e.workspaceId || e.organizationId)).size;

    // Publishing: publish completed or publish events
    const publishEvents = events.filter((e) => e.eventType === 'publish_completed');
    const publishingAdoptionCount = new Set(publishEvents.map((e) => e.workspaceId || e.organizationId)).size;

    // Analytics: publications with metrics
    let analyticsCount = 0;
    const analyticsFile = path.join(process.cwd(), 'data', 'analytics', 'snapshots.json');
    if (fs.existsSync(analyticsFile)) {
      try {
        const snapshots = JSON.parse(fs.readFileSync(analyticsFile, 'utf-8'));
        analyticsCount = Array.isArray(snapshots) ? snapshots.length : 0;
      } catch {
        // Ignore
      }
    }

    // Agency: Workspaces with client profiles
    let agencyCount = 0;
    const clientsFile = path.join(DATA_DIR, 'clients.json');
    if (fs.existsSync(clientsFile)) {
      try {
        const clients = JSON.parse(fs.readFileSync(clientsFile, 'utf-8'));
        if (Array.isArray(clients)) {
          agencyCount = new Set(clients.map((c: any) => c.workspaceId)).size;
        }
      } catch {
        // Ignore
      }
    }

    // Automation: Autonomous content agent executions
    const automationJobs = jobs.filter((j) => j.type === 'CONTENT_AGENT' || j.type === 'AUTONOMOUS_PLAN');
    const automationAdoptionCount = new Set(automationJobs.map((j) => j.workspaceId)).size;

    return {
      studioAdoptionCount,
      contentFactoryAdoptionCount,
      publishingAdoptionCount,
      analyticsAdoptionCount: analyticsCount > 0 ? 1 : 0,
      agencyAdoptionCount: agencyCount,
      automationAdoptionCount,
      totalWorkspaces,
      timestamp: new Date().toISOString(),
    };
  }
}
