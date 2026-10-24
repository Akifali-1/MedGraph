import base64
import hashlib
import os
import re
import time
from enum import Enum
from typing import Annotated

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

# bcrypt is a deliberately slow, salted hash — the correct choice for
# credentials (unlike a fast, unsalted digest like SHA-256). bcrypt operates on
# at most 72 bytes, so we cap the input to stay within that bound.
_BCRYPT_MAX_BYTES = 72

# Signing algorithm for the access tokens we mint.
JWT_ALGORITHM = "HS256"


class Role(str, Enum):
    medical_practitioner = "medical_practitioner"
    patient = "patient"


class AuthUser(BaseModel):
    sub: str
    email: str
    role: Role
    tenant_id: str = os.getenv("DEFAULT_TENANT_ID", "demo-clinic")
    name: str | None = None
    npi: str | None = None
    clinic: str | None = None


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: Role
    name: str | None = None
    npi: str | None = None
    clinic: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthUser


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)

ACCESS_TOKEN_TTL_SECONDS = int(os.getenv("AUTH_ACCESS_TOKEN_TTL_SECONDS", "3600"))
_DEFAULT_DEV_SECRET = "dev-only-change-me"
AUTH_SECRET = os.getenv("AUTH_SECRET", _DEFAULT_DEV_SECRET)
DEFAULT_TENANT_ID = os.getenv("DEFAULT_TENANT_ID", "demo-clinic")

# Refuse to boot with the insecure default secret outside of dev/test contexts.
if AUTH_SECRET == _DEFAULT_DEV_SECRET or len(AUTH_SECRET) < 32:
    if os.getenv("TESTING") == "true" or os.getenv("CI") == "true":
        import warnings
        warnings.warn("AUTH_SECRET is weak in test mode", RuntimeWarning)
    else:
        raise RuntimeError(
            "AUTH_SECRET must be a strong random value of at least 32 characters "
            "before starting outside test/CI mode."
        )


def _hash_password(password: str) -> str:
    # bcrypt operates on at most 72 bytes; longer inputs are truncated by the
    # algorithm, so we truncate explicitly to keep hashing deterministic.
    return bcrypt.hashpw(
        password.encode("utf-8")[:_BCRYPT_MAX_BYTES], bcrypt.gensalt()
    ).decode("utf-8")


# Demo-local user store. Replace with Cognito/Auth0/Keycloak or a persisted DB before production.
_users: dict[str, dict] = {
    "e.carter@medgraph.ai": {
        "password_hash": _hash_password("password"),
        "user": AuthUser(
            sub="usr_practitioner_demo",
            email="e.carter@medgraph.ai",
            role=Role.medical_practitioner,
            tenant_id="demo-clinic",
            name="Dr. Evelyn Carter, MD",
            npi="1982736450",
            clinic="Cardiovascular Research Center",
        ),
    },
    "arthur.pendelton@gmail.com": {
        "password_hash": _hash_password("password"),
        "user": AuthUser(
            sub="usr_patient_demo",
            email="arthur.pendelton@gmail.com",
            role=Role.patient,
            tenant_id="demo-clinic",
            name="Arthur Pendelton",
        ),
    },
}


def _b64url_decode(data: str) -> bytes:
    """URL-safe base64 decode with padding restored.

    Retained for decoding third-party (Google) ID token payloads, which we
    read as untrusted claims — not for verifying our own tokens.
    """
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(
            password.encode("utf-8")[:_BCRYPT_MAX_BYTES],
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # Malformed or unsupported hash in the store.
        return False


def create_access_token(user: AuthUser) -> str:
    now = int(time.time())
    payload = {
        "sub": user.sub,
        "email": user.email,
        "role": user.role.value,
        "tenant_id": user.tenant_id,
        "name": user.name,
        "npi": user.npi,
        "clinic": user.clinic,
        "iat": now,
        "exp": now + ACCESS_TOKEN_TTL_SECONDS,
    }
    return jwt.encode(payload, AUTH_SECRET, algorithm=JWT_ALGORITHM)


def authenticate_user(email: str, password: str) -> AuthUser | None:
    record = _users.get(email.lower())
    if not record or not _verify_password(password, record["password_hash"]):
        return None
    return record["user"]


def register_user(payload: RegisterRequest) -> AuthUser:
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Password must contain at least 8 characters.")

    if payload.role == Role.medical_practitioner:
        if not payload.npi or not re.fullmatch(r"\d{10}", payload.npi.strip()):
            raise HTTPException(status_code=422, detail="A valid 10-digit NPI is required for practitioner accounts.")
        if not payload.clinic or not payload.clinic.strip():
            raise HTTPException(status_code=422, detail="Clinic is required for practitioner accounts.")

    email = payload.email.lower()
    if email in _users:
        raise HTTPException(status_code=409, detail="An account already exists for this email.")

    user = AuthUser(
        sub=f"usr_{hashlib.sha256(email.encode()).hexdigest()[:12]}",
        email=email,
        role=payload.role,
        # Tenant membership is server-controlled. A public registration request
        # must not be able to mint a token for an arbitrary tenant.
        tenant_id=DEFAULT_TENANT_ID,
        name=payload.name,
        npi=payload.npi,
        clinic=payload.clinic,
    )
    _users[email] = {"password_hash": _hash_password(payload.password), "user": user}
    return user


def decode_access_token(token: str) -> AuthUser:
    try:
        claims = jwt.decode(token, AUTH_SECRET, algorithms=[JWT_ALGORITHM])
        return AuthUser(
            sub=claims["sub"],
            email=claims["email"],
            role=Role(claims["role"]),
            tenant_id=claims.get("tenant_id", DEFAULT_TENANT_ID),
            name=claims.get("name"),
            npi=claims.get("npi"),
            clinic=claims.get("clinic"),
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(token: Annotated[str | None, Depends(oauth2_scheme)]) -> AuthUser:
    if (
        os.getenv("TESTING") == "true"
        and os.getenv("ALLOW_TEST_AUTH") == "true"
    ):
        return AuthUser(
            sub="test_practitioner",
            email="test-practitioner@medgraph.ai",
            role=Role.medical_practitioner,
            tenant_id="test-clinic",
            name="Test Practitioner",
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return decode_access_token(token)


def require_roles(*roles: Role):
    allowed = set(roles)

    def dependency(user: Annotated[AuthUser, Depends(get_current_user)]) -> AuthUser:
        if user.role not in allowed:
            raise HTTPException(status_code=403, detail="Insufficient role privileges.")
        return user

    return dependency
