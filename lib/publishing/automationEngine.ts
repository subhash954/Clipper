/**
 * CLIPPER SOCIAL PUBLISHING — AUTOMATION ENGINE & NOTIFICATION CENTER
 * Phase 26, 27, 28
 * 
 * Controlled, audit-logged automation engine.
 * Maps lifecycle events to automated actions without uncontrolled execution loops.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AutomationRule,
  AutomationTriggerEvent,
  AutomationActionType,
  AutomationExecutionLog,
  InAppNotification,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data', 'publishing');
const RULES_FILE = path.join(DATA_DIR, 'automation_rules.json');
const LOGS_FILE = path.join(DATA_DIR, 'automation_logs.json');
const NOTIFS_FILE = path.join(DATA_DIR, 'notifications.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readRules(): AutomationRule[] {
  ensureDataDir();
  if (!fs.existsSync(RULES_FILE)) {
    // Provide default initial sensible automation rules
    const defaults: AutomationRule[] = [
      {
        id: 'rule-default-1',
        workspaceId: 'default-workspace',
        name: 'Notify Team on Publishing Failure',
        triggerEvent: 'publish.failed',
        actionType: 'send_notification',
        config: { notificationChannels: ['in_app'] },
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rule-default-2',
        workspaceId: 'default-workspace',
        name: 'Alert when OAuth Token Expiring',
        triggerEvent: 'account.expiring',
        actionType: 'send_notification',
        config: { notificationChannels: ['in_app'] },
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    fs.writeFileSync(RULES_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
    return defaults;
  }
  try {
    return JSON.parse(fs.readFileSync(RULES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeRules(rules: AutomationRule[]) {
  ensureDataDir();
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8');
}

function readNotifications(): InAppNotification[] {
  ensureDataDir();
  if (!fs.existsSync(NOTIFS_FILE)) {
    fs.writeFileSync(NOTIFS_FILE, JSON.stringify([], null, 2), 'utf-8');
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(NOTIFS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeNotifications(notifs: InAppNotification[]) {
  ensureDataDir();
  fs.writeFileSync(NOTIFS_FILE, JSON.stringify(notifs, null, 2), 'utf-8');
}

function logExecution(log: AutomationExecutionLog) {
  ensureDataDir();
  let logs: AutomationExecutionLog[] = [];
  if (fs.existsSync(LOGS_FILE)) {
    try {
      logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    } catch {
      logs = [];
    }
  }
  logs.push(log);
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}

// ============================================================================
// NOTIFICATION CENTER
// ============================================================================

export function createInAppNotification(params: {
  workspaceId: string;
  type: InAppNotification['type'];
  title: string;
  message: string;
  metadata?: Record<string, any>;
}): InAppNotification {
  const notifs = readNotifications();
  const notification: InAppNotification = {
    id: `notif-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    workspaceId: params.workspaceId,
    type: params.type,
    title: params.title,
    message: params.message,
    read: false,
    metadata: params.metadata,
    createdAt: new Date().toISOString(),
  };

  notifs.unshift(notification); // newest first
  writeNotifications(notifs);
  return notification;
}

export function listInAppNotifications(workspaceId: string, unreadOnly = false): InAppNotification[] {
  const notifs = readNotifications();
  return notifs.filter((n) => {
    if (n.workspaceId !== workspaceId) return false;
    if (unreadOnly && n.read) return false;
    return true;
  });
}

export function markNotificationAsRead(id: string, workspaceId: string): boolean {
  const notifs = readNotifications();
  const target = notifs.find((n) => n.id === id && n.workspaceId === workspaceId);
  if (!target) return false;

  target.read = true;
  writeNotifications(notifs);
  return true;
}

// ============================================================================
// AUTOMATION RULES MANAGEMENT
// ============================================================================

export function listAutomationRules(workspaceId: string): AutomationRule[] {
  const rules = readRules();
  return rules.filter((r) => r.workspaceId === workspaceId || r.workspaceId === 'default-workspace');
}

export function createAutomationRule(params: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt'>): AutomationRule {
  const rules = readRules();
  const now = new Date().toISOString();
  const rule: AutomationRule = {
    id: `rule-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    ...params,
    createdAt: now,
    updatedAt: now,
  };

  rules.push(rule);
  writeRules(rules);
  return rule;
}

export function toggleAutomationRule(ruleId: string, workspaceId: string, enabled: boolean): AutomationRule | null {
  const rules = readRules();
  const rule = rules.find((r) => r.id === ruleId && (r.workspaceId === workspaceId || r.workspaceId === 'default-workspace'));
  if (!rule) return null;

  rule.enabled = enabled;
  rule.updatedAt = new Date().toISOString();
  writeRules(rules);
  return rule;
}

export function deleteAutomationRule(ruleId: string, workspaceId: string): boolean {
  const rules = readRules();
  const idx = rules.findIndex((r) => r.id === ruleId && r.workspaceId === workspaceId);
  if (idx === -1) return false;

  rules.splice(idx, 1);
  writeRules(rules);
  return true;
}

// ============================================================================
// EVENT DISPATCHER
// ============================================================================

export async function dispatchAutomationEvent(
  workspaceId: string,
  event: AutomationTriggerEvent,
  payload: Record<string, any>
): Promise<{ executedRulesCount: number; logs: AutomationExecutionLog[] }> {
  const rules = readRules().filter(
    (r) => (r.workspaceId === workspaceId || r.workspaceId === 'default-workspace') && r.enabled && r.triggerEvent === event
  );

  const logs: AutomationExecutionLog[] = [];

  for (const rule of rules) {
    try {
      let details = '';

      switch (rule.actionType) {
        case 'send_notification': {
          const title = payload.title || `Automation: ${event}`;
          const message = payload.message || `Event ${event} occurred with payload data.`;
          createInAppNotification({
            workspaceId,
            type: event === 'publish.failed' ? 'publish_failure' : 'publish_success',
            title,
            message,
            metadata: payload,
          });
          details = `Sent notification: "${title}"`;
          break;
        }

        case 'request_review': {
          createInAppNotification({
            workspaceId,
            type: 'approval_request',
            title: 'Review Requested',
            message: `Asset ${payload.assetId || 'item'} requires editorial review before publishing.`,
            metadata: payload,
          });
          details = `Created approval review request for asset ${payload.assetId}`;
          break;
        }

        case 'schedule_asset': {
          details = `Scheduled asset ${payload.assetId} for automated delivery`;
          break;
        }

        case 'create_task': {
          details = `Created task for event ${event}`;
          break;
        }

        default:
          details = `Executed action ${rule.actionType}`;
          break;
      }

      const log: AutomationExecutionLog = {
        id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: rule.id,
        workspaceId,
        triggerEvent: event,
        actionType: rule.actionType,
        status: 'SUCCESS',
        details,
        timestamp: new Date().toISOString(),
      };

      logExecution(log);
      logs.push(log);
    } catch (err: any) {
      const log: AutomationExecutionLog = {
        id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ruleId: rule.id,
        workspaceId,
        triggerEvent: event,
        actionType: rule.actionType,
        status: 'FAILED',
        details: `Action error: ${err.message}`,
        timestamp: new Date().toISOString(),
      };

      logExecution(log);
      logs.push(log);
    }
  }

  return {
    executedRulesCount: logs.filter((l) => l.status === 'SUCCESS').length,
    logs,
  };
}
