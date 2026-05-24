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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
      
      {/* Patient Profile Header Card */}
      <div className="clinical-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', fontWeight: '700', fontSize: '20px' }}>
            AP
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-contrast)' }}>Arthur Pendelton</h2>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              <span><strong>Patient ID:</strong> PAT-0982</span>
              <span>•</span>
              <span><strong>Age:</strong> {age}</span>
              <span>•</span>
              <span><strong>Gender:</strong> {sex === 'M' ? 'Male' : 'Female'}</span>
            </div>
          </div>
        </div>

        {/* Tab switch buttons */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--input-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
          <button
            className={`btn ${patientActiveTab === 'health-check' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPatientActiveTab('health-check')}
            style={{ padding: '8px 16px', fontSize: '12.5px', borderRadius: '6px' }}
          >
            📋 Active Health Check
          </button>
          <button
            className={`btn ${patientActiveTab === 'visit-history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPatientActiveTab('visit-history')}
            style={{ padding: '8px 16px', fontSize: '12.5px', borderRadius: '6px' }}
          >
            📅 Practitioner Visit History ({PATIENT_VISIT_HISTORY.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Active Health Check */}
      {patientActiveTab === 'health-check' && (
        <main className="workspace-grid" style={{ gridTemplateColumns: '380px 1fr', padding: 0, gap: '20px', width: '100%' }}>
          {/* Left Column Sidebar */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="clinical-card" style={{ padding: '20px' }}>
              <span className="section-title" style={{ marginBottom: '14px' }}>
                <FileText size={12} /> Log Current Symptoms
              </span>

              {/* Age / Gender Adjuster */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '10px' }}>My Age</label>
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
                  <label className="form-label" style={{ fontSize: '10px' }}>My Gender</label>
                  <select className="form-select" value={sex} onChange={(e) => setSex(e.target.value)}>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>
              </div>

              {/* Symptoms Input */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ fontSize: '10px' }}>Symptoms I Feel</label>
                <form onSubmit={addSymptom} className="tag-input-row">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., headache, chest pain..."
                    value={symptomText}
                    onChange={(e) => setSymptomText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-icon-only">
                    <Plus size={14} />
                  </button>
                </form>
                <div className="tag-container" style={{ minHeight: '34px' }}>
                  {symptoms.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>No symptoms added</span>
                  ) : (
                    symptoms.map((symptom, i) => (
                      <span key={i} className="tag-item">
                        {symptom}
                        <button type="button" className="tag-delete-btn" onClick={() => removeSymptom(i)}>
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Medications Input */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" style={{ fontSize: '10px' }}>My Medications</label>
                <form onSubmit={addMedication} className="tag-input-row">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., Aspirin, Warfarin..."
                    value={medicationText}
                    onChange={(e) => setMedicationText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-icon-only">
                    <Plus size={14} />
                  </button>
                </form>
                <div className="tag-container" style={{ minHeight: '34px' }}>
                  {medications.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 'auto' }}>No medications listed</span>
                  ) : (
                    medications.map((med, i) => (
                      <span key={i} className="tag-item" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                        {med}
                        <button type="button" className="tag-delete-btn" onClick={() => removeMedication(i)}>
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Action buttons */}
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
                      Checking...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Run Safety Check
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
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>

            {/* Presets */}
            <div className="clinical-card" style={{ padding: '16px' }}>
              <span className="section-title" style={{ fontSize: '10px', marginBottom: '8px' }}>Quick Presets</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-secondary" onClick={() => loadCase(1)} style={{ padding: '4px 8px', fontSize: '10px' }}>
                  Warfarin + Aspirin (DDI)
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => loadCase(3)} style={{ padding: '4px 8px', fontSize: '10px' }}>
                  Chest Pressure Case
                </button>
              </div>
            </div>
          </aside>

          {/* Right Column: Safety report & Action items */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="clinical-card" style={{ flex: 1, minHeight: '450px', display: 'flex', flexDirection: 'column' }}>
              {isDiagnosing ? (
                <div className="empty-state">
                  <Activity className="nav-logo-icon" size={48} />
                  <div>
                    <h3 style={{ color: 'var(--text-contrast)', fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Analyzing Medical Profile</h3>
                    <p style={{ fontSize: '13px', maxWidth: '360px', color: 'var(--text-secondary)' }}>
                      Evaluating potential drug-drug interactions and matching symptoms to clinical guidelines...
                    </p>
                  </div>
                </div>
              ) : !results ? (
                <div className="empty-state">
                  <Activity className="empty-state-icon" size={48} style={{ color: 'var(--accent-rose)' }} />
                  <div>
                    <h3 style={{ color: 'var(--text-contrast)', fontSize: '16px', fontWeight: '700', marginBottom: '4px' }}>Awaiting Safety Evaluation</h3>
                    <p style={{ fontSize: '13px', maxWidth: '360px', color: 'var(--text-secondary)' }}>
                      Enter your current symptoms and daily medications on the left, then click "Run Safety Check" to review safety warnings.
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                  
                  {/* Header Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-contrast)' }}>My Safety Check Report</h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Checked on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                    <button className="btn btn-secondary" onClick={downloadPatientReport} style={{ padding: '6px 12px', fontSize: '12px' }}>
                      <Download size={13} /> Save Report
                    </button>
                  </div>

                  {/* Warning Banner */}
                  {results.requires_immediate_intervention ? (
                    <div className="triage-banner critical" style={{ margin: 0 }}>
                      <ShieldAlert className="triage-icon" size={24} style={{ color: 'var(--accent-rose)' }} />
                      <div>
                        <h4 className="triage-title" style={{ color: 'var(--accent-rose)', fontWeight: '800', fontSize: '14px' }}>⚠️ ATTENTION REQUIRED: MEDICATION WARNING</h4>
                        <p className="triage-desc" style={{ color: 'var(--text-primary)', marginTop: '6px', fontSize: '13.5px', lineHeight: '1.5' }}>
                          A severe safety warning has been flagged for your active medications: <strong>Warfarin</strong> and <strong>Aspirin</strong>.
                        </p>
                        <p className="triage-desc" style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '13px', lineHeight: '1.5' }}>
                          Taking these two medications together significantly thins your blood. This compound effect increases the chance of bleeding or major bruising.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="triage-banner warning" style={{ margin: 0, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.15)' }}>
                      <CheckCircle2 className="triage-icon" size={24} style={{ color: 'var(--accent-emerald)' }} />
                      <div>
                        <h4 className="triage-title" style={{ color: 'var(--accent-emerald)', fontWeight: '800', fontSize: '14px' }}>Safety Check Passed</h4>
                        <p className="triage-desc" style={{ color: 'var(--text-primary)', marginTop: '6px', fontSize: '13px', lineHeight: '1.5' }}>
                          No immediate drug-drug interactions or severe warnings were flagged in your list.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Advice cards */}
                  <div>
                    <span className="section-title">What this means for you</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                      {results.diagnoses && results.diagnoses.map((diag, idx) => (
                        <div key={idx} className="diagnosis-card" style={{ padding: '16px', margin: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-contrast)' }}>
                              {diag.name === "Medication Interaction Hazard" ? "Medication Interaction Risk" : diag.name}
                            </span>
                            <span className="badge badge-info" style={{ fontSize: '10px' }}>Patient Info</span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
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

                  {/* Checklist */}
                  <div>
                    <span className="section-title">My Recommended Care Checklist</span>
                    <div className="workup-grid" style={{ marginTop: '8px' }}>
                      {results.requires_immediate_intervention ? (
                        <>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['p1'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, p1: !prev.p1 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Contact Dr. Carter (or your primary doctor) to review your dual blood thinner therapy.</span>
                          </div>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['p2'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, p2: !prev.p2 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Schedule your scheduled PT/INR blood test to monitor your clotting time.</span>
                          </div>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['p3'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, p3: !prev.p3 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Use a soft-bristled toothbrush to prevent bleeding gums.</span>
                          </div>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['p4'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, p4: !prev.p4 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Watch out for unusual bruising or dark/tarry stools. Seek help if seen.</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['g1'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, g1: !prev.g1 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Continue taking your medications exactly as prescribed.</span>
                          </div>
                          <div 
                            className={`workup-checkbox-card ${checkedWorkups['g2'] ? 'checked' : ''}`}
                            onClick={() => setCheckedWorkups(prev => ({ ...prev, g2: !prev.g2 }))}
                          >
                            <CheckCircle2 size={16} className="workup-icon" />
                            <span>Watch for changes in your symptoms and consult your doctor if needed.</span>
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
                                <span>Follow up on: {w}</span>
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
          <div className="clinical-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '14px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-contrast)' }}>My Medical Consultation History</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  List of visits, diagnoses, and directions provided by different attending doctors.
                </p>
              </div>
            </div>

            {/* Visit Search Bar */}
            <div className="history-search-wrapper" style={{ marginBottom: 0 }}>
              <Search size={16} style={{ position: 'absolute', left: '16px', top: '15px', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                className="history-search-input"
                placeholder="Search by doctor, specialty, diagnosis, or clinical notes..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
          </div>

          {/* Visits Listing */}
          {filteredVisits.length === 0 ? (
            <div className="clinical-card" style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No visit records match your search criteria.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredVisits.map((visit) => (
                <div key={visit.id} className="clinical-card" style={{ padding: '20px', transition: 'all 0.2s' }}>
                  
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-purple)' }}>
                        <Stethoscope size={20} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-contrast)' }}>{visit.doctorName}</h4>
                        <span className="badge badge-purple" style={{ fontSize: '10px', marginTop: '2px' }}>{visit.specialty}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      <Calendar size={14} />
                      <span>{visit.date}</span>
                      <span>•</span>
                      <span><strong>ID:</strong> {visit.id}</span>
                    </div>
                  </div>

                  {/* Card Body Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ marginBottom: '10px' }}>
                        <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason for Visit</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{visit.reason}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Diagnoses Recorded</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{visit.diagnoses}</span>
                      </div>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prescribed Medications</span>
                      <span style={{ fontSize: '13.5px', color: 'var(--text-contrast)', fontWeight: '600' }}>{visit.medicationsPrescribed}</span>
                    </div>
                  </div>

                  {/* Attending Notes */}
                  <div style={{ background: 'var(--input-bg)', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '12px' }}>
                    <span style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Attending Physician Notes & Advice</span>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', fontStyle: 'italic' }}>
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
