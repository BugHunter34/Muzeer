import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Login from './Login/Login.jsx' // We will create this next
import Register from './Login/Register.jsx'
import Profile from './Profile/Profile.jsx'
// Remove index.css import here if it's breaking things

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
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)