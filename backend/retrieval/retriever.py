import os
import logging
from typing import List
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.retrievers import BM25Retriever
from langchain_classic.retrievers import EnsembleRetriever
from backend.config import Config

logger = logging.getLogger(__name__)

# Paths
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
GUIDELINES_PATH = os.path.join(DATA_DIR, "data", "aha_acc_guidelines.txt")
ABSTRACTS_PATH = os.path.join(DATA_DIR, "data", "pubmed_abstracts.txt")

# Global Retriever Instances
_hybrid_retriever = None
_documents_cache = []

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

def setup_retriever():
    """Sets up the hybrid (Dense + BM25) retriever."""
    global _hybrid_retriever
    if _hybrid_retriever is not None:
        return _hybrid_retriever

    chunks = load_and_chunk_guidelines()
    if not chunks:
        # Prevent crash if no guidelines are loaded
        chunks = [Document(page_content="No clinical guidelines seeded.", metadata={"source": "System"})]

    # Initialize Embeddings using shared singleton
    try:
        from backend.config.singletons import get_embeddings
        embeddings = get_embeddings()
    except Exception as e:
        logger.error(f"Failed to get embeddings singleton: {e}. Falling back to BM25-only.")
        embeddings = None

    # Setup Dense Vector Store (Pinecone or local FAISS fallback)
    dense_vectorstore = None
    pinecone_key = Config.PINECONE_API_KEY
    if pinecone_key and (pinecone_key.strip().lower().startswith("your_") or "placeholder" in pinecone_key.lower() or not pinecone_key.strip()):
        pinecone_key = None
    
    if pinecone_key and embeddings:
        try:
            from langchain_pinecone import PineconeVectorStore
            from backend.config.singletons import get_pinecone_index
            index_name = Config.PINECONE_INDEX_NAME
            
            # Ensure pinecone index is initialized/created
            _ = get_pinecone_index()
            
            dense_vectorstore = PineconeVectorStore.from_documents(
                chunks, 
                embeddings, 
                index_name=index_name
            )
            logger.info("Pinecone Vector Store initialized successfully using singleton.")
        except Exception as e:
            logger.error(f"Pinecone setup failed: {e}. Falling back to local FAISS vector store.")
    
    if dense_vectorstore is None and embeddings:
        try:
            # Local FAISS fallback
            logger.info("Initializing local FAISS vector store fallback...")
            dense_vectorstore = FAISS.from_documents(chunks, embeddings)
            logger.info("FAISS Vector Store initialized successfully.")
        except Exception as e:
            logger.error(f"FAISS vector store creation failed: {e}. Falling back to BM25-only.")
            dense_vectorstore = None

    # Setup BM25 Sparse Retriever
    bm25_retriever = BM25Retriever.from_documents(chunks)
    bm25_retriever.k = 8

    # Fallback to BM25-only if dense store could not be initialized
    if dense_vectorstore is None:
        logger.warning("No dense vector store available. Falling back to BM25-only retriever.")
        bm25_retriever.k = 5
        _hybrid_retriever = bm25_retriever
        return _hybrid_retriever

    # Setup Dense Retriever
    dense_retriever = dense_vectorstore.as_retriever(
        search_kwargs={
            "k": 8,
            "filter": {"source": "AHA_ACC_Guideline"}
        }
    )

    # Setup User Uploads Retriever from Pinecone
    try:
        from langchain_pinecone import PineconeVectorStore
        from backend.config.singletons import get_pinecone_index
        user_vectorstore = PineconeVectorStore(
            index=get_pinecone_index(),
            embedding=embeddings,
            namespace="user_uploads"
        )
        user_retriever = user_vectorstore.as_retriever(search_kwargs={"k": 5})
        
        # Combine using Reciprocal Rank Fusion (RRF)
        _hybrid_retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, dense_retriever, user_retriever],
            weights=[0.3, 0.4, 0.3]
        )
        logger.info("Hybrid Ensemble Retriever with User Uploads compiled successfully.")
    except Exception as e:
        logger.warning(f"Failed to setup user uploads retriever: {e}. Falling back to default ensemble.")
        # Combine using Reciprocal Rank Fusion (RRF)
        _hybrid_retriever = EnsembleRetriever(
            retrievers=[bm25_retriever, dense_retriever],
            weights=[0.4, 0.6]
        )
        logger.info("Hybrid Ensemble Retriever (Dense + Sparse) compiled successfully.")
    return _hybrid_retriever

def get_relevant_guidelines(query: str, top_n: int = 5) -> List[str]:
    """Retrieves and reranks relevant guidelines for a given query."""
    retriever = setup_retriever()
    
    # Retrieve top documents
    raw_docs = retriever.invoke(query)
    
    # Cohere Reranking
    cohere_key = Config.COHERE_API_KEY
    if cohere_key and raw_docs:
        try:
            import cohere
            co = cohere.Client(api_key=cohere_key)
            docs_text = [d.page_content for d in raw_docs]
            
            rerank_results = co.rerank(
                query=query,
                documents=docs_text,
                top_n=top_n,
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
