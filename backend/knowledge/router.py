import logging

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from typing import List, Optional
from backend.auth import AuthUser, Role, require_roles
from backend.config.rate_limit import limiter

from backend.knowledge.processor import (
    process_guideline,
    process_ddi_csv,
    list_user_documents,
    delete_user_document
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])
logger = logging.getLogger(__name__)

@router.post("/upload/guidelines")
@limiter.limit("5/minute")
async def upload_guideline(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_user: AuthUser = Depends(require_roles(Role.medical_practitioner)),
):
    """
    Upload a clinical guideline (.pdf or .txt) to be parsed, chunked, and upserted to Pinecone.
    """
    filename = file.filename
    if not (filename.lower().endswith(".pdf") or filename.lower().endswith(".txt")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Only PDF and TXT guidelines are supported."
        )
    
    try:
        content = await file.read()
        result = process_guideline(content, filename, title, doctor_id=current_user.sub)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("guideline_upload_failed")
        raise HTTPException(status_code=500, detail="Failed to process guideline.")

@router.post("/upload/structured")
@limiter.limit("5/minute")
async def upload_structured(
    request: Request,
    file: UploadFile = File(...),
    current_user: AuthUser = Depends(require_roles(Role.medical_practitioner)),
):
    """
    Upload a structured drug-drug interaction dataset (.csv) to be parsed and seeded to Neo4j.
    Required headers: drug1, drug2, severity, effect
    """
    filename = file.filename
    if not filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Only CSV drug interaction files are supported."
        )
        
    try:
        content = await file.read()
        result = process_ddi_csv(content, doctor_id=current_user.sub)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("structured_upload_failed")
        raise HTTPException(status_code=500, detail="Failed to process structured data.")

@router.get("/documents")
@limiter.limit("30/minute")
async def get_documents(
    request: Request,
    current_user: AuthUser = Depends(require_roles(Role.medical_practitioner)),
):
    """
    Fetch all user-uploaded guidelines currently indexed in Pinecone.
    """
    try:
        docs = list_user_documents(doctor_id=current_user.sub)
        return docs
    except Exception:
        logger.exception("document_list_failed")
        raise HTTPException(status_code=500, detail="Failed to retrieve documents.")

@router.delete("/documents/{document_id}")
@limiter.limit("10/minute")
async def delete_document(
    request: Request,
    document_id: str,
    current_user: AuthUser = Depends(require_roles(Role.medical_practitioner)),
):
    """
    Remove a user-uploaded guideline and its chunks from Pinecone.
    """
    try:
        delete_user_document(document_id, doctor_id=current_user.sub)
        return {"deleted": True, "document_id": document_id}
    except Exception:
        logger.exception("document_delete_failed")
        raise HTTPException(status_code=500, detail="Failed to delete document.")
