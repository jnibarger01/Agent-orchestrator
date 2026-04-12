# Workflow Engine Design

## 1. Workflow Schema
The workflow schema defines a directed graph of execution steps. It supports tasks, conditions (branching/loops), and parallel execution.

```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  initialStep: string;
  steps: Record<string, WorkflowStep>;
}

type WorkflowStep = TaskStep | ConditionStep | ParallelStep;

interface BaseStep {
  id: string;
  type: 'task' | 'condition' | 'parallel';
}

interface TaskStep extends BaseStep {
  type: 'task';
  agentId: string;                 // The agent to execute
  inputMapping: Record<string, any>; // Maps workflow state to agent prompt/input
  nextStep?: string;               // Default next step ID
  fallbackStep?: string;           // Step to execute if retries are exhausted
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  successCondition?: Condition;    // Optional: Validate output before proceeding
  failureCondition?: Condition;    // Optional: Explicit failure trigger
}

interface ConditionStep extends BaseStep {
  type: 'condition';
  condition: Condition;
  onTrue: string;                  // Step ID if condition is met
  onFalse: string;                 // Step ID if condition is not met
}

interface ParallelStep extends BaseStep {
  type: 'parallel';
  branches: string[];              // Array of step IDs to execute concurrently
  joinStep: string;                // Step to execute after all branches complete
}

interface Condition {
  variable: string;                // e.g., "steps.reviewer.output.approved"
  operator: '==' | '!=' | '>' | '<' | 'contains';
  value: any;
}
```

## 2. Execution Model & State Machine
The engine operates as a state machine tracking a `WorkflowRun`.

**Run States:**
*   `pending`: Ready to start.
*   `running`: Currently executing steps.
*   `paused`: Waiting for external input or explicitly paused.
*   `completed`: Reached the end of the workflow successfully.
*   `failed`: Encountered an unrecoverable error or exhausted retries.

**Step States:**
Each step within a run has its own state: `pending` -> `running` -> `completed` | `failed`.
The global state context (`context`) accumulates outputs from all completed steps:
```json
{
  "inputs": { "initial_prompt": "Write a python script..." },
  "steps": {
    "coder": { "status": "completed", "output": "...", "retries": 0 },
    "reviewer": { "status": "completed", "output": { "approved": false, "feedback": "..." } }
  }
}
```

## 3. Example Workflow JSON
This example demonstrates a **Loop/Review cycle** with **fallback** and **conditional routing**.

```json
{
  "id": "code-generation-flow",
  "name": "Code Generation with Review",
  "version": "1.0.0",
  "description": "Generates code, reviews it, and loops if rejected.",
  "initialStep": "generate_code",
  "steps": {
    "generate_code": {
      "id": "generate_code",
      "type": "task",
      "agentId": "coder-agent",
      "inputMapping": {
        "prompt": "Write code for: {{inputs.task}}. Previous feedback: {{steps.review_code.output.feedback}}"
      },
      "nextStep": "review_code",
      "retryPolicy": { "maxRetries": 2, "backoffMs": 1000 },
      "fallbackStep": "human_intervention"
    },
    "review_code": {
      "id": "review_code",
      "type": "task",
      "agentId": "reviewer-agent",
      "inputMapping": {
        "prompt": "Review this code: {{steps.generate_code.output}}"
      },
      "nextStep": "check_approval"
    },
    "check_approval": {
      "id": "check_approval",
      "type": "condition",
      "condition": {
        "variable": "steps.review_code.output.approved",
        "operator": "==",
        "value": true
      },
      "onTrue": "deploy_code",
      "onFalse": "generate_code" 
    },
    "deploy_code": {
      "id": "deploy_code",
      "type": "task",
      "agentId": "deployer-agent",
      "inputMapping": { "code": "{{steps.generate_code.output}}" }
    },
    "human_intervention": {
      "id": "human_intervention",
      "type": "task",
      "agentId": "human-fallback-agent",
      "inputMapping": { "reason": "Coder agent failed after retries." }
    }
  }
}
```

## 4. Backend Execution Flow
1.  **Initialization**: API creates a `WorkflowRun` record in SQLite with initial `inputs`.
2.  **Engine Tick**: The engine loads the run, determines the current step (starting with `initialStep`).
3.  **Evaluation**:
    *   If `Task`: Maps inputs, invokes the Agent via the Provider, waits for result.
    *   If `Condition`: Evaluates the context, determines the next step ID.
    *   If `Parallel`: Spawns sub-executions for branches, waits for all, proceeds to `joinStep`.
4.  **State Update**: The result is written to the `context` in SQLite.
5.  **Transition**: The engine moves to the `nextStep` (or loops back). If no next step exists, the run is marked `completed`.

## 5. Failure Handling Strategy
*   **Retries**: If a task fails (e.g., network error, or `failureCondition` met), the engine increments the step's retry counter. If `retries < maxRetries`, it re-queues the step.
*   **Fallbacks**: If retries are exhausted, the engine checks for a `fallbackStep`. If present, execution routes there.
*   **Hard Failures**: If no fallback exists, the entire `WorkflowRun` is marked `failed`.
*   **Resumability**: Because state is committed to SQLite after *every* step transition, a crashed orchestrator process can simply query for `running` workflows on startup and resume from the last pending step.

## 6. Files/Modules to Create
*   `src/types/workflow.ts`: TypeScript interfaces for the schema.
*   `src/lib/orchestrator/workflowEngine.ts`: The core execution logic, state evaluator, and condition parser.
*   `server.ts` (Updates): Add `workflows` and `workflow_runs` tables. Add `/api/v1/workflows` and `/api/v1/workflow-runs` endpoints.
*   `tests/gateway/test_workflow_engine.py`: Integration tests.

## 7. Tests to Write
*   **Sequential**: Verify A -> B -> C execution.
*   **Branching/Condition**: Verify `onTrue` routes to X, `onFalse` routes to Y based on mocked agent output.
*   **Loop Logic**: Verify A -> B -> Condition(False) -> A -> B -> Condition(True) -> C.
*   **Retry**: Mock an agent failure, verify the engine retries N times before succeeding.
*   **Fallback**: Mock an agent failure N times, verify the engine routes to the `fallbackStep`.
