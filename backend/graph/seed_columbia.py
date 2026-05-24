import urllib.request
import logging
import os
import sys
import re
from html.parser import HTMLParser

# Ensure parent directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.graph.client import Neo4jClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ColumbiaSeeder")

URL = "http://people.dbmi.columbia.edu/~friedma/Projects/DiseaseSymptomKB/index.html"

class ColumbiaTableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_td = False
        self.current_row = []
        self.rows = []
        self.current_data = []

    def handle_starttag(self, tag, attrs):
        if tag == 'td':
            self.in_td = True
            self.current_data = []

    def handle_endtag(self, tag):
        if tag == 'td':
            self.in_td = False
            self.current_row.append(" ".join(self.current_data).strip())
        elif tag == 'tr':
            if self.current_row:
                self.rows.append(self.current_row)
                self.current_row = []

    def handle_data(self, data):
        if self.in_td:
            # Word-generated HTML wraps multiple blocks of text/whitespace, collect all
            self.current_data.append(data.strip())

def parse_umls_concept(raw_str):
    """
    Parses strings like 'UMLS:C0020538_hypertensive   disease'
    Returns (umls_id, clean_name) or (None, None)
    """
    if not raw_str or "_" not in raw_str:
        return None, None
    
    parts = raw_str.split("_", 1)
    umls_part = parts[0].strip()
    name_part = parts[1].strip()
    
    # Extract UMLS CUI (e.g., C0020538)
    match = re.search(r"C\d{7}", umls_part)
    umls_id = match.group(0) if match else None
    
    # Clean up name: replace multiple spaces with single space
    clean_name = re.sub(r"\s+", " ", name_part).strip().lower()
    
    return umls_id, clean_name

def seed_columbia_dataset():
    client = Neo4jClient()
    if client.use_mock:
        logger.error(
            "Neo4j client is running in MOCK mode. "
            "Please ensure NEO4J_PASSWORD is configured in your .env file to seed a live database."
        )
        return

    logger.info(f"Downloading Columbia Disease-Symptom dataset from: {URL}")
    try:
        req = urllib.request.Request(URL, headers={'User-Agent': 'Mozilla/5.0'})
        html_content = urllib.request.urlopen(req).read().decode('utf-8', errors='ignore')
        
        parser = ColumbiaTableParser()
        parser.feed(html_content)
        
        raw_rows = parser.rows
        logger.info(f"Successfully downloaded and parsed {len(raw_rows)} HTML table rows.")
    except Exception as e:
        logger.error(f"Failed to download or parse Columbia dataset: {e}")
        client.close()
        return

    # Process rows into structured list
    # The structure of the table is:
    # [Disease, Count of Disease, Symptom]
    # Subsequent rows with empty Disease fields apply to the last seen Disease.
    
    last_disease_cui = None
    last_disease_name = None
    
    current_symptoms = []
    associations = []
    
    # Skip header row (index 0)
    for idx, row in enumerate(raw_rows[1:]):
        # Ensure row has at least 3 elements
        if len(row) < 3:
            continue
            
        disease_raw = row[0]
        symptom_raw = row[2]
        
        # Clean up whitespace and special non-breaking spaces (e.g. \xa0)
        cleaned_disease_raw = disease_raw.replace('\xa0', '').strip()
        cleaned_symptom_raw = symptom_raw.replace('\xa0', '').strip()
        
        # If disease_raw is not empty, it signifies a new disease
        if cleaned_disease_raw:
            # Yield associations for the previous disease
            if last_disease_cui and current_symptoms:
                for s_idx, (s_cui, s_name) in enumerate(current_symptoms):
                    # Decay weight based on rank ordering in dataset
                    weight = max(0.50, round(0.95 - 0.04 * s_idx, 3))
                    associations.append({
                        "disease_id": last_disease_cui,
                        "disease_name": last_disease_name,
                        "symptom_id": s_cui,
                        "symptom_name": s_name,
                        "weight": weight
                    })
                current_symptoms = []
            
            d_cui, d_name = parse_umls_concept(cleaned_disease_raw)
            if d_cui:
                last_disease_cui = d_cui
                last_disease_name = d_name
                
        # Add symptom to current disease list
        if cleaned_symptom_raw:
            s_cui, s_name = parse_umls_concept(cleaned_symptom_raw)
            if s_cui:
                current_symptoms.append((s_cui, s_name))
                
    # Seed the final disease
    if last_disease_cui and current_symptoms:
        for s_idx, (s_cui, s_name) in enumerate(current_symptoms):
            weight = max(0.50, round(0.95 - 0.04 * s_idx, 3))
            associations.append({
                "disease_id": last_disease_cui,
                "disease_name": last_disease_name,
                "symptom_id": s_cui,
                "symptom_name": s_name,
                "weight": weight
            })

    logger.info(f"Processed {len(associations)} valid disease-symptom association records.")

    # Seed into Neo4j
    try:
        with client.driver.session() as session:
            logger.info("Clearing previous Disease & Symptom nodes (preserving Drug nodes)...")
            session.run("MATCH (n:Disease) DETACH DELETE n")
            session.run("MATCH (n:Symptom) DETACH DELETE n")
            
            logger.info("Setting up database schema constraints and indexes...")
            session.run("CREATE CONSTRAINT disease_id_uniq IF NOT EXISTS FOR (d:Disease) REQUIRE d.id IS UNIQUE")
            session.run("CREATE CONSTRAINT symptom_id_uniq IF NOT EXISTS FOR (s:Symptom) REQUIRE s.id IS UNIQUE")
            
            logger.info("Inserting clinical disease and symptom nodes and relationships in a single batch...")
            
            # Query to batch merge Diseases
            batch_diseases_query = """
            UNWIND $batch AS row
            MERGE (d:Disease {id: row.disease_id})
            ON CREATE SET d.name = row.disease_name
            """
            
            # Query to batch merge Symptoms
            batch_symptoms_query = """
            UNWIND $batch AS row
            MERGE (s:Symptom {id: row.symptom_id})
            ON CREATE SET s.name = row.symptom_name
            """
            
            # Query to batch create relationships
            batch_relationships_query = """
            UNWIND $batch AS row
            MATCH (s:Symptom {id: row.symptom_id})
            MATCH (d:Disease {id: row.disease_id})
            MERGE (s)-[r:INDICATES]->(d)
            SET r.weight = row.weight
            """
            
            # Execute in batch transaction
            session.run(batch_diseases_query, batch=associations)
            session.run(batch_symptoms_query, batch=associations)
            session.run(batch_relationships_query, batch=associations)
            
            diseases_count = len(set(assoc["disease_id"] for assoc in associations))
            symptoms_count = len(set(assoc["symptom_id"] for assoc in associations))
            logger.info(f"Successfully batch-seeded {diseases_count} diseases, {symptoms_count} symptoms, and {len(associations)} indicator edges in Neo4j.")
            
    except Exception as e:
        logger.error(f"Failed to seed Neo4j database: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    seed_columbia_dataset()
