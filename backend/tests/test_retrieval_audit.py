import os

os.environ["TESTING"] = "true"

from langchain_core.documents import Document

from backend.agents.react_agent import simulate_react_flow
from backend.agents.evidence import verify_diagnosis_citations
from backend.agents.cache import RedisCacheManager
from backend.models.patient import PatientInput
from backend.retrieval import retriever
from backend.config import Config


def test_bm25_does_not_return_zero_score_documents():
    documents = [
        Document(page_content="Warfarin and aspirin increase bleeding risk."),
        Document(page_content="ECG should be performed within ten minutes."),
    ]
    bm25 = retriever._RelevanceBM25Retriever.from_documents(
        documents, preprocess_func=retriever._tokenize
    )

    assert bm25.invoke("unrelated dermatology terminology") == []
    assert bm25.invoke("warfarin bleeding")


def test_guideline_retrieval_reports_a_true_miss_as_empty(monkeypatch):
    monkeypatch.setattr(retriever, "_documents_cache", [])
    retriever._retrievers_cache.clear()
    monkeypatch.setattr(retriever.Config, "COHERE_API_KEY", None)

    assert retriever.get_relevant_guidelines(
        "zzzz unrelated terminology that is not in the corpus", top_n=5
    ) == []


def test_empty_retrieval_does_not_create_a_random_diagnosis():
    patient = PatientInput(
        age=40,
        sex="F",
        symptoms=["unmapped symptom"],
        medications=[],
        comorbidities=[],
    )
    result = simulate_react_flow({
        "patient_data": patient.model_dump(),
        "initial_ddi": {
            "drug_interactions": [],
            "probable_diseases": [],
        },
        "initial_guidelines": [],
    })

    assert result["diagnoses"] == []
    assert result["rag_status"] == "no_results"
    assert "No relevant clinical guideline" in result["rag_message"]


def test_citation_verifier_does_not_accept_generic_word_overlap():
    diagnoses = [{
        "name": "Example",
        "confidence": 0.5,
        "evidence": "example",
        "citations": ["AHA/ACC Guidelines 2021: Guideline 99"],
    }]
    verified, warnings = verify_diagnosis_citations(
        diagnoses, ["Guideline 1: ECG should be performed promptly."]
    )

    assert verified[0]["citations"] == []
    assert warnings is True


def test_diagnosis_cache_key_includes_all_clinical_inputs():
    manager = RedisCacheManager.__new__(RedisCacheManager)
    first = PatientInput(
        age=50, sex="F", symptoms=["fatigue"], medications=[],
        comorbidities=["hypertension"], duration_hours=2,
    )
    second = first.model_copy(update={"duration_hours": 8})

    assert manager._generate_key(first) != manager._generate_key(second)


def test_gemini_model_is_centralized_on_requested_identifier():
    assert Config.GEMINI_MODEL == "gemini-3.1-flash-lite"
