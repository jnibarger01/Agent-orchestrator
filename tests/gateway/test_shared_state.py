import requests
import time

BASE_URL = "http://localhost:3000/api/v1"

def test_shared_state_lifecycle():
    run_id = "test-run-123"

    # 1. Initialize State
    res = requests.post(f"{BASE_URL}/runs/{run_id}/state/init", json={"initialContext": {"foo": "bar"}})
    assert res.status_code == 201
    state = res.json()
    assert state["version"] == 1
    assert state["globalContext"]["foo"] == "bar"

    # 2. Get State
    res = requests.get(f"{BASE_URL}/runs/{run_id}/state")
    assert res.status_code == 200
    assert res.json()["version"] == 1

    # 3. Successful Update (OCC)
    patch = {
        "status": "running",
        "tasks": {
            "task1": {"status": "running", "inputs": {}}
        }
    }
    res = requests.patch(f"{BASE_URL}/runs/{run_id}/state", json={"expectedVersion": 1, "patch": patch})
    assert res.status_code == 200
    new_state = res.json()
    assert new_state["version"] == 2
    assert new_state["status"] == "running"

    # 4. Failed Update (OCC Conflict)
    # Trying to update with stale version 1 instead of 2
    res = requests.patch(f"{BASE_URL}/runs/{run_id}/state", json={"expectedVersion": 1, "patch": {"status": "completed"}})
    assert res.status_code == 409
    assert "Concurrency conflict" in res.json()["error"]

    # 5. Create Artifact
    artifact_payload = {
        "stepId": "task1",
        "name": "script.py",
        "type": "code",
        "content": "print('hello world')"
    }
    res = requests.post(f"{BASE_URL}/runs/{run_id}/artifacts", json=artifact_payload)
    assert res.status_code == 201
    artifact_id = res.json()["id"]

    # 6. Get Artifacts
    res = requests.get(f"{BASE_URL}/runs/{run_id}/artifacts")
    assert res.status_code == 200
    artifacts = res.json()
    assert len(artifacts) == 1
    assert artifacts[0]["name"] == "script.py"

    # 7. Get Audit Logs
    res = requests.get(f"{BASE_URL}/runs/{run_id}/audit")
    assert res.status_code == 200
    logs = res.json()
    # Should have STATE_INITIALIZED, STATE_UPDATED, ARTIFACT_CREATED
    assert len(logs) == 3
    actions = [log["action"] for log in logs]
    assert "STATE_INITIALIZED" in actions
    assert "STATE_UPDATED" in actions
    assert "ARTIFACT_CREATED" in actions
