import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

  // --- INLINE STYLES (Scoped only to this page) ---
  const s = {
    wrapper: {
      minHeight: '100vh',
      backgroundColor: '#000054',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      color: 'white',
      padding: '20px'
    },
    card: {
      backgroundColor: 'rgba(10, 10, 30, 0.9)',
      padding: '40px',
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.1)',
      width: '100%',
      maxWidth: '420px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
    },
    title: {
      textAlign: 'center',
      margin: '0 0 10px 0',
      background: 'linear-gradient(to right, #ec4899, #fff)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      fontSize: '32px'
    },
    input: {
      width: '100%',
      padding: '12px 20px',
      borderRadius: '50px',
      border: '1px solid rgba(255,255,255,0.1)',
      backgroundColor: 'rgba(255,255,255,0.05)',
      color: 'white',
      outline: 'none',
      marginBottom: '15px',
      fontSize: '16px'
    },
    label: {
      fontSize: '12px',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.5)',
      display: 'block',
      marginBottom: '5px',
      marginLeft: '15px'
    },
    btn: {
      width: '100%',
      padding: '14px',
      borderRadius: '50px',
      border: 'none',
      backgroundColor: '#ec4899',
      color: 'black',
      fontWeight: 'bold',
      fontSize: '16px',
      cursor: 'pointer',
      marginTop: '10px',
      transition: '0.3s'
    },
    error: {
      backgroundColor: 'rgba(244, 63, 94, 0.2)',
      color: '#f43f5e',
      padding: '10px',
      borderRadius: '10px',
      marginBottom: '20px',
      textAlign: 'center',
      fontSize: '14px'
    }
  };

  return (
    <div style={s.wrapper}>
      <div style={s.card}>
        <h1 style={s.title}>Create Account</h1>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', marginBottom: '30px' }}>
          Join the Pinkwave community
        </p>

        {error && <div style={s.error}>{error}</div>}

        <form onSubmit={handleRegister}>
          <label style={s.label}>Username</label>
          <input 
            style={s.input}
            type="text" 
            placeholder="CoolListener123"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
          />

          <label style={s.label}>Email</label>
          <input 
            style={s.input}
            type="email" 
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label style={s.label}>Password</label>
          <input 
            style={s.input}
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button 
            style={{...s.btn, opacity: loading ? 0.5 : 1}} 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Sign Up'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
          Already have an account? 
          <span 
            onClick={() => navigate('/login')} 
            style={{ color: '#ec4899', cursor: 'pointer', marginLeft: '5px' }}
          >
            Log In
          </span>
        </p>
      </div>
    </div>
  );
}