import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AssetApprovalStatus,
  ApprovalHistoryRecord,
  AssetComment,
  WorkspaceTask,
  TaskStatus,
  TaskPriority,
  WorkspaceRole,
  SaasError,
} from './types';
import { getTenantStore } from './tenantStore';

// Allowed state transitions
const VALID_TRANSITIONS: Record<AssetApprovalStatus, AssetApprovalStatus[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['CLIENT_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'],
  CLIENT_REVIEW: ['CHANGES_REQUESTED', 'APPROVED'],
  CHANGES_REQUESTED: ['DRAFT', 'IN_REVIEW'],
  APPROVED: ['SCHEDULED', 'PUBLISHED', 'IN_REVIEW'],
  SCHEDULED: ['PUBLISHED', 'APPROVED'],
  PUBLISHED: [], // Terminal state
};

export class ApprovalEngine {
  private baseDir = path.join(process.cwd(), 'data', 'saas');
  private historyFile = path.join(process.cwd(), 'data', 'saas', 'approvals.json');
  private commentsFile = path.join(process.cwd(), 'data', 'saas', 'comments.json');
  private tasksFile = path.join(process.cwd(), 'data', 'saas', 'tasks.json');

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

  // --- APPROVAL WORKFLOW ---

  async transitionApproval(
    assetId: string,
    workspaceId: string,
    currentStatus: AssetApprovalStatus,
    targetStatus: AssetApprovalStatus,
    actor: { id: string; name: string; role: WorkspaceRole },
    notes?: string
  ): Promise<ApprovalHistoryRecord> {
    const allowedTargets = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      throw new SaasError(
        'VALIDATION_ERROR',
        `Invalid approval transition from ${currentStatus} to ${targetStatus}. Allowed: [${allowedTargets.join(', ')}]`,
        400
      );
    }

    // Role gate check: Only CLIENT, APPROVER, MANAGER, ADMIN, OWNER can approve
    if (targetStatus === 'APPROVED' && !['CLIENT', 'APPROVER', 'MANAGER', 'ADMIN', 'OWNER'].includes(actor.role)) {
      throw new SaasError('FORBIDDEN', `Role ${actor.role} is not permitted to grant asset approval`, 403);
    }

    const history = this.read<ApprovalHistoryRecord>(this.historyFile);
    const transitionRecord: ApprovalHistoryRecord = {
      id: crypto.randomUUID(),
      assetId,
      workspaceId,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      notes,
      timestamp: new Date().toISOString(),
    };

    history.push(transitionRecord);
    this.write(this.historyFile, history);

    // Audit log
    const tenantStore = getTenantStore();
    const ws = await tenantStore.getWorkspace(workspaceId);
    if (ws) {
      await tenantStore.recordAudit({
        organizationId: ws.organizationId,
        workspaceId,
        actorId: actor.id,
        actorEmail: `${actor.id}@user.clipper`,
        action: `approval.status_${targetStatus.toLowerCase()}`,
        resourceType: 'asset',
        resourceId: assetId,
        metadata: { fromStatus: currentStatus, toStatus: targetStatus, notes },
      });
    }

    return transitionRecord;
  }

  async getApprovalHistory(assetId: string): Promise<ApprovalHistoryRecord[]> {
    const history = this.read<ApprovalHistoryRecord>(this.historyFile);
    return history.filter(h => h.assetId === assetId);
  }

  // --- COMMENTS & TIMESTAMPS ---

  async addComment(
    assetId: string,
    workspaceId: string,
    author: { id: string; name: string; role: WorkspaceRole },
    text: string,
    videoTimestampSeconds?: number
  ): Promise<AssetComment> {
    const comments = this.read<AssetComment>(this.commentsFile);

    // Extract @mentions
    const mentionMatches = text.match(/@([a-zA-Z0-9_-]+)/g) || [];
    const mentions = mentionMatches.map(m => m.substring(1));

    const comment: AssetComment = {
      id: crypto.randomUUID(),
      assetId,
      workspaceId,
      authorId: author.id,
      authorName: author.name,
      authorRole: author.role,
      text,
      videoTimestampSeconds,
      mentions,
      resolved: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    comments.push(comment);
    this.write(this.commentsFile, comments);
    return comment;
  }

  async listComments(assetId: string): Promise<AssetComment[]> {
    const comments = this.read<AssetComment>(this.commentsFile);
    return comments.filter(c => c.assetId === assetId);
  }

  async resolveComment(commentId: string, resolvedBy: string): Promise<AssetComment> {
    const comments = this.read<AssetComment>(this.commentsFile);
    const comment = comments.find(c => c.id === commentId);
    if (!comment) throw new SaasError('NOT_FOUND', `Comment ${commentId} not found`, 404);

    comment.resolved = true;
    comment.resolvedBy = resolvedBy;
    comment.resolvedAt = new Date().toISOString();
    comment.updatedAt = new Date().toISOString();

    this.write(this.commentsFile, comments);
    return comment;
  }

  // --- TASKS ---

  async createTask(
    workspaceId: string,
    createdById: string,
    data: {
      title: string;
      description?: string;
      assigneeId?: string;
      assigneeName?: string;
      priority?: TaskPriority;
      dueAt?: string;
      assetId?: string;
      projectId?: string;
    }
  ): Promise<WorkspaceTask> {
    const tasks = this.read<WorkspaceTask>(this.tasksFile);
    const task: WorkspaceTask = {
      id: crypto.randomUUID(),
      workspaceId,
      title: data.title,
      description: data.description,
      assigneeId: data.assigneeId,
      assigneeName: data.assigneeName,
      status: 'TODO',
      priority: data.priority || 'MEDIUM',
      dueAt: data.dueAt,
      assetId: data.assetId,
      projectId: data.projectId,
      createdById,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    tasks.push(task);
    this.write(this.tasksFile, tasks);
    return task;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<WorkspaceTask> {
    const tasks = this.read<WorkspaceTask>(this.tasksFile);
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new SaasError('NOT_FOUND', `Task ${taskId} not found`, 404);

    task.status = status;
    task.updatedAt = new Date().toISOString();
    this.write(this.tasksFile, tasks);
    return task;
  }

  async listTasks(workspaceId: string): Promise<WorkspaceTask[]> {
    const tasks = this.read<WorkspaceTask>(this.tasksFile);
    return tasks.filter(t => t.workspaceId === workspaceId);
  }
}

// Singleton
let approvalEngineInstance: ApprovalEngine | null = null;

export function getApprovalEngine(): ApprovalEngine {
  if (!approvalEngineInstance) {
    approvalEngineInstance = new ApprovalEngine();
  }
  return approvalEngineInstance;
}
