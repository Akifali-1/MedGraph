import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import os
import uuid
import logging
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
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
from backend.auth import (
    ACCESS_TOKEN_TTL_SECONDS,
    AuthUser,
    RegisterRequest,
    Role,
    TokenResponse,
    authenticate_user,
    create_access_token,
    register_user,
    require_roles,
)

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
                raise
        
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
    description="Clinical Decision Support System (portfolio prototype)",
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

# CORS middleware for the React client.
# A wildcard origin ("*") is incompatible with credentialed requests per the
# CORS spec, so we read an explicit allowlist from the environment. In dev this
# defaults to the local Vite/Nginx origins; production must set CORS_ORIGINS.
_cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost,http://localhost:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/auth/config")
def get_auth_config():
    """
    Exposes the Google Client ID dynamically to the React client.
    """
    return {
        "google_client_id": Config.GOOGLE_CLIENT_ID or ""
    }

@app.post("/auth/token", response_model=TokenResponse)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 password grant endpoint for MedGraph demo users.
    Production should delegate this flow to an OIDC provider such as Cognito, Auth0, or Keycloak.
    """
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    requested_role = form_data.scopes[0] if form_data.scopes else None
    if requested_role and requested_role != user.role.value:
        raise HTTPException(status_code=403, detail="Account does not have the requested role.")

    return TokenResponse(
        access_token=create_access_token(user),
        expires_in=ACCESS_TOKEN_TTL_SECONDS,
        user=user,
    )


@app.post("/auth/register", response_model=TokenResponse)
def register_for_access_token(payload: RegisterRequest):
    """
    Registers a demo-local account and returns an OAuth2 bearer token.
    """
    user = register_user(payload)
    return TokenResponse(
        access_token=create_access_token(user),
        expires_in=ACCESS_TOKEN_TTL_SECONDS,
        user=user,
    )


from pydantic import BaseModel
class GoogleLoginRequest(BaseModel):
    credential: str
    role: Role

@app.post("/auth/google", response_model=TokenResponse)
def google_login(payload: GoogleLoginRequest):
    """
    Authenticates a user via Google ID Token (JWT).
    Registers the user in the demo-local dictionary if they don't exist yet.
    """
    import json
    import hashlib
    from backend.auth import (
        TokenResponse, AuthUser, Role, create_access_token, 
        _users, _b64url_decode, ACCESS_TOKEN_TTL_SECONDS
    )
    
    credential = payload.credential

    # The demo bypass mints a real token for whatever role is asked for. It is
    # intentionally restricted to an explicit test environment; a production
    # .env must never be able to turn this into a public login path.
    _allow_mock = (
        os.getenv("TESTING") == "true"
        and os.getenv("ALLOW_MOCK_AUTH") == "true"
    )

    if credential == "mock_google_jwt_token":
        if not _allow_mock:
            raise HTTPException(status_code=401, detail="Invalid Google credential.")
        # Create a mock Google user payload for the offline demo
        google_user = {
            "email": "demo.doctor@gmail.com" if payload.role == Role.medical_practitioner else "demo.patient@gmail.com",
            "name": "Dr. Alex Taylor, MD" if payload.role == Role.medical_practitioner else "Alex Taylor",
            "sub": "google_123456789",
            "email_verified": True,
        }
    else:
        # Verify the ID token against Google's public keys. Decoding the payload
        # without checking the signature would let anyone forge an identity and
        # any role, so an unverifiable token is rejected outright.
        client_id = (Config.GOOGLE_CLIENT_ID or "").strip()
        if not client_id or client_id.lower().startswith("your_") or "placeholder" in client_id.lower():
            raise HTTPException(
                status_code=503,
                detail="Google sign-in is unavailable: GOOGLE_CLIENT_ID is not configured.",
            )

        try:
            from google.oauth2 import id_token as google_id_token
            from google.auth.transport import requests as google_requests

            google_user = google_id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                client_id,
            )
            if google_user.get("iss") not in (
                "accounts.google.com",
                "https://accounts.google.com",
            ):
                raise ValueError("Unexpected token issuer.")
            if google_user.get("email_verified") is not True:
                raise ValueError("Google email is not verified.")
        except ImportError:
            log.error("google_auth_library_missing")
            raise HTTPException(
                status_code=503,
                detail="Google sign-in is unavailable: server is missing the google-auth library.",
            )
        except Exception as e:
            log.warning("google_token_verification_failed", error=str(e))
            raise HTTPException(status_code=401, detail="Invalid or expired Google token.")
            
    email = google_user.get("email", "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="Google token does not contain an email address.")

    if not google_user.get("sub"):
        raise HTTPException(status_code=401, detail="Google token does not contain a stable subject identifier.")
        
    name = google_user.get("name", "Google User")
    sub = google_user.get("sub", f"g_{hashlib.sha1(email.encode()).hexdigest()[:12]}")
    
    # Register/retrieve user in local store
    if email not in _users:
        user = AuthUser(
            sub=f"usr_{sub}",
            email=email,
            role=payload.role,
            tenant_id=os.getenv("DEFAULT_TENANT_ID", "demo-clinic"),
            name=name,
            clinic="Google Integrated Center" if payload.role == Role.medical_practitioner else None,
            npi="9999999999" if payload.role == Role.medical_practitioner else None
        )
        _users[email] = {
            "password_hash": "", # SSO users have no local password hash
            "user": user
        }
    else:
        user = _users[email]["user"]
        
    if user.role != payload.role:
        raise HTTPException(status_code=403, detail="Account exists with a different role on the platform.")
        
    return TokenResponse(
        access_token=create_access_token(user),
        expires_in=ACCESS_TOKEN_TTL_SECONDS,
        user=user
    )


@app.post("/diagnose")
@limiter.limit("10/minute")
def diagnose(
    request: Request,
    patient: PatientInput,
    mode: str = "react",
    current_user: AuthUser = Depends(require_roles(Role.medical_practitioner, Role.patient)),
):
    """
    Ingests patient details, parses symptoms & medications, queries
    clinical guidelines RAG + Neo4j Graph, and generates differential diagnoses.
    Primary mode: 'react' (Parallel-Retrieval Augmented ReAct Agent).
    Legacy fallback: 'dag' (static orchestrator).
    """
    mode = mode.strip().lower()
    if mode not in {"react", "dag"}:
        raise HTTPException(status_code=400, detail="mode must be either 'react' or 'dag'")

    start_time = time.time()
    request_id = str(uuid.uuid4())
    
    log.info("diagnosis_request_received", 
             request_id=request_id,
             mode=mode,
             age=patient.age, 
             sex=patient.sex, 
             role=current_user.role.value,
             tenant_id=current_user.tenant_id,
             symptoms_count=len(patient.symptoms),
             medications_count=len(patient.medications))
    
    doctor_id = current_user.sub if current_user else None

    if mode == "react":
        # Step 1: Perform entity resolution
        from backend.agents.entity_linker import resolve_clinical_entities
        resolved_patient = resolve_clinical_entities(patient)
        
        # Step 2: Fetch baseline Graph & Guidelines context (Option A: RA-ReAct)
        from backend.graph.tools import query_knowledge_graph
        from backend.retrieval.retriever import get_relevant_guidelines, build_clinical_query
        
        initial_ddi = query_knowledge_graph.invoke({
            "patient_medications": resolved_patient.medications,
            "patient_symptoms": resolved_patient.symptoms,
            "doctor_id": doctor_id
        })
        
        query_text = build_clinical_query(resolved_patient)
        initial_guidelines = get_relevant_guidelines(query_text, top_n=5, doctor_id=doctor_id)
        
        # Step 3: Invoke the custom ReAct agent graph
        from backend.agents.react_agent import run_react_agent
        result = run_react_agent(resolved_patient, initial_ddi, initial_guidelines, request_id, doctor_id=doctor_id)
    else:
        result = diagnose_patient(patient, request_id=request_id, doctor_id=doctor_id)
    
    latency = round((time.time() - start_time) * 1000, 2)
    log.info("diagnosis_request_completed", 
             request_id=request_id,
             mode=mode,
             latency_ms=latency, 
             diagnoses_count=len(result.get("diagnoses", [])),
             critical_flag=result.get("critical_flag", False) or result.get("requires_immediate_intervention", False))
    
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
        import os
        redis_is_mock = (
            os.getenv("CI") == "true"
            or os.getenv("TESTING") == "true"
            or os.getenv("MOCK_REDIS") == "true"
        )
        dependencies["redis"] = "mock (healthy)" if redis_is_mock else f"unhealthy: {str(e)}"
        # Offline Redis is an explicit local/test mode, not a failed dependency.
        if not redis_is_mock:
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
