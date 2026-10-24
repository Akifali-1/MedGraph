import os
import json
import logging
from typing import TypedDict, List, Dict, Any, Optional
import structlog
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END

from backend.config import Config
from backend.models.patient import PatientInput, ClinicalAnalysis, Diagnosis
from backend.agents.entity_linker import resolve_clinical_entities
from backend.retrieval.retriever import get_relevant_guidelines, build_clinical_query
from backend.graph.tools import query_knowledge_graph
from backend.agents.evidence import verify_diagnosis_citations

log = structlog.get_logger()

NO_EVIDENCE_MESSAGE = "No relevant clinical guideline or knowledge-graph evidence was found for this query."

# State Definition
class AgentState(TypedDict):
    request_id: str
    doctor_id: str # Multi-tenant isolation context
    patient_data: Dict[str, Any]
    rag_chunks: List[str]
    graph_results: Dict[str, Any]
    aggregated_context: str
    diagnoses: List[Dict[str, Any]]
    confidence: float
    drug_interaction_flag: bool
    iteration: int
    query_refinement: str
    final_output: Optional[Dict[str, Any]]
    citation_warnings_present: bool

# Node 1: Intake and Entity Resolution
def intake_node(state: AgentState) -> Dict[str, Any]:
    request_id = state.get("request_id", "unknown")
    log.info("intake_node_start", request_id=request_id)
    raw_patient = state["patient_data"]
    
    # Load into Pydantic model for validation
    patient_model = PatientInput(**raw_patient)
    
    # Run MedSpacy & rules-based entity resolution
    resolved_patient = resolve_clinical_entities(patient_model)
    
    log.info("intake_node_completed", request_id=request_id)
    return {
        "patient_data": resolved_patient.model_dump(),
        "iteration": 0,
        "query_refinement": "",
        "rag_chunks": [],
        "graph_results": {},
        "diagnoses": [],
        "confidence": 0.0,
        "drug_interaction_flag": False,
        "citation_warnings_present": False
    }

# Node 2: RAG Agent
def rag_node(state: AgentState) -> Dict[str, Any]:
    request_id = state.get("request_id", "unknown")
    iteration = state["iteration"]
    log.info("rag_node_start", request_id=request_id, iteration=iteration)
    patient = state["patient_data"]
    
    # Build query: initial symptoms or expanded query if retry
    if iteration > 0 and state["query_refinement"]:
        query = state["query_refinement"]
        log.info("rag_node_refined_query", request_id=request_id, query=query)
    else:
        query = build_clinical_query(patient)
        log.info("rag_node_initial_query", request_id=request_id, query=query)
        
    chunks = get_relevant_guidelines(query, top_n=5, doctor_id=state.get("doctor_id"))
    log.info("rag_node_completed", request_id=request_id, chunks_retrieved=len(chunks))
    return {"rag_chunks": chunks}

# Node 3: Knowledge Graph Agent
def graph_node(state: AgentState) -> Dict[str, Any]:
    request_id = state.get("request_id", "unknown")
    log.info("graph_node_start", request_id=request_id)
    patient = state["patient_data"]
    
    # Call the wrapped Neo4j tool
    graph_out = query_knowledge_graph.invoke({
        "patient_medications": patient["medications"],
        "patient_symptoms": patient["symptoms"],
        "doctor_id": state.get("doctor_id")
    })
    
    log.info("graph_node_completed", request_id=request_id, critical_interaction_flag=graph_out["critical_interaction_flag"])
    return {
        "graph_results": graph_out,
        "drug_interaction_flag": graph_out["critical_interaction_flag"]
    }

# Node 4: Aggregator Node
def aggregator_node(state: AgentState) -> Dict[str, Any]:
    request_id = state.get("request_id", "unknown")
    log.info("aggregator_node_start", request_id=request_id)
    rag_text = "\n\n".join([f"- Chunk {i+1}: {chunk}" for i, chunk in enumerate(state["rag_chunks"])])
    if not rag_text:
        rag_text = NO_EVIDENCE_MESSAGE
    
    graph_res = state["graph_results"]
    graph_text = f"Symptom-Disease Probabilities: {graph_res.get('probable_diseases', [])}\n"
    graph_text += f"Drug Interactions: {graph_res.get('drug_interactions', [])}"
    
    aggregated = f"LITERATURE GUIDELINES:\n{rag_text}\n\nKNOWLEDGE GRAPH RELATIONSHIPS:\n{graph_text}"
    log.info("aggregator_node_completed", request_id=request_id)
    return {"aggregated_context": aggregated}

# Node 5: Reasoning Node (Vertex AI / SageMaker / OpenAI / Mock Fallback)
def reasoning_node(state: AgentState) -> Dict[str, Any]:
    request_id = state.get("request_id", "unknown")
    log.info("reasoning_node_start", request_id=request_id)
    patient = state["patient_data"]
    context = state["aggregated_context"]

    if not state["rag_chunks"] and not (
        state["graph_results"].get("probable_diseases")
        or state["graph_results"].get("drug_interactions")
    ):
        data = {"diagnoses": [], "recommended_workup": [],
                "status": "no_results", "message": NO_EVIDENCE_MESSAGE}
        return {"diagnoses": [], "confidence": 0.0,
                "query_refinement": "", "final_output": data}
    
    system_prompt = (
        "You are an advanced clinical decision support assistant. Analyze the patient "
        "and retrieved context to provide a ranked list of differential diagnoses with confidence scores "
        "and specific citations. Respond ONLY in valid JSON format matching this structure:\n"
        "{\n"
        "  \"diagnoses\": [\n"
        "    {\"name\": \"Diagnosis Name\", \"confidence\": 0.85, \"evidence\": \"Why this diagnosis\", \"citations\": [\"Guideline X\"]}\n"
        "  ],\n"
        "  \"top_confidence\": 0.85,\n"
        "  \"recommended_workup\": [\"Test A\", \"Test B\"],\n"
        "  \"query_refinement\": \"Specify search terms for further query if confidence is low\"\n"
        "}"
    )
    
    user_prompt = f"Patient Details:\n{json.dumps(patient, indent=2)}\n\nClinical Context:\n{context}"
    
    openai_key = Config.OPENAI_API_KEY
    google_key = Config.GOOGLE_API_KEY
    sagemaker_endpoint = Config.SAGEMAKER_ENDPOINT_NAME
    
    if os.getenv("TESTING") == "true" or os.getenv("CI") == "true":
        # Force mock fallback in testing mode for offline stability
        openai_key = None
        google_key = None
        sagemaker_endpoint = None
    
    if sagemaker_endpoint:
        try:
            log.info("reasoning_node_invoking_sagemaker", request_id=request_id, endpoint=sagemaker_endpoint)
            import boto3
            session = boto3.Session(
                aws_access_key_id=Config.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=Config.AWS_SECRET_ACCESS_KEY,
                region_name=Config.AWS_REGION
            )
            runtime = session.client("sagemaker-runtime")
            
            # Format using Gemma 2 Instruct chat template
            full_prompt = (
                f"<start_of_turn>user\n"
                f"{system_prompt}\n\n"
                f"Patient Details & Clinical Context:\n{user_prompt}<end_of_turn>\n"
                f"<start_of_turn>model\n"
            )
            
            payload = {
                "inputs": full_prompt,
                "parameters": {
                    "temperature": 0.1,
                    "max_new_tokens": 1024,
                    "return_full_text": False
                }
            }
            
            response = runtime.invoke_endpoint(
                EndpointName=sagemaker_endpoint,
                ContentType="application/json",
                Body=json.dumps(payload)
            )
            
            response_body = response["Body"].read().decode("utf-8")
            response_json = json.loads(response_body)
            
            if isinstance(response_json, list) and len(response_json) > 0:
                text_out = response_json[0].get("generated_text", "")
            elif isinstance(response_json, dict):
                text_out = response_json.get("generated_text", "")
            else:
                text_out = str(response_json)
                
            clean_content = text_out.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
                
            data = json.loads(clean_content)
            log.info("reasoning_node_sagemaker_completed", request_id=request_id)
            return {
                "diagnoses": data.get("diagnoses", []),
                "confidence": data.get("top_confidence", 0.0),
                "query_refinement": data.get("query_refinement", ""),
                "final_output": data
            }
        except Exception as e:
            log.error("reasoning_node_sagemaker_failed", request_id=request_id, error=str(e))

    if google_key:
        try:
            log.info("reasoning_node_invoking_gemini", request_id=request_id)
            from backend.config.singletons import get_gemini_chat
            llm = get_gemini_chat()
            response = llm.invoke([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ])
            
            clean_content = response.content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
                
            data = json.loads(clean_content)
            log.info("reasoning_node_gemini_completed", request_id=request_id)
            return {
                "diagnoses": data.get("diagnoses", []),
                "confidence": data.get("top_confidence", 0.0),
                "query_refinement": data.get("query_refinement", ""),
                "final_output": data
            }
        except Exception as e:
            log.error("reasoning_node_gemini_failed", request_id=request_id, error=str(e))

    if openai_key:
        try:
            log.info("reasoning_node_invoking_openai", request_id=request_id)
            llm = ChatOpenAI(api_key=openai_key, model="gpt-4o", temperature=0.1)
            response = llm.invoke([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ])
            
            # Clean response text in case markdown tags are wrapped around JSON
            clean_content = response.content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:]
            if clean_content.endswith("```"):
                clean_content = clean_content[:-3]
                
            data = json.loads(clean_content)
            log.info("reasoning_node_openai_completed", request_id=request_id)
            return {
                "diagnoses": data.get("diagnoses", []),
                "confidence": data.get("top_confidence", 0.0),
                "query_refinement": data.get("query_refinement", ""),
                "final_output": data
            }
        except Exception as e:
            log.error("reasoning_node_openai_failed", request_id=request_id, error=str(e))
            
    # Mock LLM reasoning fallback (extremely robust for offline portfolio demos)
    demo_mode = (
        os.getenv("TESTING") == "true" or os.getenv("CI") == "true"
        or os.getenv("MEDGRAPH_DEMO_MODE", "false").lower() == "true"
    )
    if not demo_mode:
        data = {"diagnoses": [], "recommended_workup": [], "status": "unavailable",
                "message": "The clinical reasoning service is unavailable. Please try again."}
        return {"diagnoses": [], "confidence": 0.0,
                "query_refinement": "", "final_output": data}
    log.info("reasoning_node_using_mock_fallback", request_id=request_id)
    symptom_set = {s.lower() for s in patient["symptoms"]}
    med_set = {m.lower() for m in patient["medications"]}
    
    diagnoses = []
    top_conf = 0.0
    recommended = []
    refinement = "atypical chest pain etiology"

    if not state["rag_chunks"] and not (
        state["graph_results"].get("probable_diseases")
        or state["graph_results"].get("drug_interactions")
    ):
        mock_res = {
            "diagnoses": [],
            "top_confidence": 0.0,
            "recommended_workup": [NO_EVIDENCE_MESSAGE],
            "query_refinement": "broader clinical guideline search terms"
        }
        return {
            "diagnoses": [],
            "confidence": 0.0,
            "query_refinement": mock_res["query_refinement"],
            "final_output": mock_res
        }
    
    # Check for STEMI / Angina symptoms
    if "chest pain" in symptom_set or "jaw pain" in symptom_set or "sweating" in symptom_set:
        diagnoses = [
            {
                "name": "STEMI (ST-Elevation Myocardial Infarction)",
                "confidence": 0.87,
                "evidence": "Acute presentation of chest pain radiating to the jaw with associated sweating (diaphoresis). This is a primary cardiac emergency.",
                "citations": ["AHA/ACC Guidelines 2021: Guideline 1", "AHA/ACC Guidelines 2021: Guideline 3"]
            },
            {
                "name": "Unstable Angina",
                "confidence": 0.71,
                "evidence": "Chest pain without definitive infarction markers, but high risk for cardiac events based on symptoms.",
                "citations": ["AHA/ACC Guidelines 2021: Guideline 1", "AHA/ACC Guidelines 2021: Guideline 4"]
            },
            {
                "name": "Aortic Dissection",
                "confidence": 0.34,
                "evidence": "Sudden chest pain radiating to the back or jaw. High morbidity risk. Must be ruled out immediately.",
                "citations": ["AHA/ACC Guidelines 2022: Guideline 6", "AHA/ACC Guidelines 2022: Guideline 8"]
            }
        ]
        top_conf = 0.87
        recommended = ["12-lead ECG immediately", "Cardiac Troponin levels", "Emergency Coronary Angiography", "CT Angiography of the chest"]
        refinement = "cardiac troponin diagnostic windows and atypical presentation"
        
    elif "headache" in symptom_set or "confusion" in symptom_set:
        diagnoses = [
            {
                "name": "Intracranial Hemorrhage",
                "confidence": 0.80,
                "evidence": "Neurological symptoms (confusion, headache) in a patient who may have anticoagulation bleeding risks.",
                "citations": ["AHA/ACC Antithrombotic Guidelines: Guideline 11"]
            }
        ]
        top_conf = 0.80
        recommended = ["Non-contrast head CT", "Coagulation profile (PT/INR)", "Stop all antiplatelets/anticoagulants"]
        refinement = "reversal of warfarin in intracranial hemorrhage guidelines"
    else:
        # Default fallback
        diagnoses = [
            {
                "name": "Nonspecific Clinical Presentation",
                "confidence": 0.45,
                "evidence": "Symptom combination does not map to strong cardiovascular indicators.",
                "citations": []
            }
        ]
        top_conf = 0.45
        recommended = ["Basic metabolic panel", "CBC", "Observation"]
        refinement = "differential diagnosis of nonspecific adult chest pain"
        
    mock_res = {
        "diagnoses": diagnoses,
        "top_confidence": top_conf,
        "recommended_workup": recommended,
        "query_refinement": refinement
    }
    
    return {
        "diagnoses": diagnoses,
        "confidence": top_conf,
        "query_refinement": refinement,
        "final_output": mock_res
    }

# Node 6: Veracity Checker Node
def veracity_checker_node(state: AgentState) -> Dict[str, Any]:
    request_id = state.get("request_id", "unknown")
    log.info("veracity_checker_node_start", request_id=request_id)
    diagnoses = state["diagnoses"]
    rag_chunks = state["rag_chunks"]
    
    verified_diagnoses, citation_warnings = verify_diagnosis_citations(diagnoses, rag_chunks)
        
    log.info("veracity_checker_node_completed", request_id=request_id, citation_warnings_present=citation_warnings)
    return {
        "diagnoses": verified_diagnoses,
        "citation_warnings_present": citation_warnings
    }

# Node 7: Output Compilation Node
def output_node(state: AgentState) -> Dict[str, Any]:
    request_id = state.get("request_id", "unknown")
    log.info("output_node_start", request_id=request_id)
    
    final_diagnoses = state["diagnoses"]
    graph_res = state["graph_results"]
    
    final_output = {
        "diagnoses": final_diagnoses,
        "drug_interactions": graph_res.get("drug_interactions", []),
        "critical_flag": state["drug_interaction_flag"],
        "iterations_taken": state["iteration"],
        "citation_warnings_flagged": state["citation_warnings_present"],
        "recommended_workup": state.get("final_output", {}).get("recommended_workup", []),
        "rag_status": "found" if state.get("rag_chunks") else "no_results",
        "rag_message": None if state.get("rag_chunks") else NO_EVIDENCE_MESSAGE
    }
    reasoning_output = state.get("final_output") or {}
    if reasoning_output.get("status"):
        final_output["status"] = reasoning_output["status"]
        final_output["message"] = reasoning_output.get("message")
    
    log.info("output_node_completed", request_id=request_id)
    return {"final_output": final_output}

# Node 8: Early-Exit Alert Node
def alert_node(state: AgentState) -> Dict[str, Any]:
    request_id = state.get("request_id", "unknown")
    log.warning("alert_node_start", request_id=request_id)
    graph_res = state["graph_results"]
    
    # High-priority bypass packet
    alert_output = {
        "alert": "CRITICAL DRUG INTERACTION DETECTED",
        "requires_immediate_intervention": True,
        "drug_interactions": graph_res.get("drug_interactions", []),
        "diagnoses": [
            {
                "name": "Medication Interaction Hazard",
                "confidence": 1.0,
                "evidence": f"Patient is concurrently taking interacting medications: {', '.join([f'{i.get('dr1')} + {i.get('dr2')} ({i.get('effect')})' for i in graph_res.get('drug_interactions', [])])}",
                "citations": ["AHA/ACC Antithrombotic Guidelines: Guideline 10"]
            }
        ],
        "citation_warnings_flagged": False,
        "recommended_workup": ["Immediate coagulation profile (PT/INR) check", "Review anticoagulant indication", "Evaluate signs of active bleeding"]
    }
    
    log.info("alert_node_completed", request_id=request_id)
    return {"final_output": alert_output}

# Routing Functions
def route_after_graph(state: AgentState) -> str:
    """Route: if high interaction flagged, jump immediately to alert node."""
    request_id = state.get("request_id", "unknown")
    if state["drug_interaction_flag"]:
        log.warning("graph_route_alert_early", request_id=request_id)
        return "alert_early"
    log.info("graph_route_normal", request_id=request_id)
    return "aggregator"

def route_after_reasoning(state: AgentState) -> str:
    """Route: check confidence and iteration limit for RAG loops."""
    request_id = state.get("request_id", "unknown")
    # Safety Check: if drug interaction flagged during late execution
    if state["drug_interaction_flag"]:
        log.warning("reasoning_route_alert_late", request_id=request_id)
        return "alert"
        
    # Low confidence retry check
    if not state.get("query_refinement"):
        return "veracity_check"
    if state["confidence"] < 0.80 and state["iteration"] < 2:
        log.info("reasoning_route_retry", request_id=request_id, confidence=state["confidence"], iteration=state["iteration"])
        return "retry"
        
    log.info("reasoning_route_veracity_check", request_id=request_id, confidence=state["confidence"], iteration=state["iteration"])
    return "veracity_check"

# Build the Graph orchestrator
def build_agent_graph():
    workflow = StateGraph(AgentState)
    
    # Add Nodes
    workflow.add_node("intake", intake_node)
    workflow.add_node("rag", rag_node)
    workflow.add_node("graph", graph_node)
    workflow.add_node("aggregator", aggregator_node)
    workflow.add_node("reasoning", reasoning_node)
    workflow.add_node("veracity", veracity_checker_node)
    workflow.add_node("output", output_node)
    workflow.add_node("alert", alert_node)
    
    # Increment iteration node for retry loops
    def increment_iteration(state: AgentState):
        log.info("increment_retry_iteration", current=state["iteration"])
        return {"iteration": state["iteration"] + 1}
    workflow.add_node("increment_retry", increment_iteration)
    
    # Entry Point
    workflow.set_entry_point("intake")
    
    # Split parallel branches: intake -> rag AND graph
    workflow.add_edge("intake", "graph")
    
    # Graph early-exit conditional routing
    workflow.add_conditional_edges(
        "graph",
        route_after_graph,
        {
            "alert_early": "alert",
            "aggregator": "rag"
        }
    )
    
    # RAG connects directly to aggregator
    workflow.add_edge("rag", "aggregator")
    
    # Aggregator feeds reasoning
    workflow.add_edge("aggregator", "reasoning")
    
    # Reasoning routing (Alert, Retry, or Veracity Check)
    workflow.add_conditional_edges(
        "reasoning",
        route_after_reasoning,
        {
            "alert": "alert",
            "retry": "increment_retry",
            "veracity_check": "veracity"
        }
    )
    
    # Increment loop back to RAG
    workflow.add_edge("increment_retry", "rag")
    
    # Veracity check goes to output compiler
    workflow.add_edge("veracity", "output")
    
    # End state transitions
    workflow.add_edge("output", END)
    workflow.add_edge("alert", END)
    
    # Compile
    return workflow.compile()

# Compile global orchestrator instance
medgraph_graph = build_agent_graph()
