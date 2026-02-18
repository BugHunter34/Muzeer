import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { authFormStyles } from './authFormStyles';

export default function Login() {
  // Login States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // 2FA States
  const [is2FA, setIs2FA] = useState(false);
  const [twoFacCode, setTwoFacCode] = useState('');
  
  const navigate = useNavigate();

  // --- STEP 1: INITIAL LOGIN (PASSWORD CHECK) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.requires2FA) {
        // Backend says password is good, now show the 2FA screen
        setIs2FA(true);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Server error. Is the backend running?');
    }
  };

  // --- STEP 2: VERIFY THE 6-DIGIT CODE ---
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/auth/login/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: twoFacCode }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        // SUCCESS! Save token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user)); 
        
        window.location.href = '/'; // Hard redirect to wake up App.jsx
      } else {
        setError(data.message || 'Invalid verification code');
      }
    } catch (err) {
      setError('Server error during verification.');
    }
  };

  const styles = {
    ...authFormStyles,
    divider: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      margin: '18px 0 14px',
      color: 'rgba(255,255,255,0.45)',
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '1.6px'
    },
    dividerLine: {
      height: '1px',
      flex: 1,
      background: 'rgba(255,255,255,0.1)'
    },
    socialGrid: {
      display: 'grid',
      gap: '10px'
    },
    socialButton: {
      width: '100%',
      padding: '12px 14px',
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(255,255,255,0.06)',
      color: 'white',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px'
    },
    socialBadge: {
      width: '22px',
      height: '22px',
      borderRadius: '999px',
      background: 'rgba(255,255,255,0.14)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px'
    },
    helper: {
      ...authFormStyles.helper,
      marginTop: '10px'
    },
    codeBox: {
      ...authFormStyles.input,
      fontSize: '24px',
      letterSpacing: '8px',
      textAlign: 'center',
      fontWeight: 'bold',
      color: '#facc15' // Muzeer Yellow
    }
  };

  return (
    <AuthLayout
      heroTitlePrefix="Welcome back to"
      heroAccent="Muzeer"
      heroText="Your curated soundtrack is waiting. Log in to sync your playlists, discover new tracks, and stay in the flow."
      heroPills={['Curated drops', 'Daily mixes', 'Community picks']}
      
      // Change title and subtitle dynamically based on state
      cardTitle={is2FA ? "Security Check" : "Sign in"}
      cardSubtitle={is2FA ? `Enter the 6-digit code we sent to ${email}` : "Use your account details to continue."}
      
      error={error}
      footer={(
        <div style={styles.helper}>
          <span>{is2FA ? "Didn't receive it?" : "Need an account?"}</span>
          <span 
            style={styles.link} 
            onClick={() => is2FA ? setIs2FA(false) : navigate('/register')}
          >
            {is2FA ? "Try logging in again" : "Create one"}
          </span>
        </div>
      )}
    >
      
      {/* --- CONDITIONAL RENDER: 2FA OR NORMAL LOGIN --- */}
      {is2FA ? (
        
        /* 2FA VERIFICATION FORM */
        <form onSubmit={handleVerify2FA} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={{...styles.label, textAlign: 'center', display: 'block'}}>Verification Code</label>
            <input
              style={styles.codeBox}
              type="text"
              maxLength="6"
              placeholder="••••••"
              value={twoFacCode}
              onChange={(e) => setTwoFacCode(e.target.value.replace(/\D/g, ''))} // Only allow numbers
              required
              autoFocus
            />
          </div>
          <button style={{...styles.button, background: '#facc15', color: 'black'}} className="auth-button" type="submit">
            Authenticate
          </button>
        </form>

      ) : (

        /* STANDARD LOGIN FORM */
        <>
          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button style={styles.button} className="auth-button" type="submit">
              Sign In
            </button>
          </form>

          <div style={styles.divider}>
            <span style={styles.dividerLine} />
            <span>Or continue with</span>
            <span style={styles.dividerLine} />
          </div>

          <div style={styles.socialGrid}>
            <button type="button" style={styles.socialButton} className="auth-button">
              <span style={styles.socialBadge}>G</span>
              Continue with Google
            </button>
            <button type="button" style={styles.socialButton} className="auth-button">
              <span style={styles.socialBadge}>f</span>
              Continue with Facebook
            </button>
            <button type="button" style={styles.socialButton} className="auth-button">
              <span style={styles.socialBadge}>A</span>
              Continue with Apple
            </button>
          </div>
        </>
      )}

    </AuthLayout>
  );
}