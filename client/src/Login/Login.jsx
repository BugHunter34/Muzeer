import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { authFormStyles } from './authFormStyles';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Connecting to your Express backend
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok) {
        // Save the JWT token
        localStorage.setItem('token', data.token);
        
        // UNCOMMENT THIS LINE: Save the user data so App.jsx can see it!
        localStorage.setItem('user', JSON.stringify(data.user)); 
        
        alert('Login successful!');
        window.location.href = '/'; // Redirect back to the main app page
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Server error. Is the backend running?');
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
    }
  };

  return (
    <AuthLayout
      heroTitlePrefix="Welcome back to"
      heroAccent="Muzeer"
      heroText="Your curated soundtrack is waiting. Log in to sync your playlists, discover new tracks, and stay in the flow."
      heroPills={['Curated drops', 'Daily mixes', 'Community picks']}
      cardTitle="Sign in"
      cardSubtitle="Use your account details to continue."
      error={error}
      footer={(
        <div style={styles.helper}>
          <span>Need an account?</span>
          <span style={styles.link} onClick={() => navigate('/register')}>
            Create one
          </span>
        </div>
      )}
    >
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
    </AuthLayout>
  );
}