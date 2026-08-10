import React from 'react';
import { 
  Stethoscope, 
  Mail, 
  Lock, 
  User, 
  UserCheck, 
  ArrowRight,
  ShieldAlert
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
  handleSignupSubmit,
  authError,
  handleGoogleLogin,
  isGoogleSsoConfigured = false
}) {
  return (
    <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '60px 24px', position: 'relative' }}>
      {/* Background visual capsule glows */}
      <div 
        style={{ 
          position: 'absolute', 
          width: '320px', 
          height: '320px', 
          borderRadius: '50%', 
          background: role === 'doctor' ? 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(129, 140, 248, 0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
          zIndex: -1,
          transition: 'background 0.5s ease'
        }}
      />
      
      <div 
        className="clinical-card" 
        style={{ 
          width: '100%', 
          maxWidth: '440px',
          boxShadow: role === 'doctor' 
            ? '0 24px 60px -15px rgba(14, 165, 233, 0.15), var(--card-shadow)' 
            : '0 24px 60px -15px rgba(129, 140, 248, 0.15), var(--card-shadow)',
          borderColor: role === 'doctor'
            ? 'rgba(14, 165, 233, 0.25)'
            : 'rgba(129, 140, 248, 0.25)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          padding: '36px'
        }}
      >
        
        {/* Role Selector Capsule */}
        <div className="workspace-tabs" style={{ marginBottom: '28px' }}>
                    <button 
            type="button"
            className={`workspace-tab-btn ${role === 'doctor' ? 'active' : ''}`}
            onClick={() => setRole('doctor')}
            style={{ fontSize: '12.5px', padding: '10px 14px' }}
          >
            Medical Practitioner
          </button>
                    <button 
            type="button"
            className={`workspace-tab-btn ${role === 'patient' ? 'active' : ''}`}
            onClick={() => setRole('patient')}
            style={{ fontSize: '12.5px', padding: '10px 14px' }}
          >
            Patient
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div 
            style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '12px', 
              background: role === 'doctor' ? 'rgba(14, 165, 233, 0.06)' : 'rgba(129, 140, 248, 0.06)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              margin: '0 auto 16px',
              border: role === 'doctor' ? '1px solid rgba(14, 165, 233, 0.2)' : '1px solid rgba(129, 140, 248, 0.2)',
              transition: 'all 0.5s ease'
            }}
          >
            <Stethoscope 
              size={24} 
              style={{ 
                color: role === 'doctor' ? 'var(--accent-cyan)' : 'var(--accent-purple)',
                filter: role === 'doctor' ? 'drop-shadow(0 0 6px rgba(14, 165, 233, 0.4))' : 'drop-shadow(0 0 6px rgba(129, 140, 248, 0.4))',
                transition: 'color 0.5s ease'
              }} 
            />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-contrast)' }}>
            {role === 'doctor' 
              ? (authMode === 'login' ? 'Clinician Gateway' : 'Practitioner Onboarding')
              : (authMode === 'login' ? 'Patient Portal' : 'Patient Account Setup')}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
            {role === 'doctor'
              ? (authMode === 'login' ? 'Access clinical decision workspace.' : 'Register practitioner credentials.')
              : (authMode === 'login' ? 'Review custom prescription safety reports.' : 'Setup account to log prescriptions.')
            }
          </p>
        </div>

        {authError && (
          <div className="triage-banner warning" style={{ marginBottom: '18px', padding: '10px 12px' }}>
            <ShieldAlert size={14} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px' }}>{authError}</span>
          </div>
        )}

        {authMode === 'login' ? (
          <form onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label className="form-label">{role === 'doctor' ? 'Clinician Email' : 'Patient ID / Email'}</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder={role === 'doctor' ? "e.carter@medgraph.ai" : "arthur.pendelton@gmail.com"} 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '44px' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Secure Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="••••••••" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '44px' }}
                />
              </div>
            </div>

            {role === 'doctor' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', borderRadius: '8px', marginBottom: '20px' }}>
                <ShieldAlert size={14} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Demo account: use e.carter@medgraph.ai with password "password".</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Verify & Launch Console
              <ArrowRight size={15} />
            </button>

            {/* Separator */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
            </div>

            {isGoogleSsoConfigured ? (
              <div id="google-sso-button" style={{ display: 'flex', justifyContent: 'center', width: '100%', minHeight: '40px' }}></div>
            ) : (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => handleGoogleLogin(role)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.7-1.57 2.69-3.88 2.69-6.57z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.24c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.58-5.05-3.71H.95v2.3A9 9 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.95 10.73A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.29-1.77V4.93H.95A9 9 0 0 0 0 9c0 1.45.35 2.82.95 4.07l3-2.34z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.8 11.43 0 9 0 5.48 0 2.44 2.02.95 4.93l3 2.34C4.66 5.16 6.65 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>
            )}

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '24px' }}>
              First time on the platform?{' '}
              <span 
                style={{ color: role === 'doctor' ? 'var(--accent-cyan)' : 'var(--accent-purple)', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => setAuthMode('signup')}
              >
                {role === 'doctor' ? 'Register Practitioner' : 'Create Patient Account'}
              </span>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignupSubmit}>
            <div className="form-group">
              <label className="form-label">{role === 'doctor' ? 'Full Name & MD Title' : 'Full Name'}</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={role === 'doctor' ? "Dr. Evelyn Carter, MD" : "Arthur Pendelton"} 
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '44px' }}
                />
              </div>
            </div>

            {role === 'doctor' ? (
              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">NPI Registry ID</label>
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
                  <label className="form-label">Attending Clinic</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Cardiology Center" 
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
                <Mail size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="e.carter@medgraph.ai" 
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '44px' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Min. 8 characters" 
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  required 
                  style={{ paddingLeft: '44px' }}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Confirm Account Setup
              <UserCheck size={15} />
            </button>

            {/* Separator */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
            </div>

            {isGoogleSsoConfigured ? (
              <div id="google-sso-button" style={{ display: 'flex', justifyContent: 'center', width: '100%', minHeight: '40px' }}></div>
            ) : (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => handleGoogleLogin(role)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.24h2.9c1.7-1.57 2.69-3.88 2.69-6.57z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.24c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.58-5.05-3.71H.95v2.3A9 9 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.95 10.73A5.4 5.4 0 0 1 3.6 9c0-.6.1-1.2.29-1.77V4.93H.95A9 9 0 0 0 0 9c0 1.45.35 2.82.95 4.07l3-2.34z"/>
                  <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.8 11.43 0 9 0 5.48 0 2.44 2.02.95 4.93l3 2.34C4.66 5.16 6.65 3.58 9 3.58z"/>
                </svg>
                Continue with Google
              </button>
            )}

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '24px' }}>
              Already registered on MedGraph?{' '}
              <span 
                style={{ color: role === 'doctor' ? 'var(--accent-cyan)' : 'var(--accent-purple)', cursor: 'pointer', fontWeight: '600' }}
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
