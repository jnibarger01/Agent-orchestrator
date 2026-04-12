# REST API Contract: Orchestrator Task Run (Slice 2)

**Version:** 1.0.0  
**Status:** Draft (Slice 2)  
**Base Path:** `/api/v1`

## Overview
This document defines the REST API contract for managing agent tasks (orchestration runs). This is Slice 2, focusing on task creation, status tracking, and log management.

## Auth Model
- **Enforcement:** Reuses existing logic from `gateway/platforms/api_server.py`.
- **Mechanism:** Bearer Token / Session based.

---

## Endpoints

### 1. List All Tasks
Retrieves a list of all orchestrated tasks, ordered by creation time (newest first).

- **Method:** `GET`
- **Path:** `/tasks`
- **Response (Success - 200 OK):**
  ```json
  [
    {
      "id": "string",
      "prompt": "string",
      "provider": "string",
      "status": "pending | running | completed | failed",
      "created_at": "number (timestamp)",
      "logs_count": "number"
    }
  ]
  ```
- **Response (Error - 500):** Internal Server Error.
- **Rate Limit:** 60 req/min.

### 2. Create Task
Creates a new orchestration task.

- **Method:** `POST`
- **Path:** `/tasks`
- **Request Body:**
  ```json
  {
    "prompt": "string (required)",
    "provider": "string (required)"
  }
  ```
- **Response (Success - 201 Created):**
  ```json
  {
    "id": "string",
    "prompt": "string",
    "provider": "string",
    "status": "pending",
    "created_at": "number"
  }
  ```
- **Response (Error - 400):** Missing required fields.
- **Rate Limit:** 20 req/min.

### 3. Get Task Details
Retrieves full details of a specific task, including its logs and result.

- **Method:** `GET`
- **Path:** `/tasks/{id}`
- **Parameters:**
  - `id` (path, string, required): Unique identifier for the task.
- **Response (Success - 200 OK):**
  ```json
  {
    "id": "string",
    "prompt": "string",
    "provider": "string",
    "status": "string",
    "logs": [
      {
        "timestamp": "number",
        "level": "info | warn | error | debug",
        "message": "string"
      }
    ],
    "result": "string | null",
    "created_at": "number"
  }
  ```
- **Response (Error - 404):** Task Not Found.
- **Rate Limit:** 100 req/min (supports polling).

### 4. Update Task
Updates the status, logs, or result of a task. Typically used by the orchestrator engine.

- **Method:** `PATCH`
- **Path:** `/tasks/{id}`
- **Parameters:**
  - `id` (path, string, required): Unique identifier for the task.
- **Request Body:**
  ```json
  {
    "status": "string (optional)",
    "logs": "array of log objects (optional, appends to existing)",
    "result": "string (optional)"
  }
  ```
- **Response (Success - 200 OK):** Updated task object.
- **Response (Error - 404):** Task Not Found.
- **Rate Limit:** 100 req/min.

### 5. Delete Task
Removes a task from the history.

- **Method:** `DELETE`
- **Path:** `/tasks/{id}`
- **Parameters:**
  - `id` (path, string, required): Unique identifier for the task.
- **Response (Success - 204 No Content):** Successfully deleted.
- **Response (Error - 404):** Task Not Found.
- **Rate Limit:** 20 req/min.

---

## SQLite State Alignment
The following fields map directly to the `tasks` table in SQLite:
- `id` (TEXT, PRIMARY KEY)
- `prompt` (TEXT)
- `provider` (TEXT)
- `status` (TEXT)
- `logs_json` (TEXT, JSON array of logs)
- `result` (TEXT)
- `created_at` (INTEGER)

## Versioning & Future Considerations
- **Flag:** `logs` are currently stored as a JSON blob in a single column. For very long-running tasks with thousands of logs, this will become inefficient. Slice 3 should consider a separate `task_logs` table.
- **Flag:** `result` is currently a plain string. Future providers might return structured JSON or file references.
