import os
import logging
import math
import re
import hashlib
from typing import Any, Dict, List
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from pydantic import ConfigDict, Field
from backend.config import Config

logger = logging.getLogger(__name__)

# Paths
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
GUIDELINES_PATH = os.path.join(DATA_DIR, "data", "aha_acc_guidelines.txt")
ABSTRACTS_PATH = os.path.join(DATA_DIR, "data", "pubmed_abstracts.txt")

# Cached retrievers mapped per doctor to prevent cross-tenant leakage
_retrievers_cache = {}
_documents_cache = []

_TOKEN_RE = re.compile(r"\b[\w-]+\b")
_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "in", "is", "it", "of", "on", "or", "that", "the", "this", "to",
    "with", "not", "no", "patient", "patients", "presenting", "symptoms",
    "previous", "medical", "history",
}


def build_clinical_query(patient: Any) -> str:
    """Search actual clinical terms, without boilerplate that creates false hits."""
    data = patient if isinstance(patient, dict) else patient.model_dump()
    return "; ".join(
        term.strip()
        for field in ("symptoms", "comorbidities", "medications")
        for term in data.get(field, [])
        if term.strip()
    )


def _tokenize(text: str) -> List[str]:
    """Use case-insensitive tokens so BM25 matches clinical terms reliably."""
    return [
        token
        for token in _TOKEN_RE.findall((text or "").lower())
        if len(token) > 2 and token not in _STOP_WORDS
    ]


def _has_token_overlap(query: str, document: str) -> bool:
    return bool(set(_tokenize(query)) & set(_tokenize(document)))


def _dense_score_threshold() -> float:
    try:
        return float(os.getenv("RAG_DENSE_SCORE_THRESHOLD", "0.35"))
    except ValueError:
        logger.warning("Invalid RAG_DENSE_SCORE_THRESHOLD; using 0.35.")
        return 0.35


class _EmptyRetriever(BaseRetriever):
    """A valid retriever that represents an empty index without fake documents."""

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        return []


class _RelevanceBM25Retriever(BM25Retriever):
    """BM25 retriever that drops zero-score documents instead of returning noise."""

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        tokens = self.preprocess_func(query)
        if not tokens:
            return []

        scores = self.vectorizer.get_scores(tokens)
        ranked_indices = sorted(
            range(len(self.docs)), key=lambda index: scores[index], reverse=True
        )
        return [
            self.docs[index]
            for index in ranked_indices
            if scores[index] > 0
            or set(tokens) & set(_tokenize(self.docs[index].page_content))
        ][: self.k]


class _DenseRelevanceRetriever(BaseRetriever):
    """Dense retriever with a relevance threshold and constant-score protection."""

    vectorstore: Any = Field(exclude=True)
    search_kwargs: Dict[str, Any] = Field(default_factory=dict)
    k: int = 8
    min_score: float = 0.35

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        if not query.strip():
            return []

        try:
            scored_docs = self.vectorstore.similarity_search_with_relevance_scores(
                query,
                k=self.k,
                **self.search_kwargs,
            )
        except Exception as exc:
            # Older/custom vector stores may not expose relevance scores. In that
            # case only accept lexical matches; never blindly return nearest docs.
            logger.warning("Dense retrieval with scores failed: %s", exc)
            docs = self.vectorstore.similarity_search(
                query, k=self.k, **self.search_kwargs
            )
            return [doc for doc in docs if _has_token_overlap(query, doc.page_content)]

        valid = []
        for doc, score in scored_docs:
            try:
                score_value = float(score)
            except (TypeError, ValueError):
                continue
            if math.isfinite(score_value) and score_value >= self.min_score:
                valid.append((doc, score_value))
        if not valid:
            return []

        # Identical scores usually mean an offline/mock embedding or a failed
        # index. Do not turn that into arbitrary documents for an unknown query.
        scores = [score for _, score in valid]
        if len(valid) > 1 and max(scores) - min(scores) < 1e-9 and not any(
            _has_token_overlap(query, doc.page_content) for doc, _ in valid
        ):
            return []

        return [doc for doc, _ in valid]


class _ResilientEnsembleRetriever(EnsembleRetriever):
    """A failed remote branch must not discard healthy sparse/dense evidence."""

    def rank_fusion(self, query, run_manager, *, config=None):
        doc_lists = []
        failures = 0
        for child in self.retrievers:
            try:
                doc_lists.append(child.invoke(query, config))
            except Exception as exc:
                failures += 1
                logger.warning("Retrieval branch failed: %s", exc)
                doc_lists.append([])
        if failures == len(self.retrievers):
            raise RuntimeError("All guideline retrieval services are unavailable.")
        return self.weighted_reciprocal_rank(doc_lists)

def load_and_chunk_guidelines() -> List[Document]:
    """Loads and splits local guidelines and abstracts into chunks."""
    global _documents_cache
    if _documents_cache:
        return _documents_cache

    all_docs = []
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=400,
        chunk_overlap=50,
        separators=["\n\n", "\n", ". ", " "]
    )

    # 1. Load Clinical Guidelines
    if os.path.exists(GUIDELINES_PATH):
        with open(GUIDELINES_PATH, "r", encoding="utf-8") as f:
            guidelines_text = f.read()
        guidelines_docs = splitter.create_documents(
            texts=[guidelines_text],
            metadatas=[{"source": "AHA_ACC_Guideline"}]
        )
        all_docs.extend(guidelines_docs)
        logger.info(f"Loaded {len(guidelines_docs)} clinical guidelines chunks.")
    else:
        logger.warning(f"Guidelines file not found at {GUIDELINES_PATH}.")

    # 2. Load PubMed Abstracts
    if os.path.exists(ABSTRACTS_PATH):
        with open(ABSTRACTS_PATH, "r", encoding="utf-8") as f:
            abstracts_text = f.read()
        abstracts_docs = splitter.create_documents(
            texts=[abstracts_text],
            metadatas=[{"source": "PubMed_Abstract"}]
        )
        all_docs.extend(abstracts_docs)
        logger.info(f"Loaded {len(abstracts_docs)} PubMed abstract chunks.")
    else:
        logger.warning(f"PubMed abstracts file not found at {ABSTRACTS_PATH}.")

    _documents_cache = all_docs
    return all_docs

def setup_retriever(doctor_id: str = None):
    """Sets up the hybrid (Dense + BM25) retriever isolated per doctor."""
    global _retrievers_cache
    cache_key = doctor_id
    if cache_key in _retrievers_cache:
        return _retrievers_cache[cache_key]

    chunks = load_and_chunk_guidelines()

    # Constant mock vectors are not semantic evidence. Offline tests use BM25;
    # dense ranking is exercised separately with meaningful scored fixtures.
    try:
        if os.getenv("TESTING") == "true" or os.getenv("CI") == "true":
            raise ValueError("Dense retrieval is disabled for offline test runs.")
        from backend.config.singletons import get_embeddings
        embeddings = get_embeddings()
    except Exception as e:
        logger.error(f"Failed to get embeddings singleton: {e}. Falling back to BM25-only.")
        embeddings = None

    # Setup Dense Vector Store (Pinecone or local FAISS fallback)
    dense_vectorstore = None
    pinecone_key = Config.PINECONE_API_KEY
    if os.getenv("TESTING") == "true" or os.getenv("CI") == "true":
        logger.info("Testing/CI environment detected. Bypassing Pinecone to use local FAISS vector store.")
        pinecone_key = None
    elif pinecone_key and (pinecone_key.strip().lower().startswith("your_") or "placeholder" in pinecone_key.lower() or not pinecone_key.strip()):
        pinecone_key = None
    
    if pinecone_key and embeddings and chunks:
        try:
            from langchain_pinecone import PineconeVectorStore
            from backend.config.singletons import get_pinecone_index
            index_name = Config.PINECONE_INDEX_NAME
            
            # Ensure pinecone index is initialized/created
            _ = get_pinecone_index()
            
            dense_vectorstore = PineconeVectorStore.from_documents(
                chunks, 
                embeddings, 
                index_name=index_name,
                ids=[hashlib.sha256(
                    (doc.metadata.get("source", "") + doc.page_content).encode("utf-8")
                ).hexdigest() for doc in chunks],
            )
            logger.info("Pinecone Vector Store initialized successfully using singleton.")
        except Exception as e:
            logger.error(f"Pinecone setup failed: {e}. Falling back to local FAISS vector store.")
    
    if dense_vectorstore is None and embeddings and chunks:
        try:
            # Local FAISS fallback
            logger.info("Initializing local FAISS vector store fallback...")
            dense_vectorstore = FAISS.from_documents(
                chunks, embeddings, normalize_L2=True,
                relevance_score_fn=lambda distance: 1.0 - distance / 2.0,
            )
            logger.info("FAISS Vector Store initialized successfully.")
        except Exception as e:
            logger.error(f"FAISS vector store creation failed: {e}. Falling back to BM25-only.")
            dense_vectorstore = None

    # Setup BM25 Sparse Retriever
    bm25_retriever = (
        _RelevanceBM25Retriever.from_documents(chunks, preprocess_func=_tokenize, k=8)
        if chunks else _EmptyRetriever()
    )
    branches = [bm25_retriever]
    weights = [0.4]
    if dense_vectorstore is not None:
        branches.append(_DenseRelevanceRetriever(
            vectorstore=dense_vectorstore, k=8,
            min_score=_dense_score_threshold(),
            search_kwargs={"filter": {"source": {"$in": ["AHA_ACC_Guideline", "PubMed_Abstract"]}}},
        ))
        weights.append(0.6)

    # Setup User Uploads Retriever from Pinecone (Isolate namespace per doctor)
    try:
        if not pinecone_key or embeddings is None or not doctor_id:
            raise ValueError("No authenticated user upload index is configured.")
            
        from langchain_pinecone import PineconeVectorStore
        from backend.config.singletons import get_pinecone_index
        
        user_namespace = f"user_uploads_doc_{doctor_id}"
        
        user_vectorstore = PineconeVectorStore(
            index=get_pinecone_index(),
            embedding=embeddings,
            namespace=user_namespace
        )
        user_retriever = _DenseRelevanceRetriever(
            vectorstore=user_vectorstore,
            k=5,
            min_score=_dense_score_threshold(),
        )
        
        branches.append(user_retriever)
        weights.append(0.3)
    except Exception as e:
        logger.info("User upload retrieval not available: %s", e)

    hybrid_retriever = branches[0] if len(branches) == 1 else _ResilientEnsembleRetriever(
        retrievers=branches, weights=weights
    )
        
    _retrievers_cache[cache_key] = hybrid_retriever
    return hybrid_retriever

def get_relevant_guidelines(query: str, top_n: int = 5, doctor_id: str = None) -> List[str]:
    """Retrieves and reranks relevant guidelines for a given query."""
    query = (query or "").strip()
    try:
        top_n = int(top_n)
    except (TypeError, ValueError):
        return []
    if not query or top_n <= 0:
        logger.info("Skipping guideline retrieval for an empty query or top_n <= 0.")
        return []

    try:
        retriever = setup_retriever(doctor_id)
        raw_docs = retriever.invoke(query)
    except Exception as exc:
        logger.error("Guideline retrieval failed: %s", exc)
        return []

    if not raw_docs:
        logger.info("No relevant guidelines found for query: %s", query)
        return []

    # Ensemble retrievers can emit duplicate chunks. Preserve rank while
    # preventing duplicate context from crowding out distinct evidence.
    unique_docs = []
    seen_content = set()
    for doc in raw_docs:
        content = (doc.page_content or "").strip()
        if content and content not in seen_content:
            seen_content.add(content)
            unique_docs.append(doc)
    raw_docs = unique_docs

    # Retrieve top documents
    # Cohere Reranking
    cohere_key = Config.COHERE_API_KEY
    if cohere_key and (
        cohere_key.strip().lower().startswith("your_")
        or "placeholder" in cohere_key.lower()
        or not cohere_key.strip()
    ):
        cohere_key = None
    if os.getenv("TESTING") == "true" or os.getenv("CI") == "true":
        cohere_key = None
    if cohere_key and raw_docs:
        try:
            import cohere
            co = cohere.Client(api_key=cohere_key)
            docs_text = [d.page_content for d in raw_docs]
            
            rerank_results = co.rerank(
                query=query,
                documents=docs_text,
                top_n=min(top_n, len(raw_docs)),
                model="rerank-english-v3.0"
            )
            
            reranked_docs = []
            for r in rerank_results.results:
                reranked_docs.append(raw_docs[r.index].page_content)
            
            logger.info(f"Cohere Rerank completed. Retrieved {len(reranked_docs)} documents.")
            return reranked_docs
        except Exception as e:
            logger.warning(f"Cohere Reranking failed: {e}. Falling back to default retriever order.")
            
    # Standard Fallback: return top_n raw docs
    return [d.page_content for d in raw_docs[:top_n]]


def clear_retriever_cache(doctor_id: str = None) -> None:
    """Invalidate cached retrievers after a user changes indexed knowledge."""
    if doctor_id is None:
        _retrievers_cache.clear()
    else:
        _retrievers_cache.pop(doctor_id, None)
