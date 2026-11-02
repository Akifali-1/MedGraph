import os

os.environ["TESTING"] = "true"
os.environ["ALLOW_TEST_AUTH"] = "true"
os.environ["MOCK_NEO4J"] = "true"
os.environ["MOCK_REDIS"] = "true"

from fastapi.testclient import TestClient

from backend.main import app


def test_diagnose_defaults_to_dag_and_react_is_opt_in(monkeypatch):
    calls = []

    def fake_dag(patient, request_id=None, doctor_id=None):
        calls.append("dag")
        return {"diagnoses": [], "data_mode": "demo"}

    monkeypatch.setattr("backend.main.diagnose_patient", fake_dag)
    client = TestClient(app)
    response = client.post(
        "/diagnose",
        json={"age": 40, "sex": "F", "symptoms": ["headache"]},
    )

    assert response.status_code == 200
    assert calls == ["dag"]
