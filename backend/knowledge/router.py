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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process guideline: {str(e)}")

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve documents: {str(e)}")

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {str(e)}")
