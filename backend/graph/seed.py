import logging
import os
import sys

# Ensure parent directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.graph.client import Neo4jClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("Neo4jSeeder")

def seed_database():
    client = Neo4jClient()
    if client.use_mock:
        logger.error(
            "Neo4j client is running in MOCK mode. "
            "Please ensure NEO4J_PASSWORD is configured in your .env file to seed a live database."
        )
        return

    logger.info("Starting Neo4j database seeding...")
    
    # 1. Clear existing database to avoid duplicates
    clear_query = "MATCH (n) DETACH DELETE n"
    
    # 2. Constraints and Indexes
    schema_queries = [
        "CREATE CONSTRAINT disease_id_uniq IF NOT EXISTS FOR (d:Disease) REQUIRE d.id IS UNIQUE",
        "CREATE CONSTRAINT symptom_id_uniq IF NOT EXISTS FOR (s:Symptom) REQUIRE s.id IS UNIQUE",
        "CREATE CONSTRAINT drug_id_uniq IF NOT EXISTS FOR (dr:Drug) REQUIRE dr.id IS UNIQUE",
        "CREATE INDEX disease_name_idx IF NOT EXISTS FOR (d:Disease) ON (d.name)",
        "CREATE INDEX symptom_name_idx IF NOT EXISTS FOR (s:Symptom) ON (s.name)",
        "CREATE INDEX drug_name_idx IF NOT EXISTS FOR (dr:Drug) ON (dr.name)",
    ]

    # 3. Create Nodes
    create_nodes_query = """
    // Create Diseases
    MERGE (d1:Disease {id: 'D001'}) SET d1.name = 'STEMI', d1.icd10 = 'I21.0'
    MERGE (d2:Disease {id: 'D002'}) SET d2.name = 'Unstable Angina', d2.icd10 = 'I20.0'
    MERGE (d3:Disease {id: 'D003'}) SET d3.name = 'Aortic Dissection', d3.icd10 = 'I71.0'
    MERGE (d4:Disease {id: 'D004'}) SET d4.name = 'Intracranial Hemorrhage', d4.icd10 = 'I62.9'

    // Create Symptoms
    MERGE (s1:Symptom {id: 'S001'}) SET s1.name = 'chest pain'
    MERGE (s2:Symptom {id: 'S002'}) SET s2.name = 'jaw pain'
    MERGE (s3:Symptom {id: 'S003'}) SET s3.name = 'sweating'
    MERGE (s4:Symptom {id: 'S004'}) SET s4.name = 'headache'
    MERGE (s5:Symptom {id: 'S005'}) SET s5.name = 'confusion'

    // Create Drugs
    MERGE (dr1:Drug {id: 'DR001'}) SET dr1.name = 'Warfarin', dr1.class = 'anticoagulant'
    MERGE (dr2:Drug {id: 'DR002'}) SET dr2.name = 'Aspirin', dr2.class = 'antiplatelet'
    MERGE (dr3:Drug {id: 'DR003'}) SET dr3.name = 'Lisinopril', dr3.class = 'ACE inhibitor'
    MERGE (dr4:Drug {id: 'DR004'}) SET dr4.name = 'Metformin', dr4.class = 'biguanide'
    """

    # 4. Create Relationships
    create_relations_query = """
    // Retrieve Nodes and Link
    MATCH (s1:Symptom {name: 'chest pain'})
    MATCH (s2:Symptom {name: 'jaw pain'})
    MATCH (s3:Symptom {name: 'sweating'})
    MATCH (s4:Symptom {name: 'headache'})
    MATCH (s5:Symptom {name: 'confusion'})
    
    MATCH (d1:Disease {name: 'STEMI'})
    MATCH (d2:Disease {name: 'Unstable Angina'})
    MATCH (d3:Disease {name: 'Aortic Dissection'})
    MATCH (d4:Disease {name: 'Intracranial Hemorrhage'})
    
    MATCH (dr1:Drug {name: 'Warfarin'})
    MATCH (dr2:Drug {name: 'Aspirin'})

    // Create Symptom-indicates-Disease
    MERGE (s1)-[:INDICATES {weight: 0.9}]->(d1)
    MERGE (s2)-[:INDICATES {weight: 0.7}]->(d1)
    MERGE (s3)-[:INDICATES {weight: 0.6}]->(d1)
    MERGE (s1)-[:INDICATES {weight: 0.8}]->(d2)
    MERGE (s1)-[:INDICATES {weight: 0.5}]->(d3)
    MERGE (s4)-[:INDICATES {weight: 0.7}]->(d4)
    MERGE (s5)-[:INDICATES {weight: 0.8}]->(d4)

    // Create Drug-interacts-with-Drug
    MERGE (dr1)-[:INTERACTS_WITH {severity: 'HIGH', effect: 'increased bleeding risk'}]->(dr2)
    MERGE (dr2)-[:INTERACTS_WITH {severity: 'HIGH', effect: 'increased bleeding risk'}]->(dr1)

    // Create Disease-treated-by-Drug
    MERGE (d1)-[:TREATED_BY]->(dr2)
    MERGE (d2)-[:TREATED_BY]->(dr2)
    """

    try:
        with client.driver.session() as session:
            # Clear DB
            logger.info("Clearing existing data...")
            session.run(clear_query)
            
            # Setup schema
            logger.info("Creating constraints and indexes...")
            for schema_q in schema_queries:
                try:
                    session.run(schema_q)
                except Exception as ex:
                    # Aura DBs sometimes warning about constraints during session runs, catch and continue
                    logger.debug(f"Schema query info: {ex}")
            
            # Seed nodes
            logger.info("Creating clinical entity nodes...")
            session.run(create_nodes_query)
            
            # Seed relations
            logger.info("Linking relationships...")
            session.run(create_relations_query)
            
            logger.info("Neo4j database seeding completed successfully!")
            
    except Exception as e:
        logger.error(f"Failed to seed Neo4j database: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    seed_database()
