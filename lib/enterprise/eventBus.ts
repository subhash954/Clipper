import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DomainEvent, OutboxRecord } from './types';

export class EnterpriseEventBus {
  private baseDir = path.join(process.cwd(), 'data', 'enterprise');
  private outboxFile = path.join(process.cwd(), 'data', 'enterprise', 'outbox.json');
  private processedEventsFile = path.join(process.cwd(), 'data', 'enterprise', 'processed_events.json');
  private handlers = new Map<string, ((event: DomainEvent) => Promise<void>)[]>();

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

  /**
   * Publishes domain event to transactional outbox (Phase 37)
   */
  async publishEvent<TPayload = any>(
    eventType: string,
    organizationId: string,
    workspaceId: string,
    payload: TPayload,
    idempotencyKey?: string
  ): Promise<DomainEvent<TPayload>> {
    const eventId = crypto.randomUUID();
    const event: DomainEvent<TPayload> = {
      eventId,
      eventType,
      organizationId,
      workspaceId,
      payload,
      idempotencyKey: idempotencyKey || eventId,
      version: '1.0',
      timestamp: new Date().toISOString(),
    };

    const outbox = this.read<OutboxRecord>(this.outboxFile);
    outbox.push({
      id: crypto.randomUUID(),
      eventId,
      eventType,
      payload: event,
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date().toISOString(),
    });
    this.write(this.outboxFile, outbox);

    return event;
  }

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    const list = this.handlers.get(eventType) || [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  /**
   * Dispatches pending events from transactional outbox to consumers idempotently
   */
  async processOutbox(): Promise<{ processedCount: number; errorsCount: number }> {
    const outbox = this.read<OutboxRecord>(this.outboxFile);
    const processedEvents = this.read<string>(this.processedEventsFile);

    let processedCount = 0;
    let errorsCount = 0;

    for (const record of outbox) {
      if (record.status === 'PUBLISHED') continue;

      const event: DomainEvent = record.payload;

      // Idempotency check: if already processed, mark published and skip
      if (processedEvents.includes(event.idempotencyKey)) {
        record.status = 'PUBLISHED';
        continue;
      }

      const handlers = this.handlers.get(record.eventType) || [];
      try {
        for (const handler of handlers) {
          await handler(event);
        }

        record.status = 'PUBLISHED';
        record.lastAttemptAt = new Date().toISOString();
        processedEvents.push(event.idempotencyKey);
        processedCount += 1;
      } catch (err: any) {
        record.attempts += 1;
        record.lastAttemptAt = new Date().toISOString();
        if (record.attempts >= 3) {
          record.status = 'FAILED';
        }
        errorsCount += 1;
      }
    }

    this.write(this.outboxFile, outbox);
    this.write(this.processedEventsFile, processedEvents);

    return { processedCount, errorsCount };
  }
}

// Singleton
let eventBusInstance: EnterpriseEventBus | null = null;

export function getEnterpriseEventBus(): EnterpriseEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EnterpriseEventBus();
  }
  return eventBusInstance;
}
