# REST API Contract: Orchestrator Provider State (Slice 1)

**Version:** 1.0.0  
**Status:** Draft (Slice 1)  
**Base Path:** `/api/v1`

## Overview
This document defines the REST API contract for managing orchestration providers (Gemini, Local Agent, etc.). This is Slice 1, focusing on state and configuration.

## Auth Model
- **Enforcement:** Reuses existing logic from `gateway/platforms/api_server.py`.
- **Mechanism:** Bearer Token / Session based (as per existing gateway).

---

## Endpoints

### 1. List All Providers
Retrieves the current state and configuration status of all available orchestration providers.

- **Method:** `GET`
- **Path:** `/providers`
- **Response (Success - 200 OK):**
  ```json
  [
    {
      "id": "string",
      "name": "string",
      "enabled": "boolean",
      "configured": "boolean",
      "status": "connected | disconnected | error",
      "last_checked": "ISO8601 Timestamp | null"
    }
  ]
  ```
- **Response (Error - 500):** Internal Server Error.
- **Rate Limit:** 60 req/min.

### 2. Get Provider Details
Retrieves detailed configuration (excluding secrets) for a specific provider.

- **Method:** `GET`
- **Path:** `/providers/{id}`
- **Parameters:**
  - `id` (path, string, required): Unique identifier for the provider.
- **Response (Success - 200 OK):**
  ```json
  {
    "id": "string",
    "name": "string",
    "enabled": "boolean",
    "config": {
      "model": "string",
      "api_key_set": "boolean"
    },
    "status": "string"
  }
  ```
- **Response (Error - 404):** Provider Not Found.
- **Rate Limit:** 60 req/min.

### 3. Update Provider Configuration
Updates the configuration or state of a provider.

- **Method:** `PATCH`
- **Path:** `/providers/{id}`
- **Parameters:**
  - `id` (path, string, required): Unique identifier for the provider.
- **Request Body:**
  ```json
  {
    "enabled": "boolean (optional)",
    "config": {
      "api_key": "string (optional)",
      "model": "string (optional)"
    }
  }
  ```
- **Response (Success - 200 OK):** Updated provider object.
- **Response (Error - 400):** Invalid configuration payload.
- **Response (Error - 404):** Provider Not Found.
- **Rate Limit:** 20 req/min.

### 4. Validate Provider Connection
Manually triggers a health check/validation for the provider's connection.

- **Method:** `POST`
- **Path:** `/providers/{id}/validate`
- **Parameters:**
  - `id` (path, string, required): Unique identifier for the provider.
- **Response (Success - 200 OK):**
  ```json
  {
    "status": "connected | error",
    "message": "string"
  }
  ```
- **Response (Error - 422):** Validation failed.
- **Rate Limit:** 10 req/min.

---

## SQLite State Alignment
The following fields map directly to the `providers` table in SQLite:
- `id` (TEXT, PRIMARY KEY)
- `name` (TEXT)
- `enabled` (INTEGER, 0 or 1)
- `config_json` (TEXT, JSON blob)
- `status` (TEXT)
- `last_checked` (TEXT, ISO8601)

## Versioning & Future Considerations
- **Flag:** The `config` object schema is provider-specific. As we add more providers (OpenClaw, Codex), this object will grow. We should consider a polymorphic schema or a generic `metadata` field to avoid breaking changes in future slices.
- **Flag:** `PATCH` on `config` currently replaces the whole config object if not handled carefully. We should implement deep merge in the backend.
