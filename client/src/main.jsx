import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import App from './App.jsx'
import Login from './Login/Login.jsx' // We will create this next
import Register from './Login/Register.jsx'
import Profile from './Profile/Profile.jsx'
import SearchResults from './Search/SearchResults.jsx'
import AdminAbuse from './Admin/AdminAbuse.jsx' // NEW: Admin dashboard
// Remove index.css import here if it's breaking things
// --- Grab User info from localStorage so we can conditionally render admin routes ---
let user = null;
const isBanned = localStorage.getItem('banned') === 'true';
try {
  const savedUser = localStorage.getItem('user');
  if (savedUser && savedUser !== "undefined") {
    user = JSON.parse(savedUser);
  }
} catch (err) {
  console.error("Corrupted user data in main.jsx");
}
console.log("MAIN.JSX BOOTING UP! USER IS:", user);

if (isBanned) {
  // TERMINATION SCREEN
  ReactDOM.createRoot(document.getElementById('root')).render(
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#020005', color: '#ff2a2a', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: '4rem', letterSpacing: '0.2em', margin: 0 }}>TERMINATED</h1>
      <p style={{ color: '#ff2a2a80', marginTop: '10px' }}>Your account has been eradicated by an Administrator.</p>
    </div>
  );
} else {

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Your main music app */}
        <Route path="/" element={<App />} />
        {/* Your new login page */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/admin" element={user?.role === 'admin' ? <AdminAbuse /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
}