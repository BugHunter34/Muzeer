import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { authFormStyles } from './authFormStyles';

export default function Register() {
  const [email, setEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Connecting to your route: router.post("/register", LoginController.register);
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userName, password })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Registration successful! Please log in.');
        navigate('/login'); // Redirect to login page after success
      } else {
        // Displays "Email už existuje" or "Chybí údaje" from your backend
        setError(data.message || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error. Is your server running?');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    ...authFormStyles,
    helper: {
      ...authFormStyles.helper,
      marginTop: '14px'
    }
  };

  return (
    <AuthLayout
      heroTitlePrefix="Join"
      heroAccent="Muzeer"
      heroText="Create your account to build playlists, discover fresh tracks, and keep your music with you."
      heroPills={['Personal playlists', 'Discover weekly', 'Save favorites']}
      cardTitle="Create account"
      cardSubtitle="Fill in your details to get started."
      error={error}
      heroTextMaxWidth="360px"
      footer={(
        <div style={styles.helper}>
          <span>Already have an account?</span>
          <span style={styles.link} onClick={() => navigate('/login')}>
            Sign in
          </span>
        </div>
      )}
    >
          <form onSubmit={handleRegister} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Username</label>
              <input
                style={styles.input}
                type="text"
                placeholder="CoolListener123"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
              />
            </div>

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

            <button
              style={{ ...styles.button, opacity: loading ? 0.5 : 1 }}
              className="auth-button"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Sign Up'}
            </button>
          </form>
    </AuthLayout>
  );
}