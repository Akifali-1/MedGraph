import os

os.environ["TESTING"] = "true"
os.environ["ALLOW_TEST_AUTH"] = "true"
os.environ["MOCK_NEO4J"] = "false"
os.environ["MOCK_REDIS"] = "true"
os.environ.pop("MEDGRAPH_DEMO_MODE", None)

from fastapi.testclient import TestClient
from langchain_core.documents import Document

from backend.agents.orchestrator import reasoning_node
from backend.config import Config
from backend.main import app


def _reasoning_state():
    return {
        "request_id": "phase3-reasoning",
        "doctor_id": "test",
        "patient_data": {
            "age": 65,
            "sex": "M",
            "symptoms": ["chest pain", "jaw pain", "sweating"],
            "medications": [],
            "comorbidities": [],
        },
        "rag_chunks": [Document(page_content="Chest pain guideline evidence.")],
        "graph_results": {"probable_diseases": [], "drug_interactions": []},
        "aggregated_context": "Chest pain guideline evidence.",
        "diagnoses": [],
        "confidence": 0.0,
        "drug_interaction_flag": False,
        "iteration": 0,
        "query_refinement": "",
        "final_output": None,
        "citation_warnings_present": False,
        "data_mode": "live",
        "reasoning_engine": "none",
    }


def test_mock_reasoning_is_not_used_without_explicit_demo_mode(monkeypatch):
    monkeypatch.delenv("MEDGRAPH_DEMO_MODE", raising=False)
    monkeypatch.setattr(Config, "GOOGLE_API_KEY", None)
    monkeypatch.setattr(Config, "OPENAI_API_KEY", None)
    monkeypatch.setattr(Config, "SAGEMAKER_ENDPOINT_NAME", None)

    result = reasoning_node(_reasoning_state())

    assert result["reasoning_engine"] == "none"
    assert result["final_output"]["status"] == "error"
    assert result["final_output"]["diagnoses"] == []


def test_gemini_failure_returns_error_without_mock_diagnoses(monkeypatch):
    class AvailableEmptyGraph:
        available = True
        use_mock = False
        error = None

        def query_drug_interactions(self, medications, doctor_id=None):
            return []

        def query_symptom_diseases(self, symptoms):
            return []

    import backend.config.singletons as singletons

    monkeypatch.delenv("MEDGRAPH_DEMO_MODE", raising=False)
    monkeypatch.setattr(Config, "GOOGLE_API_KEY", "invalid-test-key")
    monkeypatch.setattr(Config, "OPENAI_API_KEY", None)
    monkeypatch.setattr(Config, "SAGEMAKER_ENDPOINT_NAME", None)
    monkeypatch.setattr(singletons, "get_neo4j_client", lambda: AvailableEmptyGraph())

    def unavailable_gemini():
        raise RuntimeError("simulated Gemini failure")

    monkeypatch.setattr(singletons, "get_gemini_chat", unavailable_gemini)

    response = TestClient(app).post(
        "/diagnose",
        json={
            "age": 65,
            "sex": "M",
            "symptoms": ["chest pain", "jaw pain", "sweating"],
            "medications": [],
            "comorbidities": [],
        },
    )

    assert response.status_code == 200
    result = response.json()
    assert result["reasoning_engine"] == "none"
    assert result["status"] == "error"
    assert result["diagnoses"] == []
    assert result["message"] == "The clinical reasoning service is unavailable. Please try again."
