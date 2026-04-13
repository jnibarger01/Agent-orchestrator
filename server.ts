import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import bodyParser from "body-parser";
import Database from "better-sqlite3";
import { WorkflowEngine } from "./src/lib/orchestrator/workflowEngine";
import { StateManager } from "./src/lib/orchestrator/stateManager";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize SQLite Database
const db = new Database("orchestrator.db");
const workflowEngine = new WorkflowEngine(db);
const stateManager = new StateManager(db);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER DEFAULT 0,
    config_json TEXT DEFAULT '{}',
    status TEXT DEFAULT 'disconnected',
    last_checked TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    provider TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    logs_json TEXT DEFAULT '[]',
    result TEXT,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT DEFAULT '',
    provider TEXT NOT NULL,
    model TEXT DEFAULT '',
    tools_json TEXT DEFAULT '[]',
    permissions_json TEXT DEFAULT '[]',
    input_schema_json TEXT DEFAULT '{}',
    output_schema_json TEXT DEFAULT '{}',
    runtime_status TEXT DEFAULT 'idle',
    enabled INTEGER DEFAULT 1,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT DEFAULT '',
    initial_step TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    current_step_id TEXT,
    context_json TEXT NOT NULL,
    created_at INTEGER,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS run_states (
    run_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    version INTEGER NOT NULL,
    updated_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details_json TEXT NOT NULL,
    created_at INTEGER
  );
`);

// Seed initial providers if empty
const providerCount = db.prepare("SELECT COUNT(*) as count FROM providers").get() as { count: number };
if (providerCount.count === 0) {
  const insert = db.prepare("INSERT INTO providers (id, name, enabled, config_json) VALUES (?, ?, ?, ?)");
  insert.run("codex", "Codex", 1, JSON.stringify({}));
  insert.run("openclaw", "OpenClaw", 1, JSON.stringify({}));
  insert.run("hermes", "Hermes", 1, JSON.stringify({}));
  insert.run("claude-code", "Claude Code", 1, JSON.stringify({}));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(bodyParser.json());

  // Auth Middleware Placeholder (Aligning with gateway/platforms/api_server.py)
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // In a real scenario, this would call out to the Python gateway or share a session/token
    // For Slice 1, we assume the request is authorized if it comes from the local frontend
    const authHeader = req.headers.authorization;
    if (process.env.NODE_ENV === "production" && !authHeader) {
      return res.status(401).json({ error: "Unauthorized - Missing API Token" });
    }
    next();
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- Provider State Endpoints (Slice 1) ---

  app.get("/api/v1/providers", authMiddleware, (req, res) => {
    const providers = db.prepare("SELECT * FROM providers").all();
    res.json(providers.map((p: any) => ({
      ...p,
      enabled: !!p.enabled,
      configured: JSON.parse(p.config_json).api_key_set || p.id === 'hermes', // Simple logic for now
      config: JSON.parse(p.config_json)
    })));
  });

  app.get("/api/v1/providers/:id", authMiddleware, (req, res) => {
    const provider = db.prepare("SELECT * FROM providers WHERE id = ?").get(req.params.id) as any;
    if (!provider) return res.status(404).json({ error: "Provider not found" });
    
    res.json({
      ...provider,
      enabled: !!provider.enabled,
      config: JSON.parse(provider.config_json)
    });
  });

  app.patch("/api/v1/providers/:id", authMiddleware, (req, res) => {
    const { enabled, config } = req.body;
    const provider = db.prepare("SELECT * FROM providers WHERE id = ?").get(req.params.id) as any;
    if (!provider) return res.status(404).json({ error: "Provider not found" });

    const currentConfig = JSON.parse(provider.config_json);
    const newConfig = { ...currentConfig, ...config };
    
    // If api_key is provided, we don't store it in config_json directly for security in some cases,
    // but for Slice 1 local orchestration, we mark it as set.
    if (config?.api_key) {
      newConfig.api_key_set = true;
      // In a real app, you'd store the key in a secure vault or encrypted column
    }

    const update = db.prepare("UPDATE providers SET enabled = ?, config_json = ? WHERE id = ?");
    update.run(
      enabled !== undefined ? (enabled ? 1 : 0) : provider.enabled,
      JSON.stringify(newConfig),
      req.params.id
    );

    res.json({ message: "Provider updated successfully" });
  });

  app.post("/api/v1/providers/:id/validate", authMiddleware, (req, res) => {
    // Placeholder for validation logic
    res.json({ status: "connected", message: `Successfully validated ${req.params.id}` });
  });

  // --- Task Endpoints (Slice 2) ---

  app.get("/api/v1/tasks", authMiddleware, (req, res) => {
    const tasks = db.prepare("SELECT id, prompt, provider, status, created_at, length(logs_json) as logs_size FROM tasks ORDER BY created_at DESC").all();
    res.json(tasks.map((t: any) => ({
      ...t,
      logs_count: JSON.parse(db.prepare("SELECT logs_json FROM tasks WHERE id = ?").get(t.id).logs_json).length
    })));
  });

  app.post("/api/v1/tasks", authMiddleware, (req, res) => {
    const { prompt, provider } = req.body;
    if (!prompt || !provider) {
      return res.status(400).json({ error: "Missing prompt or provider" });
    }

    const newTask = {
      id: Math.random().toString(36).substring(7),
      prompt,
      provider,
      status: "pending",
      logs_json: JSON.stringify([]),
      created_at: Date.now(),
    };
    
    const insert = db.prepare("INSERT INTO tasks (id, prompt, provider, status, logs_json, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    insert.run(newTask.id, newTask.prompt, newTask.provider, newTask.status, newTask.logs_json, newTask.created_at);
    
    res.status(201).json({
      id: newTask.id,
      prompt: newTask.prompt,
      provider: newTask.provider,
      status: newTask.status,
      created_at: newTask.created_at
    });
  });

  app.get("/api/v1/tasks/:id", authMiddleware, (req, res) => {
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id) as any;
    if (!task) return res.status(404).json({ error: "Task not found" });
    
    res.json({
      ...task,
      logs: JSON.parse(task.logs_json)
    });
  });

  app.patch("/api/v1/tasks/:id", authMiddleware, (req, res) => {
    const { status, logs, result } = req.body;
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id) as any;
    if (!task) return res.status(404).json({ error: "Task not found" });

    let currentLogs = JSON.parse(task.logs_json);
    if (logs && Array.isArray(logs)) {
      currentLogs = [...currentLogs, ...logs];
    }

    const update = db.prepare("UPDATE tasks SET status = ?, logs_json = ?, result = ? WHERE id = ?");
    update.run(
      status || task.status,
      JSON.stringify(currentLogs),
      result !== undefined ? result : task.result,
      req.params.id
    );

    const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id) as any;
    res.json({
      ...updatedTask,
      logs: JSON.parse(updatedTask.logs_json)
    });
  });

  app.delete("/api/v1/tasks/:id", authMiddleware, (req, res) => {
    const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: "Task not found" });
    res.status(204).send();
  });

  // --- Agent Registry Endpoints ---

  app.get("/api/v1/agents", authMiddleware, (req, res) => {
    const agents = db.prepare("SELECT * FROM agents ORDER BY created_at DESC").all();
    res.json(agents.map((a: any) => ({
      ...a,
      enabled: !!a.enabled,
      runtimeStatus: a.runtime_status,
      tools: JSON.parse(a.tools_json),
      permissions: JSON.parse(a.permissions_json),
      inputSchema: JSON.parse(a.input_schema_json),
      outputSchema: JSON.parse(a.output_schema_json)
    })));
  });

  app.get("/api/v1/agents/:id", authMiddleware, (req, res) => {
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id) as any;
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    
    res.json({
      ...agent,
      enabled: !!agent.enabled,
      runtimeStatus: agent.runtime_status,
      tools: JSON.parse(agent.tools_json),
      permissions: JSON.parse(agent.permissions_json),
      inputSchema: JSON.parse(agent.input_schema_json),
      outputSchema: JSON.parse(agent.output_schema_json)
    });
  });

  app.post("/api/v1/agents", authMiddleware, (req, res) => {
    const { id, name, role, description, provider, model, tools, permissions, inputSchema, outputSchema, enabled, runtimeStatus } = req.body;
    
    // Validation
    if (!id || !name || !role || !provider) {
      return res.status(400).json({ error: "Missing required fields: id, name, role, provider" });
    }
    if (!/^[a-zA-Z0-9-_]+$/.test(id)) {
      return res.status(400).json({ error: "Invalid ID format. Use alphanumeric, hyphens, or underscores." });
    }

    // Check provider exists
    const providerExists = db.prepare("SELECT id FROM providers WHERE id = ?").get(provider);
    if (!providerExists) {
      return res.status(422).json({ error: `Provider '${provider}' does not exist.` });
    }

    try {
      const insert = db.prepare(`
        INSERT INTO agents (
          id, name, role, description, provider, model, 
          tools_json, permissions_json, input_schema_json, output_schema_json, 
          enabled, runtime_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = Date.now();
      insert.run(
        id, name, role, description || '', provider, model || '',
        JSON.stringify(tools || []),
        JSON.stringify(permissions || []),
        JSON.stringify(inputSchema || {}),
        JSON.stringify(outputSchema || {}),
        enabled !== undefined ? (enabled ? 1 : 0) : 1,
        runtimeStatus || 'idle',
        now, now
      );
      
      res.status(201).json({ message: "Agent created successfully", id });
    } catch (error: any) {
      if (error.message.includes("UNIQUE constraint failed")) {
        return res.status(409).json({ error: "Agent ID already exists" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/v1/agents/:id", authMiddleware, (req, res) => {
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id) as any;
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const { name, role, description, provider, model, tools, permissions, inputSchema, outputSchema, enabled, runtimeStatus } = req.body;

    if (provider) {
      const providerExists = db.prepare("SELECT id FROM providers WHERE id = ?").get(provider);
      if (!providerExists) return res.status(422).json({ error: `Provider '${provider}' does not exist.` });
    }

    const update = db.prepare(`
      UPDATE agents SET 
        name = ?, role = ?, description = ?, provider = ?, model = ?, 
        tools_json = ?, permissions_json = ?, input_schema_json = ?, output_schema_json = ?, 
        enabled = ?, runtime_status = ?, updated_at = ?
      WHERE id = ?
    `);

    update.run(
      name || agent.name,
      role || agent.role,
      description !== undefined ? description : agent.description,
      provider || agent.provider,
      model !== undefined ? model : agent.model,
      tools ? JSON.stringify(tools) : agent.tools_json,
      permissions ? JSON.stringify(permissions) : agent.permissions_json,
      inputSchema ? JSON.stringify(inputSchema) : agent.input_schema_json,
      outputSchema ? JSON.stringify(outputSchema) : agent.output_schema_json,
      enabled !== undefined ? (enabled ? 1 : 0) : agent.enabled,
      runtimeStatus || agent.runtime_status,
      Date.now(),
      req.params.id
    );

    res.json({ message: "Agent updated successfully" });
  });

  app.delete("/api/v1/agents/:id", authMiddleware, (req, res) => {
    const result = db.prepare("DELETE FROM agents WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: "Agent not found" });
    res.status(204).send();
  });

  // --- Workflow Endpoints ---

  app.post("/api/v1/workflows", authMiddleware, (req, res) => {
    const { id, name, version, description, initialStep, steps } = req.body;
    
    if (!id || !name || !version || !initialStep || !steps) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const insert = db.prepare(`
        INSERT INTO workflows (id, name, version, description, initial_step, steps_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = Date.now();
      insert.run(id, name, version, description || '', initialStep, JSON.stringify(steps), now, now);
      res.status(201).json({ id });
    } catch (error: any) {
      if (error.message.includes("UNIQUE constraint failed")) {
        return res.status(409).json({ error: "Workflow ID already exists" });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/v1/workflows/:id", authMiddleware, (req, res) => {
    const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: "Workflow not found" });
    res.json({ ...row, steps: JSON.parse(row.steps_json) });
  });

  app.post("/api/v1/workflow-runs", authMiddleware, async (req, res) => {
    const { workflowId, inputs } = req.body;
    if (!workflowId) return res.status(400).json({ error: "Missing workflowId" });

    try {
      const runId = await workflowEngine.startRun(workflowId, inputs || {});
      res.status(201).json({ id: runId });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/v1/workflow-runs/:id", authMiddleware, (req, res) => {
    const row = db.prepare("SELECT * FROM workflow_runs WHERE id = ?").get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: "Run not found" });
    res.json({ ...row, context: JSON.parse(row.context_json) });
  });

  // --- Shared State Endpoints ---

  app.post("/api/v1/runs/:id/state/init", authMiddleware, (req, res) => {
    try {
      const state = stateManager.initializeState(req.params.id, req.body.initialContext);
      res.status(201).json(state);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/v1/runs/:id/state", authMiddleware, (req, res) => {
    const state = stateManager.getState(req.params.id);
    if (!state) return res.status(404).json({ error: "State not found" });
    res.json(state);
  });

  app.patch("/api/v1/runs/:id/state", authMiddleware, (req, res) => {
    const { expectedVersion, patch } = req.body;
    if (expectedVersion === undefined || !patch) {
      return res.status(400).json({ error: "Missing expectedVersion or patch" });
    }
    try {
      const newState = stateManager.updateState(req.params.id, expectedVersion, patch);
      res.json(newState);
    } catch (error: any) {
      if (error.message.includes("Concurrency conflict")) {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/v1/runs/:id/artifacts", authMiddleware, (req, res) => {
    res.json(stateManager.getArtifacts(req.params.id));
  });

  app.post("/api/v1/runs/:id/artifacts", authMiddleware, (req, res) => {
    try {
      const artifact = stateManager.saveArtifact({ ...req.body, runId: req.params.id });
      res.status(201).json(artifact);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/v1/runs/:id/audit", authMiddleware, (req, res) => {
    res.json(stateManager.getAuditLogs(req.params.id));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
