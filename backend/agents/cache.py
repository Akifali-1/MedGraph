import json
import hashlib
import logging
from typing import Dict, Any, Optional
from backend.config import Config
from backend.models.patient import PatientInput
from backend.agents.orchestrator import medgraph_graph

logger = logging.getLogger(__name__)

# In-Memory Cache Fallback
_local_cache: Dict[str, Dict[str, Any]] = {}

class RedisCacheManager:
    def __init__(self):
        self.client = None
        self.use_fallback = True
        
        try:
            from backend.config.singletons import get_redis_client
            self.client = get_redis_client()
            # Fail-fast ping check on startup
            self.client.ping()
            self.use_fallback = False
            logger.info("Connected to Redis cache successfully.")
        except Exception as e:
            import os
            if os.getenv("CI") == "true" or os.getenv("TESTING") == "true" or os.getenv("MOCK_REDIS") == "true":
                self.use_fallback = True
                logger.warning(
                    f"CI/Test environment detected. Could not connect to Redis cache: {e}. "
                    "Falling back to local in-memory query cache for offline testing."
                )
            else:
                raise RuntimeError(
                    f"Fail-fast startup check: Could not connect to Redis cache: {e}. "
                    "Redis server must be running."
                )

    def _generate_key(self, patient: PatientInput) -> str:
        """Generates a deterministic MD5 hash key for patient symptoms and medications."""
        # Sort values to ensure key consistency
        sorted_symptoms = sorted([s.strip().lower() for s in patient.symptoms])
        sorted_medications = sorted([m.strip().lower() for m in patient.medications])
        
        # Combine parameters into a structured tuple string
        payload = {
            "symptoms": sorted_symptoms,
            "medications": sorted_medications,
            "age": patient.age,
            "sex": patient.sex.upper()
        }
        serialized = json.dumps(payload, sort_keys=True)
        return hashlib.md5(serialized.encode("utf-8")).hexdigest()

    def get(self, patient: PatientInput) -> Optional[Dict[str, Any]]:
        """Retrieves cached result if matches exist."""
        key = self._generate_key(patient)
        
        if self.use_fallback:
            if key in _local_cache:
                logger.info("Cache HIT [In-Memory Cache]")
                return _local_cache[key]
            return None

        try:
            cached_val = self.client.get(key)
            if cached_val:
                logger.info("Cache HIT [Redis Cache]")
                return json.loads(cached_val.decode("utf-8"))
        except Exception as e:
            logger.error(f"Redis cache read error: {e}")
        return None

    def set(self, patient: PatientInput, val: Dict[str, Any], ttl_seconds: int = 86400):
        """Saves output to cache."""
        key = self._generate_key(patient)
        
        if self.use_fallback:
            _local_cache[key] = val
            logger.info("Cached result stored [In-Memory Cache]")
            return

        try:
            self.client.setex(key, ttl_seconds, json.dumps(val))
            logger.info("Cached result stored [Redis Cache]")
        except Exception as e:
            logger.error(f"Redis cache write error: {e}")

# Instantiate global cache manager
cache_manager = RedisCacheManager()

def diagnose_patient(patient: PatientInput, request_id: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves cached diagnoses, or invokes the LangGraph orchestrator on cache miss."""
    cached_result = cache_manager.get(patient)
    if cached_result:
        return cached_result
        
    logger.info("Cache MISS - Running LangGraph agent workflow.")
    
    import uuid
    if not request_id:
        request_id = str(uuid.uuid4())
        
    # Initialize state dictionary
    initial_state = {
        "request_id": request_id,
        "patient_data": patient.model_dump(),
        "rag_chunks": [],
        "graph_results": {},
        "aggregated_context": "",
        "diagnoses": [],
        "confidence": 0.0,
        "drug_interaction_flag": False,
        "iteration": 0,
        "query_refinement": "",
        "final_output": None,
        "citation_warnings_present": False
    }
    
    # Run the graph
    result_state = medgraph_graph.invoke(initial_state)
    output = result_state.get("final_output", {})
    
    # Store in cache
    if output:
        cache_manager.set(patient, output)
        
    return output
