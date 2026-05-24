from pydantic import BaseModel, Field
from typing import List, Optional

class PatientInput(BaseModel):
    age: int = Field(..., description="Age of the patient", ge=0, le=120)
    sex: str = Field(..., description="Biological sex of the patient (e.g., M, F)")
    symptoms: List[str] = Field(..., description="List of raw symptoms reported by the patient or doctor")
    duration_hours: Optional[int] = Field(None, description="Duration of symptoms in hours", ge=0)
    medications: List[str] = Field(default_factory=list, description="List of current medications the patient is taking")
    comorbidities: List[str] = Field(default_factory=list, description="List of patient comorbidities or pre-existing conditions")

class Diagnosis(BaseModel):
    name: str = Field(..., description="Name of the differential diagnosis")
    confidence: float = Field(..., description="Confidence score between 0.0 and 1.0", ge=0.0, le=1.0)
    evidence: str = Field(..., description="Clinical evidence or rationale backing the diagnosis")
    citations: List[str] = Field(default_factory=list, description="List of literature or guideline document citations supporting this diagnosis")

class ClinicalAnalysis(BaseModel):
    diagnoses: List[Diagnosis] = Field(..., description="Ranked list of differential diagnoses")
    top_confidence: float = Field(..., description="Highest confidence level score")
    recommended_workup: List[str] = Field(default_factory=list, description="Recommended laboratory tests, imaging, or physical exams")
    drug_interaction_flagged: bool = Field(default=False, description="Flag indicating if a high-severity drug interaction exists")
