import React, { useRef } from 'react';

export default function AuthLayout({
  heroTitlePrefix,
  heroAccent,
  heroText,
  heroPills,
  cardTitle,
  cardSubtitle,
  error,
  children,
  footer,
  heroTextMaxWidth = '320px'
}) {
  const pageRef = useRef(null);
  const cursorRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!pageRef.current) return;
    if (cursorRef.current) {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const isInteractive = target && target.closest('button, a, input, label, select, textarea');
      cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      cursorRef.current.style.opacity = isInteractive ? '0' : '1';
    }
    const rect = pageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    pageRef.current.style.setProperty('--mx', `${x}%`);
    pageRef.current.style.setProperty('--my', `${y}%`);
  };

  const handleMouseLeave = () => {
    if (!pageRef.current) return;
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '0';
    }
    pageRef.current.style.setProperty('--mx', '50%');
    pageRef.current.style.setProperty('--my', '50%');
  };

  const styles = {
    page: {
      minHeight: '100vh',
      width: '100vw',
      alignSelf: 'stretch',
      background:
        'radial-gradient(900px 600px at 12% 8%, rgba(236,72,153,0.22), transparent 60%),' +
        'radial-gradient(700px 500px at 90% 18%, rgba(14,165,233,0.18), transparent 58%),' +
        'radial-gradient(800px 700px at 50% 110%, rgba(99,102,241,0.2), transparent 65%),' +
        'radial-gradient(circle at 30% 40%, #0a0834 0%, #040425 45%, #02021a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Poppins", "Trebuchet MS", sans-serif',
      color: 'white',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    },
    shell: {
      position: 'relative',
      width: '100%',
      maxWidth: '960px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
      gap: '24px',
      alignItems: 'stretch'
    },
    hero: {
      position: 'relative',
      borderRadius: '28px',
      padding: '40px',
      background: 'rgba(4, 4, 32, 0.75)',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    },
    heroGlow: {
      position: 'absolute',
      inset: '-40% 40% auto -40%',
      height: '120%',
      background: 'radial-gradient(circle, rgba(236,72,153,0.35), transparent 70%)',
      filter: 'blur(10px)',
      opacity: 0.6
    },
    heroTitle: {
      margin: '0 0 12px 0',
      fontSize: '36px',
      lineHeight: 1.1,
      letterSpacing: '-0.5px'
    },
    heroAccent: {
      background: 'linear-gradient(90deg, #ec4899 0%, #22d3ee 90%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    },
    heroText: {
      color: 'rgba(255,255,255,0.65)',
      fontSize: '15px',
      maxWidth: heroTextMaxWidth
    },
    heroPills: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '24px'
    },
    pill: {
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.18)',
      padding: '6px 12px',
      fontSize: '12px',
      color: 'rgba(255,255,255,0.7)',
      background: 'rgba(255,255,255,0.04)'
    },
    card: {
      backgroundColor: 'rgba(10, 10, 30, 0.92)',
      padding: '36px',
      borderRadius: '26px',
      border: '1px solid rgba(255,255,255,0.1)',
      width: '100%',
      boxSizing: 'border-box',
      boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
      textAlign: 'left'
    },
    title: {
      margin: '0 0 6px 0',
      fontSize: '30px',
      background: 'linear-gradient(to right, #ec4899, #fff)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent'
    },
    subtitle: {
      color: 'rgba(255,255,255,0.55)',
      marginBottom: '26px',
      fontSize: '14px'
    },
    errorBox: {
      backgroundColor: 'rgba(244, 63, 94, 0.2)',
      color: '#f43f5e',
      padding: '10px',
      borderRadius: '10px',
      marginBottom: '18px',
      fontSize: '14px'
    }
  };

  return (
    <div
      ref={pageRef}
      style={styles.page}
      className="auth-page"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div style={styles.shell} className="auth-shell">
        <section style={styles.hero}>
          <div style={styles.heroGlow} />
          <div>
            <h1 style={styles.heroTitle}>
              {heroTitlePrefix} <span style={styles.heroAccent}>{heroAccent}</span>
            </h1>
            <p style={styles.heroText}>{heroText}</p>
          </div>
          <div style={styles.heroPills}>
            {heroPills.map((pill) => (
              <span key={pill} style={styles.pill}>
                {pill}
              </span>
            ))}
          </div>
        </section>

        <div style={styles.card} className="auth-card">
          <h2 style={styles.title}>{cardTitle}</h2>
          <p style={styles.subtitle}>{cardSubtitle}</p>

          {error && <div style={styles.errorBox}>{error}</div>}

          {children}
          {footer}
        </div>
      </div>

      <div ref={cursorRef} className="auth-cursor" aria-hidden="true" />

      <style>
        {`
          .auth-page {
            background-size: 140% 140%;
            animation: floatGradient 18s ease-in-out infinite;
            cursor: none;
          }

          .auth-page::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background:
              radial-gradient(220px 220px at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.18), transparent 60%);
            mix-blend-mode: screen;
            opacity: 0.7;
            transition: opacity 200ms ease;
            z-index: 0;
          }

          .auth-cursor {
            position: fixed;
            top: 0;
            left: 0;
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.9);
            box-shadow: 0 0 16px rgba(236,72,153,0.6);
            pointer-events: none;
            transform: translate(-9999px, -9999px);
            transition: opacity 120ms ease;
            opacity: 0;
            z-index: 2;
          }

          .auth-shell,
          .auth-card,
          .auth-shell * {
            position: relative;
            z-index: 1;
          }

          .auth-card::before {
            content: "";
            position: absolute;
            inset: -1px;
            border-radius: 28px;
            background: linear-gradient(130deg, rgba(255,255,255,0.15), transparent 40%);
            opacity: 0.6;
            pointer-events: none;
          }

          .auth-button {
            transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
          }

          .auth-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 14px 30px rgba(236,72,153,0.25);
            filter: brightness(1.05);
          }

          .auth-button:active {
            transform: translateY(0);
            box-shadow: 0 10px 20px rgba(236,72,153,0.2);
          }

          @keyframes floatGradient {
            0% {
              background-position: 0% 0%;
            }
            50% {
              background-position: 100% 100%;
            }
            100% {
              background-position: 0% 0%;
            }
          }

          @media (max-width: 900px) {
            .auth-shell {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </div>
  );
}
