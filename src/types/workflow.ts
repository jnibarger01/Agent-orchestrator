export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  initialStep: string;
  steps: Record<string, WorkflowStep>;
}

export type WorkflowStep = TaskStep | ConditionStep | ParallelStep;

export interface BaseStep {
  id: string;
  type: 'task' | 'condition' | 'parallel';
}

export interface TaskStep extends BaseStep {
  type: 'task';
  agentId: string;
  inputMapping: Record<string, any>;
  nextStep?: string;
  fallbackStep?: string;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  successCondition?: Condition;
  failureCondition?: Condition;
}

export interface ConditionStep extends BaseStep {
  type: 'condition';
  condition: Condition;
  onTrue: string;
  onFalse: string;
}

export interface ParallelStep extends BaseStep {
  type: 'parallel';
  branches: string[];
  joinStep: string;
}

export interface Condition {
  variable: string;
  operator: '==' | '!=' | '>' | '<' | 'contains';
  value: any;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStepId: string | null;
  context: WorkflowContext;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowContext {
  inputs: Record<string, any>;
  steps: Record<string, StepState>;
}

export interface StepState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
  retries: number;
  startedAt?: number;
  completedAt?: number;
}
