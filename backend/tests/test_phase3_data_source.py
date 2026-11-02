import os

os.environ["TESTING"] = "true"
os.environ["MOCK_NEO4J"] = "true"
os.environ["MOCK_REDIS"] = "true"

from backend.graph.client import Neo4jClient
from backend.agents.orchestrator import alert_node


def test_non_ddinter_interactions_are_labeled_synthetic_demo():
    client = Neo4jClient()
    result = client.query_drug_interactions(["Warfarin", "Aspirin"])
    assert result
    assert all(item["data_source"] == "synthetic-demo" for item in result)


def test_synthetic_demo_alert_identifies_demo_data():
    state = {
        "request_id": "phase3-demo-source",
        "graph_results": {
            "drug_interactions": [{
                "dr1": "Drug Alpha", "dr2": "Drug Beta", "severity": "HIGH",
                "effect": "reported effect", "data_source": "synthetic-demo",
            }],
            "interaction_check": {"status": "ok", "interactions": []},
        },
        "rag_chunks": [],
        "final_output": {},
        "data_mode": "demo",
    }
    result = alert_node(state)["final_output"]
    assert "synthetic-demo" in result["alert"]
