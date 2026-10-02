import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AutonomousAgentPlan,
  AgentActionType,
  AutomationWorkflow,
  WorkflowExecutionRun,
  WorkflowNode,
} from './types';
import { getEnterpriseJobQueue } from './jobQueue';

export interface WorkspaceContentMemory {
  workspaceId: string;
  brandVoice: string;
  contentPillars: string[];
  approvedTerminology: string[];
  bannedTerminology: string[];
  successfulPatterns: string[];
}

export class AutonomousContentAgent {
  private baseDir = path.join(process.cwd(), 'data', 'enterprise');
  private plansFile = path.join(process.cwd(), 'data', 'enterprise', 'agent_plans.json');
  private memoryFile = path.join(process.cwd(), 'data', 'enterprise', 'workspace_memory.json');
  private workflowsFile = path.join(process.cwd(), 'data', 'enterprise', 'workflows.json');
  private runsFile = path.join(process.cwd(), 'data', 'enterprise', 'workflow_runs.json');

  // Hard safety limit on workflow chain depth to prevent runaway loops (Phase 49)
  private readonly MAX_EXECUTION_DEPTH = 10;

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

  // --- CONTENT MEMORY ---

  async saveMemory(memory: WorkspaceContentMemory): Promise<void> {
    let memories = this.read<WorkspaceContentMemory>(this.memoryFile);
    memories = memories.filter(m => m.workspaceId !== memory.workspaceId);
    memories.push(memory);
    this.write(this.memoryFile, memories);
  }

  async getMemory(workspaceId: string): Promise<WorkspaceContentMemory> {
    const memories = this.read<WorkspaceContentMemory>(this.memoryFile);
    const found = memories.find(m => m.workspaceId === workspaceId);
    if (found) return found;

    return {
      workspaceId,
      brandVoice: 'Authoritative, concise, insight-driven',
      contentPillars: ['Engineering', 'SaaS Growth', 'Architecture'],
      approvedTerminology: ['scalable', 'deterministic', 'fault-tolerant'],
      bannedTerminology: ['guru', 'hack', 'magic', 'guaranteed overnight'],
      successfulPatterns: ['Contrarian opening statements', 'Under 30s clips with visual B-roll'],
    };
  }

  // --- AUTONOMOUS ACTION PLANNER & HUMAN APPROVAL BOUNDARY ---

  /**
   * Constructs an autonomous plan for a source project.
   * Marks external publishing as strictly requiring human approval.
   */
  async createAutonomousPlan(
    organizationId: string,
    workspaceId: string,
    sourceProjectId: string
  ): Promise<AutonomousAgentPlan> {
    const plans = this.read<AutonomousAgentPlan>(this.plansFile);

    const plan: AutonomousAgentPlan = {
      planId: crypto.randomUUID(),
      organizationId,
      workspaceId,
      sourceProjectId,
      status: 'PLANNING',
      requiresHumanApproval: true,
      steps: [
        {
          stepId: 'step-1',
          action: 'ANALYZE_SOURCE',
          params: { projectId: sourceProjectId },
          status: 'PENDING',
        },
        {
          stepId: 'step-2',
          action: 'EXTRACT_OPPORTUNITIES',
          params: { targetCount: 5 },
          status: 'PENDING',
        },
        {
          stepId: 'step-3',
          action: 'GENERATE_VARIANTS',
          params: { platforms: ['youtube_shorts', 'tiktok', 'linkedin'] },
          status: 'PENDING',
        },
        {
          stepId: 'step-4',
          action: 'COMPILE_RENDERSPEC',
          params: { format: '9:16', addSubtitles: true },
          status: 'PENDING',
        },
        {
          stepId: 'step-5',
          action: 'REQUEST_HUMAN_APPROVAL',
          params: { requireClientSignoff: true },
          status: 'PENDING',
        },
        {
          stepId: 'step-6',
          action: 'PUBLISH_TO_PLATFORM',
          params: { scheduledPublish: true },
          status: 'PENDING',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    plans.push(plan);
    this.write(this.plansFile, plans);
    return plan;
  }

  /**
   * Executes steps in sequence until hitting the HUMAN APPROVAL boundary
   */
  async executePlan(planId: string): Promise<AutonomousAgentPlan> {
    const plans = this.read<AutonomousAgentPlan>(this.plansFile);
    const plan = plans.find(p => p.planId === planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    plan.status = 'EXECUTING';

    for (const step of plan.steps) {
      if (step.status === 'COMPLETED') continue;

      // HUMAN APPROVAL BOUNDARY: Stop automatically before high-risk external publishing!
      if (step.action === 'REQUEST_HUMAN_APPROVAL' || step.action === 'PUBLISH_TO_PLATFORM') {
        if (!plan.approvalGrantedBy) {
          step.status = 'REQUIRES_APPROVAL';
          plan.status = 'REQUIRES_APPROVAL';
          plan.updatedAt = new Date().toISOString();
          this.write(this.plansFile, plans);
          return plan; // Strictly HALTS here!
        }
      }

      // Execute safe autonomous step
      step.status = 'RUNNING';
      if (step.action === 'ANALYZE_SOURCE') {
        step.result = { transcriptWords: 450, speakers: 2 };
      } else if (step.action === 'EXTRACT_OPPORTUNITIES') {
        step.result = { opportunitiesDiscovered: 4 };
      } else if (step.action === 'GENERATE_VARIANTS') {
        step.result = { variantsCreated: 6 };
      } else if (step.action === 'COMPILE_RENDERSPEC') {
        step.result = { renderSpecId: `rs-${Date.now()}` };
      } else if (step.action === 'PUBLISH_TO_PLATFORM') {
        step.result = { publicationQueued: true };
      }

      step.status = 'COMPLETED';
    }

    plan.status = 'COMPLETED';
    plan.updatedAt = new Date().toISOString();
    this.write(this.plansFile, plans);
    return plan;
  }

  /**
   * Human operator reviews and explicitly grants approval to proceed past the safety boundary
   */
  async grantHumanApproval(planId: string, approverUserId: string): Promise<AutonomousAgentPlan> {
    const plans = this.read<AutonomousAgentPlan>(this.plansFile);
    const plan = plans.find(p => p.planId === planId);
    if (!plan) throw new Error(`Plan ${planId} not found`);

    plan.approvalGrantedBy = approverUserId;
    plan.approvalGrantedAt = new Date().toISOString();

    const approvalStep = plan.steps.find(s => s.action === 'REQUEST_HUMAN_APPROVAL');
    if (approvalStep) {
      approvalStep.status = 'COMPLETED';
      approvalStep.result = { approvedBy: approverUserId, approvedAt: plan.approvalGrantedAt };
    }

    this.write(this.plansFile, plans);

    // Resume execution
    return this.executePlan(planId);
  }

  // --- WORKFLOW DAG ENGINE (Phase 83 - 88) ---

  async createWorkflow(
    organizationId: string,
    workspaceId: string,
    title: string,
    nodes: WorkflowNode[],
    entryNodeId: string
  ): Promise<AutomationWorkflow> {
    const workflows = this.read<AutomationWorkflow>(this.workflowsFile);
    const wf: AutomationWorkflow = {
      id: crypto.randomUUID(),
      organizationId,
      workspaceId,
      title,
      version: 1,
      status: 'ACTIVE',
      nodes,
      entryNodeId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    workflows.push(wf);
    this.write(this.workflowsFile, workflows);
    return wf;
  }

  /**
   * Executes a visual DAG workflow with recursion depth protection
   */
  async runWorkflow(workflowId: string, initialContext: Record<string, any> = {}): Promise<WorkflowExecutionRun> {
    const workflows = this.read<AutomationWorkflow>(this.workflowsFile);
    const wf = workflows.find(w => w.id === workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found`);

    const runs = this.read<WorkflowExecutionRun>(this.runsFile);
    const run: WorkflowExecutionRun = {
      runId: crypto.randomUUID(),
      workflowId,
      workspaceId: wf.workspaceId,
      status: 'RUNNING',
      currentNodeId: wf.entryNodeId,
      nodeHistory: [],
      context: { ...initialContext },
      startedAt: new Date().toISOString(),
    };

    let currentNode = wf.nodes.find(n => n.id === wf.entryNodeId);
    let depth = 0;

    while (currentNode && depth < this.MAX_EXECUTION_DEPTH) {
      depth += 1;
      const start = Date.now();

      // Check for human approval node
      if (currentNode.type === 'HUMAN_APPROVAL') {
        run.status = 'WAITING_FOR_APPROVAL';
        run.currentNodeId = currentNode.id;
        run.nodeHistory.push({
          nodeId: currentNode.id,
          status: 'AWAITING_APPROVAL',
          durationMs: Date.now() - start,
          timestamp: new Date().toISOString(),
        });
        runs.push(run);
        this.write(this.runsFile, runs);
        return run; // Pause execution durably
      }

      // Normal node execution
      run.nodeHistory.push({
        nodeId: currentNode.id,
        status: 'SUCCESS',
        output: { processed: true, depth },
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });

      // Move to next node if any
      const nextId = currentNode.nextNodes[0];
      if (!nextId) break;
      currentNode = wf.nodes.find(n => n.id === nextId);
    }

    run.status = 'COMPLETED';
    run.completedAt = new Date().toISOString();
    runs.push(run);
    this.write(this.runsFile, runs);
    return run;
  }
}

// Singleton
let autonomousAgentInstance: AutonomousContentAgent | null = null;

export function getAutonomousContentAgent(): AutonomousContentAgent {
  if (!autonomousAgentInstance) {
    autonomousAgentInstance = new AutonomousContentAgent();
  }
  return autonomousAgentInstance;
}
