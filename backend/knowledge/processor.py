import io
import csv
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any

import pypdf
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
try:
    from langchain_pinecone import PineconeVectorStore
except ImportError:
    PineconeVectorStore = None
import pinecone

from backend.config import Config
from backend.config.singletons import get_embeddings, get_pinecone_index, get_neo4j_client
from backend.graph.client import MOCK_INTERACTIONS

logger = logging.getLogger(__name__)

def process_guideline(file_bytes: bytes, filename: str, title: str = None, doctor_id: str = None) -> dict:
    """
    Ingests, chunks, embeds, and indexes clinical guideline document (PDF or TXT) into Pinecone.
    """
    if not title:
        title = filename

    # 1. Extract text
    if filename.lower().endswith(".pdf"):
        pdf_file = io.BytesIO(file_bytes)
        reader = pypdf.PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    else:
        # Treat as TXT
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin1")

    # 2. Validate word count
    words = text.split()
    if len(words) < 50:
        raise ValueError("Document too short — must contain at least 50 words")

    # 3. Chunk text
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=400,
        chunk_overlap=50,
        separators=["\n\n", "\n", ". ", " "]
    )
    chunks = splitter.split_text(text)

    # 4. Generate LangChain Document objects with metadata
    doc_id = str(uuid.uuid4())
    uploaded_at = datetime.utcnow().isoformat()
    
    documents = []
    for i, chunk_content in enumerate(chunks):
        doc = Document(
            page_content=chunk_content,
            metadata={
                "source": "user_upload",
                "title": title,
                "filename": filename,
                "uploaded_at": uploaded_at,
                "document_id": doc_id,
                "chunk_index": i
            }
        )
        documents.append(doc)

    # 5. Embed and Index into Pinecone (namespace user_uploads_doc_id)
    embeddings = get_embeddings()
    index_name = Config.PINECONE_INDEX_NAME
    
    # Initialize index connection to make sure it exists
    get_pinecone_index()
    
    user_namespace = f"user_uploads_doc_{doctor_id}" if doctor_id else "user_uploads"
    
    logger.info(f"Upserting {len(documents)} chunks to Pinecone index '{index_name}' in namespace '{user_namespace}'...")
    PineconeVectorStore.from_documents(
        documents,
        embeddings,
        index_name=index_name,
        namespace=user_namespace
    )
    
    return {
        "chunks_indexed": len(documents),
        "document_id": doc_id,
        "title": title
    }

def process_ddi_csv(file_bytes: bytes, doctor_id: str = None) -> dict:
    """
    Parses drug-drug interactions from CSV and upserts them to Neo4j database.
    CSV Columns: drug1, drug2, severity, effect
    """
    csv_text = file_bytes.decode("utf-8")
    csv_file = io.StringIO(csv_text)
    reader = csv.DictReader(csv_file)

    # Validate header fields
    required_fields = {"drug1", "drug2", "severity", "effect"}
    if not required_fields.issubset(set(reader.fieldnames or [])):
        missing = required_fields - set(reader.fieldnames or [])
        raise ValueError(f"Invalid CSV structure. Missing required columns: {', '.join(missing)}")

    rows = list(reader)
    if not rows:
        raise ValueError("CSV is empty.")

    # Validate values
    allowed_severities = {"HIGH", "MEDIUM", "LOW"}
    for idx, row in enumerate(rows):
        severity = (row.get("severity") or "").strip().upper()
        if severity not in allowed_severities:
            raise ValueError(f"Row {idx+1}: severity must be one of HIGH, MEDIUM, or LOW (found '{row.get('severity')}')")

    nodes_created = 0
    edges_created = 0
    rows_processed = 0

    client = get_neo4j_client()
    
    if client.use_mock:
        logger.info(f"Neo4j client is in MOCK mode. Appending DDI to local cache list under doctor context '{doctor_id}'.")
        for row in rows:
            d1 = row["drug1"].strip()
            d2 = row["drug2"].strip()
            severity = row["severity"].strip().upper()
            effect = row["effect"].strip()

            # Add bidirectional records to the mock interaction list
            # First check if interaction already exists to avoid duplicates
            def exists(drug_a, drug_b):
                return any(
                    i["dr1.name"].lower() == drug_a.lower() and i["dr2.name"].lower() == drug_b.lower()
                    for i in MOCK_INTERACTIONS
                )

            if not exists(d1, d2):
                MOCK_INTERACTIONS.append({
                    "dr1.name": d1,
                    "dr2.name": d2,
                    "r.severity": severity,
                    "r.effect": effect,
                    "r.scope": "private" if doctor_id else "global",
                    "r.doctor_id": doctor_id
                })
                edges_created += 1
            
            if not exists(d2, d1):
                MOCK_INTERACTIONS.append({
                    "dr1.name": d2,
                    "dr2.name": d1,
                    "r.severity": severity,
                    "r.effect": effect,
                    "r.scope": "private" if doctor_id else "global",
                    "r.doctor_id": doctor_id
                })
                edges_created += 1

            rows_processed += 1
        
        # Estimate mock nodes created
        nodes_created = len(set(r["drug1"].strip().lower() for r in rows) | set(r["drug2"].strip().lower() for r in rows))
    else:
        scope = "private" if doctor_id else "global"
        logger.info(f"Writing drug-drug interactions with scope '{scope}' for doctor '{doctor_id}' to live Neo4j database...")
        with client.driver.session() as session:
            for row in rows:
                d1 = row["drug1"].strip()
                d2 = row["drug2"].strip()
                severity = row["severity"].strip().upper()
                effect = row["effect"].strip()

                d1_id = f"DR_{d1.lower()}"
                d1_class = "anticoagulant" if "warfarin" in d1.lower() else "antiplatelet" if "aspirin" in d1.lower() or "clopidogrel" in d1.lower() else "other"
                
                # Merge Drug 1
                res1 = session.run(
                    "MERGE (dr:Drug {name: $name}) ON CREATE SET dr.id = $id, dr.class = $class",
                    {"name": d1, "id": d1_id, "class": d1_class}
                )
                nodes_created += res1.consume().counters.nodes_created

                d2_id = f"DR_{d2.lower()}"
                d2_class = "anticoagulant" if "warfarin" in d2.lower() else "antiplatelet" if "aspirin" in d2.lower() or "clopidogrel" in d2.lower() else "other"
                
                # Merge Drug 2
                res2 = session.run(
                    "MERGE (dr:Drug {name: $name}) ON CREATE SET dr.id = $id, dr.class = $class",
                    {"name": d2, "id": d2_id, "class": d2_class}
                )
                nodes_created += res2.consume().counters.nodes_created

                # Create bidirectional relations with scoping metadata
                # Direction 1: d1 -> d2
                res_rel1 = session.run(
                    """
                    MATCH (dr1:Drug {name: $d1})
                    MATCH (dr2:Drug {name: $d2})
                    MERGE (dr1)-[r:INTERACTS_WITH {severity: $severity, effect: $effect, scope: $scope, doctor_id: $doctor_id}]->(dr2)
                    """,
                    {"d1": d1, "d2": d2, "severity": severity, "effect": effect, "scope": scope, "doctor_id": doctor_id}
                )
                edges_created += res_rel1.consume().counters.relationships_created

                # Direction 2: d2 -> d1
                res_rel2 = session.run(
                    """
                    MATCH (dr1:Drug {name: $d2})
                    MATCH (dr2:Drug {name: $d1})
                    MERGE (dr1)-[r:INTERACTS_WITH {severity: $severity, effect: $effect, scope: $scope, doctor_id: $doctor_id}]->(dr2)
                    """,
                    {"d1": d1, "d2": d2, "severity": severity, "effect": effect, "scope": scope, "doctor_id": doctor_id}
                )
                edges_created += res_rel2.consume().counters.relationships_created

                rows_processed += 1

    return {
        "rows_processed": rows_processed,
        "nodes_created": nodes_created,
        "edges_created": edges_created
    }

def list_user_documents(doctor_id: str = None) -> List[Dict[str, Any]]:
    """
    Lists all guidelines currently indexed in the specific namespace of Pinecone for the doctor.
    """
    try:
        index = get_pinecone_index()
        embeddings = get_embeddings()
        emb_dim = len(embeddings.embed_query("test"))
        
        user_namespace = f"user_uploads_doc_{doctor_id}" if doctor_id else "user_uploads"
        
        query_response = index.query(
            vector=[0.0] * emb_dim,
            top_k=10000,
            include_metadata=True,
            namespace=user_namespace
        )
        
        matches = query_response.get("matches", [])
        docs = {}
        for m in matches:
            meta = m.get("metadata", {})
            doc_id = meta.get("document_id")
            if not doc_id:
                continue
            if doc_id not in docs:
                docs[doc_id] = {
                    "document_id": doc_id,
                    "title": meta.get("title", "Untitled"),
                    "filename": meta.get("filename", ""),
                    "uploaded_at": meta.get("uploaded_at", ""),
                    "chunks": 0
                }
            docs[doc_id]["chunks"] += 1
            
        # Sort by uploaded_at descending
        sorted_docs = sorted(docs.values(), key=lambda x: x["uploaded_at"], reverse=True)
        return sorted_docs
    except Exception as e:
        logger.error(f"Failed to list user documents from Pinecone namespace '{user_namespace}': {e}")
        return []

def delete_user_document(document_id: str, doctor_id: str = None) -> bool:
    """
    Deletes all vector chunks belonging to the given document_id in Pinecone user_uploads for a doctor.
    """
    try:
        index = get_pinecone_index()
        user_namespace = f"user_uploads_doc_{doctor_id}" if doctor_id else "user_uploads"
        index.delete(filter={"document_id": document_id}, namespace=user_namespace)
        return True
    except Exception as e:
        logger.error(f"Failed to delete document {document_id} from Pinecone namespace '{user_namespace}': {e}")
        raise e
