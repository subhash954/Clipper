import { CanonicalRenderSpec, EditorCommand, EditorCommandType } from './types';

export interface CommandHistoryState {
  past: EditorCommand[];
  future: EditorCommand[];
  currentSpec: CanonicalRenderSpec;
}

export class EditorCommandManager {
  private past: EditorCommand[] = [];
  private future: EditorCommand[] = [];
  private currentSpec: CanonicalRenderSpec;
  private maxHistory: number = 50;

  constructor(initialSpec: CanonicalRenderSpec, maxHistory: number = 50) {
    this.currentSpec = initialSpec;
    this.maxHistory = maxHistory;
  }

  public getSpec(): CanonicalRenderSpec {
    return this.currentSpec;
  }

  public setSpec(spec: CanonicalRenderSpec): void {
    this.currentSpec = spec;
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public executeCommand(command: EditorCommand): CanonicalRenderSpec {
    const nextSpec = command.execute(this.currentSpec);
    this.past.push(command);
    if (this.past.length > this.maxHistory) {
      this.past.shift();
    }
    // Any new edit clears the redo stack
    this.future = [];
    this.currentSpec = nextSpec;
    return this.currentSpec;
  }

  public undo(): CanonicalRenderSpec | null {
    if (!this.canUndo()) return null;
    const command = this.past.pop()!;
    const prevSpec = command.undo(this.currentSpec);
    this.future.unshift(command);
    this.currentSpec = prevSpec;
    return this.currentSpec;
  }

  public redo(): CanonicalRenderSpec | null {
    if (!this.canRedo()) return null;
    const command = this.future.shift()!;
    const nextSpec = command.execute(this.currentSpec);
    this.past.push(command);
    this.currentSpec = nextSpec;
    return this.currentSpec;
  }

  public getHistorySummary(): {
    undoCount: number;
    redoCount: number;
    lastCommand?: string;
  } {
    return {
      undoCount: this.past.length,
      redoCount: this.future.length,
      lastCommand: this.past.length > 0 ? this.past[this.past.length - 1].description : undefined,
    };
  }

  public clear(): void {
    this.past = [];
    this.future = [];
  }
}

/**
 * Factory helper to construct deterministic undoable EditorCommand instances
 */
export function createEditorCommand(params: {
  type: EditorCommandType;
  description: string;
  execute: (spec: CanonicalRenderSpec) => CanonicalRenderSpec;
  undo: (spec: CanonicalRenderSpec) => CanonicalRenderSpec;
}): EditorCommand {
  return {
    id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: params.type,
    description: params.description,
    execute: params.execute,
    undo: params.undo,
    timestamp: new Date().toISOString(),
  };
}
