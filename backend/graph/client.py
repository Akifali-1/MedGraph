import os
import logging
from typing import List, Dict, Any
from backend.config import Config

logger = logging.getLogger(__name__)

# Standard Seed Mock Data (aligns with Cypher schema)
MOCK_INTERACTIONS = [
    {
        "dr1.name": "Warfarin",
        "dr2.name": "Aspirin",
        "r.severity": "HIGH",
        "r.effect": "increased bleeding risk"
    },
    {
        "dr1.name": "Aspirin",
        "dr2.name": "Warfarin",
        "r.severity": "HIGH",
        "r.effect": "increased bleeding risk"
    }
]

MOCK_INDICATIONS = [
    {"s.name": "chest pain", "d.name": "STEMI", "r.weight": 0.9},
    {"s.name": "jaw pain", "d.name": "STEMI", "r.weight": 0.7},
    {"s.name": "sweating", "d.name": "STEMI", "r.weight": 0.6},
    {"s.name": "chest pain", "d.name": "Unstable Angina", "r.weight": 0.8},
    {"s.name": "chest pain", "d.name": "Aortic Dissection", "r.weight": 0.5},
    {"s.name": "headache", "d.name": "Intracranial Hemorrhage", "r.weight": 0.7},
    {"s.name": "confusion", "d.name": "Intracranial Hemorrhage", "r.weight": 0.8},
]

class Neo4jClient:
    def __init__(self):
        self.driver = None
        self.use_mock = True
        
        import os
        if os.getenv("TESTING") == "true" or os.getenv("CI") == "true":
            logger.info("Testing/CI environment active. Bypassing live Neo4j initialization and using local mock knowledge graph.")
            return

        uri = Config.NEO4J_URI
        username = Config.NEO4J_USERNAME
        password = Config.NEO4J_PASSWORD

        if password:
            try:
                from neo4j import GraphDatabase
                self.driver = GraphDatabase.driver(uri, auth=(username, password))
                # Verify connection
                self.driver.verify_connectivity()
                self.use_mock = False
                logger.info("Connected to live Neo4j database successfully.")
            except Exception as e:
                logger.warning(
                    f"Could not connect to live Neo4j database: {e}. "
                    "Falling back to local in-memory knowledge graph representation."
                )
        else:
            logger.info("NEO4J_PASSWORD not provided in config. Using local in-memory knowledge graph.")

    def close(self):
        if self.driver:
            self.driver.close()

    def query_drug_interactions(self, medications: List[str], doctor_id: str = None) -> List[Dict[str, Any]]:
        """Queries drug-drug interactions for the specified medications list, isolated per doctor."""
        if self.use_mock:
            logger.info(f"Querying MOCK drug interactions for: {medications} under context doctor_id: {doctor_id}")
            results = []
            meds_set = {m.lower() for m in medications}
            for interaction in MOCK_INTERACTIONS:
                dr1 = interaction["dr1.name"].lower()
                dr2 = interaction["dr2.name"].lower()
                if dr1 in meds_set and dr2 in meds_set:
                    scope = interaction.get("r.scope", "global")
                    doc_id = interaction.get("r.doctor_id")
                    if scope == "global" or (scope == "private" and doc_id == doctor_id):
                        results.append({
                            "dr1": interaction["dr1.name"],
                            "dr2": interaction["dr2.name"],
                            "severity": interaction["r.severity"],
                            "effect": interaction["r.effect"]
                        })
            return results

        # Live Cypher Query with tenant boundary check
        logger.info(f"Querying live Neo4j drug interactions for: {medications} under context doctor_id: {doctor_id}")
        query = """
            MATCH (dr1:Drug)-[r:INTERACTS_WITH]->(dr2:Drug)
            WHERE dr1.name IN $meds AND dr2.name IN $meds
              AND (r.scope = "global" OR (r.scope = "private" AND r.doctor_id = $doctor_id))
            RETURN dr1.name AS dr1, dr2.name AS dr2, r.severity AS severity, r.effect AS effect
        """
        try:
            with self.driver.session() as session:
                result = session.run(query, meds=medications, doctor_id=doctor_id)
                return [dict(r) for r in result]
        except Exception as e:
            logger.error(f"Live Neo4j query error: {e}. Returning empty list.")
            return []

    def query_symptom_diseases(self, symptoms: List[str]) -> List[Dict[str, Any]]:
        """Queries probable diseases based on symptoms indicators."""
        if self.use_mock:
            logger.info(f"Querying MOCK symptom-disease mappings for: {symptoms}")
            disease_scores = {}
            symptom_set = {s.lower() for s in symptoms}
            
            for indication in MOCK_INDICATIONS:
                s_name = indication["s.name"].lower()
                if s_name in symptom_set:
                    d_name = indication["d.name"]
                    weight = indication["r.weight"]
                    disease_scores[d_name] = disease_scores.get(d_name, 0.0) + weight
                    
            # Sort by score descending
            sorted_diseases = sorted(disease_scores.items(), key=lambda x: x[1], reverse=True)
            return [{"name": name, "score": round(score, 2)} for name, score in sorted_diseases]

        # Live Cypher Query
        logger.info(f"Querying live Neo4j symptom-disease mappings for: {symptoms}")
        query = """
            MATCH (s:Symptom)-[r:INDICATES]->(d:Disease)
            WHERE s.name IN $symptoms
            RETURN d.name AS name, sum(r.weight) AS score
            ORDER BY score DESC LIMIT 5
        """
        try:
            with self.driver.session() as session:
                result = session.run(query, symptoms=symptoms)
                return [dict(r) for r in result]
        except Exception as e:
            logger.error(f"Live Neo4j query error: {e}. Returning empty list.")
            return []
