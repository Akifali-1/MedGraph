import os
from types import SimpleNamespace

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


def test_health_reports_unreachable_dependencies_and_does_not_create_pinecone(monkeypatch):
    from backend.config import Config
    import backend.config.singletons as singletons

    monkeypatch.setattr(Config, "MOCK_REDIS", False)
    monkeypatch.setattr(Config, "REDIS_HOST", "127.0.0.1")
    monkeypatch.setattr(Config, "REDIS_PORT", 1)
    monkeypatch.setattr(
        singletons,
        "get_neo4j_client",
        lambda: SimpleNamespace(
            use_mock=False,
            available=False,
            error="connection refused",
        ),
    )

    calls = []

    def fake_pinecone(*, allow_create=True):
        calls.append(allow_create)
        raise ValueError("Pinecone unavailable")

    monkeypatch.setattr(singletons, "get_pinecone_index", fake_pinecone)

    response = TestClient(app).get("/health")

    assert response.status_code == 503
    data = response.json()
    assert data["dependencies"]["neo4j"] == "unhealthy: connection refused"
    assert data["dependencies"]["redis"].startswith("unhealthy:")
    assert data["dependencies"]["pinecone"] == "unhealthy: Pinecone unavailable"
    assert calls == [False]


def test_diagnosis_marks_interaction_check_unavailable(monkeypatch):
    import backend.config.singletons as singletons
    from backend.agents.cache import diagnose_patient
    from backend.models.patient import PatientInput

    monkeypatch.setattr(
        singletons,
        "get_neo4j_client",
        lambda: type(
            "UnavailableNeo4j",
            (),
            {"available": False, "use_mock": False, "error": "connection refused"},
        )(),
    )

    result = diagnose_patient(
        PatientInput(
            age=41,
            sex="F",
            symptoms=["unmapped phase1 symptom"],
            medications=[],
            comorbidities=[],
        ),
        request_id="phase1-unavailable-interaction",
        doctor_id="phase1-test",
    )

    assert result["interaction_check"] == {"status": "unavailable", "interactions": []}
    assert result["drug_interactions"] == []
