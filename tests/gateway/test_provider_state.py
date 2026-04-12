# tests/gateway/test_provider_state.py
# Integration tests for the provider-state feature (Slice 1)

import requests
import pytest

BASE_URL = "http://localhost:3000/api/v1"

def test_get_providers():
    response = requests.get(f"{BASE_URL}/providers")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert any(p['id'] == 'gemini' for p in response.json())

def test_update_provider_config():
    payload = {
        "enabled": True,
        "config": {"model": "gemini-3.1-pro-preview"}
    }
    response = requests.patch(f"{BASE_URL}/providers/gemini", json=payload)
    assert response.status_code == 200
    
    # Verify update
    response = requests.get(f"{BASE_URL}/providers/gemini")
    data = response.json()
    assert data['enabled'] == True
    assert data['config']['model'] == "gemini-3.1-pro-preview"
