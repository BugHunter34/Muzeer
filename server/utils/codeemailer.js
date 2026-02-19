// utils/sendEmail.js
const nodemailer = require('nodemailer');
require("dotenv").config();
 

const sendEmail = async (to, code) => {
  const role = "owner";
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });
let subjectLine = '';
  let emailHtml = '';

  // 👑 OWNER TEMPLATE (Ultra Premium / High Security Vibe)
  if (role === 'owner') {
    subjectLine = '👑 Muzeer - Ahoj tati';
    emailHtml = `
      <div style="font-family: 'Courier New', monospace; text-align: center; padding: 40px; background-color: #000000; color: #fbbf24; border: 2px solid #fbbf24; border-radius: 12px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #fbbf24; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 5px;">System Owner</h2>
        <p style="color: #ffffff; font-family: Arial, sans-serif; font-size: 14px;">Master clearance requested for Muzeer Core.</p>
        <div style="background-color: #111111; padding: 20px; border-radius: 8px; margin: 30px 0;">
          <h1 style="font-size: 48px; letter-spacing: 12px; color: #ef4444; margin: 0;">${code}</h1>
        </div>
        <p style="color: #666666; font-size: 12px; font-family: Arial, sans-serif;">This override code expires in 10 minutes. Do not share this with anyone.</p>
      </div>
    `;
  } 
  
  // 🛡️ ADMIN TEMPLATE (System Admin Vibe)
  else if (role === 'admin') {
    subjectLine = '🛡️ Muzeer - Admin Clearance Code';
    emailHtml = `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #0f172a; color: #ffffff; border-top: 5px solid #3b82f6; border-radius: 8px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #3b82f6; text-transform: uppercase; letter-spacing: 2px;">Admin Security Gate</h2>
        <p style="color: #cbd5e1; font-size: 15px;">Elevated access requested. Your authentication code is:</p>
        <h1 style="font-size: 42px; letter-spacing: 8px; color: #ffffff; background: #1e293b; padding: 15px; border-radius: 8px; border: 1px solid #334155;">${code}</h1>
        <p style="color: #64748b; font-size: 12px; margin-top: 20px;">Code valid for 10 minutes.</p>
      </div>
    `;
  } 
  
  // 🎧 STANDARD USER TEMPLATE (Classic Muzeer Vibe)
  else {
    subjectLine = 'Muzeer - Your Login Code';
    emailHtml = `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px; background-color: #02021a; color: white; border-radius: 12px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #ec4899; margin-bottom: 5px;">Muzeer Security</h2>
        <p style="color: rgba(255,255,255,0.7); font-size: 16px;">Welcome back. Your login verification code is:</p>
        <h1 style="font-size: 40px; letter-spacing: 6px; color: #facc15; margin: 30px 0;">${code}</h1>
        <p style="color: rgba(255,255,255,0.3); font-size: 12px;">This code will expire in 10 minutes.</p>
      </div>
    `;
  }

  // Combine and Send
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: subjectLine,
    html: emailHtml
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;