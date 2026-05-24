import csv
import logging
import os
import sys

# Ensure parent directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.graph.client import Neo4jClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("Neo4jCSVSeeder")

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DRUGBANK_CSV = os.path.join(DATA_DIR, "drugbank_mini.csv")
DISEASE_SYMPTOMS_CSV = os.path.join(DATA_DIR, "disease_symptoms.csv")

def seed_from_csv():
    client = Neo4jClient()
    if client.use_mock:
        logger.error(
            "Neo4j client is running in MOCK mode. "
            "Please ensure NEO4J_PASSWORD is configured in your .env file to seed a live database."
        )
        return

    logger.info("Starting Neo4j CSV database seeding...")
    
    # Check if files exist
    if not os.path.exists(DRUGBANK_CSV) or not os.path.exists(DISEASE_SYMPTOMS_CSV):
        logger.error(f"CSV files not found under data directory: {DATA_DIR}")
        return

    # Schema configuration queries
    schema_queries = [
        "CREATE CONSTRAINT disease_id_uniq IF NOT EXISTS FOR (d:Disease) REQUIRE d.id IS UNIQUE",
        "CREATE CONSTRAINT symptom_id_uniq IF NOT EXISTS FOR (s:Symptom) REQUIRE s.id IS UNIQUE",
        "CREATE CONSTRAINT drug_id_uniq IF NOT EXISTS FOR (dr:Drug) REQUIRE dr.id IS UNIQUE",
        "CREATE INDEX disease_name_idx IF NOT EXISTS FOR (d:Disease) ON (d.name)",
        "CREATE INDEX symptom_name_idx IF NOT EXISTS FOR (s:Symptom) ON (s.name)",
        "CREATE INDEX drug_name_idx IF NOT EXISTS FOR (dr:Drug) ON (dr.name)",
    ]

    try:
        with client.driver.session() as session:
            # 1. Clear database
            logger.info("Clearing existing data...")
            session.run("MATCH (n) DETACH DELETE n")

            # 2. Setup schema
            logger.info("Creating constraints and indexes...")
            for query in schema_queries:
                try:
                    session.run(query)
                except Exception as ex:
                    logger.debug(f"Schema configuration info: {ex}")

            # 3. Seed Drug Interactions (DrugBank)
            logger.info(f"Seeding drug interactions from: {DRUGBANK_CSV}")
            with open(DRUGBANK_CSV, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                drugs_seeded = set()
                interactions_count = 0
                
                for row in reader:
                    d1 = row["drug1"]
                    d2 = row["drug2"]
                    severity = row["severity"]
                    effect = row["effect"]
                    
                    # Merge Drug 1
                    if d1 not in drugs_seeded:
                        d1_id = f"DR_{d1.lower()}"
                        # Set default drug class if it matches known drugs
                        d1_class = "anticoagulant" if "warfarin" in d1.lower() else "antiplatelet" if "aspirin" in d1.lower() or "clopidogrel" in d1.lower() else "other"
                        session.run(
                            "MERGE (dr:Drug {name: $name}) ON CREATE SET dr.id = $id, dr.class = $class",
                            name=d1, id=d1_id, class=d1_class
                        )
                        drugs_seeded.add(d1)
                        
                    # Merge Drug 2
                    if d2 not in drugs_seeded:
                        d2_id = f"DR_{d2.lower()}"
                        d2_class = "anticoagulant" if "warfarin" in d2.lower() else "antiplatelet" if "aspirin" in d2.lower() or "clopidogrel" in d2.lower() else "other"
                        session.run(
                            "MERGE (dr:Drug {name: $name}) ON CREATE SET dr.id = $id, dr.class = $class",
                            name=d2, id=d2_id, class=d2_class
                        )
                        drugs_seeded.add(d2)
                    
                    # Create Relationship
                    session.run(
                        """
                        MATCH (dr1:Drug {name: $d1})
                        MATCH (dr2:Drug {name: $d2})
                        MERGE (dr1)-[r:INTERACTS_WITH {severity: $severity, effect: $effect}]->(dr2)
                        """,
                        d1=d1, d2=d2, severity=severity, effect=effect
                    )
                    interactions_count += 1
                    
                logger.info(f"Seeded {len(drugs_seeded)} unique drugs and {interactions_count} interactions.")

            # 4. Seed Disease-Symptom Mappings
            logger.info(f"Seeding disease-symptom mappings from: {DISEASE_SYMPTOMS_CSV}")
            with open(DISEASE_SYMPTOMS_CSV, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                diseases_seeded = set()
                symptoms_seeded = set()
                mappings_count = 0
                
                for row in reader:
                    disease = row["disease"]
                    symptom = row["symptom"]
                    weight = float(row["weight"])
                    
                    # Merge Disease
                    if disease not in diseases_seeded:
                        disease_id = f"DIS_{disease.lower().replace(' ', '_')}"
                        # Mock icd10 code
                        icd10 = "I21.0" if "stemi" in disease.lower() else "I20.0" if "angina" in disease.lower() else "I71.0" if "aortic" in disease.lower() else "I62.9"
                        session.run(
                            "MERGE (d:Disease {name: $name}) ON CREATE SET d.id = $id, d.icd10 = $icd10",
                            name=disease, id=disease_id, icd10=icd10
                        )
                        diseases_seeded.add(disease)
                        
                    # Merge Symptom
                    if symptom not in symptoms_seeded:
                        symptom_id = f"SYM_{symptom.lower().replace(' ', '_')}"
                        session.run(
                            "MERGE (s:Symptom {name: $name}) ON CREATE SET s.id = $id",
                            name=symptom, id=symptom_id
                        )
                        symptoms_seeded.add(symptom)
                        
                    # Create indicates relationship
                    session.run(
                        """
                        MATCH (s:Symptom {name: $symptom})
                        MATCH (d:Disease {name: $disease})
                        MERGE (s)-[r:INDICATES {weight: $weight}]->(d)
                        """,
                        symptom=symptom, disease=disease, weight=weight
                    )
                    mappings_count += 1
                    
                logger.info(f"Seeded {len(diseases_seeded)} diseases, {len(symptoms_seeded)} symptoms, and {mappings_count} indication edges.")
                
            logger.info("CSV Database seeding completed successfully!")
            
    except Exception as e:
        logger.error(f"Failed to seed Neo4j from CSV files: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    seed_from_csv()
