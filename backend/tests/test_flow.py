import os
os.environ["TESTING"] = "true"
import sys
import logging

# Ensure parent directory is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from fastapi.testclient import TestClient
from backend.main import app

# Initialize test client
client = TestClient(app)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("TestClinicalFlow")

def test_critical_drug_interaction():
    """
    Test Case 1: "65M, on Warfarin + Aspirin, chest pain, jaw pain, sweating"
    Primary: react mode — should trigger critical DDI flag + trace_steps.
    Secondary: dag mode legacy check.
    """
    for mode in ["react", "dag"]:  # react is primary
        logger.info(f"\n--- TEST CASE 1: Warfarin + Aspirin | Mode: {mode} (Expected: Early Alert Exit) ---")
        
        response = client.post(
            f"/diagnose?mode={mode}",
            json={
                "age": 65,
                "sex": "M",
                "symptoms": ["chest pain", "jaw pain", "sweating"],
                "medications": ["Warfarin", "Aspirin"],
                "comorbidities": []
            }
        )
        
        assert response.status_code == 200, f"Request failed with status {response.status_code}: {response.text}"
        result = response.json()
        
        # Assertions
        assert result is not None
        
        # The legacy DAG returns 'alert' while ReAct returns 'critical_flag=True'
        has_critical = (
            result.get("critical_flag") is True or 
            "alert" in result or 
            result.get("requires_immediate_intervention") is True
        )
        assert has_critical, f"No early-exit alert or critical flag triggered for DDI in mode {mode}!"
        
        if mode == "react":
            assert "trace_steps" in result, "No ReAct trace_steps returned!"
            assert len(result["trace_steps"]) > 0, "ReAct trace_steps array is empty!"
            logger.info(f"ReAct trace steps count: {len(result['trace_steps'])}")
            
        logger.info(f"Test Case 1 ({mode}) Passed!")

def test_cardiac_differential():
    """
    Test Case 2: "65M, chest pain, jaw pain, sweating"
    No interacting meds. Primary (react) should output cardiac diagnoses with trace_steps.
    """
    for mode in ["react", "dag"]:  # react is primary
        logger.info(f"\n--- TEST CASE 2: Cardiac Symptoms | Mode: {mode} (Expected: STEMI & Unstable Angina) ---")
        
        response = client.post(
            f"/diagnose?mode={mode}",
            json={
                "age": 65,
                "sex": "M",
                "symptoms": ["chest pressure", "jaw pain", "sweating"],  # "chest pressure" resolves to "chest pain"
                "medications": [],
                "comorbidities": []
            }
        )
        
        assert response.status_code == 200, f"Request failed with status {response.status_code}: {response.text}"
        result = response.json()
        
        # Assertions
        assert result is not None
        assert "diagnoses" in result, f"No differential diagnoses list in mode {mode}!"
        
        diagnoses = result.get("diagnoses", [])
        assert len(diagnoses) > 0, f"Differential diagnosis list is empty in mode {mode}!"
        
        top_diag = diagnoses[0]["name"]
        logger.info(f"[{mode}] Top Diagnosis: {top_diag} (Confidence: {diagnoses[0]['confidence']})")
        
        cardiac_keywords = ["stemi", "myocardial", "coronary", "acs", "angina", "cardiac"]
        assert any(kw in top_diag.lower() for kw in cardiac_keywords), f"Top diagnosis '{top_diag}' does not match expected cardiac outcomes."
        
        if mode == "react":
            assert "trace_steps" in result, "No ReAct trace_steps returned!"
            assert len(result["trace_steps"]) > 0, "ReAct trace_steps array is empty!"
            
        logger.info(f"Test Case 2 ({mode}) Passed!")

def test_neurological_differential():
    """
    Test Case 3: "54F, headache, confusion"
    Expected: Intracranial Hemorrhage. Primary (react) must include trace_steps.
    """
    for mode in ["react", "dag"]:  # react is primary
        logger.info(f"\n--- TEST CASE 3: Neurological Symptoms | Mode: {mode} (Expected: Intracranial Hemorrhage) ---")
        
        response = client.post(
            f"/diagnose?mode={mode}",
            json={
                "age": 54,
                "sex": "F",
                "symptoms": ["cephalalgia", "confusion"],  # 'cephalalgia' resolves to 'headache'
                "medications": [],
                "comorbidities": []
            }
        )
        
        assert response.status_code == 200, f"Request failed with status {response.status_code}: {response.text}"
        result = response.json()
        
        # Assertions
        assert result is not None
        diagnoses = result.get("diagnoses", [])
        assert len(diagnoses) > 0, f"Differential diagnoses empty in mode {mode}!"
        
        top_diag = diagnoses[0]["name"]
        logger.info(f"[{mode}] Top Diagnosis: {top_diag} (Confidence: {diagnoses[0]['confidence']})")
        
        neuro_keywords = ["hemorrhage", "intracranial", "stroke", "bleed", "infarction", "neurological"]
        assert any(kw in top_diag.lower() for kw in neuro_keywords), f"Top diagnosis '{top_diag}' does not match expected neurological outcomes."
        
        if mode == "react":
            assert "trace_steps" in result, "No ReAct trace_steps returned!"
            assert len(result["trace_steps"]) > 0, "ReAct trace_steps array is empty!"
            
        logger.info(f"Test Case 3 ({mode}) Passed!")

if __name__ == "__main__":
    logger.info("Starting clinical flow offline test suite (Primary: Hybrid ReAct Agent)...")
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
