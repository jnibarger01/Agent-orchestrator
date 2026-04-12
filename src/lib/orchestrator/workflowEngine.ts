import Database from "better-sqlite3";
import { WorkflowDefinition, WorkflowRun, WorkflowStep, Condition, WorkflowContext } from "../../types/workflow";

// In a real app, this would be injected or imported from a shared DB module.
// For this slice, we accept the db instance in the constructor.
export class WorkflowEngine {
  constructor(private db: Database.Database) {}

  /**
   * Starts a new workflow run.
   */
  async startRun(workflowId: string, inputs: Record<string, any>): Promise<string> {
    const workflow = this.getWorkflow(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const runId = Math.random().toString(36).substring(7);
    const context: WorkflowContext = { inputs, steps: {} };
    const now = Date.now();

    const insert = this.db.prepare(`
      INSERT INTO workflow_runs (id, workflow_id, status, current_step_id, context_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    insert.run(runId, workflowId, 'running', workflow.initialStep, JSON.stringify(context), now, now);

    // Kick off execution asynchronously
    this.executeRun(runId).catch(console.error);

    return runId;
  }

  /**
   * Core execution loop for a workflow run.
   */
  async executeRun(runId: string): Promise<void> {
    let run = this.getRun(runId);
    if (!run || run.status !== 'running') return;

    const workflow = this.getWorkflow(run.workflowId);
    if (!workflow) {
      this.updateRunStatus(runId, 'failed');
      return;
    }

    while (run.status === 'running' && run.currentStepId) {
      const step = workflow.steps[run.currentStepId];
      if (!step) {
        this.updateRunStatus(runId, 'failed', `Step ${run.currentStepId} not found`);
        break;
      }

      // Initialize step state if not present
      if (!run.context.steps[step.id]) {
        run.context.steps[step.id] = { status: 'pending', retries: 0 };
        this.saveRunContext(runId, run.context);
      }

      try {
        const nextStepId = await this.executeStep(step, run);
        
        if (nextStepId) {
          run.currentStepId = nextStepId;
          this.updateRunCurrentStep(runId, nextStepId);
        } else {
          run.currentStepId = null;
          this.updateRunStatus(runId, 'completed');
        }
      } catch (error: any) {
        // Handle step failure, retries, and fallbacks
        const stepState = run.context.steps[step.id];
        stepState.status = 'failed';
        stepState.error = error.message;
        
        if (step.type === 'task' && step.retryPolicy && stepState.retries < step.retryPolicy.maxRetries) {
          stepState.retries++;
          this.saveRunContext(runId, run.context);
          // Simple delay for backoff
          await new Promise(res => setTimeout(res, step.retryPolicy!.backoffMs));
          continue; // Retry the loop
        } else if (step.type === 'task' && step.fallbackStep) {
          run.currentStepId = step.fallbackStep;
          this.updateRunCurrentStep(runId, step.fallbackStep);
          this.saveRunContext(runId, run.context);
        } else {
          this.updateRunStatus(runId, 'failed', `Step ${step.id} failed: ${error.message}`);
        }
      }

      // Refresh run state from DB
      run = this.getRun(runId)!;
    }
  }

  private async executeStep(step: WorkflowStep, run: WorkflowRun): Promise<string | null> {
    const stepState = run.context.steps[step.id];
    stepState.status = 'running';
    stepState.startedAt = Date.now();
    this.saveRunContext(run.id, run.context);

    let nextStepId: string | null = null;

    if (step.type === 'task') {
      // 1. Map inputs (simple template replacement for this slice)
      const mappedInput = this.mapInputs(step.inputMapping, run.context);
      
      // 2. Execute Agent (Mocked for this slice, in reality calls OrchestratorEngine/Provider)
      // We simulate agent execution based on the prompt to allow testing branching/loops
      const output = await this.mockAgentExecution(step.agentId, mappedInput);

      // 3. Check success/failure conditions
      if (step.failureCondition && this.evaluateCondition(step.failureCondition, { ...run.context, currentOutput: output })) {
        throw new Error("Failure condition met");
      }
      if (step.successCondition && !this.evaluateCondition(step.successCondition, { ...run.context, currentOutput: output })) {
        throw new Error("Success condition not met");
      }

      stepState.output = output;
      nextStepId = step.nextStep || null;

    } else if (step.type === 'condition') {
      const isTrue = this.evaluateCondition(step.condition, run.context);
      nextStepId = isTrue ? step.onTrue : step.onFalse;
      stepState.output = { evaluated: isTrue };

    } else if (step.type === 'parallel') {
      // For slice 3, we just mock parallel execution by returning a combined output
      stepState.output = { status: "parallel_branches_executed", branches: step.branches };
      nextStepId = step.joinStep;
    }

    stepState.status = 'completed';
    stepState.completedAt = Date.now();
    this.saveRunContext(run.id, run.context);

    return nextStepId;
  }

  // --- Helpers ---

  private mapInputs(mapping: Record<string, any>, context: WorkflowContext): any {
    // Very basic template replacement: "{{inputs.prompt}}" -> context.inputs.prompt
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
        const path = value.slice(2, -2).trim();
        result[key] = this.resolvePath(path, context);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  private resolvePath(path: string, obj: any): any {
    return path.split('.').reduce((prev, curr) => (prev ? prev[curr] : null), obj);
  }

  private evaluateCondition(cond: Condition, context: any): boolean {
    const actualValue = this.resolvePath(cond.variable, context);
    switch (cond.operator) {
      case '==': return actualValue === cond.value;
      case '!=': return actualValue !== cond.value;
      case '>': return actualValue > cond.value;
      case '<': return actualValue < cond.value;
      case 'contains': return Array.isArray(actualValue) ? actualValue.includes(cond.value) : String(actualValue).includes(String(cond.value));
      default: return false;
    }
  }

  private async mockAgentExecution(agentId: string, input: any): Promise<any> {
    await new Promise(res => setTimeout(res, 100));
    // For testing purposes, if the input contains a specific magic string, we return a specific output
    if (input.prompt && typeof input.prompt === 'string') {
      if (input.prompt.includes('MOCK_FAIL')) throw new Error("Mocked agent failure");
      if (input.prompt.includes('MOCK_APPROVE')) return { approved: true, feedback: "Looks good" };
      if (input.prompt.includes('MOCK_REJECT')) return { approved: false, feedback: "Needs work" };
    }
    return { result: `Executed by ${agentId}`, received: input };
  }

  // --- DB Accessors ---

  private getWorkflow(id: string): WorkflowDefinition | null {
    const row = this.db.prepare("SELECT * FROM workflows WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      description: row.description,
      initialStep: row.initial_step,
      steps: JSON.parse(row.steps_json)
    };
  }

  private getRun(id: string): WorkflowRun | null {
    const row = this.db.prepare("SELECT * FROM workflow_runs WHERE id = ?").get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      workflowId: row.workflow_id,
      status: row.status,
      currentStepId: row.current_step_id,
      context: JSON.parse(row.context_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private updateRunStatus(id: string, status: string, error?: string) {
    this.db.prepare("UPDATE workflow_runs SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), id);
    if (error) {
       // In a real system, we'd log this to a run_logs table. For now, we just update status.
       console.error(`Run ${id} failed: ${error}`);
    }
  }

  private updateRunCurrentStep(id: string, stepId: string) {
    this.db.prepare("UPDATE workflow_runs SET current_step_id = ?, updated_at = ? WHERE id = ?").run(stepId, Date.now(), id);
  }

  private saveRunContext(id: string, context: WorkflowContext) {
    this.db.prepare("UPDATE workflow_runs SET context_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(context), Date.now(), id);
  }
}
