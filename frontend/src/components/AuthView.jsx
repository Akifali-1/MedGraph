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
            Practitioner
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
              ? (authMode === 'login' ? 'Practitioner sign in' : 'Create practitioner account')
              : (authMode === 'login' ? 'Patient sign in' : 'Create patient account')}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
            {role === 'doctor'
              ? (authMode === 'login' ? 'Open the case workspace.' : 'Create your practitioner account.')
              : (authMode === 'login' ? 'Review your medicine safety checks.' : 'Create an account to save checks.')
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
               <label className="form-label">Email</label>
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
              <label className="form-label">Password</label>
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
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Password sign-in is for local development.</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Sign in
              <ArrowRight size={15} />
            </button>

            {/* Separator */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '10px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--panel-border)' }} />
            </div>

            {isGoogleSsoConfigured ? (
              <div id="google-sso-button" style={{ width: '100%', minHeight: '40px', display: 'flex', justifyContent: 'center' }} />
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                disabled
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
              >
                Google sign-in unavailable
              </button>
            )}

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '24px' }}>
              New here?{' '}
              <span 
                style={{ color: role === 'doctor' ? 'var(--accent-cyan)' : 'var(--accent-purple)', cursor: 'pointer', fontWeight: '600' }}
                onClick={() => setAuthMode('signup')}
              >
                {role === 'doctor' ? 'Create account' : 'Create patient account'}
              </span>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSignupSubmit}>
            <div className="form-group">
              <label className="form-label">Full name</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={role === 'doctor' ? "Dr. Evelyn Carter, MD" : "Your full name"} 
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
                   <label className="form-label">NPI</label>
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
                   <label className="form-label">Clinic</label>
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
              <div id="google-sso-button" style={{ width: '100%', minHeight: '40px', display: 'flex', justifyContent: 'center' }} />
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                disabled
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}
              >
                Google sign-in unavailable
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
