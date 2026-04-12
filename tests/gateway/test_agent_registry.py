import requests
import pytest

BASE_URL = "http://localhost:3000/api/v1"

def test_create_valid_agent():
    payload = {
        "id": "test-agent-1",
        "name": "Test Agent",
        "role": "You are a test agent.",
        "description": "A simple test agent.",
        "provider": "hermes",
        "tools": [{"name": "test_tool", "description": "A test tool", "parameters": {}}],
        "permissions": ["fs:read"],
        "inputSchema": {"type": "object"},
        "outputSchema": {"type": "object"}
    }
    response = requests.post(f"{BASE_URL}/agents", json=payload)
    assert response.status_code == 201

def test_create_invalid_agent_missing_fields():
    payload = {
        "id": "test-agent-2",
        "name": "Test Agent 2"
        # Missing role and provider
    }
    response = requests.post(f"{BASE_URL}/agents", json=payload)
    assert response.status_code == 400

def test_create_duplicate_agent():
    payload = {
        "id": "test-agent-1", # Already created above
        "name": "Test Agent Duplicate",
        "role": "You are a test agent.",
        "provider": "hermes"
    }
    response = requests.post(f"{BASE_URL}/agents", json=payload)
    assert response.status_code == 409

def test_get_agent():
    response = requests.get(f"{BASE_URL}/agents/test-agent-1")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Agent"
    assert data["tools"][0]["name"] == "test_tool"
    assert data["permissions"] == ["fs:read"]

def test_update_agent():
    payload = {
        "name": "Updated Test Agent",
        "enabled": False
    }
    response = requests.patch(f"{BASE_URL}/agents/test-agent-1", json=payload)
    assert response.status_code == 200

    # Verify update
    response = requests.get(f"{BASE_URL}/agents/test-agent-1")
    data = response.json()
    assert data["name"] == "Updated Test Agent"
    assert data["enabled"] == False

def test_delete_agent():
    response = requests.delete(f"{BASE_URL}/agents/test-agent-1")
    assert response.status_code == 204

    # Verify deletion
    response = requests.get(f"{BASE_URL}/agents/test-agent-1")
    assert response.status_code == 404
