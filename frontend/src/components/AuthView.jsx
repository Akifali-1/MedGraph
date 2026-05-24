import React from 'react';
import { 
  Stethoscope, 
  Mail, 
  Lock, 
  User, 
  UserCheck, 
  ArrowRight,
  Shield
} from 'lucide-react';

export default function AuthView({
  authMode,
  setAuthMode,
  role,
  setRole,
  emailInput,
  setEmailInput,
  passwordInput,
  setPasswordInput,
  nameInput,
  setNameInput,
  npiInput,
  setNpiInput,
  clinicInput,
  setClinicInput,
  handleLoginSubmit,
  handleSignupSubmit
}) {
  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px 24px' }}>
      <div className="clinical-card" style={{ width: '100%', maxWidth: '420px' }}>
        
        {/* Role Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--panel-border)', marginBottom: '24px', paddingBottom: '8px' }}>
          <button 
            type="button"
            className={`workspace-tab-btn ${role === 'doctor' ? 'active' : ''}`}
            onClick={() => setRole('doctor')}
            style={{ flex: 1, padding: '8px', fontSize: '13px', border: 'none', background: 'none' }}
          >
            🥼 Practitioner Login
          </button>
          <button 
            type="button"
            className={`workspace-tab-btn ${role === 'patient' ? 'active' : ''}`}
            onClick={() => setRole('patient')}
            style={{ flex: 1, padding: '8px', fontSize: '13px', border: 'none', background: 'none' }}
          >
            👤 Patient Portal
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Stethoscope className="nav-logo-icon" size={32} style={{ margin: '0 auto 10px', color: 'var(--accent-cyan)' }} />
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-contrast)' }}>
            {role === 'doctor' 
              ? (authMode === 'login' ? 'Practitioner Console' : 'Create Practitioner Account')
              : (authMode === 'login' ? 'Patient Portal Sign In' : 'Create Patient Account')}
          </h2>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {role === 'doctor'
              ? (authMode === 'login' ? 'Access clinical support systems' : 'Register with NPI credentials')
              : (authMode === 'login' ? 'View health summaries and safety checklists' : 'Sign up to log your prescriptions')
            }
          </p>
        </div>

        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">{role === 'doctor' ? 'Practitioner Email' : 'Patient ID / Email'}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder={role === 'doctor' ? "e.carter@medgraph.ai" : "patient@email.com"} 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Sign In
              <ArrowRight size={15} />
            </button>

            <p style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '20px' }}>
              Need an account?{' '}
              <span 
                style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => setAuthMode('signup')}
              >
                Register here
              </span>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignupSubmit}>
            <div className="form-group">
              <label className="form-label">{role === 'doctor' ? 'Full Name & MD Title' : 'Full Name'}</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={role === 'doctor' ? "Dr. Evelyn Carter, MD" : "John Doe"} 
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            {role === 'doctor' ? (
              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">NPI Identifier</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="1982736450" 
                    value={npiInput}
                    onChange={(e) => setNpiInput(e.target.value)}
                    required 
                  />
                </div>
                <div>
                  <label className="form-label">Clinic Center</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Cardio Center" 
                    value={clinicInput}
                    onChange={(e) => setClinicInput(e.target.value)}
                    required 
                  />
                </div>
              </div>
            ) : null}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="name@email.com" 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Min. 8 characters" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '38px' }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Create Account
              <UserCheck size={15} />
            </button>

            <p style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '20px' }}>
              Already have an account?{' '}
              <span 
                style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => setAuthMode('login')}
              >
                Sign in
              </span>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
