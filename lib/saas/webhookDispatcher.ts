import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  WebhookEndpoint,
  WebhookDeliveryLog,
  OutgoingWebhookEvent,
  SaasError,
} from './types';

export class WebhookDispatcher {
  private baseDir = path.join(process.cwd(), 'data', 'saas');
  private endpointsFile = path.join(process.cwd(), 'data', 'saas', 'webhook_endpoints.json');
  private logsFile = path.join(process.cwd(), 'data', 'saas', 'webhook_logs.json');

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

  async createEndpoint(
    workspaceId: string,
    url: string,
    events: OutgoingWebhookEvent[]
  ): Promise<WebhookEndpoint> {
    const endpoints = this.read<WebhookEndpoint>(this.endpointsFile);
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const endpoint: WebhookEndpoint = {
      id: crypto.randomUUID(),
      workspaceId,
      url,
      secret,
      events,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    endpoints.push(endpoint);
    this.write(this.endpointsFile, endpoints);
    return endpoint;
  }

  async listEndpoints(workspaceId: string): Promise<WebhookEndpoint[]> {
    const endpoints = this.read<WebhookEndpoint>(this.endpointsFile);
    return endpoints.filter(e => e.workspaceId === workspaceId);
  }

  async deleteEndpoint(id: string, workspaceId: string): Promise<boolean> {
    let endpoints = this.read<WebhookEndpoint>(this.endpointsFile);
    const initialLen = endpoints.length;
    endpoints = endpoints.filter(e => !(e.id === id && e.workspaceId === workspaceId));
    this.write(this.endpointsFile, endpoints);
    return endpoints.length < initialLen;
  }

  /**
   * Dispatches an event to all subscribed endpoints with HMAC-SHA256 signature
   */
  async dispatchEvent(
    workspaceId: string,
    event: OutgoingWebhookEvent,
    payload: any
  ): Promise<WebhookDeliveryLog[]> {
    const endpoints = this.read<WebhookEndpoint>(this.endpointsFile);
    const subscribers = endpoints.filter(e => e.workspaceId === workspaceId && e.enabled && e.events.includes(event));

    const deliveryLogs = this.read<WebhookDeliveryLog>(this.logsFile);
    const results: WebhookDeliveryLog[] = [];

    const rawPayload = JSON.stringify({
      id: crypto.randomUUID(),
      event,
      timestamp: new Date().toISOString(),
      workspaceId,
      data: payload,
    });

    for (const ep of subscribers) {
      const startTime = Date.now();
      const signature = crypto
        .createHmac('sha256', ep.secret)
        .update(rawPayload)
        .digest('hex');

      let success = true;
      let statusCode = 200;
      let errorMsg: string | undefined;

      try {
        // Attempt HTTP POST if not in test dummy mode
        if (ep.url.startsWith('http://') || ep.url.startsWith('https://')) {
          const res = await fetch(ep.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Clipper-Signature': `sha256=${signature}`,
              'X-Clipper-Event': event,
              'X-Clipper-Delivery-Id': crypto.randomUUID(),
            },
            body: rawPayload,
            signal: AbortSignal.timeout(5000), // 5s timeout
          });
          statusCode = res.status;
          success = res.ok;
          if (!res.ok) {
            errorMsg = `Endpoint returned HTTP status ${res.status}`;
          }
        }
      } catch (err: any) {
        success = false;
        statusCode = 500;
        errorMsg = err.message || 'Network dispatch failed';
      }

      const log: WebhookDeliveryLog = {
        id: crypto.randomUUID(),
        endpointId: ep.id,
        workspaceId,
        event,
        payload,
        statusCode,
        durationMs: Date.now() - startTime,
        success,
        error: errorMsg,
        deliveredAt: new Date().toISOString(),
      };

      deliveryLogs.push(log);
      results.push(log);

      ep.lastTriggeredAt = new Date().toISOString();
    }

    this.write(this.endpointsFile, endpoints);
    this.write(this.logsFile, deliveryLogs);
    return results;
  }

  async listDeliveryLogs(workspaceId: string): Promise<WebhookDeliveryLog[]> {
    const logs = this.read<WebhookDeliveryLog>(this.logsFile);
    return logs.filter(l => l.workspaceId === workspaceId).slice(-100);
  }
}

// Singleton
let webhookDispatcherInstance: WebhookDispatcher | null = null;

export function getWebhookDispatcher(): WebhookDispatcher {
  if (!webhookDispatcherInstance) {
    webhookDispatcherInstance = new WebhookDispatcher();
  }
  return webhookDispatcherInstance;
}
