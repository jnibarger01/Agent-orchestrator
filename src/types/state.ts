export interface SharedState {
  runId: string;
  version: number;
  globalContext: Record<string, any>;
  tasks: Record<string, TaskState>;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

export interface TaskState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputs: Record<string, any>;
  intermediateOutputs: Record<string, any>;
  finalOutput?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface Artifact {
  id: string;
  runId: string;
  stepId: string;
  name: string;
  type: 'code' | 'markdown' | 'json' | 'image';
  content: string;
  createdAt: number;
}

export interface AuditLogEntry {
  id: string;
  runId: string;
  action: string;
  details: any;
  createdAt: number;
}
