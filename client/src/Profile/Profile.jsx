import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Profile() {
  const navigate = useNavigate();
  
  const hasAttemptedLink = React.useRef(false);
  // --- Magic Link Hooks ---
  const [searchParams, setSearchParams] = useSearchParams();
  const [linkStatus, setLinkStatus] = useState(null); 

  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  const userData = savedUser ? JSON.parse(savedUser) : null;
  const userName = userData?.userName || 'User';
  const email = userData?.email || 'No email provided';

  // --- Redirect if not logged in ---
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // --- The Magic Link Catcher ---
  useEffect(() => {
    const discordIdFromUrl = searchParams.get('discordId');
    const discordNameFromUrl = searchParams.get('discordName');

    if (discordIdFromUrl && token) {
      // 1. THE LOOP KILLER: Instantly wipe the URL clean without triggering a React re-render
      window.history.replaceState(null, '', '/profile');

      setLinkStatus({ type: 'loading', text: 'Linking your Discord account...' });

      // 2. THE 404 FIX: Point to the new /api/bot route
      fetch('http://localhost:3000/api/bot/link-discord', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        credentials: 'include',
        body: JSON.stringify({ 
          discordId: discordIdFromUrl, 
          discordName: discordNameFromUrl 
        })
      })
      .then(res => {
        if (!res.ok) throw new Error("Server returned " + res.status);
        return res.json();
      })
      .then(data => {
        if (data.success) {
          setLinkStatus({ type: 'success', text: 'Discord account linked successfully!' });
          
          const updatedUser = { 
            ...userData, 
            discordId: discordIdFromUrl, 
            discordName: discordNameFromUrl 
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        } else {
          setLinkStatus({ type: 'error', text: 'Failed to link Discord.' });
        }
      })
      .catch(err => {
        console.error("Linking error:", err);
        setLinkStatus({ type: 'error', text: 'Server error while linking.' });
      });
    }
  }, [searchParams, token]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!token) return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100vw',
        background:
          'radial-gradient(900px 600px at 12% 8%, rgba(236,72,153,0.22), transparent 60%),' +
          'radial-gradient(700px 500px at 90% 18%, rgba(14,165,233,0.18), transparent 58%),' +
          'radial-gradient(800px 700px at 50% 110%, rgba(99,102,241,0.2), transparent 65%),' +
          'radial-gradient(circle at 30% 40%, #0a0834 0%, #040425 45%, #02021a 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
        color: 'white',
        fontFamily: '"Poppins", "Trebuchet MS", sans-serif'
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '900px',
          borderRadius: '28px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(10, 10, 30, 0.88)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          padding: '28px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: '12px', letterSpacing: '1.2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
              My Account
            </p>
            <h1 style={{ margin: '8px 0 0 0', fontSize: '32px' }}>
              Profile
            </h1>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
              padding: '10px 14px',
              cursor: 'pointer'
            }}
          >
            Back to Home
          </button>
        </div>

        {/* --- Dynamic Status Banner --- */}
        {linkStatus && (
          <div style={{
            marginTop: '20px',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            background: linkStatus.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 
                        linkStatus.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 
                        'rgba(255, 255, 255, 0.1)',
            border: `1px solid ${
                        linkStatus.type === 'success' ? 'rgba(34, 197, 94, 0.4)' : 
                        linkStatus.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 
                        'rgba(255, 255, 255, 0.2)'}`,
            color: linkStatus.type === 'success' ? '#4ade80' : 
                   linkStatus.type === 'error' ? '#f87171' : 
                   '#fff'
          }}>
            {linkStatus.type === 'loading' && '⏳ '}
            {linkStatus.text}
          </div>
        )}

        <div style={{ marginTop: '22px', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '16px' }}>
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.04)',
              padding: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '999px',
                  background: 'linear-gradient(135deg, #ec4899, #22d3ee)',
                  color: '#040425',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}
              >
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px' }}>{userName}</h2>
                <p style={{ margin: '4px 0 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                  {token ? 'Logged in to Muzeer' : 'Not logged in'}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '18px', display: 'grid', gap: '10px' }}>
              <div style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px' }}>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.58)', fontSize: '12px' }}>Email</p>
                <p style={{ margin: '3px 0 0 0' }}>{token ? email : '—'}</p>
              </div>
              
              <div style={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px' }}>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.58)', fontSize: '12px' }}>Plan</p>
                <p style={{ margin: '3px 0 0 0' }}>Free</p>
              </div>

              {/* --- NEW: DISCORD CONNECTION UI --- */}
              <div style={{ 
                borderRadius: '12px', 
                border: '1px solid rgba(88, 101, 242, 0.4)', 
                background: 'rgba(88, 101, 242, 0.1)',
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>Discord Connection</p>
                  <p style={{ margin: '3px 0 0 0', fontWeight: 'bold', color: '#5865F2' }}>
                    {userData?.discordName ? `@${userData.discordName}` : 'Not linked'}
                  </p>
                </div>
              </div>

            </div>
          </div>

          <div
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.04)',
              padding: '20px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '18px' }}>Quick actions</h3>
            <p style={{ margin: '8px 0 18px 0', color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
              Basic profile controls for MVP.
            </p>

            <div style={{ display: 'grid', gap: '10px' }}>
              <button
                onClick={() => navigate('/register')}
                style={{
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'white',
                  padding: '11px 14px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                Edit profile (next step)
              </button>

              <button
                onClick={handleLogout}
                style={{
                  border: 'none',
                  borderRadius: '12px',
                  background: 'linear-gradient(90deg, #ec4899, #22d3ee)',
                  color: '#05001f',
                  fontWeight: 700,
                  padding: '11px 14px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}