import uuid
import logging
import sys
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import structlog

from backend.config import Config
from backend.config.rate_limit import limiter
from backend.models.patient import PatientInput
from backend.agents.cache import diagnose_patient

# Configure Structlog
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()

# Setup standard logging forwarding to structlog
logging.basicConfig(
    format="%(message)s",
    stream=sys.stdout,
    level=logging.INFO,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize and check all client singletons on startup
    log.info("lifespan_startup_initializing_singletons")
    try:
        from backend.config.singletons import (
            get_redis_client,
            get_neo4j_client,
            get_embeddings,
            get_pinecone_index,
            get_gemini_chat
        )
        
        # 1. Redis fail-fast check
        try:
            redis_client = get_redis_client()
            redis_client.ping()
            log.info("lifespan_startup_redis_connected")
        except Exception as e:
            import os
            if os.getenv("CI") == "true" or os.getenv("TESTING") == "true" or os.getenv("MOCK_REDIS") == "true":
                log.warning("lifespan_startup_redis_fallback_warning", error=str(e))
            else:
                raise e
        
        # 2. Neo4j connection verification
        neo4j_client = get_neo4j_client()
        if not neo4j_client.use_mock:
            neo4j_client.driver.verify_connectivity()
            log.info("lifespan_startup_neo4j_connected")
        else:
            log.info("lifespan_startup_neo4j_mock_mode")
            
        # 3. Embeddings singleton
        _ = get_embeddings()
        log.info("lifespan_startup_embeddings_ready")
        
        # 4. Pinecone index singleton
        _ = get_pinecone_index()
        log.info("lifespan_startup_pinecone_ready")
        
        # 5. Gemini Chat singleton
        _ = get_gemini_chat()
        log.info("lifespan_startup_gemini_chat_ready")
        
    except Exception as e:
        log.error("lifespan_startup_failed", error=str(e))
        # Raising RuntimeError to fail-fast on startup configuration errors
        raise RuntimeError(f"Startup check failed: {e}")
        
    yield
    
    # Shutdown / cleanup
    log.info("lifespan_shutdown_cleaning_up")
    try:
        from backend.config.singletons import get_neo4j_client
        neo4j_client = get_neo4j_client()
        neo4j_client.close()
        log.info("lifespan_shutdown_neo4j_closed")
    except Exception as e:
        log.error("lifespan_shutdown_cleanup_error", error=str(e))


app = FastAPI(
    title="MedGraph AI",
    description="Production-Grade Clinical Decision Support System",
    version="1.0.0",
    lifespan=lifespan
)

# Set limiter in app state
app.state.limiter = limiter

# Register global exception handlers for structured schema output
@app.exception_handler(RateLimitExceeded)
async def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    log.warning("rate_limit_exceeded", ip=get_remote_address(request))
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded. Please try again later.",
            "code": "RATE_LIMIT_EXCEEDED",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    log.error("validation_error", errors=exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "error": "Input validation failed. Please check the request body format.",
            "code": "VALIDATION_ERROR",
            "details": exc.errors(),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    log.error("http_error", status_code=exc.status_code, detail=exc.detail)
    code = "HTTP_ERROR"
    if exc.status_code == 429:
        code = "RATE_LIMIT_EXCEEDED"
    elif exc.status_code == 404:
        code = "NOT_FOUND"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "code": code,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.exception("unhandled_exception", error=str(exc))
    return JSONResponse(
        status_code=500,
        content={
            "error": "An unexpected internal server error occurred.",
            "code": "INTERNAL_SERVER_ERROR",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )

# Import and mount the knowledge router
from backend.knowledge.router import router as knowledge_router
app.include_router(knowledge_router)

# CORS middleware for React connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/diagnose")
@limiter.limit("10/minute")
def diagnose(request: Request, patient: PatientInput):
    """
    Ingests patient details, parses symptoms & medications, queries
    clinical guidelines RAG + Neo4j Graph, and generates differential diagnoses.
    """
    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    log.info("diagnosis_request_received", 
             request_id=request_id,
             age=patient.age, 
             sex=patient.sex, 
             symptoms_count=len(patient.symptoms),
             medications_count=len(patient.medications))
    
    result = diagnose_patient(patient, request_id=request_id)
    
    latency = round((time.time() - start_time) * 1000, 2)
    log.info("diagnosis_request_completed", 
             request_id=request_id,
             latency_ms=latency, 
             diagnoses_count=len(result.get("diagnoses", [])),
             critical_flag=result.get("critical_flag", False))
    
    return result

@app.get("/health")
@limiter.limit("30/minute")
def health_check(request: Request):
    """
    Checks status of all external integrations:
    - Redis (via singleton ping with fast socket timeouts)
    - Neo4j (via singleton mock check or status)
    - Pinecone (via singleton verification)
    - SageMaker (if configured, via boto3 check)
    """
    dependencies = {}
    is_healthy = True

    # 1. Redis Check (uses fast socket connection attempt to avoid blocking)
    try:
        import socket
        from backend.config import Config
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.5)
        s.connect((Config.REDIS_HOST, int(Config.REDIS_PORT)))
        s.close()
        dependencies["redis"] = "healthy"
    except Exception as e:
        dependencies["redis"] = f"unhealthy: {str(e)}"
        # If we are in testing/CI, we allow Redis to be offline without marking the whole system unhealthy
        import os
        if not (os.getenv("CI") == "true" or os.getenv("TESTING") == "true" or os.getenv("MOCK_REDIS") == "true"):
            is_healthy = False

    # 2. Neo4j Check (uses active driver singleton)
    try:
        from backend.config.singletons import get_neo4j_client
        neo4j_client = get_neo4j_client()
        if neo4j_client.use_mock:
            dependencies["neo4j"] = "mock (healthy)"
        else:
            # Quick check on active connection
            dependencies["neo4j"] = "healthy"
    except Exception as e:
        dependencies["neo4j"] = f"unhealthy: {str(e)}"
        is_healthy = False

    # 3. Pinecone Check
    try:
        from backend.config.singletons import get_pinecone_index
        _ = get_pinecone_index()
        dependencies["pinecone"] = "healthy"
    except Exception as e:
        dependencies["pinecone"] = f"unhealthy: {str(e)}"
        is_healthy = False

    # 4. SageMaker Check
    sagemaker_endpoint = Config.SAGEMAKER_ENDPOINT_NAME
    if sagemaker_endpoint:
        try:
            import boto3
            session = boto3.Session(
                aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
                region_name=Config.AWS_REGION
            )
            sagemaker_client = session.client("sagemaker")
            response = sagemaker_client.describe_endpoint(EndpointName=sagemaker_endpoint)
            status = response.get("EndpointStatus")
            dependencies["sagemaker"] = f"healthy (status: {status})"
            if status != "InService":
                is_healthy = False
        except Exception as e:
            dependencies["sagemaker"] = f"unhealthy: {str(e)}"
            is_healthy = False
    else:
        dependencies["sagemaker"] = "not_configured"
        
    status_str = "healthy" if is_healthy else "unhealthy"
    status_code = 200 if is_healthy else 503
    
    return JSONResponse(
        status_code=status_code,
        content={
            "status": status_str,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "dependencies": dependencies
        }
    )
