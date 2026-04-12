import Database from "better-sqlite3";
import { SharedState, Artifact, AuditLogEntry } from "../../types/state";

export class StateManager {
  constructor(private db: Database.Database) {}

  /**
   * Initializes a new shared state for a run.
   */
  initializeState(runId: string, initialContext: Record<string, any> = {}): SharedState {
    const initialState: SharedState = {
      runId,
      version: 1,
      globalContext: initialContext,
      tasks: {},
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.db.prepare(`
      INSERT INTO run_states (run_id, state_json, version, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(runId, JSON.stringify(initialState), 1, initialState.updatedAt);

    this.appendAuditLog(runId, 'STATE_INITIALIZED', { initialContext });

    return initialState;
  }

  /**
   * Retrieves the current state and its version.
   */
  getState(runId: string): SharedState | null {
    const row = this.db.prepare("SELECT state_json, version FROM run_states WHERE run_id = ?").get(runId) as any;
    if (!row) return null;
    
    const state = JSON.parse(row.state_json) as SharedState;
    state.version = row.version; // Ensure version matches DB
    return state;
  }

  /**
   * Updates the state using Optimistic Concurrency Control.
   * Throws an error if the expected version does not match the DB version.
   */
  updateState(runId: string, expectedVersion: number, patch: Partial<SharedState>): SharedState {
    const currentState = this.getState(runId);
    if (!currentState) throw new Error(`State for run ${runId} not found`);
    if (currentState.version !== expectedVersion) {
      throw new Error(`Concurrency conflict: expected version ${expectedVersion}, but DB has ${currentState.version}`);
    }

    // Deep merge patch into current state (simplified for this slice)
    const newState: SharedState = {
      ...currentState,
      ...patch,
      globalContext: { ...currentState.globalContext, ...(patch.globalContext || {}) },
      tasks: { ...currentState.tasks, ...(patch.tasks || {}) },
      version: expectedVersion + 1,
      updatedAt: Date.now()
    };

    const result = this.db.prepare(`
      UPDATE run_states 
      SET state_json = ?, version = ?, updated_at = ?
      WHERE run_id = ? AND version = ?
    `).run(JSON.stringify(newState), newState.version, newState.updatedAt, runId, expectedVersion);

    if (result.changes === 0) {
      throw new Error(`Concurrency conflict: update failed for run ${runId}`);
    }

    this.appendAuditLog(runId, 'STATE_UPDATED', { patch, newVersion: newState.version });

    return newState;
  }

  /**
   * Saves a discrete artifact.
   */
  saveArtifact(artifact: Omit<Artifact, 'id' | 'createdAt'>): Artifact {
    const id = Math.random().toString(36).substring(7);
    const now = Date.now();
    const newArtifact: Artifact = { ...artifact, id, createdAt: now };

    this.db.prepare(`
      INSERT INTO artifacts (id, run_id, step_id, name, type, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, artifact.runId, artifact.stepId, artifact.name, artifact.type, artifact.content, now);

    this.appendAuditLog(artifact.runId, 'ARTIFACT_CREATED', { artifactId: id, name: artifact.name });

    return newArtifact;
  }

  /**
   * Retrieves artifacts for a run.
   */
  getArtifacts(runId: string): Artifact[] {
    return this.db.prepare("SELECT * FROM artifacts WHERE run_id = ? ORDER BY created_at ASC").all(runId) as Artifact[];
  }

  /**
   * Retrieves the audit log for a run.
   */
  getAuditLogs(runId: string): AuditLogEntry[] {
    const rows = this.db.prepare("SELECT * FROM audit_logs WHERE run_id = ? ORDER BY created_at ASC").all(runId) as any[];
    return rows.map(r => ({
      id: r.id,
      runId: r.run_id,
      action: r.action,
      details: JSON.parse(r.details_json),
      createdAt: r.created_at
    }));
  }

  private appendAuditLog(runId: string, action: string, details: any) {
    const id = Math.random().toString(36).substring(7);
    this.db.prepare(`
      INSERT INTO audit_logs (id, run_id, action, details_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, runId, action, JSON.stringify(details), Date.now());
  }
}
