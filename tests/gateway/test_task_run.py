# tests/gateway/test_task_run.py
# Integration tests for the task-run feature (Slice 2)

import requests
import pytest
import time

BASE_URL = "http://localhost:3000/api/v1"

def test_create_and_get_task():
    # 1. Create task
    payload = {
        "prompt": "Test task run",
        "provider": "hermes"
    }
    response = requests.post(f"{BASE_URL}/tasks", json=payload)
    assert response.status_code == 201
    task_id = response.json()['id']
    assert task_id is not None

    # 2. Get task details
    response = requests.get(f"{BASE_URL}/tasks/{task_id}")
    assert response.status_code == 200
    data = response.json()
    assert data['prompt'] == "Test task run"
    assert data['status'] == "pending"
    assert data['logs'] == []

def test_update_task_status_and_logs():
    # 1. Create task
    payload = {"prompt": "Update test", "provider": "hermes"}
    task_id = requests.post(f"{BASE_URL}/tasks", json=payload).json()['id']

    # 2. Update task
    update_payload = {
        "status": "running",
        "logs": [{"timestamp": int(time.time() * 1000), "level": "info", "message": "Starting..."}]
    }
    response = requests.patch(f"{BASE_URL}/tasks/{task_id}", json=update_payload)
    assert response.status_code == 200
    
    # 3. Verify update
    data = requests.get(f"{BASE_URL}/tasks/{task_id}").json()
    assert data['status'] == "running"
    assert len(data['logs']) == 1
    assert data['logs'][0]['message'] == "Starting..."

def test_delete_task():
    # 1. Create task
    task_id = requests.post(f"{BASE_URL}/tasks", json={"prompt": "Delete me", "provider": "hermes"}).json()['id']
    
    # 2. Delete task
    response = requests.delete(f"{BASE_URL}/tasks/{task_id}")
    assert response.status_code == 204
    
    # 3. Verify deletion
    response = requests.get(f"{BASE_URL}/tasks/{task_id}")
    assert response.status_code == 404
