import React, { useState } from 'react';
import { 
  User, 
  FileText, 
  Plus, 
  X, 
  Activity, 
  Sparkles, 
  RotateCcw, 
  Download, 
  ShieldAlert, 
  CheckCircle2,
  Calendar,
  Stethoscope,
  Briefcase,
  Search
} from 'lucide-react';

const PATIENT_VISIT_HISTORY = [
  {
    id: "VIS-9201",
    date: "2026-04-12",
    doctorName: "Dr. Evelyn Carter, MD",
    specialty: "Cardiology",
    reason: "Routine cardiac evaluation and anticoagulation therapy review",
    diagnoses: "Atrial Fibrillation, Hypertension",
    medicationsPrescribed: "Warfarin 5mg daily, Lisinopril 10mg daily",
    notes: "Patient is stable on current Warfarin dose. Advised regular PT/INR blood checks. Encouraged low-sodium diet and daily walking."
  },
  {
    id: "VIS-8730",
    date: "2026-02-18",
    doctorName: "Dr. Marcus Vance, MD",
    specialty: "Neurology",
    reason: "Follow-up for occasional tension headaches",
    diagnoses: "Tension-type Headache",
    medicationsPrescribed: "Aspirin 81mg daily (as needed)",
    notes: "Headaches are stable. Patient was advised to use Aspirin cautiously. Note: Ensure coordination with Dr. Carter (Cardiology) regarding anticoagulation therapy to prevent compound bleeding risks."
  },
  {
    id: "VIS-5412",
    date: "2025-11-05",
    doctorName: "Dr. Sarah Jenkins, MD",
    specialty: "Primary Care",
    reason: "Annual physical checkup",
    diagnoses: "Essential Hypertension",
    medicationsPrescribed: "Lisinopril 10mg daily",
    notes: "Blood pressure is mildly elevated but controlled on Lisinopril. Reminded patient to maintain daily activity, stay hydrated, and follow up in 6 months."
  }
];

export default function PatientWorkspace({
  age,
  setAge,
  sex,
  setSex,
  symptoms,
  medications,
  symptomText,
  setSymptomText,
  medicationText,
  setMedicationText,
  addSymptom,
  addMedication,
  removeSymptom,
  removeMedication,
  runDiagnostics,
  isDiagnosing,
  results,
  checkedWorkups,
  setCheckedWorkups,
  loadCase,
  resetForm,
  downloadPatientReport
}) {
  const [patientActiveTab, setPatientActiveTab] = useState('health-check'); // 'health-check' | 'visit-history'
  const [historySearch, setHistorySearch] = useState('');

  const filteredVisits = PATIENT_VISIT_HISTORY.filter(visit => {
    const query = historySearch.toLowerCase().trim();
    if (!query) return true;
    return (
      visit.doctorName.toLowerCase().includes(query) ||
      visit.specialty.toLowerCase().includes(query) ||
      visit.diagnoses.toLowerCase().includes(query) ||
      visit.notes.toLowerCase().includes(query)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
      
      {/* Patient Profile Header Card */}
      <div className="clinical-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', fontWeight: '800', fontSize: '20px' }}>
            AP
          </div>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-contrast)' }}>Arthur Pendelton</h2>
            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', alignItems: 'center' }}>
              <span><strong>Patient ID:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>PAT-0982</span></span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span><strong>Age:</strong> {age || "—"} Years</span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span><strong>Biological Sex:</strong> {sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : '—'}</span>
            </div>
          </div>
        </div>

        {/* Tab switch buttons */}
        <div className="workspace-tabs" style={{ marginBottom: 0, padding: '4px', width: 'auto' }}>
          <button
            className={`workspace-tab-btn ${patientActiveTab === 'health-check' ? 'active' : ''}`}
            onClick={() => setPatientActiveTab('health-check')}
            style={{ fontSize: '13px', padding: '10px 20px' }}
          >
            Active Safety Check
          </button>
          <button
            className={`workspace-tab-btn ${patientActiveTab === 'visit-history' ? 'active' : ''}`}
            onClick={() => setPatientActiveTab('visit-history')}
            style={{ fontSize: '13px', padding: '10px 20px' }}
          >
            Attending Visit History ({PATIENT_VISIT_HISTORY.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Active Health Check */}
      {patientActiveTab === 'health-check' && (
        <main className="workspace-grid" style={{ gridTemplateColumns: '380px 1fr', padding: 0, gap: '24px', width: '100%' }}>
          {/* Left Column Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="clinical-card" style={{ padding: '24px' }}>
              <span className="section-title">
                <FileText size={13} style={{ color: 'var(--accent-cyan)' }} /> Log Health Symptoms
              </span>

              {/* Age / Gender Adjuster */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '10px' }}>My Age</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="0" 
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '10px' }}>My Gender</label>
                  <select className="form-select" value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="" disabled>Select Gender...</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>

              {/* Symptoms Input */}
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" style={{ fontSize: '10px' }}>Symptoms I Feel</label>
                <form onSubmit={addSymptom} className="tag-input-row">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. headache, pain..."
                    value={symptomText}
                    onChange={(e) => setSymptomText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-icon-only">
                    <Plus size={16} />
                  </button>
                </form>
                <div className="tag-container symptom-tags" style={{ minHeight: '40px' }}>
                  {symptoms.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>No symptoms logged</span>
                  ) : (
                    symptoms.map((symptom, i) => (
                      <span key={i} className="tag-item">
                        {symptom}
                        <button type="button" className="tag-delete-btn" onClick={() => removeSymptom(i)}>
                          <X size={11} style={{ marginLeft: '4px' }} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Medications Input */}
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label" style={{ fontSize: '10px' }}>My Daily Medications</label>
                <form onSubmit={addMedication} className="tag-input-row">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Aspirin, Warfarin..."
                    value={medicationText}
                    onChange={(e) => setMedicationText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-icon-only">
                    <Plus size={16} />
                  </button>
                </form>
                <div className="tag-container medication-tags" style={{ minHeight: '40px' }}>
                  {medications.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>No medications listed</span>
                  ) : (
                    medications.map((med, i) => (
                      <span key={i} className="tag-item medication-tag">
                        {med}
                        <button type="button" className="tag-delete-btn" onClick={() => removeMedication(i)}>
                          <X size={11} style={{ marginLeft: '4px' }} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: '10px' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={runDiagnostics} 
                  disabled={isDiagnosing}
                  style={{ width: '100%' }}
                >
                  {isDiagnosing ? (
                    <>
                      <Activity className="spin-animation" size={15} />
                      Checking safety...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Run Safety Evaluation
                    </>
                  )}
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={resetForm}
                  disabled={isDiagnosing}
                  title="Reset Profile"
                  style={{ padding: 0 }}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Presets */}
            <div className="clinical-card" style={{ padding: '18px' }}>
              <span className="section-title" style={{ fontSize: '10px', marginBottom: '10px' }}>Quick Case Logs</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button type="button" className="preset-tag" onClick={() => loadCase(1)}>
                  Warfarin + Aspirin
                </button>
                <button type="button" className="preset-tag" onClick={() => loadCase(3)}>
                  Chest Pressure
                </button>
              </div>
            </div>
          </aside>

          {/* Right Column: Safety report & Action items */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="clinical-card" style={{ flex: 1, minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
              {isDiagnosing ? (
                <div className="empty-state">
                  <Activity className="spin-animation" size={48} style={{ color: 'var(--accent-cyan)' }} />
                  <div>
                    <h3 style={{ color: 'var(--text-contrast)', fontSize: '17px', fontWeight: '800', marginBottom: '6px' }}>Analyzing Health Profile</h3>
                    <p style={{ fontSize: '13.5px', maxWidth: '380px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      Cross-referencing medications with drug interaction database and comparing symptoms with clinical advice guidelines...
                    </p>
                  </div>
                </div>
              ) : !results ? (
                <div className="empty-state">
                  <Activity className="empty-state-icon" size={56} />
                  <div>
                    <h3 style={{ color: 'var(--text-contrast)', fontSize: '17px', fontWeight: '800', marginBottom: '8px' }}>Awaiting Safety Evaluation</h3>
                    <p style={{ fontSize: '13.5px', maxWidth: '380px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      Add your current symptoms and daily prescriptions in the left intake panel, then click "Run Safety Evaluation" to inspect safety warnings.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
                  
                  {/* Header Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '16px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-contrast)' }}>My Prescription Safety Report</h3>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Evaluated dynamically on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                    <button className="btn btn-secondary" onClick={downloadPatientReport} style={{ padding: '8px 16px', fontSize: '12.5px' }}>
                      <Download size={14} /> Download Health Summary
                    </button>
                  </div>

                  {/* Warning Banner */}
                  {(results.requires_immediate_intervention || results.critical_flag) ? (
                    <div className="triage-banner critical" style={{ margin: 0 }}>
                      <ShieldAlert className="triage-icon" size={26} />
                      <div>
                        <h4 className="triage-title" style={{ color: 'var(--accent-rose)' }}>Drug Interaction - High Severity</h4>
                        <p className="triage-desc" style={{ color: 'var(--text-contrast)', marginTop: '6px', fontSize: '14px', fontWeight: '500' }}>
                          A severe safety interaction has been flagged between your medications: <strong>Warfarin</strong> and <strong>Aspirin</strong>.
                        </p>
                        <p className="triage-desc" style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '13.5px', lineHeight: '1.5' }}>
                          Taking these two blood-thinning medications together significantly increases the risk of bleeding or bruising. Please contact your attending cardiologist to verify this combination.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="triage-banner warning" style={{ margin: 0, backgroundColor: 'rgba(16, 185, 129, 0.04)', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                      <CheckCircle2 className="triage-icon" size={26} style={{ color: 'var(--accent-emerald)' }} />
                      <div>
                        <h4 className="triage-title" style={{ color: 'var(--accent-emerald)' }}>Safety Clearance Approved</h4>
                        <p className="triage-desc" style={{ color: 'var(--text-primary)', marginTop: '6px', fontSize: '13.5px', lineHeight: '1.5' }}>
                          No immediate pharmacological drug-drug interactions or severe warnings were flagged in your active lists.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Advice cards */}
                  <div>
                    <span className="section-title">Safety Explanations & Advice</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                      {results.diagnoses && results.diagnoses.map((diag, idx) => (
                        <div key={idx} className="diagnosis-card" style={{ padding: '18px', margin: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)' }}>
                              {diag.name === "Medication Interaction Hazard" ? "Pharmacological Bleeding Risk" : diag.name}
                            </span>
                            <span className="badge badge-outline" style={{ fontSize: '10px' }}>PATIENT ADVISORY</span>
                          </div>
                          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            {diag.name === "Medication Interaction Hazard" 
                              ? "Your profile indicates a drug safety risk. Taking Warfarin (a blood thinner) together with Aspirin increases the likelihood of side effects like bleeding or bruising. Your doctor should verify if both are required for your health."
                              : diag.name === "Acute Coronary Syndrome (ACS)"
                              ? "Your symptoms of chest pain radiating to the jaw with sweating require prompt medical evaluation. These symptoms are key warning indicators for cardiac concern. Please contact emergency health services or your doctor immediately."
                              : diag.name === "Intracranial Hemorrhage"
                              ? "Geriatric symptoms of a severe headache and confusion can indicate high-priority neurological concerns. Please seek emergency medical care."
                              : diag.evidence
                            }
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Care Checklist */}
                  <div>
                    <span className="section-title">My Recommended Care Checklist</span>
                    <div className="workup-grid" style={{ marginTop: '12px' }}>
                      {(results.requires_immediate_intervention || results.critical_flag) ? (
                        <>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['p1'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, p1: !prev.p1 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Contact Dr. Evelyn Carter to review your combined blood-thinner schedule.</span>
                          </div>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['p2'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, p2: !prev.p2 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Schedule your PT/INR blood clotting test as ordered by your cardiologist.</span>
                          </div>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['p3'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, p3: !prev.p3 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Use a soft-bristled toothbrush to prevent gum irritation or bleeding.</span>
                          </div>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['p4'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, p4: !prev.p4 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Watch for signs of bleeding like bruising easily, dark stool, or nosebleeds.</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['g1'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, g1: !prev.g1 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Continue taking all daily medications exactly as prescribed.</span>
                          </div>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['g2'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, g2: !prev.g2 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Notify Dr. Carter if you experience any new symptoms.</span>
                          </div>
                          {results.recommended_workup && results.recommended_workup.map((w, wIdx) => {
                            const key = `rec-${wIdx}`;
                            return (
                              <div 
                                key={key}
                                className={`workup-checkbox-card ${checkedWorkups[key] ? 'checked' : ''}`}
                                onClick={() => setCheckedWorkups(prev => ({ ...prev, [key]: !prev[key] }))}
                              >
                                <CheckCircle2 size={16} className="workup-icon" />
                                <span>Attending physician suggestion: {w}</span>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* Tab 2: Medical Visit History */}
      {patientActiveTab === 'visit-history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          
          {/* Header Controls inside History */}
          <div className="clinical-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-contrast)' }}>My Medical Consultation History</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Archived clinical visit summaries, attending diagnoses, and clinical instructions.
                </p>
              </div>
            </div>

            {/* Visit Search Bar */}
            <div className="history-search-wrapper" style={{ marginBottom: 0 }}>
              <Search size={16} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="history-search-input"
                placeholder="Search by attending doctor, specialty, diagnoses, or notes..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
          </div>

          {/* Visits Listing */}
          {filteredVisits.length === 0 ? (
            <div className="clinical-card" style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No visit records matched your query parameters.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredVisits.map((visit) => (
                <div key={visit.id} className="clinical-card" style={{ padding: '24px' }}>
                  
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(129, 140, 248, 0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-purple)', border: '1px solid rgba(129, 140, 248, 0.15)' }}>
                        <Stethoscope size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-contrast)' }}>{visit.doctorName}</h4>
                        <span className="badge badge-purple" style={{ fontSize: '10px', marginTop: '2px', padding: '1px 6px' }}>{visit.specialty}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                      <span>{visit.date}</span>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span>ID: {visit.id}</span>
                    </div>
                  </div>

                  {/* Card Body Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ marginBottom: '14px' }}>
                        <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Reason for Consultation</span>
                        <span style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>{visit.reason}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Documented Diagnoses</span>
                        <span style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>{visit.diagnoses}</span>
                      </div>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Prescribed Medication Plan</span>
                      <span style={{ fontSize: '14px', color: 'var(--accent-cyan)', fontWeight: '700' }}>{visit.medicationsPrescribed}</span>
                    </div>
                  </div>

                  {/* Attending Notes */}
                  <div style={{ background: 'var(--input-bg)', border: '1px solid var(--panel-border)', borderRadius: '10px', padding: '16px' }}>
                    <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Physician Consultation Notes</span>
                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6', fontStyle: 'italic' }}>
                      "{visit.notes}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
