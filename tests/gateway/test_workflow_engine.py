import requests
import time

BASE_URL = "http://localhost:3000/api/v1"

def test_workflow_branching_and_loop():
    # 1. Create a workflow definition
    workflow_payload = {
        "id": "test-loop-flow",
        "name": "Test Loop Flow",
        "version": "1.0",
        "initialStep": "step1",
        "steps": {
            "step1": {
                "id": "step1",
                "type": "task",
                "agentId": "hermes",
                "inputMapping": { "prompt": "{{inputs.prompt}}" },
                "nextStep": "check_condition"
            },
            "check_condition": {
                "id": "check_condition",
                "type": "condition",
                "condition": {
                    "variable": "steps.step1.output.approved",
                    "operator": "==",
                    "value": True
                },
                "onTrue": "success_step",
                "onFalse": "step1" # Loop back
            },
            "success_step": {
                "id": "success_step",
                "type": "task",
                "agentId": "hermes",
                "inputMapping": { "prompt": "Success!" }
            }
        }
    }
    
    # Ignore 409 if it already exists from a previous test run
    requests.post(f"{BASE_URL}/workflows", json=workflow_payload)

    # 2. Start a run that will LOOP (MOCK_REJECT causes approved=false)
    run_payload = {
        "workflowId": "test-loop-flow",
        "inputs": { "prompt": "MOCK_REJECT" }
    }
    res = requests.post(f"{BASE_URL}/workflow-runs", json=run_payload)
    assert res.status_code == 201
    run_id = res.json()["id"]

    # Wait for execution
    time.sleep(1)

    # 3. Verify it looped and is still running or stuck in loop
    res = requests.get(f"{BASE_URL}/workflow-runs/{run_id}")
    run_data = res.json()
    # It should have executed step1, check_condition, and gone back to step1
    assert run_data["status"] == "running"
    assert run_data["current_step_id"] == "step1"

def test_workflow_retry_and_fallback():
    workflow_payload = {
        "id": "test-retry-flow",
        "name": "Test Retry Flow",
        "version": "1.0",
        "initialStep": "failing_step",
        "steps": {
            "failing_step": {
                "id": "failing_step",
                "type": "task",
                "agentId": "hermes",
                "inputMapping": { "prompt": "MOCK_FAIL" },
                "retryPolicy": { "maxRetries": 1, "backoffMs": 100 },
                "fallbackStep": "fallback_step"
            },
            "fallback_step": {
                "id": "fallback_step",
                "type": "task",
                "agentId": "hermes",
                "inputMapping": { "prompt": "Fallback executed" }
            }
        }
    }
    requests.post(f"{BASE_URL}/workflows", json=workflow_payload)

    run_payload = {
        "workflowId": "test-retry-flow",
        "inputs": {}
    }
    res = requests.post(f"{BASE_URL}/workflow-runs", json=run_payload)
    run_id = res.json()["id"]

    # Wait for execution (includes 1 retry of 100ms + execution time)
    time.sleep(1)

    res = requests.get(f"{BASE_URL}/workflow-runs/{run_id}")
    run_data = res.json()
    
    # Verify it hit the fallback step and completed
    assert run_data["status"] == "completed"
    assert "fallback_step" in run_data["context"]["steps"]
    assert run_data["context"]["steps"]["failing_step"]["retries"] == 1
    assert run_data["context"]["steps"]["failing_step"]["status"] == "failed"
