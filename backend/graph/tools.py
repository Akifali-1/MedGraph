from langchain_core.tools import tool

@tool
def query_knowledge_graph(patient_medications: list, patient_symptoms: list, doctor_id: str = None) -> dict:
    """
    Query the Neo4j knowledge graph database to retrieve:
    1. Known drug-drug interactions between medications.
    2. Weight-based symptom-disease indicators.
    Also returns a boolean flag `critical_interaction_flag` if a high-severity interaction is found.
    """
    from backend.config.singletons import get_neo4j_client
    neo4j_client = get_neo4j_client()

    # Normalize inputs to list if they aren't
    meds = list(patient_medications) if patient_medications else []
    sympts = list(patient_symptoms) if patient_symptoms else []
    
    interactions = neo4j_client.query_drug_interactions(meds, doctor_id=doctor_id)
    diseases = neo4j_client.query_symptom_diseases(sympts)
    
    # Identify high-severity interactions
    has_critical = any(i.get("severity") == "HIGH" for i in interactions)
    
    return {
        "drug_interactions": interactions,
        "probable_diseases": diseases,
        "critical_interaction_flag": has_critical
    }
