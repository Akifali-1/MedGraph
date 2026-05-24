import logging
from typing import Dict, List, Set
from backend.models.patient import PatientInput

logger = logging.getLogger(__name__)

# Medical Terminology Mapping Dictionary (Synonyms to Standard Terms)
# In production, this would hook into a database or UMLS service.
MED_SYNONYMS: Dict[str, str] = {
    # Medications
    "coumadin": "Warfarin",
    "warfarin": "Warfarin",
    "aspirin": "Aspirin",
    "ecotrin": "Aspirin",
    "lisinopril": "Lisinopril",
    "zestril": "Lisinopril",
    "prinivil": "Lisinopril",
    "metformin": "Metformin",
    "glucophage": "Metformin",
    "lipitor": "Atorvastatin",
    "atorvastatin": "Atorvastatin",
    "plavix": "Clopidogrel",
    "clopidogrel": "Clopidogrel",
    
    # Symptoms
    "chest pain": "chest pain",
    "chest pressure": "chest pain",
    "angina": "chest pain",
    "sweating": "sweating",
    "diaphoresis": "sweating",
    "perspiring": "sweating",
    "jaw pain": "jaw pain",
    "jaw ache": "jaw pain",
    "shortness of breath": "dyspnea",
    "short of breath": "dyspnea",
    "dyspnea": "dyspnea",
    "sob": "dyspnea",
    "headache": "headache",
    "cephalalgia": "headache",
    "confusion": "confusion",
    "altered mental status": "confusion",
    "dizziness": "dizziness",
    "lightheadedness": "dizziness",
    "nausea": "nausea",
    "feeling sick": "nausea",
}

# Lazy load medspacy to avoid import slowdowns during initialization
_nlp = None

def get_medspacy_nlp():
    global _nlp
    if _nlp is None:
        try:
            import medspacy
            # Load default medspacy pipeline (includes sentence splitter, target matcher, ConText, sectionizer)
            _nlp = medspacy.load()
            logger.info("MedSpacy pipeline loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load MedSpacy ({e}). Falling back to manual rule-based parsing.")
            _nlp = False
    return _nlp

def normalize_term(term: str) -> str:
    """Normalize a symptom or drug name to its standard clinical term."""
    clean_term = term.strip().lower()
    return MED_SYNONYMS.get(clean_term, term)  # Fallback to original term if not in map

def resolve_clinical_entities(patient_input: PatientInput) -> PatientInput:
    """
    Parses patient symptoms and medications using MedSpacy and maps them to standard entities.
    Resolves synonyms (e.g. 'Coumadin' -> 'Warfarin', 'diaphoresis' -> 'sweating').
    """
    nlp = get_medspacy_nlp()
    
    resolved_symptoms: Set[str] = set()
    resolved_medications: Set[str] = set()

    # 1. Process Symptoms
    for sym in patient_input.symptoms:
        normalized = normalize_term(sym)
        resolved_symptoms.add(normalized)
        
        # If medspacy is available, analyze for deeper clinical entities or modifiers (like negation)
        if nlp:
            doc = nlp(sym)
            for ent in doc.ents:
                # Resolve extracted entity label
                resolved_symptoms.add(normalize_term(ent.text))
                
    # 2. Process Medications
    for med in patient_input.medications:
        normalized = normalize_term(med)
        resolved_medications.add(normalized)
        
        if nlp:
            doc = nlp(med)
            for ent in doc.ents:
                resolved_medications.add(normalize_term(ent.text))

    # Update patient input structure with resolved/normalized values
    patient_input.symptoms = list(resolved_symptoms)
    patient_input.medications = list(resolved_medications)
    
    logger.info(f"Resolved Symptoms: {patient_input.symptoms}")
    logger.info(f"Resolved Medications: {patient_input.medications}")
    
    return patient_input
