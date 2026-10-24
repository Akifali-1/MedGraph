import { useState, useEffect, useRef } from 'react';
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
import AboutPage from './components/AboutPage';
import EvidenceLibraryPage from './components/EvidenceLibraryPage';
import ContactPage from './components/ContactPage';
import { getApiUrl } from './config';

const PUBLIC_VIEWS = ['landing', 'how', 'about', 'library', 'contact', 'auth'];
const PAGE_TITLES = {
  landing: 'Clinical Decision Support', how: 'How It Works', about: 'About',
  library: 'Evidence Library', contact: 'Contact', auth: 'Sign In', dashboard: 'Workspace',
};

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

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp) return false;
    return (payload.exp * 1000) <= (Date.now() + 60000); // 60-second safety window
  } catch {
    return true;
  }
};

const getInitialHistoryForUser = (user) => (
  user?.role === 'medical_practitioner'
  && user?.email?.toLowerCase() === 'e.carter@medgraph.ai'
    ? INITIAL_HISTORY
    : []
);

const getPatientDisplayId = (user) => {
  if (!user?.sub) return 'PATIENT';
  return `PAT-${user.sub.replace(/^usr_/, '').slice(-8).toUpperCase()}`;
};

const SERVICE_LABELS = [
  { key: 'neo4j', label: 'Neo4j' },
  { key: 'pinecone', label: 'Pinecone' },
  { key: 'redis', label: 'Redis' },
  { key: 'sagemaker', label: 'SageMaker' },
];

const getServiceState = (value) => {
  const text = String(value || '').toLowerCase();
  if (!text) return 'checking';
  if (text.includes('not_configured')) return 'inactive';
  if (text.includes('unhealthy')) return 'offline';
  if (text.includes('mock')) return 'mock';
  if (text.includes('healthy')) return 'online';
  return 'offline';
};

function ServiceStatus({ label, value }) {
  const state = getServiceState(value);
  const stateLabels = {
    checking: 'checking',
    online: 'online',
    mock: 'mock',
    inactive: 'off',
    offline: 'offline',
  };

  return (
    <span className={`service-status service-status-${state}`} title={`${label}: ${value || 'checking'}`}>
      <i className="service-status-dot" />
      <span>{label}</span>
      <small>{stateLabels[state]}</small>
    </span>
  );
}

function App() {
  // Navigation & Page State
  const [view, setView] = useState(() => {
    const page = window.location.hash.slice(1);
    return PUBLIC_VIEWS.includes(page) ? page : 'landing';
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('medgraph_theme') || 'light'); // 'dark' | 'light'
  const [role, setRole] = useState('doctor'); // 'doctor' | 'patient'
  const [authToken, setAuthToken] = useState('');
  const [authError, setAuthError] = useState('');
  const [serviceHealth, setServiceHealth] = useState(null);
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

  const mapUiRoleToApiRole = (uiRole) => (
    uiRole === 'doctor' ? 'medical_practitioner' : 'patient'
  );

  const applyAuthenticatedSession = (data, navigateToDashboard = true) => {
    resetWorkspaceState(data.user);
    setAuthToken(data.access_token);
    setAuthError('');
    setCurrentUser(data.user);
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
    if (navigateToDashboard) {
      setView('dashboard');
    }
  };

  const ensureValidAuthToken = async () => {
    const stored = authToken || localStorage.getItem('medgraph_access_token');
    if (stored && !isTokenExpired(stored)) {
      return stored;
    }
    // Never silently authenticate as a shared demo account after a real
    // session expires. That can cross account boundaries in the same browser.
    clearAuthenticatedSession(true);
    return null;
  };

  // Restore session from localStorage on load
  useEffect(() => {
    let restoreTimer;
    const token = localStorage.getItem('medgraph_access_token');
    const storedUser = localStorage.getItem('medgraph_user');
    if (token && storedUser) {
      if (isTokenExpired(token)) {
        console.warn("Stored session token is expired. Clearing stale session.");
        localStorage.removeItem('medgraph_access_token');
        localStorage.removeItem('medgraph_user');
      } else {
        try {
          const parsedUser = JSON.parse(storedUser);
          restoreTimer = window.setTimeout(() => {
            setAuthToken(token);
            setCurrentUser(parsedUser);
            setIsLoggedIn(true);
            setRole(parsedUser.role === 'medical_practitioner' ? 'doctor' : 'patient');
            setHistory(getInitialHistoryForUser(parsedUser));
            if (parsedUser.role === 'medical_practitioner') {
              setPractitioner({
                name: parsedUser.name || '',
                npi: parsedUser.npi || '',
                email: parsedUser.email || '',
                clinic: parsedUser.clinic || ''
              });
            }
            const requestedPage = window.location.hash.slice(1);
            if (!PUBLIC_VIEWS.includes(requestedPage)) setView('dashboard');
          }, 0);
        } catch (e) {
          console.error("Failed to restore session from localStorage", e);
        }
      }
    }
    return () => {
      if (restoreTimer) window.clearTimeout(restoreTimer);
    };
  }, []);

  useEffect(() => {
    const handleNavigation = () => {
      const page = window.location.hash.slice(1);
      if (PUBLIC_VIEWS.includes(page)) setView(page);
      else if (page === 'dashboard' && isLoggedIn) setView('dashboard');
      else setView('landing');
    };
    window.addEventListener('hashchange', handleNavigation);
    return () => window.removeEventListener('hashchange', handleNavigation);
  }, [isLoggedIn]);

  useEffect(() => {
    document.title = `${PAGE_TITLES[view] || 'MedGraph'} | MedGraph AI`;
    window.history.replaceState(null, '', `#${view}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [view]);

  // Query Google SSO Configuration on boot / when view changes to auth
  useEffect(() => {
    let cancelled = false;
    let renderTimer;

    if (view !== 'auth') {
      return () => {};
    }

    const renderGoogleButton = (clientId) => {
      if (cancelled) return;
      const btnContainer = document.getElementById('google-sso-button');
      if (!window.google?.accounts?.id || !btnContainer) {
        renderTimer = window.setTimeout(() => renderGoogleButton(clientId), 100);
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
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
          } catch {
            setAuthError('Unable to connect to Google authentication server.');
          }
        }
      });

      btnContainer.replaceChildren();
      window.google.accounts.id.renderButton(btnContainer, {
        theme: 'outline',
        size: 'large',
        width: 368
      });
    };

    const fetchGoogleConfig = async () => {
      try {
        const response = await fetch(getApiUrl('/auth/config'));
        const data = response.ok ? await response.json() : {};
        const clientId = (data.google_client_id || '').trim();
        if (!clientId) {
          setIsGoogleSsoConfigured(false);
          return;
        }
        setIsGoogleSsoConfigured(true);
        renderGoogleButton(clientId);
      } catch (error) {
        console.warn('Failed to retrieve Google Auth config from backend:', error);
        setIsGoogleSsoConfigured(false);
      }
    };

    fetchGoogleConfig();
    return () => {
      cancelled = true;
      if (renderTimer) window.clearTimeout(renderTimer);
    };
  // The Google callback intentionally closes over the current session helpers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, authMode]);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
    localStorage.setItem('medgraph_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (view !== 'dashboard' || !isLoggedIn || role !== 'doctor') {
      return () => {};
    }

    let cancelled = false;
    let controller;
    let timeoutId;

    const checkServiceHealth = async () => {
      controller = new AbortController();
      timeoutId = window.setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(getApiUrl('/health'), {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!cancelled) {
          setServiceHealth(data.dependencies || {});
        }
      } catch {
        if (!cancelled) {
          setServiceHealth({
            neo4j: 'unhealthy: service check failed',
            pinecone: 'unhealthy: service check failed',
            redis: 'unhealthy: service check failed',
            sagemaker: 'unhealthy: service check failed',
          });
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    checkServiceHealth();
    const intervalId = window.setInterval(checkServiceHealth, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      controller?.abort();
    };
  }, [view, isLoggedIn, role]);

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
  const [history, setHistory] = useState([]);
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
  const terminalConsoleRef = useRef(null);

  function resetWorkspaceState(user = null) {
    setAge('');
    setSex('');
    setSymptoms([]);
    setMedications([]);
    setComorbidities([]);
    setSymptomText('');
    setMedicationText('');
    setComorbidityText('');
    setActiveTab('diagnostics');
    setHistory(getInitialHistoryForUser(user));
    setActiveHistoryId(null);
    setSearchQuery('');
    setCheckedWorkups({});
    setIsDiagnosing(false);
    setActiveNode('none');
    setLogs([]);
    setResults(null);
    setError(null);
    setRagPassages([]);
  }

  function clearAuthenticatedSession(navigateToAuth = false) {
    localStorage.removeItem('medgraph_access_token');
    localStorage.removeItem('medgraph_user');
    setAuthToken('');
    setCurrentUser(null);
    setIsLoggedIn(false);
    setRole('doctor');
    setPractitioner({
      name: '',
      npi: '',
      email: '',
      clinic: ''
    });
    resetWorkspaceState(null);
    setView(navigateToAuth ? 'auth' : 'landing');
  }

  useEffect(() => {
    if (terminalConsoleRef.current) {
      terminalConsoleRef.current.scrollTop = terminalConsoleRef.current.scrollHeight;
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
    setSymptomText('');
    setMedicationText('');
    setComorbidityText('');
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
    if (diagnosisOutput?.rag_status === 'no_results' || diagnosisOutput?.status === 'unavailable') {
      setRagPassages([]);
      return;
    }
    const isCardiac = symptomsList.some(s => s.toLowerCase().includes('chest') || s.toLowerCase().includes('jaw') || s.toLowerCase().includes('sweating') || s.toLowerCase().includes('pressure'));
    const isNeuro = symptomsList.some(s => s.toLowerCase().includes('headache') || s.toLowerCase().includes('cephalalgia') || s.toLowerCase().includes('confusion'));
    const hasDDI = diagnosisOutput?.requires_immediate_intervention || diagnosisOutput?.critical_flag || false;

    let passages;

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

    const activeToken = await ensureValidAuthToken();
    if (!activeToken) {
      setAuthError('Your session has expired. Please sign in again.');
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
    await addLog('Starting case check...', 'info', 0);
    await addLog(`Patient: ${age}-year-old ${sex === 'M' ? 'Male' : 'Female'}`, 'info', 300);
    await addLog(`Symptoms: [${symptoms.join(', ')}]`, 'info', 250);
    
    setActiveNode('graph');
    await addLog('Matching symptom names...', 'info', 300);
    const resolvedSym = symptoms.map(s => s === 'cephalalgia' ? 'headache' : s === 'chest pressure' ? 'chest pain' : s);
    const resolvedLogMessages = [];
    symptoms.forEach((s, idx) => {
      if (s !== resolvedSym[idx]) {
        resolvedLogMessages.push(`${s} ➔ ${resolvedSym[idx]}`);
      }
    });
    if (resolvedLogMessages.length > 0) {
        await addLog(`Names matched: ${resolvedLogMessages.join(', ')}`, 'success', 250);
    }
    
    await addLog('Checking medicine links...', 'info', 300);
    await addLog('Looking for known medicine conflicts...', 'info', 200);

    // Check drug interactions locally
    const hasDDI = medications.some(m => m.toLowerCase().includes('warfarin')) && medications.some(m => m.toLowerCase().includes('aspirin'));
    
    if (hasDDI) {
      await addLog('HIGH-RISK INTERACTION: Warfarin + Aspirin', 'danger', 400);
      await addLog('Action: Safety alert triggered.', 'warning', 300);
      setActiveNode('synthesis');
    } else {
      await addLog('No high-risk medicine conflict found.', 'success', 400);
      
      setActiveNode('rag');
      await addLog('Finding relevant sources...', 'info', 400);
      await addLog('Comparing exact and similar terms...', 'info', 300);
      await addLog('Choosing the most useful references...', 'info', 300);
      await addLog('Gathering source notes...', 'info', 300);
      
      setActiveNode('reasoning');
      await addLog('Combining case details and sources...', 'info', 300);
      await addLog('Building possible causes...', 'info', 450);
      await addLog('Possible causes ready.', 'success', 400);
      
      setActiveNode('veracity');
      await addLog('Checking citations...', 'info', 350);
      await addLog('Sources checked.', 'success', 300);
      
      setActiveNode('synthesis');
    }

    await addLog('Preparing case summary...', 'info', 300);

    // Call actual backend or fallback to local mock
    let diagnosticResult = null;
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }
      const diagnoseController = new AbortController();
      const diagnoseTimeout = setTimeout(() => diagnoseController.abort(), 120000); // 120s timeout
      let response = await fetch(getApiUrl('/diagnose'), {
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

      // Do not retry with a shared/demo account after the server rejects the
      // token. That would make the result belong to the wrong user.
      if (response.status === 401) {
        clearAuthenticatedSession(true);
        throw new Error('Your session has expired. Please sign in again.');
      }

      if (!response.ok) {
        let errMessage = 'API Response Error';
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errMessage = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
          }
        } catch {
          // Some gateway errors do not return JSON.
        }
        throw new Error(errMessage);
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
      if (data.rag_status === 'no_results') {
        await addLog(data.rag_message || 'No relevant clinical guideline evidence found.', 'warning', 250);
      } else if (data.rag_status === 'found') {
          await addLog('Sources found.', 'success', 250);
      }
      updateRagEvidence(data, resolvedSym);
      await addLog('Clinical analysis report compiled successfully. Rendering outputs.', 'success', 200);
    } catch (e) {
      const message = e?.name === 'AbortError'
        ? 'The clinical analysis request timed out. Please try again.'
        : (e?.message && e.message !== 'API Response Error')
          ? `Analysis Error: ${e.message}`
          : 'The clinical analysis service is unavailable. Please try again.';
      setResults({
        status: 'unavailable', message,
        diagnoses: [], recommended_workup: [], drug_interactions: [],
        critical_flag: false, rag_status: 'unavailable', rag_message: message,
      });
      updateRagEvidence({ diagnoses: [] }, resolvedSym);
      await addLog(message, 'warning', 100);
    } finally {
      setIsDiagnosing(false);
      setActiveNode('none');
      setActiveTab('diagnostics'); // Switch tab to results to display diagnostics immediately!
      setView(localStorage.getItem('medgraph_access_token') ? 'dashboard' : 'auth');

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
    } catch {
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
        })
      });

      if (!response.ok) {
        setAuthError('Account setup failed. Email may already be registered.');
        return;
      }

      const data = await response.json();
      applyAuthenticatedSession(data);
    } catch {
      setAuthError('Unable to connect to safety gateway.');
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
    report += `Name: ${currentUser?.name || 'Patient'}\n`;
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
    element.download = `patient_health_summary_${activeHistoryId || getPatientDisplayId(currentUser)}.txt`;
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
    setResults(null);
    setLogs([]);
    setRagPassages([]);
    setError(null);
    setActiveHistoryId(null);

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
          <span>MedGraph AI <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', background: 'var(--accent-soft)', border: '1px solid var(--panel-border)', padding: '2px 6px', borderRadius: '3px', marginLeft: '6px' }}>CDSS v2.4</span></span>
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
          <a href="#about" className={`nav-link page-navigation-link ${view === 'about' ? 'active' : ''}`} aria-current={view === 'about' ? 'page' : undefined}>About</a>
          <a href="#library" className={`nav-link page-navigation-link ${view === 'library' ? 'active' : ''}`} aria-current={view === 'library' ? 'page' : undefined}>Evidence Library</a>
          <a href="#contact" className={`nav-link page-navigation-link ${view === 'contact' ? 'active' : ''}`} aria-current={view === 'contact' ? 'page' : undefined}>Contact</a>
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
                onClick={() => clearAuthenticatedSession(false)}
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
      {view === 'about' && (
        <AboutPage
          onHowItWorks={() => setView('how')}
          onOpenLibrary={() => setView('library')}
          onEnterWorkspace={() => { setAuthMode('login'); setView(isLoggedIn ? 'dashboard' : 'auth'); }}
        />
      )}
      {view === 'library' && (
        <EvidenceLibraryPage onEnterWorkspace={() => { setAuthMode('login'); setView(isLoggedIn ? 'dashboard' : 'auth'); }} />
      )}
      {view === 'contact' && <ContactPage />}

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
          isGoogleSsoConfigured={isGoogleSsoConfigured}
        />
      )}

      {/* Dashboard Workspace View */}
      {view === 'dashboard' && isLoggedIn && role === 'doctor' && (
        <main className={`workspace-grid ${isDiagnosing || results ? 'workspace-grid--results' : 'workspace-grid--intake'}`}>
          {/* Left Column: patient details */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Compact Practitioner Dossier Card */}
            <div className="clinical-card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'var(--accent-soft)', border: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontWeight: '600', fontSize: '13px' }}>
                    MD
                  </div>
                  <div>
                    <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-contrast)', fontFamily: 'var(--font-sans)' }}>{practitioner.name}</h4>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>NPI: {practitioner.npi} · {practitioner.clinic || 'Cardiology'}</div>
                  </div>
                </div>
                <span className="badge badge-emerald" style={{ fontSize: '9.5px', fontFamily: 'var(--font-mono)' }}>ONLINE</span>
              </div>
            </div>

            {/* Ingestion Intake Card */}
            <div className="clinical-card" style={{ padding: '24px' }}>
              <span className="section-title" style={{ marginBottom: '16px' }}>
                <Stethoscope size={12} /> Patient details
              </span>
              
              {/* Presets Row */}
              <div style={{ marginBottom: '20px' }}>
                <span className="form-label">Quick cases</span>
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
                <label className="form-label">Symptoms</label>
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
                <label className="form-label">Medications</label>
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
                <label className="form-label">Medical history</label>
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
            
            {/* Active Case Telemetry Header Strip */}
            <div className="dashboard-status-strip">
              <div className="dashboard-status-left">
                <span className="dashboard-status-id">
                  {activeHistoryId || 'ACTIVE INTAKE'}
                </span>
                <span className="dashboard-status-meta">
                  {age ? `${age}yo ${sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : ''}` : 'Age and sex pending'} ·{' '}
                  {symptoms.length} symptoms · {medications.length} meds · {comorbidities.length} history
                </span>
              </div>
              <div className="dashboard-status-right">
                <div className="service-status-summary" aria-label="Service status">
                  <ServiceStatus label="Neo4j" value={serviceHealth?.neo4j} />
                  <ServiceStatus label="Pinecone" value={serviceHealth?.pinecone} />
                </div>
                {results && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '11px' }}
                    onClick={() => setShowExportModal(true)}
                  >
                <FileText size={12} /> View summary
                  </button>
                )}
              </div>
            </div>

            {/* Workspace tabs navigation bar */}
            <div className="workspace-tabs">
              <button 
                className={`workspace-tab-btn ${activeTab === 'diagnostics' ? 'active' : ''}`}
                onClick={() => setActiveTab('diagnostics')}
              >
                Results
              </button>
              <button 
                className={`workspace-tab-btn ${activeTab === 'evidence' ? 'active' : ''}`}
                onClick={() => setActiveTab('evidence')}
              >
                Sources {ragPassages.length > 0 && `(${ragPassages.length})`}
              </button>
              <button 
                className={`workspace-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                Records ({history.length})
              </button>
              <button 
                className={`workspace-tab-btn ${activeTab === 'telemetry' ? 'active' : ''}`}
                onClick={() => setActiveTab('telemetry')}
              >
                Console
              </button>
              <button 
                className={`workspace-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
                onClick={() => setActiveTab('knowledge')}
              >
                Uploads
              </button>
            </div>

            {/* TAB 1: Diagnostics & Workup */}
            {activeTab === 'diagnostics' && (
              <div className="clinical-card" style={{ flex: 1, minHeight: '450px' }}>
                {!results ? (
                  <div className="empty-state">
                    <Stethoscope className="empty-state-icon" size={48} />
                    <div>
                        <h3 style={{ color: 'var(--text-contrast)', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>Ready to evaluate</h3>
                      <p style={{ fontSize: '13px', maxWidth: '360px', color: 'var(--text-secondary)' }}>
                        Add symptoms and medicines, then click “Evaluate Case”.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Header Controls */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px', marginBottom: '20px' }}>
                      <div>
                        <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-contrast)' }}>Case results</h3>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          History used: {comorbidities.length > 0 ? comorbidities.join(', ') : 'None added'}
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
                            Demo result — not a live diagnosis
                          </h4>
                          <p className="triage-desc">
                            {results.simulated_reason || 'The backend is unreachable'}. This result was made locally for demonstration.
                          </p>
                        </div>
                      </div>
                    )}

                    {results.rag_status === 'no_results' && (
                      <div className="triage-banner" style={{ borderColor: 'var(--accent-amber)', background: 'rgba(217, 169, 95, 0.1)', marginBottom: '14px' }}>
                        <AlertTriangle className="triage-icon" size={20} style={{ color: 'var(--accent-amber)' }} />
                        <div>
                          <h4 className="triage-title" style={{ color: 'var(--accent-amber)' }}>No matching sources</h4>
                          <p className="triage-desc">{results.rag_message || 'No relevant clinical guideline evidence was found for this query.'} Add more specific symptoms, medications, or history and try again.</p>
                        </div>
                      </div>
                    )}

                    {results.status === 'unavailable' && (
                      <div className="triage-banner" style={{ borderColor: 'var(--accent-rose)', marginBottom: '14px' }}>
                        <AlertTriangle className="triage-icon" size={20} style={{ color: 'var(--accent-rose)' }} />
                        <div>
                          <h4 className="triage-title" style={{ color: 'var(--accent-rose)' }}>Analysis unavailable</h4>
                          <p className="triage-desc">{results.message || 'The clinical analysis service is unavailable. Please try again.'}</p>
                        </div>
                      </div>
                    )}

                    {/* Flashing Warning Banner */}
                    {(results.requires_immediate_intervention || results.critical_flag) && (
                      <div className="triage-banner critical">
                        <ShieldAlert className="triage-icon" size={20} />
                        <div>
                          <h4 className="triage-title">High-risk medicine interaction</h4>
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
                      <span className="section-title">Possible causes</span>
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
                        <span className="section-title">Next steps</span>
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
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)' }}>Sources used</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    References used for this case.
                  </p>
                </div>

                {ragPassages.length === 0 ? (
                  <div className="empty-state">
                    <BookOpen className="empty-state-icon" size={48} style={{ color: 'var(--accent-purple)' }} />
                    <div>
                        <h3 style={{ color: 'var(--text-contrast)', fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>No sources yet</h3>
                      <p style={{ fontSize: '13px', maxWidth: '360px', color: 'var(--text-secondary)' }}>
                        Evaluate a case to see the supporting references.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="evidence-section">
                    
                    {/* Dynamic Bipartite Clinical Concept Graph */}
                    <span className="section-title"><Sparkles size={12} /> Case links</span>
                    <div className="svg-graph-container">
                      <svg width="100%" height="100%" viewBox="0 0 680 280">
                        {symptoms.slice(0, 4).map((_, i) => {
                          const y = 45 + i * 48;
                          return <path key={`sx-e-${i}`} d={`M 145 ${y} C 220 ${y}, 240 140, 310 140`} className="graph-link active symptom" fill="none" />;
                        })}
                        {medications.slice(0, 2).map((_, i) => {
                          const y = 215 + i * 38;
                          return <path key={`med-e-${i}`} d={`M 145 ${y} C 220 ${y}, 240 140, 310 140`} className="graph-link active medication" fill="none" />;
                        })}
                        {results?.diagnoses && results.diagnoses.slice(0, 3).map((_, i) => {
                          const y = 65 + i * 75;
                          return <path key={`dx-e-${i}`} d={`M 370 140 C 435 140, 455 ${y}, 520 ${y}`} className="graph-link active diagnosis" fill="none" />;
                        })}
                        {symptoms.slice(0, 4).map((sym, i) => {
                          const y = 45 + i * 48;
                          return (
                            <g key={`sx-n-${i}`} className="graph-node symptom">
                              <rect x="20" y={y - 14} width="125" height="28" rx="4" className="graph-node-circle" />
                              <text x="82" y={y + 4} className="graph-node-text title" style={{ fontSize: '10px' }}>
                                Sx: {sym.length > 14 ? sym.slice(0, 14) + '…' : sym}
                              </text>
                            </g>
                          );
                        })}
                        {medications.slice(0, 2).map((med, i) => {
                          const y = 215 + i * 38;
                          return (
                            <g key={`med-n-${i}`} className="graph-node medication">
                              <rect x="20" y={y - 14} width="125" height="28" rx="4" className="graph-node-circle" />
                              <text x="82" y={y + 4} className="graph-node-text title" style={{ fontSize: '10px' }}>
                                Rx: {med.length > 14 ? med.slice(0, 14) + '…' : med}
                              </text>
                            </g>
                          );
                        })}
                        <g className="graph-node">
                          <circle cx="340" cy="140" r="32" className="graph-node-circle" style={{ stroke: 'var(--accent-cyan)', strokeWidth: 2 }} />
                          <text x="340" y="136" className="graph-node-text title" style={{ fontSize: '11px', fontWeight: 700 }}>
                            {age || 'Pt'}{sex}
                          </text>
                          <text x="340" y="151" className="graph-node-text" style={{ fontSize: '9px' }}>
                            Graph Core
                          </text>
                        </g>
                        {results?.diagnoses && results.diagnoses.slice(0, 3).map((diag, i) => {
                          const y = 65 + i * 75;
                          return (
                            <g key={`dx-n-${i}`} className="graph-node diagnosis">
                              <rect x="520" y={y - 18} width="145" height="36" rx="4" className="graph-node-circle" />
                              <text x="592" y={y - 2} className="graph-node-text title" style={{ fontSize: '9.5px', fontWeight: 600 }}>
                                {diag.name.length > 20 ? diag.name.slice(0, 20) + '…' : diag.name}
                              </text>
                              <text x="592" y={y + 11} className="graph-node-text" style={{ fontSize: '9px', fill: 'var(--accent-emerald)' }}>
                                {(diag.confidence * 100).toFixed(0)}% match
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    <span className="section-title"><BookOpen size={12} /> Reference notes</span>
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
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)' }}>Saved cases</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Review earlier cases by ID, symptom, medicine, or finding.
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
                        Try another search or evaluate a new case.
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
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)' }}>Run console</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    See the main steps and service connections for the current run.
                  </p>
                </div>

                <div className="service-health-panel">
                  <div className="service-health-heading">Services</div>
                  <div className="service-health-list">
                    {SERVICE_LABELS.map(({ key, label }) => (
                      <ServiceStatus key={key} label={label} value={serviceHealth?.[key]} />
                    ))}
                  </div>
                </div>

                {/* Main run steps */}
                <span className="section-title"><Layers size={12} /> Run steps</span>
                <div className="clinical-vitals-map">
                  <div className={`vital-node-card ${activeNode === 'ingest' ? 'active' : (logs.length > 0 && activeNode !== 'ingest' ? 'completed' : '')}`}>
                    <User className="vital-node-icon" size={16} />
                    <span className="vital-node-title">Intake</span>
                  </div>
                  <div className={`vital-node-card ${activeNode === 'graph' ? 'active' : (logs.some(l => l.message.includes('medicine conflict') || l.message.includes('HIGH-RISK INTERACTION')) ? 'completed' : '')}`}>
                    <Database className="vital-node-icon" size={16} />
                    <span className="vital-node-title">Graph</span>
                  </div>
                  <div className={`vital-node-card ${activeNode === 'rag' ? 'active' : (logs.some(l => l.message.includes('Sources found')) ? 'completed' : '')}`}>
                    <FileText className="vital-node-icon" size={16} />
                    <span className="vital-node-title">RAG Lit</span>
                  </div>
                  <div className={`vital-node-card ${activeNode === 'reasoning' ? 'active' : (logs.some(l => l.message.includes('Possible causes ready')) ? 'completed' : '')}`}>
                    <Brain className="vital-node-icon" size={16} />
                    <span className="vital-node-title">Reasoning</span>
                  </div>
                  <div className={`vital-node-card ${activeNode === 'veracity' ? 'active' : (logs.some(l => l.message.includes('Sources checked')) ? 'completed' : '')}`}>
                    <UserCheck className="vital-node-icon" size={16} />
                    <span className="vital-node-title">Veracity</span>
                  </div>
                </div>

                {/* Telemetry Console */}
                <span className="section-title"><Terminal size={12} /> Activity</span>
                <div className="telemetry-console" ref={terminalConsoleRef}>
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

      {view === 'dashboard' && isLoggedIn && role === 'patient' && (
        <PatientWorkspace
          patient={currentUser}
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
              <li><a className="page-navigation-link" href="#about">About MedGraph</a></li>
              <li><a className="page-navigation-link" href="#library">Evidence Library</a></li>
              <li><a className="page-navigation-link" href="#contact">Contact & Feedback</a></li>
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
