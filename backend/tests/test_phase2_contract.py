import os

os.environ["TESTING"] = "true"
os.environ["MOCK_REDIS"] = "true"

from langchain_core.documents import Document

from backend.agents.orchestrator import alert_node, output_node, NO_EVIDENCE_MESSAGE


def _state(*, chunks=None, graph_results=None, diagnoses=None):
    return {
        "request_id": "phase2-contract",
        "doctor_id": "test",
        "patient_data": {"age": 40, "sex": "F", "symptoms": ["chest pain"], "medications": []},
        "rag_chunks": chunks or [],
        "graph_results": graph_results or {
            "drug_interactions": [],
            "probable_diseases": [],
            "interaction_check": {"status": "ok", "interactions": []},
        },
        "diagnoses": diagnoses or [],
        "confidence": 0.8,
        "drug_interaction_flag": False,
        "iteration": 0,
        "query_refinement": "",
        "final_output": {"recommended_workup": []},
        "citation_warnings_present": False,
        "data_mode": "live",
    }


def test_no_evidence_contract_keeps_structured_graph_results():
    result = output_node(_state(graph_results={
        "drug_interactions": [{"dr1": "A", "dr2": "B", "severity": "LOW", "effect": "reported"}],
        "probable_diseases": [],
        "interaction_check": {"status": "ok", "interactions": [{"dr1": "A", "dr2": "B"}]},
    })) ["final_output"]

    assert result["status"] == "no_evidence"
    assert result["message"] == NO_EVIDENCE_MESSAGE
    assert result["diagnoses"] == []
    assert result["interaction_check"]["interactions"][0]["dr1"] == "A"


def test_citations_are_built_from_retrieved_metadata():
    chunk = Document(page_content="A" * 400, metadata={
        "title": "Chest pain guideline",
        "source_type": "guideline",
        "source_id": "guideline-1",
        "chunk_id": "chunk-1",
        "url": "https://example.test/guideline",
    })
    result = output_node(_state(
        chunks=[chunk],
        diagnoses=[{"name": "Example", "confidence": 0.8, "evidence": "supported", "citations": []}],
    ))["final_output"]

    assert result["status"] == "ok"
    assert result["citations"][0] == {
        "citation_id": "citation-1",
        "title": "Chest pain guideline",
        "source_type": "guideline",
        "source_id": "guideline-1",
        "chunk_id": "chunk-1",
        "excerpt": "A" * 300,
        "url": "https://example.test/guideline",
    }
    assert result["diagnoses"][0]["citation_ids"] == ["citation-1"]


def test_graph_unavailable_is_distinct_from_empty_interactions():
    chunk = Document(page_content="Chest pain evidence", metadata={"title": "Guideline"})
    result = output_node(_state(
        chunks=[chunk],
        graph_results={
            "drug_interactions": [],
            "probable_diseases": [],
            "interaction_check": {"status": "unavailable", "interactions": []},
            "graph_check": "unavailable",
        },
    ))["final_output"]

    assert result["status"] == "graph_unavailable"
    assert result["message"] == "The interaction check could not run."
    assert result["interaction_check"]["status"] == "unavailable"


def test_alert_text_uses_returned_interaction_pair():
    state = _state(
        chunks=[Document(page_content="Interaction evidence", metadata={"title": "Guideline"})],
        graph_results={
            "drug_interactions": [{"dr1": "Drug Alpha", "dr2": "Drug Beta", "severity": "HIGH", "effect": "reported effect"}],
            "interaction_check": {"status": "ok", "interactions": [{"dr1": "Drug Alpha", "dr2": "Drug Beta"}]},
        },
    )
    state["drug_interaction_flag"] = True
    result = alert_node(state)["final_output"]

    assert "Drug Alpha + Drug Beta" in result["alert"]
    assert "Warfarin" not in result["alert"]
