import logging
import os
import sys

# Ensure parent directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.graph.client import Neo4jClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("DrugBankSeeder")

# Real-world DrugBank drug-drug interactions for our 7 target clinical drugs
REAL_INTERACTIONS = [
    {
        "drug1": "Warfarin", "drug1_class": "anticoagulant", "drug1_id": "DB01289",
        "drug2": "Aspirin", "drug2_class": "antiplatelet", "drug2_id": "DB01191",
        "severity": "HIGH", "effect": "The risk or severity of bleeding can be increased when Warfarin is combined with Aspirin."
    },
    {
        "drug1": "Warfarin", "drug1_class": "anticoagulant", "drug1_id": "DB01289",
        "drug2": "Ibuprofen", "drug2_class": "other", "drug2_id": "DB00564",
        "severity": "HIGH", "effect": "Ibuprofen may increase the anticoagulant activities of Warfarin, increasing risk of bleeding."
    },
    {
        "drug1": "Aspirin", "drug1_class": "antiplatelet", "drug1_id": "DB01191",
        "drug2": "Ibuprofen", "drug2_class": "other", "drug2_id": "DB00564",
        "severity": "MEDIUM", "effect": "Ibuprofen may decrease the antiplatelet activity of Aspirin, lowering cardiovascular protection."
    },
    {
        "drug1": "Clopidogrel", "drug1_class": "antiplatelet", "drug1_id": "DB03296",
        "drug2": "Aspirin", "drug2_class": "antiplatelet", "drug2_id": "DB01191",
        "severity": "MEDIUM", "effect": "Combining Clopidogrel and Aspirin (Dual Antiplatelet Therapy) therapeutically increases bleeding risk."
    },
    {
        "drug1": "Warfarin", "drug1_class": "anticoagulant", "drug1_id": "DB01289",
        "drug2": "Clopidogrel", "drug2_class": "antiplatelet", "drug2_id": "DB03296",
        "severity": "HIGH", "effect": "The risk or severity of major bleeding can be increased when Warfarin is combined with Clopidogrel."
    },
    {
        "drug1": "Lisinopril", "drug1_class": "other", "drug1_id": "DB02904",
        "drug2": "Spironolactone", "drug2_class": "other", "drug2_id": "DB00999",
        "severity": "HIGH", "effect": "Combining Lisinopril (ACE inhibitor) and Spironolactone (potassium-sparing diuretic) increases risk of severe hyperkalemia."
    }
]

def seed_real_drug_interactions():
    client = Neo4jClient()
    if client.use_mock:
        logger.error(
            "Neo4j client is running in MOCK mode. "
            "Please ensure NEO4J_PASSWORD is configured in your .env file to seed a live database."
        )
        return

    logger.info("Seeding real DrugBank drug interactions into Neo4j database...")

    try:
        with client.driver.session() as session:
            logger.info("Setting up database schema constraints and indexes for Drugs...")
            session.run("CREATE CONSTRAINT drug_id_uniq IF NOT EXISTS FOR (dr:Drug) REQUIRE dr.id IS UNIQUE")
            session.run("CREATE INDEX drug_name_idx IF NOT EXISTS FOR (dr:Drug) ON (dr.name)")
            
            logger.info("Inserting drugs and live interactions into Neo4j database...")
            
            drugs_seeded = set()
            interactions_seeded = 0
            
            for item in REAL_INTERACTIONS:
                d1 = item["drug1"]
                d2 = item["drug2"]
                d1_cui = item["drug1_id"]
                d2_cui = item["drug2_id"]
                d1_class = item["drug1_class"]
                d2_class = item["drug2_class"]
                severity = item["severity"]
                effect = item["effect"]
                
                # Merge Drug 1
                if d1 not in drugs_seeded:
                    session.run(
                        "MERGE (dr:Drug {name: $name}) ON CREATE SET dr.id = $id, dr.class = $drug_class",
                        name=d1, id=d1_cui, drug_class=d1_class
                    )
                    drugs_seeded.add(d1)
                    
                # Merge Drug 2
                if d2 not in drugs_seeded:
                    session.run(
                        "MERGE (dr:Drug {name: $name}) ON CREATE SET dr.id = $id, dr.class = $drug_class",
                        name=d2, id=d2_cui, drug_class=d2_class
                    )
                    drugs_seeded.add(d2)
                    
                # Create Relationship bidirectional
                session.run(
                    """
                    MATCH (dr1:Drug {name: $d1})
                    MATCH (dr2:Drug {name: $d2})
                    MERGE (dr1)-[r:INTERACTS_WITH {severity: $severity, effect: $effect}]->(dr2)
                    """,
                    d1=d1, d2=d2, severity=severity, effect=effect
                )
                session.run(
                    """
                    MATCH (dr1:Drug {name: $d2})
                    MATCH (dr2:Drug {name: $d1})
                    MERGE (dr1)-[r:INTERACTS_WITH {severity: $severity, effect: $effect}]->(dr2)
                    """,
                    d1=d1, d2=d2, severity=severity, effect=effect
                )
                interactions_seeded += 1
                
            logger.info(f"Seeded {len(drugs_seeded)} real clinical drugs and {interactions_seeded} interactions.")
            
    except Exception as e:
        logger.error(f"Failed to seed drug interactions: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    seed_real_drug_interactions()
