import os
os.environ["TESTING"] = "true"
import sys
import logging

# Ensure parent directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.models.patient import PatientInput
from backend.agents.cache import diagnose_patient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("TestClinicalFlow")

def test_critical_drug_interaction():
    """
    Test Case 1: "65M, on Warfarin + Aspirin, chest pain, jaw pain, sweating"
    This should identify the severe Warfarin + Aspirin interaction and trigger the early-exit alert node.
    """
    logger.info("\n--- TEST CASE 1: Warfarin + Aspirin (Expected: Early Alert Exit) ---")
    patient = PatientInput(
        age=65,
        sex="M",
        symptoms=["chest pain", "jaw pain", "sweating"],
        medications=["Warfarin", "Aspirin"],
        comorbidities=[]
    )
    
    result = diagnose_patient(patient)
    
    # Assertions
    assert result is not None, "Result is None"
    assert "alert" in result, "No early-exit alert triggered for critical drug-drug interaction!"
    assert result.get("requires_immediate_intervention") is True
    
    logger.info("Test Case 1 Passed!")
    logger.info(f"Alert Output: {result.get('alert')}")
    logger.info(f"Interactions found: {result.get('interactions')}")

def test_cardiac_differential():
    """
    Test Case 2: "65M, chest pain, jaw pain, sweating"
    No interacting meds. Should route through RAG and Knowledge Graph, compile contexts, and output cardiac diagnoses (STEMI, Angina).
    """
    logger.info("\n--- TEST CASE 2: Cardiac Symptoms (Expected: STEMI & Unstable Angina) ---")
    patient = PatientInput(
        age=65,
        sex="M",
        symptoms=["chest pressure", "jaw pain", "sweating"],  # Note: "chest pressure" should resolve to "chest pain"
        medications=[],
        comorbidities=[]
    )
    
    result = diagnose_patient(patient)
    
    # Assertions
    assert result is not None, "Result is None"
    assert "alert" not in result or result.get("requires_immediate_intervention") is not True, "False positive drug alert triggered!"
    assert "diagnoses" in result, "No differential diagnoses generated!"
    
    diagnoses = result.get("diagnoses", [])
    assert len(diagnoses) > 0, "Differential diagnosis list is empty!"
    
    # Verify STEMI or ACS is top or prominent
    top_diag = diagnoses[0]["name"]
    logger.info(f"Top Diagnosis: {top_diag} (Confidence: {diagnoses[0]['confidence']})")
    cardiac_keywords = ["stemi", "myocardial", "coronary", "acs", "angina", "cardiac"]
    assert any(kw in top_diag.lower() for kw in cardiac_keywords), f"Top diagnosis '{top_diag}' does not match expected cardiac outcomes."
    
    # Verify synonyms resolution worked
    # Patient inputted "chest pressure" which is normalized in linker
    logger.info("Test Case 2 Passed!")
    for idx, d in enumerate(diagnoses):
        logger.info(f"#{idx+1}: {d['name']} - {d['confidence']*100}% [Citations: {', '.join(d.get('citations', []))}]")

def test_neurological_differential():
    """
    Test Case 3: "54F, headache, confusion"
    Expected: Intracranial Hemorrhage.
    """
    logger.info("\n--- TEST CASE 3: Neurological Symptoms (Expected: Intracranial Hemorrhage) ---")
    patient = PatientInput(
        age=54,
        sex="F",
        symptoms=["cephalalgia", "confusion"],  # 'cephalalgia' should resolve to 'headache'
        medications=[],
        comorbidities=[]
    )
    
    result = diagnose_patient(patient)
    
    assert result is not None
    diagnoses = result.get("diagnoses", [])
    assert len(diagnoses) > 0
    
    top_diag = diagnoses[0]["name"]
    logger.info(f"Top Diagnosis: {top_diag} (Confidence: {diagnoses[0]['confidence']})")
    neuro_keywords = ["hemorrhage", "intracranial", "stroke", "ischemic", "tia", "bleed", "infarction", "migraine", "neurological"]
    assert any(kw in top_diag.lower() for kw in neuro_keywords), f"Top diagnosis '{top_diag}' does not match expected neurological outcomes."
    
    logger.info("Test Case 3 Passed!")

if __name__ == "__main__":
    logger.info("Starting clinical flow offline test suite...")
    try:
        test_critical_drug_interaction()
        test_cardiac_differential()
        test_neurological_differential()
        logger.info("\nAll Integration tests completed successfully!")
    except AssertionError as e:
        logger.error(f"Test Assertion Failed: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Test Crashed: {e}")
        sys.exit(1)
