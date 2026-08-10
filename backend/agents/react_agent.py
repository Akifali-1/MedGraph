import os
import json
import logging
import operator
from typing import TypedDict, List, Dict, Any, Optional, Annotated
from langchain_core.messages import BaseMessage, SystemMessage, AIMessage, ToolMessage, HumanMessage
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

from backend.models.patient import PatientInput
from backend.retrieval.retriever import get_relevant_guidelines
from backend.graph.tools import query_knowledge_graph

logger = logging.getLogger(__name__)

# State Definition
class ReActState(TypedDict):
    request_id: str
    doctor_id: str # Multi-tenant isolation context
    patient_data: Dict[str, Any]
    clinical_case: Dict[str, Any]
    steps: Annotated[List[Dict[str, Any]], operator.add]   # accumulates trace steps
    messages: Annotated[List[BaseMessage], add_messages]   # accumulates full message history
    initial_ddi: Dict[str, Any]
    initial_guidelines: List[str]
    diagnoses: List[Dict[str, Any]]
    recommended_workup: List[str]
    critical_flag: bool
    citation_warnings_flagged: bool
    final_output: Optional[Dict[str, Any]]

# Predefined Clinical Case Profiles (Mocks)
CLINICAL_PRESETS = {
    "ddi": {
        "vitals": {
            "blood_pressure": "95/60 mmHg",
            "heart_rate": "108 bpm",
            "temperature": "98.6 F",
            "respiratory_rate": "20 rpm",
            "oxygen_saturation": "94% on room air"
        },
        "labs": {
            "EKG": "ST-elevation in inferior leads II, III, aVF (Acute Inferior STEMI)",
            "Troponin": "Elevated: 1.5 ng/mL (Reference < 0.04)",
            "CBC": "Normal: WBC 8.5 x10^3/uL, Hgb 14.2 g/dL, Plt 250 x10^3/uL",
            "BMP": "Normal electrolytes, Creatinine 0.9 mg/dL (eGFR > 90)",
            "PT_INR": "Elevated INR: 2.4 (Therapeutic range, but high risk for bleed with dual antiplatelet therapy)",
            "Chest_Xray": "Clear: No acute cardiopulmonary disease, normal cardiac silhouette",
            "Head_CT": "Normal: No acute intracranial hemorrhage or mass effect"
        }
    },
    "stroke": {
        "vitals": {
            "blood_pressure": "180/100 mmHg",
            "heart_rate": "78 bpm",
            "temperature": "98.2 F",
            "respiratory_rate": "16 rpm",
            "oxygen_saturation": "98% on room air"
        },
        "labs": {
            "EKG": "Normal Sinus Rhythm, no acute ischemic changes",
            "Troponin": "Normal: < 0.01 ng/mL",
            "CBC": "Normal: WBC 7.2, Hgb 13.8",
            "BMP": "Normal electrolytes",
            "PT_INR": "Normal INR: 1.0",
            "Chest_Xray": "Normal",
            "Head_CT": "ACUTE INTRACRANIAL HEMORRHAGE: Spontaneous bleeding detected in left basal ganglia (~25ml volume) with mild mass effect."
        }
    },
    "stemi": {
        "vitals": {
            "blood_pressure": "120/80 mmHg",
            "heart_rate": "88 bpm",
            "temperature": "98.6 F",
            "respiratory_rate": "18 rpm",
            "oxygen_saturation": "96% on room air"
        },
        "labs": {
            "EKG": "ST-elevation in inferior leads II, III, aVF (Acute Inferior STEMI)",
            "Troponin": "Elevated: 1.5 ng/mL (Reference < 0.04)",
            "CBC": "Normal baseline indices",
            "BMP": "Normal electrolytes",
            "PT_INR": "Normal INR: 1.0",
            "Chest_Xray": "Clear: No acute cardiopulmonary pathology",
            "Head_CT": "Normal"
        }
    }
}

def generate_clinical_case(patient: PatientInput) -> Dict[str, Any]:
    """Retrieves standard preset mock lab results or uses LLM to generate custom patient metrics."""
    symptoms = [s.lower() for s in patient.symptoms]
    meds = [m.lower() for m in patient.medications]
    
    # 1. Match presets based on keywords
    is_ddi = any("warfarin" in m or "coumadin" in m for m in meds) and any("aspirin" in m for m in meds)
    is_stroke = any("headache" in s or "cephalalgia" in s or "confusion" in s for s in symptoms)
    is_cardiac = any("chest" in s or "angina" in s or "sweating" in s or "diaphoresis" in s for s in symptoms)
    
    if is_ddi:
        logger.info("Clinical case preset matched: DDI Hazard")
        return CLINICAL_PRESETS["ddi"]
    elif is_cardiac:
        logger.info("Clinical case preset matched: Cardiac STEMI")
        return CLINICAL_PRESETS["stemi"]
    elif is_stroke:
        logger.info("Clinical case preset matched: Geriatric Stroke")
        return CLINICAL_PRESETS["stroke"]
        
    # 2. Testing / CI environment fallback
    if os.getenv("TESTING") == "true" or os.getenv("CI") == "true":
        logger.info("Offline test environment: returning generic case report.")
        return {
            "vitals": {
                "blood_pressure": "120/80 mmHg",
                "heart_rate": "72 bpm",
                "temperature": "98.6 F",
                "respiratory_rate": "14 rpm",
                "oxygen_saturation": "99% on room air"
            },
            "labs": {
                "EKG": "Normal Sinus Rhythm",
                "Troponin": "Normal: < 0.01 ng/mL",
                "CBC": "Normal baseline indices",
                "BMP": "Normal electrolytes and kidney function",
                "PT_INR": "Normal INR: 1.0",
                "Chest_Xray": "Normal",
                "Head_CT": "Normal: No acute intracranial pathology"
            }
        }
        
    # 3. Dynamic LLM clinico-pathology generator for custom inputs
    try:
        from backend.config.singletons import get_gemini_chat
        llm = get_gemini_chat()
        
        prompt = f"""You are an expert clinical pathophysiologist.
        Generate a realistic clinical mock case database for a patient with the following profile:
        Age: {patient.age}
        Sex: {patient.sex}
        Symptoms: {patient.symptoms}
        Medications: {patient.medications}
        Comorbidities: {patient.comorbidities}

        Produce realistic clinical findings for vitals and diagnostic tests. If the symptoms suggest a severe condition (e.g. stroke, hemorrhage, pulmonary embolism, infarction), the labs/imaging findings should reflect that. Otherwise, generate normal baseline values.
        Output ONLY valid JSON matching this schema:
        {{
          "vitals": {{
            "blood_pressure": "e.g., 120/80 mmHg",
            "heart_rate": "e.g., 72 bpm",
            "temperature": "e.g., 98.6 F",
            "respiratory_rate": "e.g., 16 rpm",
            "oxygen_saturation": "e.g., 98% on room air"
          }},
          "labs": {{
            "EKG": "description of EKG findings",
            "Troponin": "description of Troponin findings",
            "CBC": "description of CBC findings",
            "BMP": "description of BMP findings",
            "PT_INR": "description of PT/INR findings",
            "Chest_Xray": "description of chest X-Ray findings",
            "Head_CT": "description of Head CT findings"
          }}
        }}
        """
        response = llm.invoke(prompt)
        text_out = response.content.strip()
        if text_out.startswith("```json"):
            text_out = text_out[7:]
        if text_out.endswith("```"):
            text_out = text_out[:-3]
        return json.loads(text_out)
    except Exception as e:
        logger.error(f"Failed to dynamically generate clinical case: {e}. Falling back to default.")
        return {
            "vitals": {
                "blood_pressure": "120/80 mmHg",
                "heart_rate": "72 bpm",
                "temperature": "98.6 F",
                "respiratory_rate": "14 rpm",
                "oxygen_saturation": "99% on room air"
            },
            "labs": {
                "EKG": "Normal Sinus Rhythm",
                "Troponin": "Normal: < 0.01 ng/mL",
                "CBC": "Normal baseline indices",
                "BMP": "Normal electrolytes and kidney function",
                "PT_INR": "Normal INR: 1.0",
                "Chest_Xray": "Normal",
                "Head_CT": "Normal"
            }
        }

# Tool schemas and arguments validation
class VitalsInput(BaseModel):
    pass

class LabInput(BaseModel):
    test_name: str = Field(..., description="Name of test to order: EKG, Troponin, CBC, BMP, PT_INR, Chest_Xray, Head_CT")

class GuidelinesInput(BaseModel):
    query: str = Field(..., description="Search clinical practice guidelines vector database for relevant protocols")

class KnowledgeGraphInput(BaseModel):
    medications: List[str] = Field(..., description="Medications to cross-check in Neo4j")
    symptoms: List[str] = Field(..., description="Symptoms to cross-check in Neo4j")

class DiagnosisItem(BaseModel):
    name: str = Field(..., description="Diagnosis name (e.g. STEMI, Stroke)")
    confidence: float = Field(..., description="Confidence score from 0.0 to 1.0")
    evidence: str = Field(..., description="Clinical evidence supporting diagnosis")
    citations: List[str] = Field(default_factory=list, description="Citations from guidelines supporting diagnosis")

class SubmitDiagnosisInput(BaseModel):
    diagnoses: List[DiagnosisItem] = Field(..., description="List of differential diagnoses")
    recommended_workup: List[str] = Field(..., description="Recommended workup checklists")
    critical_flag: bool = Field(..., description="True if a high-severity drug interaction alert exists")

# Tool Definitions
@tool("check_patient_vitals", args_schema=VitalsInput)
def check_patient_vitals_tool() -> str:
    """Check patient's current vitals: blood pressure, heart rate, temperature, respiratory rate, oxygen saturation."""
    return "Vitals check tool executed"

@tool("order_lab_or_imaging_test", args_schema=LabInput)
def order_lab_or_imaging_test_tool(test_name: str) -> str:
    """Order specific laboratory test or diagnostic imaging. Valid tests: EKG, Troponin, CBC, BMP, PT_INR, Chest_Xray, Head_CT."""
    return f"Ordered test {test_name}"

@tool("query_guidelines", args_schema=GuidelinesInput)
def query_guidelines_tool(query: str) -> str:
    """Search clinical practice guidelines vector database for literature and citations."""
    return f"Guidelines query: {query}"

@tool("query_knowledge_graph", args_schema=KnowledgeGraphInput)
def query_knowledge_graph_tool(medications: list, symptoms: list) -> str:
    """Query the Neo4j knowledge graph for drug-drug interactions and symptom-disease weights."""
    return "Queried knowledge graph"

@tool("submit_diagnosis", args_schema=SubmitDiagnosisInput)
def submit_diagnosis_tool(diagnoses: list, recommended_workup: list, critical_flag: bool) -> str:
    """Submit the final differential diagnosis report, recommended workup plan, and safety flags."""
    return "Diagnosis submitted"

react_tools = [
    check_patient_vitals_tool,
    order_lab_or_imaging_test_tool,
    query_guidelines_tool,
    query_knowledge_graph_tool,
    submit_diagnosis_tool
]

# LangGraph Orchestrator Nodes
def agent_node(state: ReActState) -> Dict[str, Any]:
    """Clinical reasoning agent node. Compiles state and asks Gemini to choose actions."""
    request_id = state.get("request_id", "unknown")
    logger.info(f"react_agent_node_start request_id={request_id}")
    
    # Message history already contains SystemMessage at index 0 (set in run_react_agent initial_state).
    # With add_messages reducer, history accumulates: [SystemMessage, HumanMessage, AIMessage, ToolMessage, ...]
    messages = state["messages"]
    
    from backend.config.singletons import get_gemini_chat
    llm = get_gemini_chat()
    llm_with_tools = llm.bind_tools(react_tools)
    
    try:
        ai_message = llm_with_tools.invoke(messages)
        has_content = bool(getattr(ai_message, "content", None))
        has_tool_calls = bool(getattr(ai_message, "tool_calls", None))
        if not has_content and not has_tool_calls:
            raise ValueError("Empty model output — no content or tool calls returned.")
    except Exception as e:
        logger.warning(f"react_agent_node_gemini_empty_output request_id={request_id} error={e}. Forcing submit_diagnosis.")
        nudge = HumanMessage(content=(
            "You have gathered enough clinical evidence from the tools above. "
            "You MUST now call `submit_diagnosis` with your differential diagnosis. "
            "Do NOT reply with text — call the submit_diagnosis tool immediately."
        ))
        try:
            ai_message = llm_with_tools.invoke(messages + [nudge])
        except Exception as retry_err:
            logger.error(f"react_agent_node_retry_failed request_id={request_id} error={retry_err}")
            raise retry_err
    
    logger.info(f"react_agent_node_completed request_id={request_id}")
    return {"messages": [ai_message]}

def tool_node(state: ReActState) -> Dict[str, Any]:
    """Executes the tool chosen by the agent, updates state steps trace."""
    request_id = state.get("request_id", "unknown")
    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, "tool_calls", [])
    
    new_messages = []
    new_steps = []
    updates = {}
    
    for tc in tool_calls:
        name = tc["name"]
        args = tc["args"]
        tc_id = tc["id"]
        
        logger.info(f"react_tool_execution_start request_id={request_id} tool_name={name}")
        
        if name == "check_patient_vitals":
            vitals = state["clinical_case"].get("vitals", {})
            obs = f"Vitals retrieved: BP: {vitals.get('blood_pressure')}, HR: {vitals.get('heart_rate')}, Temp: {vitals.get('temperature')}, RR: {vitals.get('respiratory_rate')}, SpO2: {vitals.get('oxygen_saturation')}."
        elif name == "order_lab_or_imaging_test":
            test = args.get("test_name", "")
            # Match case insensitive
            normalized_test = test
            for key in state["clinical_case"].get("labs", {}).keys():
                if key.lower() in test.lower() or test.lower() in key.lower():
                    normalized_test = key
                    break
            obs = state["clinical_case"].get("labs", {}).get(normalized_test, f"Test {test} normal/inconclusive.")
        elif name == "query_guidelines":
            q = args.get("query", "")
            obs = str(get_relevant_guidelines(q, top_n=3, doctor_id=state.get("doctor_id")))
        elif name == "query_knowledge_graph":
            meds = args.get("medications", [])
            syms = args.get("symptoms", [])
            res = query_knowledge_graph.invoke({
                "patient_medications": meds, 
                "patient_symptoms": syms,
                "doctor_id": state.get("doctor_id")
            })
            obs = json.dumps(res)
        elif name == "submit_diagnosis":
            obs = "Diagnoses submitted successfully."
            updates["diagnoses"] = args.get("diagnoses", [])
            updates["recommended_workup"] = args.get("recommended_workup", [])
            updates["critical_flag"] = args.get("critical_flag", False)
        else:
            obs = f"Error: Tool {name} not found."
            
        logger.info(f"react_tool_execution_completed request_id={request_id} tool_name={name}")
        
        tool_msg = ToolMessage(content=obs, name=name, tool_call_id=tc_id)
        new_messages.append(tool_msg)
        
        # Capture step trace log
        step_log = {
            "thought": last_message.content or "Analyzing current information...",
            "action": f"{name}({json.dumps(args)})",
            "observation": obs
        }
        new_steps.append(step_log)
        
    return {
        "messages": new_messages,
        "steps": new_steps,
        **updates
    }

def route_next(state: ReActState) -> str:
    """Checks loop exit conditions: submit_diagnosis, loop step bounds, or no tool calls."""
    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, "tool_calls", [])
    
    if not tool_calls:
        return "end"
        
    for tc in tool_calls:
        if tc["name"] == "submit_diagnosis":
            return "end"
            
    if len(state.get("steps", [])) >= 5:
        logger.warning("react_loop_maximum_steps_reached")
        return "end"
        
    return "tools"

def build_react_graph():
    """Compiles the ReAct StateGraph orchestrator."""
    workflow = StateGraph(ReActState)
    
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)
    
    workflow.set_entry_point("agent")
    
    workflow.add_conditional_edges(
        "agent",
        route_next,
        {
            "tools": "tools",
            "end": END
        }
    )
    workflow.add_edge("tools", "agent")
    
    return workflow.compile()

react_agent_graph = build_react_graph()

# Offline / Test Telemetry Mappings (Deterministic Case Simulator)
def simulate_react_flow(state: ReActState) -> Dict[str, Any]:
    """Generates a detailed, clinically accurate mock ReAct trace for testing and CI runs."""
    patient = state["patient_data"]
    symptoms = [s.lower() for s in patient.get("symptoms", [])]
    meds = [m.lower() for m in patient.get("medications", [])]
    
    has_ddi = any("warfarin" in m or "coumadin" in m for m in meds) and any("aspirin" in m for m in meds)
    
    trace_steps = []
    diagnoses = []
    workup = []
    critical_flag = False
    
    if has_ddi:
        critical_flag = True
        trace_steps = [
            {
                "thought": "The patient is on Warfarin and Aspirin. I need to query the Neo4j graph database to check for drug-drug interactions.",
                "action": "query_knowledge_graph(medications=['Warfarin', 'Aspirin'], symptoms=['chest pain'])",
                "observation": "CRITICAL HAZARD DETECTED: Co-administration of Warfarin and Aspirin increases bleeding risk synergistically (Severity: HIGH)."
            },
            {
                "thought": "This is a critical pharmacological hazard. I should search standard clinical guidelines for anticoagulation safety.",
                "action": "query_guidelines(query='AHA/ACC Antithrombotic Guidelines: Warfarin and Aspirin interaction')",
                "observation": "Guidelines recommend holding or adjusting therapy and checking coagulation profile (PT/INR) immediately to avoid major hemorrhage."
            },
            {
                "thought": "A critical drug interaction is flagged. I will execute an early exit and submit the Medication Interaction Hazard diagnosis.",
                "action": "submit_diagnosis(diagnoses=[{'name': 'Medication Interaction Hazard', 'confidence': 1.0, ...}], ...)",
                "observation": "Diagnoses submitted successfully."
            }
        ]
        diagnoses = [
            {
                "name": "Medication Interaction Hazard",
                "confidence": 1.0,
                "evidence": "Patient is concurrently taking Warfarin (anticoagulant) and Aspirin (antiplatelet). This combination synergisticly increases risk of major gastrointestinal and intracranial bleeding, violating standard clinical recommendations unless specifically indicated under strict monitoring.",
                "citations": ["AHA/ACC Antithrombotic Guidelines: Guideline 10"]
            }
        ]
        workup = [
            "Immediate coagulation profile (PT/INR) check",
            "Review indication for dual therapy",
            "Evaluate for signs of active bleeding (occult blood, bruising)"
        ]
    elif any("chest" in s or "angina" in s or "sweating" in s for s in symptoms):
        trace_steps = [
            {
                "thought": "Patient presents with acute chest pain and sweating. I must check their vitals and order a 12-lead ECG and Troponin test to rule out STEMI.",
                "action": "check_patient_vitals()",
                "observation": "Vitals retrieved: BP: 120/80 mmHg, HR: 88 bpm, Temp: 98.6 F, RR: 18 rpm, SpO2: 96% on room air."
            },
            {
                "thought": "Vitals are stable, but chest pain warrants cardiac test results. Let me order an EKG and Troponin lab test.",
                "action": "order_lab_or_imaging_test(test_name='EKG')",
                "observation": "EKG Result: ST-elevation in inferior leads II, III, aVF (Acute Inferior STEMI)."
            },
            {
                "thought": "EKG shows acute ST-elevation myocardial infarction. I will query clinical guidelines for immediate STEMI workup.",
                "action": "query_guidelines(query='AHA/ACC STEMI Guidelines 2021')",
                "observation": "STEMI guidelines recommend immediate ECG within 10 mins, cardiac troponin, chest X-ray, and angiography."
            },
            {
                "thought": "I will query the Neo4j knowledge graph to verify symptom-disease weights and potential drug interactions.",
                "action": "query_knowledge_graph(medications=[], symptoms=['chest pain', 'jaw pain', 'sweating'])",
                "observation": "Symptom-Disease weights: STEMI (87%), Unstable Angina (71%), Aortic Dissection (34%). No medication hazards."
            },
            {
                "thought": "The clinical picture confirms STEMI. I will submit the final diagnoses and recommend immediate angiography and troponin follow-up.",
                "action": "submit_diagnosis(diagnoses=[...], ...)",
                "observation": "Diagnoses submitted successfully."
            }
        ]
        diagnoses = [
            {
                "name": "STEMI (ST-Elevation Myocardial Infarction)",
                "confidence": 0.87,
                "evidence": "Acute presentation of chest pain radiating to the jaw with associated sweating (diaphoresis). ST-elevation confirmed on EKG. This is a primary cardiac emergency.",
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
        workup = [
            "Electrocardiogram (ECG) within 10 minutes",
            "Cardiac Troponin levels (initial and 3-hour)",
            "Chest X-ray",
            "CT Angiography of the chest"
        ]
    elif any("headache" in s or "cephalalgia" in s or "confusion" in s for s in symptoms):
        trace_steps = [
            {
                "thought": "The patient presents with acute onset headache and confusion. I need to check vitals and order a head CT scan to rule out intracranial hemorrhage.",
                "action": "check_patient_vitals()",
                "observation": "Vitals retrieved: BP: 180/100 mmHg, HR: 78 bpm, Temp: 98.2 F, RR: 16 rpm, SpO2: 98% on room air."
            },
            {
                "thought": "Vitals show severe hypertension. I will order a non-contrast Head CT scan immediately.",
                "action": "order_lab_or_imaging_test(test_name='Head_CT')",
                "observation": "Head CT Result: ACUTE INTRACRANIAL HEMORRHAGE: Spontaneous bleeding detected in left basal ganglia (~25ml volume) with mild surrounding edema."
            },
            {
                "thought": "Intracranial hemorrhage is confirmed. Let me check the antithrombotic guidelines for spontaneous hemorrhage.",
                "action": "query_guidelines(query='AHA/ASA guidelines for spontaneous intracranial hemorrhage')",
                "observation": "Guidelines recommend non-contrast head CT, coagulation profile (PT/INR), and halting antiplatelets/anticoagulants."
            },
            {
                "thought": "I will submit the final diagnoses and recommend immediate neuro-critical care and coagulation checks.",
                "action": "submit_diagnosis(...) ",
                "observation": "Diagnoses submitted successfully."
            }
        ]
        diagnoses = [
            {
                "name": "Intracranial Hemorrhage",
                "confidence": 0.80,
                "evidence": "Neurological symptoms (confusion, headache) with confirmed bleed in the left basal ganglia on CT scan.",
                "citations": ["AHA/ACC Antithrombotic Guidelines: Guideline 11"]
            }
        ]
        workup = [
            "Non-contrast Head CT Scan",
            "Coagulation profile (PT/INR/aPTT)",
            "Stop all antiplatelets/anticoagulants",
            "Neurological checks every 1 hour"
        ]
    else:
        trace_steps = [
            {
                "thought": "Analyzing symptoms to order relevant workup...",
                "action": "check_patient_vitals()",
                "observation": "Vitals retrieved: BP: 120/80 mmHg, HR: 72 bpm, Temp: 98.6 F, RR: 14 rpm, SpO2: 99%."
            },
            {
                "thought": "Querying guidelines for nonspecific symptoms...",
                "action": "order_lab_or_imaging_test(test_name='CBC')",
                "observation": "CBC: Normal baseline indices."
            },
            {
                "thought": "I will search for general clinical pathways.",
                "action": "query_guidelines(query='nonspecific clinical presentation guidelines')",
                "observation": "Recommended basic workup includes CBC, BMP, and clinical observation."
            },
            {
                "thought": "I will submit the final diagnosis for nonspecific symptoms.",
                "action": "submit_diagnosis(...)",
                "observation": "Diagnoses submitted successfully."
            }
        ]
        diagnoses = [
            {
                "name": "Nonspecific Clinical Presentation",
                "confidence": 0.45,
                "evidence": "Symptom combination does not map to strong cardiovascular indicators.",
                "citations": []
            }
        ]
        workup = [
            "Basic metabolic panel",
            "CBC",
            "Observation"
        ]
        
    return {
        "diagnoses": diagnoses,
        "drug_interactions": state["initial_ddi"].get("drug_interactions", []),
        "critical_flag": critical_flag,
        "iterations_taken": len(trace_steps),
        "citation_warnings_flagged": False,
        "recommended_workup": workup,
        "trace_steps": trace_steps
    }

def run_react_agent(patient: PatientInput, initial_ddi: dict, initial_guidelines: List[str], request_id: str, doctor_id: Optional[str] = None) -> Dict[str, Any]:
    """Main execution entrance for RA-ReAct workflow. Selects live run or mock simulation."""
    google_key = os.getenv("GOOGLE_API_KEY")
    is_testing = os.getenv("TESTING") == "true" or os.getenv("CI") == "true"
    
    system_prompt = (
        f"You are an advanced Clinical Decision Support Agent co-pilot running an interactive diagnostic workup.\n"
        f"Patient demographics:\n"
        f"- Age: {patient.age}\n"
        f"- Sex: {patient.sex}\n"
        f"- Symptoms: {patient.symptoms}\n"
        f"- Medications: {patient.medications}\n"
        f"- Comorbidities: {patient.comorbidities}\n\n"
        f"Baseline Context (pre-retrieved from fast database queries):\n"
        f"- Drug-Drug Interactions: {initial_ddi.get('drug_interactions', [])}\n"
        f"- Symptom-Disease Links: {initial_ddi.get('probable_diseases', [])}\n"
        f"- Guideline Citations: {initial_guidelines}\n\n"
        f"Your goal is to investigate this case step-by-step using clinical tools, evaluate lab findings, "
        f"consult guidelines, and conclude by calling `submit_diagnosis`.\n"
        f"To inspect vital signs: use `check_patient_vitals`.\n"
        f"To order test findings (EKG, Troponin, Head CT, CBC, BMP, PT_INR, Chest_Xray): use `order_lab_or_imaging_test`.\n"
        f"If initial RAG is insufficient, query vector index with `query_guidelines`.\n"
        f"If you need to query Neo4j for drug interactions, use `query_knowledge_graph`.\n"
        f"Once you have enough evidence, call `submit_diagnosis` with:\n"
        f"- `diagnoses`: Ranked differentials with confidence (0.0-1.0), evidence, and citations.\n"
        f"- `recommended_workup`: Follow-up tests or immediate actions.\n"
        f"- `critical_flag`: True if a high-severity drug interaction alert exists.\n\n"
        f"IMPORTANT: Always call a tool — never reply with plain text."
    )

    # Initialize basic state — SystemMessage goes first so it anchors the conversation history.
    # add_messages reducer will accumulate: [SystemMessage, HumanMessage, AIMessage, ToolMessage, ...]
    initial_state = {
        "request_id": request_id,
        "doctor_id": doctor_id or "global",
        "patient_data": patient.model_dump(),
        "clinical_case": generate_clinical_case(patient),
        "steps": [],
        "messages": [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Analyze patient: {patient.age}-year-old {patient.sex}, symptoms: {patient.symptoms}, medications: {patient.medications}, comorbidities: {patient.comorbidities}.")
        ],
        "initial_ddi": initial_ddi,
        "initial_guidelines": initial_guidelines,
        "diagnoses": [],
        "recommended_workup": [],
        "critical_flag": False,
        "citation_warnings_flagged": False,
        "final_output": None
    }
    
    from backend.config.singletons import get_neo4j_client
    neo4j_fallback = True
    try:
        neo4j_fallback = get_neo4j_client().use_mock
    except Exception:
        pass

    if neo4j_fallback:
        print("[FALLBACK ACTIVE] Neo4j database is offline. Running with local in-memory knowledge graph data.")
    else:
        print("[CONNECTED LIVE] Connected to live Neo4j cloud graph instance.")

    if is_testing or not google_key or google_key.strip().lower().startswith("your_") or "placeholder" in google_key.lower():
        print("[FALLBACK ACTIVE] Google Gemini API key is missing or invalid. Running in Simulated Offline LLM mode.")
        res = simulate_react_flow(initial_state)
        res["fallbacks_active"] = {
            "llm": True,
            "neo4j": neo4j_fallback
        }
        return res
        
    try:
        logger.info("Executing live LangGraph ReAct agent co-pilot.")
        result_state = react_agent_graph.invoke(initial_state)
        
        # route_next exits on submit_diagnosis BEFORE tool_node runs, so state["diagnoses"]
        # may still be empty. Recover by scanning accumulated messages for the tool call args.
        diagnoses = result_state.get("diagnoses", [])
        recommended_workup = result_state.get("recommended_workup", [])
        critical_flag = result_state.get("critical_flag", False)
        
        if not diagnoses:
            for msg in result_state.get("messages", []):
                for tc in getattr(msg, "tool_calls", []):
                    if tc["name"] == "submit_diagnosis":
                        diagnoses = tc["args"].get("diagnoses", [])
                        recommended_workup = tc["args"].get("recommended_workup", recommended_workup)
                        critical_flag = tc["args"].get("critical_flag", critical_flag)
                        logger.info(f"react_agent_diagnoses_recovered_from_messages count={len(diagnoses)}")
                        break
                if diagnoses:
                    break
        
        # Compile response matching schema
        output = {
            "diagnoses": diagnoses,
            "drug_interactions": initial_ddi.get("drug_interactions", []),
            "critical_flag": critical_flag,
            "iterations_taken": len(result_state.get("steps", [])),
            "citation_warnings_flagged": result_state.get("citation_warnings_flagged", False),
            "recommended_workup": recommended_workup,
            "trace_steps": result_state.get("steps", []),
            "fallbacks_active": {
                "llm": False,
                "neo4j": neo4j_fallback
            }
        }
        return output
    except Exception as e:
        print(f"[FALLBACK ACTIVE] Live ReAct agent run failed ({e}). Reverting to Simulated LLM fallback.")
        res = simulate_react_flow(initial_state)
        res["fallbacks_active"] = {
            "llm": True,
            "neo4j": neo4j_fallback
        }
        return res
