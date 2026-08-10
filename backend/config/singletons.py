import os
import logging
import pinecone
from backend.config import Config

logger = logging.getLogger(__name__)

# Private module-level cache variables for singletons
_redis_client = None
_neo4j_client = None
_pinecone_index = None
_embeddings = None
_gemini_chat = None

def get_redis_client():
    """Returns a singleton Redis client instance."""
    global _redis_client
    if _redis_client is None:
        import redis
        host = Config.REDIS_HOST
        port = Config.REDIS_PORT
        logger.info(f"Initializing Redis Client Singleton (target: {host}:{port})...")
        _redis_client = redis.Redis(host=host, port=port, db=0, socket_timeout=2, socket_connect_timeout=2)
    return _redis_client

def get_neo4j_client():
    """Returns a singleton Neo4j client instance."""
    global _neo4j_client
    if _neo4j_client is None:
        from backend.graph.client import Neo4jClient
        logger.info("Initializing Neo4j Client Singleton...")
        _neo4j_client = Neo4jClient()
    return _neo4j_client

def get_embeddings():
    """Returns a singleton Embeddings instance, falling back to OpenAI if Google keys are missing."""
    global _embeddings
    if _embeddings is None:
        if os.getenv("TESTING") == "true" or os.getenv("CI") == "true":
            from langchain_core.embeddings import Embeddings
            class FakeEmbeddings(Embeddings):
                def embed_documents(self, texts):
                    return [[0.1] * 768 for _ in texts]
                def embed_query(self, text):
                    return [0.1] * 768
            logger.info("Initializing offline Mock FakeEmbeddings for testing...")
            _embeddings = FakeEmbeddings()
            return _embeddings

        google_key = Config.GOOGLE_API_KEY
        openai_key = Config.OPENAI_API_KEY
        
        # Clean placeholders
        if google_key and (google_key.strip().lower().startswith("your_") or "placeholder" in google_key.lower() or not google_key.strip()):
            google_key = None
            
        if openai_key and (openai_key.strip().lower().startswith("your_") or "placeholder" in openai_key.lower() or not openai_key.strip()):
            openai_key = None

        if google_key:
            try:
                from langchain_google_genai import GoogleGenerativeAIEmbeddings
                logger.info("Initializing Google Generative AI Embeddings (gemini-embedding-001) Singleton...")
                _embeddings = GoogleGenerativeAIEmbeddings(
                    google_api_key=google_key,
                    model="models/gemini-embedding-001"
                )
            except Exception as e:
                logger.error(f"Failed to initialize GoogleGenerativeAIEmbeddings: {e}")
                
        if _embeddings is None and openai_key:
            try:
                from langchain_openai import OpenAIEmbeddings
                logger.info("Initializing OpenAI Embeddings (text-embedding-3-large) Singleton...")
                _embeddings = OpenAIEmbeddings(
                    openai_api_key=openai_key, 
                    model="text-embedding-3-large"
                )
            except Exception as e:
                logger.error(f"Failed to initialize OpenAIEmbeddings: {e}")
                
        if _embeddings is None:
            raise ValueError("No valid embedding API keys configured (Google or OpenAI).")
            
    return _embeddings

def get_pinecone_index():
    """Returns a singleton Pinecone index client. Automatically creates serverless index if missing."""
    global _pinecone_index
    if _pinecone_index is None:
        pinecone_key = Config.PINECONE_API_KEY
        if not pinecone_key or pinecone_key.strip().lower().startswith("your_") or "placeholder" in pinecone_key.lower() or not pinecone_key.strip():
            raise ValueError("Pinecone API Key is missing or placeholder.")
            
        pc = pinecone.Cone(api_key=pinecone_key) if hasattr(pinecone, 'Cone') else pinecone.Pinecone(api_key=pinecone_key)
        index_name = Config.PINECONE_INDEX_NAME
        
        existing_indexes = [idx.name for idx in pc.list_indexes()]
        if index_name not in existing_indexes:
            embeddings = get_embeddings()
            emb_dim = len(embeddings.embed_query("test"))
            logger.info(f"Creating Pinecone Serverless Index '{index_name}' (dimension: {emb_dim})...")
            pc.create_index(
                name=index_name,
                dimension=emb_dim,
                metric="cosine",
                spec=pinecone.ServerlessSpec(cloud="aws", region=Config.PINECONE_ENV or "us-east-1")
            )
        _pinecone_index = pc.Index(index_name)
    return _pinecone_index

def get_gemini_chat():
    """Returns a singleton instance of Google Gemini Chat client."""
    global _gemini_chat
    if _gemini_chat is None:
        google_key = Config.GOOGLE_API_KEY
        if google_key and not (google_key.strip().lower().startswith("your_") or "placeholder" in google_key.lower() or not google_key.strip()):
            from langchain_google_genai import ChatGoogleGenerativeAI
            logger.info("Initializing ChatGoogleGenerativeAI (gemini-2.5-flash-lite) Singleton...")
            _gemini_chat = ChatGoogleGenerativeAI(
                google_api_key=google_key, 
                model="gemini-2.5-flash-lite", 
                temperature=0.1,
                request_timeout=120
            )
        else:
            raise ValueError("Google API key is missing or placeholder. Required for Gemini Chat.")
    return _gemini_chat
