import fs from 'fs';
import path from 'path';
import { SupportTicket, TicketMessage, TicketStatus, TicketPriority, TicketCategory } from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'saas');
const TICKETS_FILE = path.join(DATA_DIR, 'support_tickets.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'support_messages.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadTickets(): SupportTicket[] {
  ensureDataDir();
  if (!fs.existsSync(TICKETS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveTickets(tickets: SupportTicket[]): void {
  ensureDataDir();
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf-8');
}

function loadMessages(): TicketMessage[] {
  ensureDataDir();
  if (!fs.existsSync(MESSAGES_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMessages(messages: TicketMessage[]): void {
  ensureDataDir();
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2), 'utf-8');
}

export interface CreateTicketInput {
  organizationId: string;
  workspaceId?: string;
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  category: TicketCategory;
  priority?: TicketPriority;
  resourceType?: string;
  resourceId?: string;
}

export interface TicketFilter {
  organizationId?: string;
  workspaceId?: string;
  userId?: string;
  status?: TicketStatus;
  category?: TicketCategory;
}

/**
 * Valid ticket status lifecycle transitions
 * OPEN -> IN_PROGRESS -> WAITING -> RESOLVED -> CLOSED
 */
const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['WAITING', 'RESOLVED', 'CLOSED'],
  WAITING: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['OPEN'], // Reopening allowed if necessary
};

export class SupportService {
  /**
   * Create a new support ticket linked to organization, workspace, user, and optional resource
   */
  static async createTicket(input: CreateTicketInput): Promise<SupportTicket> {
    const tickets = loadTickets();
    const id = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const ticket: SupportTicket = {
      id,
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      userEmail: input.userEmail,
      subject: input.subject,
      message: input.message,
      category: input.category,
      priority: input.priority || 'medium',
      status: 'OPEN',
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      createdAt: now,
      updatedAt: now,
    };

    tickets.push(ticket);
    saveTickets(tickets);

    // Initial message
    const messages = loadMessages();
    messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ticketId: id,
      authorId: input.userId,
      authorEmail: input.userEmail,
      authorRole: 'USER',
      message: input.message,
      createdAt: now,
    });
    saveMessages(messages);

    return ticket;
  }

  /**
   * Get ticket by ID
   */
  static async getTicket(id: string): Promise<SupportTicket | null> {
    const tickets = loadTickets();
    return tickets.find((t) => t.id === id) || null;
  }

  /**
   * List tickets with optional tenant / status filter
   */
  static async listTickets(filter: TicketFilter = {}): Promise<SupportTicket[]> {
    let tickets = loadTickets();
    if (filter.organizationId) {
      tickets = tickets.filter((t) => t.organizationId === filter.organizationId);
    }
    if (filter.workspaceId) {
      tickets = tickets.filter((t) => t.workspaceId === filter.workspaceId);
    }
    if (filter.userId) {
      tickets = tickets.filter((t) => t.userId === filter.userId);
    }
    if (filter.status) {
      tickets = tickets.filter((t) => t.status === filter.status);
    }
    if (filter.category) {
      tickets = tickets.filter((t) => t.category === filter.category);
    }
    return tickets;
  }

  /**
   * Advance or update ticket status following the state machine
   */
  static async updateTicketStatus(
    id: string,
    newStatus: TicketStatus,
    resolutionNotes?: string
  ): Promise<SupportTicket> {
    const tickets = loadTickets();
    const index = tickets.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Ticket ${id} not found`);
    }

    const currentTicket = tickets[index];
    const allowed = VALID_TRANSITIONS[currentTicket.status];
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentTicket.status} to ${newStatus}. Allowed: ${allowed.join(', ')}`
      );
    }

    currentTicket.status = newStatus;
    currentTicket.updatedAt = new Date().toISOString();
    if (resolutionNotes) {
      currentTicket.resolutionNotes = resolutionNotes;
    }

    tickets[index] = currentTicket;
    saveTickets(tickets);
    return currentTicket;
  }

  /**
   * Append a reply to the ticket thread
   */
  static async addMessage(
    ticketId: string,
    authorId: string,
    authorEmail: string,
    authorRole: string,
    message: string
  ): Promise<TicketMessage> {
    const tickets = loadTickets();
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const messages = loadMessages();
    const newMessage: TicketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ticketId,
      authorId,
      authorEmail,
      authorRole,
      message,
      createdAt: new Date().toISOString(),
    };

    messages.push(newMessage);
    saveMessages(messages);

    // Update ticket updatedAt
    ticket.updatedAt = newMessage.createdAt;
    saveTickets(tickets);

    return newMessage;
  }

  /**
   * Retrieve all messages for a ticket
   */
  static async getMessages(ticketId: string): Promise<TicketMessage[]> {
    const messages = loadMessages();
    return messages.filter((m) => m.ticketId === ticketId);
  }
}
