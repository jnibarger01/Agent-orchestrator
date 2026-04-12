# Agent Registry Design

## 1. Recommended Data Model
The Agent Registry uses the following data model to represent an agent. This model is designed to be provider-agnostic, allowing the orchestrator to map these definitions to specific provider adapters (e.g., OpenClaw, Hermes).

```typescript
interface AgentDefinition {
  id: string;              // Unique identifier (e.g., "code-reviewer-v1")
  name: string;            // Human-readable name (e.g., "Code Reviewer")
  role: string;            // System role/prompt instruction
  description: string;     // Brief description of the agent's purpose
  provider: string;        // The ID of the provider to use (e.g., "hermes", "claude-code")
  model: string;           // Specific model override (optional)
  tools: ToolDefinition[]; // Array of tools the agent can use
  permissions: string[];   // Required system permissions (e.g., ["fs:read", "network:http"])
  inputSchema: object;     // JSON Schema for expected input
  outputSchema: object;    // JSON Schema for guaranteed output
  runtimeStatus: 'idle' | 'running' | 'error' | 'offline';
  enabled: boolean;        // Whether the agent is active and selectable
  createdAt: number;
  updatedAt: number;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: object; // JSON Schema
}
```

## 2. File/Folder Structure
```text
/
├── docs/
│   └── AGENT_REGISTRY_DESIGN.md       # This design document
├── server.ts                          # Backend SQLite schema & API routes
├── src/
│   ├── types/
│   │   └── agent.ts                   # TypeScript interfaces for Agent
│   └── lib/
│       └── agents/
│           └── registryClient.ts      # Frontend client for interacting with the registry
└── tests/
    └── gateway/
        └── test_agent_registry.py     # Integration tests for the registry API
```

## 3. Backend API Contract
Base Path: `/api/v1/agents`

*   **`GET /`**: List all agents.
*   **`GET /:id`**: Get a specific agent by ID.
*   **`POST /`**: Create a new agent.
    *   *Body*: Partial `AgentDefinition` (requires `id`, `name`, `role`, `provider`).
*   **`PATCH /:id`**: Update an existing agent.
    *   *Body*: Partial `AgentDefinition`.
*   **`DELETE /:id`**: Delete an agent.

## 4. Validation Rules
Before saving an agent to the registry, the backend enforces the following rules:
1.  **Required Fields**: `id`, `name`, `role`, and `provider` must be present and non-empty strings.
2.  **ID Format**: `id` must be alphanumeric with hyphens/underscores only (e.g., `^[a-zA-Z0-9-_]+$`).
3.  **Provider Existence**: The `provider` specified must exist in the `providers` table.
4.  **JSON Validity**: `tools`, `inputSchema`, and `outputSchema` must be valid JSON objects/arrays.
5.  **Uniqueness**: On creation, the `id` must not already exist.

## 5. Persistence Approach
The registry uses the existing **SQLite** database (`orchestrator.db`). 
A new table `agents` is created with columns mapping to the data model. Complex objects (`tools`, `permissions`, `inputSchema`, `outputSchema`) are serialized to JSON strings for storage and deserialized upon retrieval.

## 6. Error Cases
*   **400 Bad Request**: Validation failure (e.g., missing required fields, invalid ID format, malformed JSON).
*   **404 Not Found**: Attempting to GET, PATCH, or DELETE an agent ID that does not exist.
*   **409 Conflict**: Attempting to POST an agent with an `id` that already exists.
*   **422 Unprocessable Entity**: The specified `provider` does not exist or is disabled.

## 7. Tests to Write
*   `test_create_valid_agent`: Verify successful creation and persistence.
*   `test_create_invalid_agent`: Verify 400 response for missing fields or invalid ID.
*   `test_create_duplicate_agent`: Verify 409 response for duplicate ID.
*   `test_get_agent`: Verify retrieval of a specific agent with correct JSON deserialization.
*   `test_update_agent`: Verify partial updates (e.g., changing `enabled` status or `model`).
*   `test_delete_agent`: Verify successful deletion and subsequent 404 on GET.

## 8. Example Agent Config JSON
```json
{
  "id": "fs-analyzer",
  "name": "File System Analyzer",
  "role": "You are an expert systems engineer. Analyze the provided directory structure and identify potential security vulnerabilities or architectural flaws.",
  "description": "Scans local directories for structural issues.",
  "provider": "hermes",
  "model": "Nous-Hermes-2-Mixtral-8x7B-DPO",
  "tools": [
    {
      "name": "list_directory",
      "description": "Lists the contents of a directory.",
      "parameters": {
        "type": "object",
        "properties": {
          "path": { "type": "string" }
        },
        "required": ["path"]
      }
    }
  ],
  "permissions": ["fs:read"],
  "inputSchema": {
    "type": "object",
    "properties": {
      "target_path": { "type": "string" }
    },
    "required": ["target_path"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "vulnerabilities": { "type": "array", "items": { "type": "string" } },
      "summary": { "type": "string" }
    }
  },
  "runtimeStatus": "idle",
  "enabled": true
}
```
