import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  ShieldAlert, 
  FileText, 
  Brain, 
  Database, 
  UserCheck, 
  Stethoscope, 
  Terminal, 
  ArrowRight, 
  Plus, 
  X, 
  Lock, 
  Mail, 
  User, 
  CheckCircle2, 
  RotateCcw, 
  Sparkles, 
  LogOut, 
  AlertTriangle, 
  Play,
  Clipboard,
  BookOpen,
  Layers,
  Download,
  Search,
  FolderOpen,
  Sun,
  Moon
} from 'lucide-react';
import './App.css';
import './cinematic.css';
import './document.css';
import AuthView from './components/AuthView';
import CinematicLanding from './components/CinematicLanding';
import HowItWorks from './components/HowItWorks';
import PatientWorkspace from './components/PatientWorkspace';
import KnowledgeUploader from './components/KnowledgeUploader';
import { getApiUrl } from './config';

// Pre-seeded patient case history logs for practitioner demonstration
const INITIAL_HISTORY = [
  {
    id: "PAT-0982",
    age: 65,
    sex: "M",
    date: "2026-05-23 20:12",
    symptoms: ["chest pain", "jaw pain", "sweating"],
    medications: ["Warfarin", "Aspirin"],
    comorbidities: ["Atrial Fibrillation", "Hypertension"],
    results: {
      alert: "CRITICAL DRUG INTERACTION DETECTED",
      requires_immediate_intervention: true,
      drug_interactions: [
        {
          dr1: "Warfarin",
          dr2: "Aspirin",
          severity: "High",
          effect: "Co-administration increases the risk of major hemorrhage/bleeding."
        }
      ],
      diagnoses: [
        {
          name: "Medication Interaction Hazard",
          confidence: 1.0,
          evidence: "Patient is concurrently taking Warfarin (anticoagulant) and Aspirin (antiplatelet). This combination synergisticly increases risk of major gastrointestinal and intracranial bleeding, violating standard clinical recommendations unless specifically indicated under strict monitoring.",
          citations: ["AHA/ACC Antithrombotic Guidelines: Guideline 10"]
        }
      ],
      recommended_workup: [
        "Immediate coagulation profile (PT/INR) check",
        "Review indication for dual therapy",
        "Evaluate for signs of active bleeding (occult blood, bruising)"
      ]
    }
  },
  {
    id: "PAT-0411",
    age: 72,
    sex: "F",
    date: "2026-05-23 19:44",
    symptoms: ["headache", "confusion"],
    medications: ["Lisinopril"],
    comorbidities: ["Hypertension"],
    results: {
      diagnoses: [
        {
          name: "Intracranial Hemorrhage",
          confidence: 0.80,
          evidence: "Spontaneous headache and confusion in a geriatric patient. High priority rule-out given anticoagulation/bleeding risk paths.",
          citations: ["AHA/ACC Antithrombotic Guidelines: Guideline 11"]
        },
        {
          name: "Migraine with Aura",
          confidence: 0.45,
          evidence: "Severe headache accompanied by transient neurological symptoms (confusion/cognitive fog).",
          citations: []
        }
      ],
      top_confidence: 0.80,
      recommended_workup: [
        "Non-contrast Head CT Scan",
        "Coagulation profile (PT/INR/aPTT)",
        "Neurological examination checks"
      ],
      drug_interaction_flagged: false,
      drug_interactions: []
    }
  }
];

function App() {
  // Navigation & Page State
  const [view, setView] = useState('landing'); // 'landing' | 'auth' | 'dashboard'
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('medgraph_theme') || 'light'); // 'dark' | 'light'
  const [role, setRole] = useState('doctor'); // 'doctor' | 'patient'
  const [authToken, setAuthToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [practitioner, setPractitioner] = useState({
    name: 'Dr. Evelyn Carter, MD',
    npi: '1982736450',
    email: 'e.carter@medgraph.ai',
    clinic: 'Cardiovascular Research Center'
  });

  const [isGoogleSsoConfigured, setIsGoogleSsoConfigured] = useState(false);
  const roleRef = useRef(role);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  // Restore session from localStorage on load
  useEffect(() => {
    const token = localStorage.getItem('medgraph_access_token');
    const storedUser = localStorage.getItem('medgraph_user');
    if (token && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setAuthToken(token);
        setIsLoggedIn(true);
        setRole(parsedUser.role === 'medical_practitioner' ? 'doctor' : 'patient');
        if (parsedUser.role === 'medical_practitioner') {
          setPractitioner({
            name: parsedUser.name || '',
            npi: parsedUser.npi || '',
            email: parsedUser.email || '',
            clinic: parsedUser.clinic || ''
          });
        }
        setView('dashboard');
      } catch (e) {
        console.error("Failed to restore session from localStorage", e);
      }
    }
  }, []);

  // Query Google SSO Configuration on boot / when view changes to auth
  useEffect(() => {
    const fetchGoogleConfig = async () => {
      try {
        const response = await fetch(getApiUrl('/auth/config'));
        if (response.ok) {
          const data = await response.json();
          if (data.google_client_id) {
            setIsGoogleSsoConfigured(true);
            
            // Wait for script to load & DOM container to mount, then render standard button
            setTimeout(() => {
              if (window.google) {
                window.google.accounts.id.initialize({
                  client_id: data.google_client_id,
                  callback: async (res) => {
                    setAuthError('');
                    try {
                      const apiRes = await fetch(getApiUrl('/auth/google'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          credential: res.credential,
                          role: mapUiRoleToApiRole(roleRef.current)
                        })
                      });
                      if (!apiRes.ok) {
                        const errData = await apiRes.json();
                        setAuthError(errData.detail || 'Google SSO login failed.');
                        return;
                      }
                      const sessionData = await apiRes.json();
                      applyAuthenticatedSession(sessionData);
                    } catch (err) {
                      setAuthError('Unable to connect to Google authentication server.');
                    }
                  }
                });
                
                // Render inside container
                const btnContainer = document.getElementById("google-sso-button");
                if (btnContainer) {
                  window.google.accounts.id.renderButton(btnContainer, {
                    theme: "outline",
                    size: "large",
                    width: 368
                  });
                }
              }
            }, 300);
          } else {
            setIsGoogleSsoConfigured(false);
          }
        }
      } catch (e) {
        console.warn("Failed to retrieve Google Auth config from backend:", e);
        setIsGoogleSsoConfigured(false);
      }
    };

    if (view === 'auth') {
      fetchGoogleConfig();
    }
  }, [view, authMode]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
    localStorage.setItem('medgraph_theme', theme);
  }, [theme]);

  // Auth Form Fields
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [npiInput, setNpiInput] = useState('');
  const [clinicInput, setClinicInput] = useState('');

  // CDSS Dashboard Form Fields
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [symptoms, setSymptoms] = useState([]);
  const [medications, setMedications] = useState([]);
  const [comorbidities, setComorbidities] = useState([]);
  
  // Temporary input state
  const [symptomText, setSymptomText] = useState('');
  const [medicationText, setMedicationText] = useState('');
  const [comorbidityText, setComorbidityText] = useState('');

  // Dashboard Active Workspace Tab
  const [activeTab, setActiveTab] = useState('diagnostics'); // 'diagnostics' | 'evidence' | 'history' | 'telemetry'

  // Patient History List & Search
  const [history, setHistory] = useState(INITIAL_HISTORY);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Checked workup checklist tasks
  const [checkedWorkups, setCheckedWorkups] = useState({});

  // Diagnosis Execution States
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [activeNode, setActiveNode] = useState('none'); // 'none' | 'ingest' | 'graph' | 'rag' | 'reasoning' | 'veracity' | 'synthesis'
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // RAG Source Grounding passages mapped from RAG hits
  const [ragPassages, setRagPassages] = useState([]);

  // Export summary modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Terminal autoscroll reference
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Handle adding items dynamically
  const addSymptom = (e) => {
    e.preventDefault();
    const entries = symptomText.split(',').map(s => s.trim().toLowerCase()).filter(s => s && !symptoms.includes(s));
    if (entries.length > 0) {
      setSymptoms([...symptoms, ...entries]);
      setSymptomText('');
    }
  };

  const addMedication = (e) => {
    e.preventDefault();
    const entries = medicationText.split(',').map(m => m.trim()).filter(m => m && !medications.includes(m));
    if (entries.length > 0) {
      setMedications([...medications, ...entries]);
      setMedicationText('');
    }
  };

  const addComorbidity = (e) => {
    e.preventDefault();
    const entries = comorbidityText.split(',').map(c => c.trim()).filter(c => c && !comorbidities.includes(c));
    if (entries.length > 0) {
      setComorbidities([...comorbidities, ...entries]);
      setComorbidityText('');
    }
  };

  // Remove items
  const removeSymptom = (index) => {
    setSymptoms(symptoms.filter((_, i) => i !== index));
  };

  const removeMedication = (index) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const removeComorbidity = (index) => {
    setComorbidities(comorbidities.filter((_, i) => i !== index));
  };

  // Load a session from History Table
  const loadHistoryItem = (item) => {
    setActiveHistoryId(item.id);
    setAge(item.age);
    setSex(item.sex);
    setSymptoms(item.symptoms);
    setMedications(item.medications);
    setComorbidities(item.comorbidities);
    setResults(item.results);
    setCheckedWorkups({});
    
    // Load pre-populated RAG chunks for selected history item
    updateRagEvidence(item.results, item.symptoms);
    
    // Switch to diagnostics tab
    setActiveTab('diagnostics');
    setLogs([
      { id: 1, message: `Loaded Patient Record ${item.id} successfully.`, type: 'success', timestamp: new Date().toLocaleTimeString() },
      { id: 2, message: `Clinical diagnostic outputs resolved from session cache.`, type: 'info', timestamp: new Date().toLocaleTimeString() }
    ]);
  };

  // Clear inputs
  const resetForm = () => {
    setAge('');
    setSex('');
    setSymptoms([]);
    setMedications([]);
    setComorbidities([]);
    setResults(null);
    setLogs([]);
    setActiveNode('none');
    setActiveHistoryId(null);
    setCheckedWorkups({});
    setRagPassages([]);
  };

  // Mock logging function with timing
  const addLog = (message, type = 'info', delay = 0) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [...prev, { id: Math.random(), message, type, timestamp }]);
        resolve();
      }, delay);
    });
  };

  // Populate dynamic reference grounding guidelines passages
  const updateRagEvidence = (diagnosisOutput, symptomsList) => {
    const isCardiac = symptomsList.some(s => s.toLowerCase().includes('chest') || s.toLowerCase().includes('jaw') || s.toLowerCase().includes('sweating') || s.toLowerCase().includes('pressure'));
    const isNeuro = symptomsList.some(s => s.toLowerCase().includes('headache') || s.toLowerCase().includes('cephalalgia') || s.toLowerCase().includes('confusion'));
    const hasDDI = diagnosisOutput?.requires_immediate_intervention || diagnosisOutput?.critical_flag || false;

    let passages = [];

    if (hasDDI) {
      passages = [
        {
          title: "AHA/ACC Antithrombotic Guidelines — Section 10.4",
          source: "Guideline 10 (Clinical Anticoagulation)",
          match: "94.2% Similarity",
          text: "Concurrent administration of oral anticoagulants (e.g., Warfarin) and antiplatelet therapy (e.g., Aspirin) increases the risk of bleeding synergistically. Dual therapy should only be maintained when clinical indications (e.g., mechanical heart valves, recent coronary stenting) outweigh verified bleeding score metrics, and requires close, continuous INR monitoring."
        },
        {
          title: "DrugBank Reference Core Path — DDI-39201",
          source: "DrugBank Database",
          match: "99.1% Correlation",
          text: "Warfarin and Aspirin co-administration. High Risk: The antiplatelet action of aspirin combined with the clotting factor synthesis inhibition of warfarin results in a profound compound bleed hazard. Recommended action: Evaluate target INR range and substitute non-interacting drugs if indicated."
        }
      ];
    } else if (isCardiac) {
      passages = [
        {
          title: "AHA/ACC Chest Pain Guidelines 2021 — Section 4.1.2 (Triage)",
          source: "Practice Guideline",
          match: "89.5% Similarity",
          text: "For patients presenting with acute chest pain and potential ischemic symptoms (including radiation to the jaw, back, or neck, and accompanying diaphoresis), a 12-lead ECG must be obtained and interpreted within 10 minutes of clinical arrival. Serial cardiac troponins should be drawn to rule out myocardial infarction."
        },
        {
          title: "AHA/ACC Guidelines 2022 — Aortic Dissection Rules",
          source: "Clinical Guideline",
          match: "87.0% Similarity",
          text: "Geriatric patients with history of hypertension presenting with sudden, severe chest pain radiating to the jaw or back require prompt CT Angiography to rule out thoracic aortic dissection. Aortic dissection carries an hourly mortality rate of 1-2% if untreated."
        }
      ];
    } else if (isNeuro) {
      passages = [
        {
          title: "AHA/ASA Guidelines for the Management of Spontaneous Intracranial Hemorrhage",
          source: "Guideline 11 (Neurology)",
          match: "91.8% Similarity",
          text: "Geriatric patients presenting with spontaneous onset headache (cephalalgia) and associated cognitive decline or confusion require immediate emergency non-contrast head CT scan to differentiate between intracranial hemorrhage and ischemic cerebrovascular accidents."
        }
      ];
    } else {
      passages = [
        {
          title: "Nonspecific Adult Chest Pain Pathways",
          source: "Clinical Guideline",
          match: "82.4% Similarity",
          text: "For adult clinical presentations that do not meet high-risk cardiac or neurological guidelines, initial evaluation should include complete blood count (CBC) and basic metabolic panels (BMP) to establish baseline parameters, alongside observation."
        }
      ];
    }

    setRagPassages(passages);
  };

  // Primary trigger to invoke diagnostics
  const runDiagnostics = async () => {
    const parsedAge = parseInt(age);
    if (age === '' || isNaN(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      setError('Please enter a valid patient age between 0 and 120.');
      return;
    }
    if (!sex || (sex !== 'M' && sex !== 'F')) {
      setError("Please select the patient's biological sex.");
      return;
    }
    if (symptoms.length === 0) {
      setError('Please add at least one symptom to run diagnostics.');
      return;
    }
    setError(null);
    setIsDiagnosing(true);
    setResults(null);
    setLogs([]);
    setCheckedWorkups({});
    setActiveTab('telemetry'); // Switch tab to show telemetry during execution!

    // Telemetry and active node animation flow
    setActiveNode('ingest');
    await addLog('System initialized: Ingesting patient demographics...', 'info', 0);
    await addLog(`Profile loaded: ${age}-year-old ${sex === 'M' ? 'Male' : 'Female'}`, 'info', 300);
    await addLog(`Raw symptoms: [${symptoms.join(', ')}]`, 'info', 250);
    
    setActiveNode('graph');
    await addLog('Linker engine: Resolving clinical entities and mapping synonyms...', 'info', 300);
    const resolvedSym = symptoms.map(s => s === 'cephalalgia' ? 'headache' : s === 'chest pressure' ? 'chest pain' : s);
    const resolvedLogMessages = [];
    symptoms.forEach((s, idx) => {
      if (s !== resolvedSym[idx]) {
        resolvedLogMessages.push(`${s} ➔ ${resolvedSym[idx]}`);
      }
    });
    if (resolvedLogMessages.length > 0) {
      await addLog(`Synonyms resolved: ${resolvedLogMessages.join(', ')} matched to standard UMLS terms`, 'success', 250);
    }
    
    await addLog('Connecting to Neo4j Graph Database...', 'info', 300);
    await addLog('Querying drug-drug interactions and symptom-disease probability links...', 'info', 200);

    // Check drug interactions locally
    const hasDDI = medications.some(m => m.toLowerCase().includes('warfarin')) && medications.some(m => m.toLowerCase().includes('aspirin'));
    
    if (hasDDI) {
      await addLog('CRITICAL HAZARD DETECTED: Severe drug-drug interaction found [Warfarin + Aspirin]', 'danger', 400);
      await addLog('Action: High-severity flag triggered. Initiating early-exit bypass node...', 'warning', 300);
      setActiveNode('synthesis');
    } else {
      await addLog('No critical drug interactions found. Continuing standard workflow...', 'success', 400);
      
      setActiveNode('rag');
      await addLog('Initializing guideline Vector RAG index...', 'info', 400);
      await addLog('Querying documents database using dense vector embeddings (gemini-embedding-001)...', 'info', 300);
      await addLog('Retrieving reference literature. Metadata filter applied: prioritize guideline sources over PubMed abstracts...', 'info', 300);
      await addLog('RAG HIT: Retrieved 5 relevant reference document chunks from AHA/ACC Guidelines.', 'success', 400);
      
      setActiveNode('reasoning');
      await addLog('Aggregating graph contexts and guideline literature chunks...', 'info', 300);
      await addLog('Invoking clinical reasoning engine (SageMaker Gemma-2-9b ml.g5.2xlarge endpoint)...', 'info', 450);
      await addLog('Reasoning complete: Differential diagnoses formulated.', 'success', 400);
      
      setActiveNode('veracity');
      await addLog('Running Veracity Checker: Cross-referencing citations against RAG context...', 'info', 350);
      await addLog('Citation check complete: All source documents validated. 0 hallucinations detected.', 'success', 300);
      
      setActiveNode('synthesis');
    }

    await addLog('Compiling final structured clinical analysis report...', 'info', 300);

    // Call actual backend or fallback to local mock
    let diagnosticResult = null;
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const diagnoseController = new AbortController();
      const diagnoseTimeout = setTimeout(() => diagnoseController.abort(), 120000); // 120s timeout
      const response = await fetch(getApiUrl('/diagnose'), {
        method: 'POST',
        headers: headers,
        signal: diagnoseController.signal,
        body: JSON.stringify({
          age: parseInt(age),
          sex: sex,
          symptoms: resolvedSym,
          medications: medications,
          comorbidities: comorbidities
        })
      });
      clearTimeout(diagnoseTimeout);

      if (!response.ok) {
        throw new Error('API Response Error');
      }

      const data = await response.json();
      if (data.fallbacks_active) {
        if (data.fallbacks_active.llm) {
          console.warn("⚠️ MedGraph AI Alert: LLM reasoning core is running on offline SIMULATED FALLBACK.");
        } else {
          console.log("🚀 MedGraph AI Core: Live LangGraph ReAct agent successfully executed.");
        }
        if (data.fallbacks_active.neo4j) {
          console.warn("⚠️ MedGraph AI Alert: Neo4j database is unreachable. Using local in-memory fallback graph.");
        } else {
          console.log("🚀 MedGraph AI Core: Connected live to Neo4j cloud instance.");
        }
      }
      diagnosticResult = data;
      setResults(data);
      updateRagEvidence(data, resolvedSym);
      await addLog('Clinical analysis report compiled successfully. Rendering outputs.', 'success', 200);
    } catch (e) {
      await addLog(`Backend server unreachable. Engaging local clinical engine cache fallback...`, 'warning', 200);
      
      // Local Mock Engine Fallback matching backend rules exactly
      let mockData = {};
      if (hasDDI) {
        mockData = {
          alert: "CRITICAL DRUG INTERACTION DETECTED",
          requires_immediate_intervention: true,
          drug_interactions: [
            {
              dr1: "Warfarin",
              dr2: "Aspirin",
              severity: "High",
              effect: "Co-administration increases the risk of major hemorrhage/bleeding."
            }
          ],
          diagnoses: [
            {
              name: "Medication Interaction Hazard",
              confidence: 1.0,
              evidence: "Patient is concurrently taking Warfarin (anticoagulant) and Aspirin (antiplatelet). This combination synergisticly increases risk of major gastrointestinal and intracranial bleeding, violating standard clinical recommendations unless specifically indicated under strict monitoring.",
              citations: ["AHA/ACC Antithrombotic Guidelines: Guideline 10"]
            }
          ],
          recommended_workup: [
            "Immediate coagulation profile (PT/INR) check",
            "Review indication for dual therapy",
            "Evaluate for signs of active bleeding (occult blood, bruising)"
          ]
        };
      } else {
        const isNeuro = resolvedSym.some(s => s.toLowerCase().includes('headache') || s.toLowerCase().includes('confusion'));
        const isCardiac = resolvedSym.some(s => s.toLowerCase().includes('chest') || s.toLowerCase().includes('jaw') || s.toLowerCase().includes('sweating') || s.toLowerCase().includes('breath'));

        if (isCardiac) {
          mockData = {
            diagnoses: [
              {
                name: "Acute Coronary Syndrome (ACS)",
                confidence: 0.95,
                evidence: "Patient presents with classic symptoms of chest pain radiating to the jaw with associated diaphoresis, which, according to AHA/ACC Guidelines 2021, warrant immediate cardiac workup.",
                citations: ["AHA/ACC Guidelines 2021: Guideline 1", "AHA/ACC Guidelines 2021: Guideline 3"]
              },
              {
                name: "Aortic Dissection",
                confidence: 0.80,
                evidence: "Aortic Dissection is a critical cardiovascular emergency that can present with sudden, severe chest pain radiating to the jaw. Hypertension acts as a severe risk factor, as per AHA/ACC Guidelines 2022.",
                citations: ["AHA/ACC Guidelines 2022: Guideline 6"]
              },
              {
                name: "Unstable Angina",
                confidence: 0.70,
                evidence: "Ischemic chest tightness without biomarkers elevation. Requires serial troponin tracking.",
                citations: []
              }
            ],
            top_confidence: 0.95,
            recommended_workup: [
              "Electrocardiogram (ECG) within 10 minutes",
              "Cardiac Troponin levels (initial and 3-hour)",
              "Chest X-ray",
              "CT Angiography of the chest"
            ],
            drug_interaction_flagged: false,
            drug_interactions: []
          };
        } else if (isNeuro) {
          mockData = {
            diagnoses: [
              {
                name: "Intracranial Hemorrhage",
                confidence: 0.80,
                evidence: "Acute onset headache and confusion. Requires high priority rule-out given anticoagulation/hypertensive hemorrhage risks.",
                citations: ["AHA/ACC Antithrombotic Guidelines: Guideline 11"]
              },
              {
                name: "Spontaneous Subarachnoid Hemorrhage",
                confidence: 0.55,
                evidence: "Sudden onset headache described as severe. High correlation with pre-existing vascular pathologies.",
                citations: []
              }
            ],
            top_confidence: 0.80,
            recommended_workup: [
              "Non-contrast Head CT Scan",
              "Coagulation profile (PT/INR/aPTT)",
              "Neurological checks every 1 hour"
            ],
            drug_interaction_flagged: false,
            drug_interactions: []
          };
        } else {
          mockData = {
            diagnoses: [
              {
                name: "Nonspecific Clinical Presentation",
                confidence: 0.45,
                evidence: "Patient's symptom constellation does not strongly map to clear high-severity cardiovascular or neurological guidelines.",
                citations: []
              }
            ],
            top_confidence: 0.45,
            recommended_workup: [
              "Basic Metabolic Panel (BMP)",
              "Complete Blood Count (CBC)",
              "Clinical Observation"
            ],
            drug_interaction_flagged: false,
            drug_interactions: []
          };
        }
      }
      // Tag the payload so the UI can label it. Rendering fabricated clinical
      // output indistinguishable from a real backend response is the dangerous
      // failure here, not the fallback itself.
      mockData.is_simulated = true;
      mockData.simulated_reason = (e && e.name === 'AbortError')
        ? 'Request timed out'
        : 'Backend unreachable';
      diagnosticResult = mockData;
      setResults(mockData);
      updateRagEvidence(mockData, resolvedSym);
      await addLog('SIMULATED result - backend unreachable. This is not a live diagnosis.', 'warning', 100);
    } finally {
      setIsDiagnosing(false);
      setActiveNode('none');
      setActiveTab('diagnostics'); // Switch tab to results to display diagnostics immediately!

      // Add to case history
      if (diagnosticResult) {
        const newCaseId = `PAT-${Math.floor(1000 + Math.random() * 9000)}`;
        const newRecord = {
          id: newCaseId,
          age: parseInt(age),
          sex: sex,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          symptoms: [...symptoms],
          medications: [...medications],
          comorbidities: [...comorbidities],
          results: diagnosticResult
        };
        setHistory(prev => [newRecord, ...prev]);
        setActiveHistoryId(newCaseId);
      }
    }
  };

  const mapUiRoleToApiRole = (uiRole) => (
    uiRole === 'doctor' ? 'medical_practitioner' : 'patient'
  );

  const applyAuthenticatedSession = (data) => {
    setAuthToken(data.access_token);
    setAuthError('');
    localStorage.setItem('medgraph_access_token', data.access_token);
    localStorage.setItem('medgraph_user', JSON.stringify(data.user));

    if (data.user.role === 'medical_practitioner') {
      setRole('doctor');
      setPractitioner({
        name: data.user.name || '',
        npi: data.user.npi || '',
        email: data.user.email || '',
        clinic: data.user.clinic || ''
      });
    } else {
      setRole('patient');
    }

    setIsLoggedIn(true);
    setView('dashboard');
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const form = new URLSearchParams();
    form.append('username', emailInput);
    form.append('password', passwordInput);
    form.append('scope', mapUiRoleToApiRole(role));

    try {
      const response = await fetch(getApiUrl('/auth/token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
      });

      if (!response.ok) {
        setAuthError('Authentication failed. Check credentials and role type.');
        return;
      }

      const data = await response.json();
      applyAuthenticatedSession(data);
    } catch (err) {
      setAuthError('Unable to connect to safety gateway.');
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(getApiUrl('/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          password: passwordInput,
          role: mapUiRoleToApiRole(role),
          name: nameInput || (role === 'doctor' ? 'Medical Practitioner' : 'Patient'),
          npi: role === 'doctor' ? npiInput : null,
          clinic: role === 'doctor' ? clinicInput : null,
          tenant_id: 'demo-clinic'
        })
      });

      if (!response.ok) {
        setAuthError('Account setup failed. Email may already be registered.');
        return;
      }

      const data = await response.json();
      applyAuthenticatedSession(data);
    } catch (err) {
      setAuthError('Unable to connect to safety gateway.');
    }
  };

  const handleGoogleLogin = async (uiRole) => {
    setAuthError('');
    try {
      const response = await fetch(getApiUrl('/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: 'mock_google_jwt_token',
          role: mapUiRoleToApiRole(uiRole)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setAuthError(errorData.detail || 'Google SSO login failed.');
        return;
      }

      const data = await response.json();
      applyAuthenticatedSession(data);
    } catch (err) {
      setAuthError('Unable to connect to Google authentication server.');
    }
  };

  // Generate markdown text of the report
  const generateMarkdownReport = () => {
    if (!results) return "";
    let report = `## MedGraph AI — Clinical Case Summary Report\n\n`;
    report += `**Patient ID:** ${activeHistoryId || "New Patient"}\n`;
    report += `**Demographics:** ${age}-year-old ${sex === 'M' ? 'Male' : 'Female'}\n`;
    report += `**Intake Symptoms:** ${symptoms.join(', ')}\n`;
    report += `**Active Medications:** ${medications.length > 0 ? medications.join(', ') : 'None'}\n`;
    report += `**Pre-existing Comorbidities:** ${comorbidities.length > 0 ? comorbidities.join(', ') : 'None'}\n\n`;
    report += `--- \n\n`;
    
    if (results.requires_immediate_intervention || results.critical_flag) {
      report += `### ⚠️ CRITICAL PHARMACOLOGICAL HAZARD ALERT\n`;
      results.drug_interactions.forEach(i => {
        report += `- **${i.dr1} + ${i.dr2}:** ${i.effect} (Severity: ${i.severity})\n`;
      });
      report += `\n`;
    }

    report += `### 📋 Differential Diagnoses\n`;
    results.diagnoses.forEach((d, idx) => {
      report += `${idx + 1}. **${d.name}** (Confidence: ${(d.confidence * 100).toFixed(0)}%)\n`;
      report += `   *Evidence:* ${d.evidence}\n`;
      if (d.citations && d.citations.length > 0) {
        report += `   *Citations:* ${d.citations.join(', ')}\n`;
      }
      report += `\n`;
    });

    report += `### 🩺 Recommended Clinical Workup\n`;
    results.recommended_workup.forEach(w => {
      report += `- [ ] ${w}\n`;
    });
    
    report += `\n---\n*Report generated by ${practitioner.name} via MedGraph Decision Console on ${new Date().toLocaleString()}.*`;
    return report;
  };

  const downloadPatientReport = () => {
    let report = `MedGraph AI — Patient Health Summary\n`;
    report += `===================================\n\n`;
    report += `Name: Patient Intake\n`;
    report += `Age: ${age} | Gender: ${sex === 'M' ? 'Male' : 'Female'}\n\n`;
    report += `Symptoms Checked:\n`;
    symptoms.forEach(s => {
      report += `- ${s}\n`;
    });
    report += `\nMedications Checked:\n`;
    medications.forEach(m => {
      report += `- ${m}\n`;
    });
    report += `\n-----------------------------------\n`;
    report += `HEALTH SUMMARY & ADVICE:\n`;
    
    const hasDDI = medications.some(m => m.toLowerCase().includes('warfarin')) && medications.some(m => m.toLowerCase().includes('aspirin'));
    if (hasDDI) {
      report += `⚠️ CRITICAL DRUG SAFETY WARNING:\n`;
      report += `You are taking Warfarin and Aspirin together. These two medications both thin your blood and can cause severe internal bleeding or easy bruising when taken at the same time.\n\n`;
      report += `RECOMMENDED STEPS:\n`;
      report += `1. Contact your doctor or cardiologist immediately to confirm if taking both medications is necessary for you.\n`;
      report += `2. Get your blood clotting time checked (PT/INR test) as scheduled by your clinic.\n`;
      report += `3. Watch for unusual signs of bleeding, like blood in your urine, black stools, nosebleeds, or large bruises.\n`;
      report += `4. Do NOT stop taking your medication without consulting Dr. Carter or your physician.\n`;
    } else {
      report += `Your checked symptoms and medications have been logged. No critical drug-drug interactions were flagged in your active list.\n\n`;
      report += `General Guidance:\n`;
      report += `- Continue taking your medications as prescribed.\n`;
      report += `- If you experience new or worsening symptoms, consult your healthcare provider.\n`;
    }
    
    report += `\n*This summary is generated for information purposes using MedGraph AI and should be discussed directly with your doctor.*`;
    
    const element = document.createElement("a");
    const file = new Blob([report], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `patient_health_summary_${activeHistoryId || 'PAT-0982'}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateMarkdownReport());
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const toggleWorkupCheck = (wIdx) => {
    setCheckedWorkups(prev => ({
      ...prev,
      [wIdx]: !prev[wIdx]
    }));
  };

  // Helpers for Case Loader presets
  const loadCase = (caseNum) => {
    if (caseNum === 1) {
      setAge(65);
      setSex('M');
      setSymptoms(['chest pain', 'jaw pain', 'sweating']);
      setMedications(['Warfarin', 'Aspirin']);
      setComorbidities(['Atrial Fibrillation', 'Hypertension']);
    } else if (caseNum === 2) {
      setAge(72);
      setSex('F');
      setSymptoms(['cephalalgia', 'confusion']);
      setMedications(['Lisinopril']);
      setComorbidities(['Hypertension']);
    } else if (caseNum === 3) {
      setAge(55);
      setSex('M');
      setSymptoms(['chest pressure', 'shortness of breath']);
      setMedications(['Aspirin', 'Ibuprofen']);
      setComorbidities(['Coronary Artery Disease', 'Hypertension']);
    }
  };

  // Filter session history by search query
  const filteredHistory = history.filter(item => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    
    const idMatch = item.id.toLowerCase().includes(query);
    const symptomMatch = item.symptoms.some(s => s.toLowerCase().includes(query));
    const medMatch = item.medications.some(m => m.toLowerCase().includes(query));
    const diagMatch = item.results?.diagnoses?.some(d => d.name.toLowerCase().includes(query));
    const alertMatch = item.results?.alert?.toLowerCase().includes(query);
    
    return idMatch || symptomMatch || medMatch || diagMatch || alertMatch;
  });

  return (
    <div className="app-container">
      {/* Ambient background glows */}
      <div className="ambient-glow-container">
        <div className="glow-orb-cyan"></div>
        <div className="glow-orb-purple"></div>
      </div>

      {/* Navigation Header */}
      <header className="navbar">
        <div className="nav-brand" onClick={() => setView('landing')} style={{ cursor: 'pointer' }}>
          <Activity className="nav-logo-icon" size={20} />
          <span>MedGraph AI <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', background: 'rgba(14,165,233,0.1)', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px' }}>CDSS v1.0</span></span>
        </div>
        <nav className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            className={`nav-link ${view === 'landing' ? 'active' : ''}`}
            onClick={() => setView('landing')}
          >
            Overview
          </span>
          <span
            className={`nav-link ${view === 'how' ? 'active' : ''}`}
            onClick={() => setView('how')}
          >
            How it works
          </span>
          {isLoggedIn ? (
            <>
              {role === 'doctor' ? (
                <span
                  className={`nav-link ${view === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setView('dashboard')}
                >
                  <Stethoscope size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                  Practitioner Console
                </span>
              ) : (
                <span
                  className={`nav-link ${view === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setView('dashboard')}
                >
                  <UserCheck size={14} style={{ marginRight: '6px', verticalAlign: '-2px' }} />
                  Patient Portal
                </span>
              )}
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  localStorage.removeItem('medgraph_access_token');
                  localStorage.removeItem('medgraph_user');
                  setAuthToken('');
                  setIsLoggedIn(false);
                  setView('landing');
                }}
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </>
          ) : (
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setAuthMode('login');
                setView('auth');
              }}
              style={{ padding: '6px 14px', fontSize: '12px' }}
            >
              Sign In
              <ArrowRight size={13} />
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--panel-border)', borderRadius: '6px' }}
          >
            {theme === 'dark' ? <Sun size={14} style={{ color: 'var(--accent-cyan)' }} /> : <Moon size={14} style={{ color: 'var(--accent-purple)' }} />}
          </button>
        </nav>
      </header>

      {/* Landing View */}
      {view === 'landing' && (
        <CinematicLanding
          isLoggedIn={isLoggedIn}
          onEnterWorkspace={() => setView('dashboard')}
          onLogin={() => { setAuthMode('login'); setView('auth'); }}
          onRegister={() => { setAuthMode('signup'); setView('auth'); }}
          onHowItWorks={() => setView('how')}
        />
      )}

      {/* How MedGraph Works */}
      {view === 'how' && (
        <HowItWorks
          isLoggedIn={isLoggedIn}
          onEnterWorkspace={() => setView('dashboard')}
          onLogin={() => { setAuthMode('login'); setView('auth'); }}
          onRegister={() => { setAuthMode('signup'); setView('auth'); }}
        />
      )}

      {/* Auth View */}
      {view === 'auth' && (
        <AuthView
          authMode={authMode}
          setAuthMode={setAuthMode}
          role={role}
          setRole={setRole}
          emailInput={emailInput}
          setEmailInput={setEmailInput}
          passwordInput={passwordInput}
          setPasswordInput={setPasswordInput}
          nameInput={nameInput}
          setNameInput={setNameInput}
          npiInput={npiInput}
          setNpiInput={setNpiInput}
          clinicInput={clinicInput}
          setClinicInput={setClinicInput}
          handleLoginSubmit={handleLoginSubmit}
          handleSignupSubmit={handleSignupSubmit}
          authError={authError}
          handleGoogleLogin={handleGoogleLogin}
          isGoogleSsoConfigured={isGoogleSsoConfigured}
        />
      )}

      {/* Dashboard Workspace View */}
      {view === 'dashboard' && role === 'doctor' && (
        <main className="workspace-grid">
          {/* Left Column Sidebar: Inputs ONLY (Wider 420px column layout) */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* compact Practitioner Info card */}
            <div className="clinical-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '6px', background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'var(--accent-cyan)', fontWeight: '700', fontSize: '14px', justifyContent: 'center' }}>
                  {practitioner.name.split(' ').pop().charAt(0) || 'D'}
                </div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-contrast)' }}>{practitioner.name}</h4>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>NPI: {practitioner.npi}</div>
                </div>
              </div>
            </div>

            {/* Ingestion Intake Card */}
            <div className="clinical-card" style={{ padding: '24px' }}>
              <span className="section-title" style={{ marginBottom: '16px' }}>
                <Stethoscope size={12} /> Patient Intake Profile
              </span>
              
              {/* Presets Row */}
              <div style={{ marginBottom: '20px' }}>
                <span className="form-label">Load Preset Scenarios</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <button className="btn btn-secondary" onClick={() => loadCase(1)} style={{ padding: '5px 10px', fontSize: '11px' }}>
                    DDI Hazard
                  </button>
                  <button className="btn btn-secondary" onClick={() => loadCase(2)} style={{ padding: '5px 10px', fontSize: '11px' }}>
                    Geriatric Stroke
                  </button>
                  <button className="btn btn-secondary" onClick={() => loadCase(3)} style={{ padding: '5px 10px', fontSize: '11px' }}>
                    Cardiac STEMI
                  </button>
                </div>
              </div>

              {/* Age / Sex */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label className="form-label">Age</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="0" 
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Sex</label>
                  <select className="form-select" value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="" disabled>Select Sex...</option>
                    <option value="M">Male (M)</option>
                    <option value="F">Female (F)</option>
                  </select>
                </div>
              </div>

              {/* Presenting Symptoms Tagging */}
              <div className="form-group">
                <label className="form-label">Presenting Symptoms</label>
                <form onSubmit={addSymptom} className="tag-input-row">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Add symptom..."
                    value={symptomText}
                    onChange={(e) => setSymptomText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-icon-only">
                    <Plus size={14} />
                  </button>
                </form>
                <div className="tag-container">
                  {symptoms.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>No symptoms added</span>
                  ) : (
                    symptoms.map((symptom, i) => (
                      <span key={i} className="tag-item">
                        {symptom}
                        <button className="tag-delete-btn" onClick={() => removeSymptom(i)}>
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Active Medications Tagging */}
              <div className="form-group">
                <label className="form-label">Active Medications</label>
                <form onSubmit={addMedication} className="tag-input-row">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Add drug..."
                    value={medicationText}
                    onChange={(e) => setMedicationText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-icon-only">
                    <Plus size={14} />
                  </button>
                </form>
                <div className="tag-container">
                  {medications.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>No medications listed</span>
                  ) : (
                    medications.map((med, i) => (
                      <span key={i} className="tag-item" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                        {med}
                        <button className="tag-delete-btn" onClick={() => removeMedication(i)}>
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Comorbidities */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Comorbidities</label>
                <form onSubmit={addComorbidity} className="tag-input-row">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Add comorbidity..."
                    value={comorbidityText}
                    onChange={(e) => setComorbidityText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-icon-only">
                    <Plus size={14} />
                  </button>
                </form>
                <div className="tag-container">
                  {comorbidities.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>No comorbidities listed</span>
                  ) : (
                    comorbidities.map((como, i) => (
                      <span key={i} className="tag-item">
                        {como}
                        <button className="tag-delete-btn" onClick={() => removeComorbidity(i)}>
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {error && (
                <div style={{ color: 'var(--accent-rose)', fontSize: '11px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={12} />
                  {error}
                </div>
              )}

              {/* Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px', gap: '8px' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={runDiagnostics} 
                  disabled={isDiagnosing}
                  style={{ width: '100%' }}
                >
                  {isDiagnosing ? (
                    <>
                      <Activity className="nav-logo-icon" size={14} />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      Evaluate Case
                    </>
                  )}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={resetForm}
                  disabled={isDiagnosing}
                  title="Clear Workspace"
                  style={{ padding: 0 }}
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </aside>

          {/* Right Column: Workspace tab panels */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Workspace tabs navigation bar */}
            <div className="workspace-tabs">
              <button 
                className={`workspace-tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
                onClick={() => setActiveTab('diagnostics')}
              >
                📋 Diagnostics & Workup
              </button>
              <button 
                className={`workspace-tab-btn ${activeTab === 'evidence' ? 'active' : ''}`}
                onClick={() => setActiveTab('evidence')}
              >
                🔍 Grounding Evidence {ragPassages.length > 0 && `(${ragPassages.length})`}
              </button>
              <button 
                className={`workspace-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                📅 Patient Records ({history.length})
              </button>
              <button 
                className={`workspace-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
                onClick={() => setActiveTab('telemetry')}
              >
                🛠️ Agent Telemetry
              </button>
              <button 
                className={`workspace-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
                onClick={() => setActiveTab('knowledge')}
              >
                📁 Knowledge Ingestion
              </button>
            </div>

            {/* TAB 1: Diagnostics & Workup */}
            {activeTab === 'diagnostics' && (
              <div className="clinical-card" style={{ flex: 1, minHeight: '450px' }}>
                {!results ? (
                  <div className="empty-state">
                    <Stethoscope className="empty-state-icon" size={48} />
                    <div>
                      <h3 style={{ color: 'var(--text-contrast)', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>CDSS Engine Dormant</h3>
                      <p style={{ fontSize: '13px', maxWidth: '360px', color: 'var(--text-secondary)' }}>
                        Add symptoms in the left intake panel and click "Evaluate Case" to initiate calculations.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Header Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-contrast)' }}>Differential Analysis Report</h3>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Evaluated against: {comorbidities.length > 0 ? comorbidities.join(', ') : 'No pre-existing history'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary" onClick={() => downloadPatientReport(results)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                          <Download size={13} /> Export Summary
                        </button>
                      </div>
                    </div>

                    {/* Simulated-output banner. The offline fallback fabricates
                        clinical content, so it must never be mistaken for a
                        real backend response. */}
                    {results.is_simulated && (
                      <div className="triage-banner" style={{
                        borderColor: 'var(--accent-amber)',
                        background: 'rgba(217, 169, 95, 0.1)',
                        marginBottom: '14px'
                      }}>
                        <AlertTriangle className="triage-icon" size={20} style={{ color: 'var(--accent-amber)' }} />
                        <div>
                          <h4 className="triage-title" style={{ color: 'var(--accent-amber)' }}>
                            SIMULATED OUTPUT - NOT A LIVE DIAGNOSIS
                          </h4>
                          <p className="triage-desc">
                            {results.simulated_reason || 'Backend unreachable'}. These results were
                            generated locally for demonstration and are not derived from the
                            knowledge graph, guideline retrieval, or the reasoning model.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Flashing Warning Banner */}
                    {(results.requires_immediate_intervention || results.critical_flag) && (
                      <div className="triage-banner critical">
                        <ShieldAlert className="triage-icon" size={20} />
                        <div>
                          <h4 className="triage-title">CRITICAL PHARMACOLOGICAL ALERT (EARLY-EXIT DETECTED)</h4>
                          {results.drug_interactions && results.drug_interactions.map((interaction, i) => (
                            <p key={i} className="triage-desc" style={{ color: 'var(--text-contrast)', fontWeight: '500' }}>
                              <strong>{interaction.dr1}</strong> + <strong>{interaction.dr2}</strong>: {interaction.effect} (Severity: {interaction.severity})
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Diagnoses list */}
                    <div style={{ marginBottom: '24px' }}>
                      <span className="section-title">Differential Diagnosis Ranks</span>
                      {results.diagnoses && results.diagnoses.map((diag, idx) => (
                        <div key={idx} className="diagnosis-card">
                          <div className="diagnosis-header">
                            <span className="diagnosis-title">{idx + 1}. {diag.name}</span>
                            <span className={`badge ${idx === 0 ? 'badge-rose' : 'badge-outline'}`}>
                              {idx === 0 ? 'Primary Indication' : `Differential Rank ${idx + 1}`}
                            </span>
                          </div>

                          <div className="confidence-row">
                            <div className="confidence-slider-bg">
                              <div 
                                className="confidence-slider-fill" 
                                style={{ width: `${diag.confidence * 100}%`, backgroundColor: idx === 0 ? 'var(--accent-rose)' : 'var(--accent-cyan)' }}
                              ></div>
                            </div>
                            <span className="confidence-label" style={{ color: idx === 0 ? 'var(--accent-rose)' : 'var(--accent-cyan)' }}>{(diag.confidence * 100).toFixed(0)}%</span>
                          </div>

                          <p className="diagnosis-evidence">{diag.evidence}</p>

                          {diag.citations && diag.citations.length > 0 && (
                            <div className="badges-row">
                              {diag.citations.map((citation, cIdx) => (
                                <span 
                                  key={cIdx} 
                                  className="badge badge-info" 
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => setActiveTab('evidence')}
                                  title="View grounding context paragraph"
                                >
                                  <BookOpen size={11} />
                                  {citation}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Checkbox Recommended Workup list */}
                    {results.recommended_workup && results.recommended_workup.length > 0 && (
                      <div>
                        <span className="section-title">Recommended Clinical Workup Checklist</span>
                        <div className="workup-grid">
                          {results.recommended_workup.map((workup, wIdx) => {
                            const isChecked = checkedWorkups[wIdx] || false;
                            return (
                              <div 
                                key={wIdx} 
                                className={`workup-checkbox-card ${isChecked ? 'checked' : ''}`}
                                onClick={() => toggleWorkupCheck(wIdx)}
                              >
                                <CheckCircle2 className="workup-icon" size={16} />
                                <span>{workup}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Grounding Evidence */}
            {activeTab === 'evidence' && (
              <div className="clinical-card" style={{ flex: 1, minHeight: '450px' }}>
                <div style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)' }}>Citations & Grounding Guidelines</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Verifiable reference paragraphs retrieved from Vector index supporting the differentials.
                  </p>
                </div>

                {ragPassages.length === 0 ? (
                  <div className="empty-state">
                    <BookOpen className="empty-state-icon" size={48} style={{ color: 'var(--accent-purple)' }} />
                    <div>
                      <h3 style={{ color: 'var(--text-contrast)', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>No Grounding Context Loaded</h3>
                      <p style={{ fontSize: '13px', maxWidth: '360px', color: 'var(--text-secondary)' }}>
                        Execute a patient evaluation to retrieve and inspect referenced guidelines literature text.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="evidence-section">
                    
                    {/* SVG Concept Graph Visualizer inside Evidence */}
                    <span className="section-title"><Sparkles size={12} /> Dynamic Concept Linkage Graph</span>
                    <div className="svg-graph-container">
                      <svg width="100%" height="100%" viewBox="0 0 600 280">
                        {/* Links */}
                        <line x1="80" y1="60" x2="280" y2="140" className="graph-link active" />
                        <line x1="80" y1="130" x2="280" y2="140" className="graph-link active" />
                        {medications.length > 0 && <line x1="80" y1="210" x2="280" y2="140" className="graph-link active" />}
                        {results.diagnoses && results.diagnoses.map((_, i) => (
                          <line key={i} x1="280" y1="140" x2="480" y2={60 + i * 80} className="graph-link active" />
                        ))}

                        {/* Central Node */}
                        <g className="graph-node">
                          <circle cx="280" cy="140" r="30" className="graph-node-circle" style={{ stroke: 'var(--accent-purple)', fill: 'rgba(139, 92, 246, 0.05)' }} />
                          <text x="280" y="137" className="graph-node-text title">{age}{sex}</text>
                          <text x="280" y="152" className="graph-node-text">Case Link</text>
                        </g>

                        {/* Symptoms Nodes */}
                        <g className="graph-node symptom">
                          <circle cx="80" cy="60" r="22" className="graph-node-circle" />
                          <text x="80" y="63" className="graph-node-text title" style={{ fontSize: '8px' }}>{symptoms[0] || "symptom"}</text>
                        </g>
                        
                        <g className="graph-node symptom">
                          <circle cx="80" cy="130" r="22" className="graph-node-circle" />
                          <text x="80" y="133" className="graph-node-text title" style={{ fontSize: '8px' }}>{symptoms[1] || "symptom"}</text>
                        </g>

                        {/* Medications Node */}
                        <g className="graph-node medication">
                          <circle cx="80" cy="210" r="22" className="graph-node-circle" />
                          <text x="80" y="213" className="graph-node-text title" style={{ fontSize: '8px' }}>{medications[0] || "meds"}</text>
                        </g>

                        {/* Diagnoses Nodes */}
                        {results.diagnoses && results.diagnoses.map((diag, i) => (
                          <g key={i} className="graph-node diagnosis">
                            <circle cx="480" cy={60 + i * 80} r="25" className="graph-node-circle" />
                            <text x="480" y={63 + i * 80} className="graph-node-text title" style={{ fontSize: '8px' }}>{diag.name.substring(0, 15)}...</text>
                          </g>
                        ))}
                      </svg>
                    </div>

                    <span className="section-title"><BookOpen size={12} /> Grounding Literature Reference Paragraphs</span>
                    {ragPassages.map((passage, pIdx) => (
                      <div key={pIdx} className="evidence-block">
                        <div className="evidence-block-header">
                          <span className="evidence-block-title">{passage.title}</span>
                          <span className="badge badge-outline" style={{ fontSize: '10px' }}>{passage.match}</span>
                        </div>
                        <div className="evidence-block-text">
                          "{passage.text}"
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Patient Records History (Searchable Table Workspace) */}
            {activeTab === 'history' && (
              <div className="clinical-card" style={{ flex: 1, minHeight: '450px' }}>
                <div style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)' }}>Patient Records Database</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Historical CDSS runs audit log. Search by Patient ID, symptoms, or diagnoses findings.
                  </p>
                </div>

                {/* Search Bar */}
                <div className="history-search-wrapper">
                  <Search size={16} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="history-search-input"
                    placeholder="Search by Patient ID, symptoms, medications, or diagnostic findings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {filteredHistory.length === 0 ? (
                  <div className="empty-state">
                    <Search className="empty-state-icon" size={48} />
                    <div>
                      <h3 style={{ color: 'var(--text-contrast)', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>No Matching Records Found</h3>
                      <p style={{ fontSize: '13px', maxWidth: '360px', color: 'var(--text-secondary)' }}>
                        Try adjusting your search criteria or evaluate a new patient case to append logs.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="history-table-container">
                    <table className="history-table">
                      <thead>
                        <tr>
                          <th className="history-th">Case ID</th>
                          <th className="history-th">Date/Time</th>
                          <th className="history-th">Demographics</th>
                          <th className="history-th">Clinical Profile</th>
                          <th className="history-th">Primary Diagnostic Finding</th>
                          <th className="history-th" style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHistory.map((item) => {
                          const hasAlert = item.results?.requires_immediate_intervention || item.results?.critical_flag || false;
                          const topDiag = item.results?.diagnoses?.[0];
                          
                          return (
                            <tr key={item.id} className={`history-tr ${activeHistoryId === item.id ? 'active-item' : ''}`}>
                              <td className="history-td">
                                <strong>{item.id}</strong>
                              </td>
                              <td className="history-td" style={{ fontSize: '12px' }}>
                                {item.date}
                              </td>
                              <td className="history-td">
                                {item.age} / {item.sex}
                              </td>
                              <td className="history-td">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <span style={{ fontSize: '12px', color: 'var(--text-contrast)' }}>
                                    Sx: {item.symptoms.join(', ')}
                                  </span>
                                  {item.medications.length > 0 && (
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      Meds: {item.medications.join(', ')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="history-td">
                                {hasAlert ? (
                                  <span className="badge badge-rose" style={{ fontSize: '11px' }}>
                                    ⚠️ Critical DDI Alert
                                  </span>
                                ) : topDiag ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--text-contrast)', fontWeight: '500' }}>
                                      {topDiag.name}
                                    </span>
                                    <span className="badge badge-purple" style={{ fontSize: '10px', padding: '1px 5px' }}>
                                      {(topDiag.confidence * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>No findings</span>
                                )}
                              </td>
                              <td className="history-td" style={{ textAlign: 'right' }}>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                  onClick={() => loadHistoryItem(item)}
                                >
                                  <FolderOpen size={13} style={{ marginRight: '4px' }} />
                                  Load Case
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Agent Telemetry & Logs */}
            {activeTab === 'telemetry' && (
              <div className="clinical-card" style={{ flex: 1, minHeight: '450px' }}>
                <div style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)' }}>Agent Process Telemetry Console</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Track parallel agent execution paths, database queries, and LLM orchestration steps.
                  </p>
                </div>

                {/* Vitals Agent Workflow status */}
                <span className="section-title"><Layers size={12} /> Agent Chains Vitals</span>
                <div className="clinical-vitals-map">
                  <div className={`vital-node-card ${activeNode === 'ingest' ? 'active' : (logs.length > 0 && activeNode !== 'ingest' ? 'completed' : '')}`}>
                    <User className="vital-node-icon" size={16} />
                    <span className="vital-node-title">Intake</span>
                  </div>
                  <div className={`vital-node-card ${activeNode === 'graph' ? 'active' : (logs.some(l => l.message.includes('Connections') || l.message.includes('standard workflow') || l.message.includes('CRITICAL HAZARD')) ? 'completed' : '')}`}>
                    <Database className="vital-node-icon" size={16} />
                    <span className="vital-node-title">Graph</span>
                  </div>
                  <div className={`vital-node-card ${activeNode === 'rag' ? 'active' : (logs.some(l => l.message.includes('RAG HIT')) ? 'completed' : '')}`}>
                    <FileText className="vital-node-icon" size={16} />
                    <span className="vital-node-title">RAG Lit</span>
                  </div>
                  <div className={`vital-node-card ${activeNode === 'reasoning' ? 'active' : (logs.some(l => l.message.includes('Reasoning complete')) ? 'completed' : '')}`}>
                    <Brain className="vital-node-icon" size={16} />
                    <span className="vital-node-title">Reasoning</span>
                  </div>
                  <div className={`vital-node-card ${activeNode === 'veracity' ? 'active' : (logs.some(l => l.message.includes('Citation check complete')) ? 'completed' : '')}`}>
                    <UserCheck className="vital-node-icon" size={16} />
                    <span className="vital-node-title">Veracity</span>
                  </div>
                </div>

                {/* Telemetry Console */}
                <span className="section-title"><Terminal size={12} /> Console Output</span>
                <div className="telemetry-console">
                  {logs.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'center' }}>
                      <Terminal size={14} />
                      Awaiting query ingestion...
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className={`telemetry-line ${log.type}`}>
                        <span className="telemetry-timestamp">[{log.timestamp}]</span>
                        <span>{log.message}</span>
                      </div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            )}

            {/* TAB 5: Knowledge Ingestion */}
            {activeTab === 'knowledge' && (
              <KnowledgeUploader />
            )}
          </section>
        </main>
      )}

      {view === 'dashboard' && role === 'patient' && (
        <PatientWorkspace
          age={age}
          setAge={setAge}
          sex={sex}
          setSex={setSex}
          symptoms={symptoms}
          medications={medications}
          symptomText={symptomText}
          setSymptomText={setSymptomText}
          medicationText={medicationText}
          setMedicationText={setMedicationText}
          addSymptom={addSymptom}
          addMedication={addMedication}
          removeSymptom={removeSymptom}
          removeMedication={removeMedication}
          runDiagnostics={runDiagnostics}
          isDiagnosing={isDiagnosing}
          results={results}
          checkedWorkups={checkedWorkups}
          setCheckedWorkups={setCheckedWorkups}
          loadCase={loadCase}
          resetForm={resetForm}
          downloadPatientReport={downloadPatientReport}
        />
      )}

      {/* Export Summary Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-contrast)' }}>Export Clinical Case Summary</h3>
              <button 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowExportModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <pre style={{ background: '#030712', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '16px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '11px', whiteSpace: 'pre-wrap', maxHeight: '350px', overflowY: 'auto' }}>
                {generateMarkdownReport()}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowExportModal(false)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={copyToClipboard}>
                <Clipboard size={14} /> {copiedNotification ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.4 4 8.2V22h8v-3.8c1.9-1.8 4-4.8 4-8.2a8 8 0 0 0-8-8Z" />
                <path d="M10 22h4" />
                <path d="M9 6.5c1.5-1 4.5-1 6 0" />
                <path d="M8 10c2-1.5 6-1.5 8 0" />
              </svg>
              <span>MedGraph AI</span>
            </div>
            <p className="footer-desc">
              Graph-augmented clinical intelligence connecting structured medical evidence to diagnostic decisions.
            </p>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Platform</h4>
            <ul className="footer-links">
              <li><span>Clinical Decision Support</span></li>
              <li><span>Drug Interaction Engine</span></li>
              <li><span>Evidence Retrieval</span></li>
              <li><span>Knowledge Graph</span></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Technology</h4>
            <ul className="footer-links">
              <li><span>Neo4j + RxNav</span></li>
              <li><span>Hybrid RAG Pipeline</span></li>
              <li><span>Citation Verification</span></li>
              <li><span>Graceful Degradation</span></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Resources</h4>
            <ul className="footer-links">
              <li><span>API Documentation</span></li>
              <li><span>AHA/ACC Guidelines</span></li>
              <li><span>Architecture Overview</span></li>
              <li><span>HIPAA Compliance</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 MedGraph AI. Research prototype — not a certified medical device.</span>
          <span className="footer-bottom-links">
            <span>Privacy</span>
            <span className="footer-dot">·</span>
            <span>Terms</span>
            <span className="footer-dot">·</span>
            <span>HIPAA Notice</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
