# Shared State Layer Design

## 1. State Model
The shared state layer acts as the central source of truth for a workflow run. It replaces loose untyped blobs with a strictly typed hierarchy.

```typescript
interface SharedState {
  runId: string;
  version: number;             // For Optimistic Concurrency Control
  globalContext: Record<string, any>; // High-level workflow variables
  tasks: Record<string, TaskState>;   // State scoped to individual tasks/agents
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
}

interface TaskState {
  status: 'pending' | 'running' | 'completed' | 'failed';
  inputs: Record<string, any>;
  intermediateOutputs: Record<string, any>; // Ephemeral/scratchpad data
  finalOutput?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

interface Artifact {
  id: string;
  runId: string;
  stepId: string;
  name: string;
  type: 'code' | 'markdown' | 'json' | 'image';
  content: string; // Or a storage URI for large blobs
  createdAt: number;
}

interface AuditLog {
  id: string;
  runId: string;
  action: string; // e.g., "STATE_UPDATE", "ARTIFACT_CREATED", "TASK_STARTED"
  details: any;   // Diff or metadata
  createdAt: number;
}
```

## 2. Storage Strategy
*   **Persisted State (SQLite):**
    *   `run_states` table: Stores the `SharedState` JSON blob along with a `version` integer.
    *   `artifacts` table: Stores discrete outputs (files, code blocks) separately to prevent the main state blob from bloating.
    *   `audit_logs` table: Append-only ledger of all state mutations.
*   **Ephemeral State (In-Memory):**
    *   High-frequency updates (e.g., streaming LLM tokens, rapid scratchpad edits) are held in memory by the `StateManager` and flushed to SQLite periodically or on significant transitions (e.g., task completion).

## 3. Read/Write Patterns
*   **Namespacing:** Agents can only write to their specific `tasks[taskId]` namespace or emit discrete `Artifacts`. They cannot overwrite the `globalContext` directly unless explicitly permitted by the workflow engine.
*   **Patching:** Writes are performed as JSON patches rather than full replacements to minimize data transfer and collision risk.
*   **Immutability:** Audit logs and Artifacts are append-only.

## 4. Concurrency Considerations
To support concurrent updates safely (e.g., parallel agents writing to the state), we use **Optimistic Concurrency Control (OCC)**.
*   Every state read includes a `version` number.
*   Every write must include the `expectedVersion`.
*   The database executes: `UPDATE run_states SET state_json = ?, version = version + 1 WHERE run_id = ? AND version = expectedVersion`.
*   If `0` rows are affected, a concurrent modification occurred. The writer must re-fetch the state, apply its patch, and retry.

## 5. Suggested API Endpoints
*   `GET /api/v1/runs/:id/state` - Fetch current state and version.
*   `PATCH /api/v1/runs/:id/state` - Update state (requires `version` in payload).
*   `GET /api/v1/runs/:id/artifacts` - List artifacts for a run.
*   `POST /api/v1/runs/:id/artifacts` - Save a new artifact.
*   `GET /api/v1/runs/:id/audit` - Retrieve the immutable audit trail.

## 6. Data Validation Rules
*   **Strict Typing:** All state updates must conform to the `SharedState` interface.
*   **No Loose Blobs:** Unknown top-level keys in the state patch are rejected.
*   **Artifact Constraints:** Artifacts must have a defined `type` and cannot exceed a maximum payload size (e.g., 5MB) before being offloaded to external storage (S3/GCS).

## 7. UI Implications for Displaying State
*   **State Tree Viewer:** The UI can render a live-updating JSON tree of the `SharedState`, highlighting recent diffs.
*   **Artifact Gallery:** A dedicated tab to view generated artifacts (e.g., syntax-highlighted code blocks, rendered markdown) independent of the raw state JSON.
*   **Audit Timeline:** A chronological feed showing exactly when agents started, what state they mutated, and when artifacts were produced.

## 8. Tests for State Transitions and Data Integrity
*   `test_occ_conflict`: Verify that concurrent writes with stale versions are rejected with a 409 Conflict.
*   `test_state_patching`: Verify that partial updates correctly merge into the existing state without overwriting sibling keys.
*   `test_audit_trail`: Verify that every successful state update generates a corresponding audit log entry.
*   `test_artifact_creation`: Verify artifacts are stored correctly and linked to the correct run and step.
