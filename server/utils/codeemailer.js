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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:28px 12px;font-family:Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(180deg,#0a0a0a 0%,#060606 100%);border:1px solid #fbbf24;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:24px 28px 10px 28px;text-align:center;">
                  <div style="font-size:12px;letter-spacing:2px;color:#fcd34d;text-transform:uppercase;font-weight:700;">Muzeer Owner Access</div>
                  <h1 style="margin:10px 0 0 0;font-size:24px;line-height:1.3;color:#ffffff;">System Owner Verification</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 28px 0 28px;text-align:center;color:#d1d5db;font-size:14px;line-height:1.6;">
                  Master clearance requested for Muzeer Core. Use the secure code below.
                </td>
              </tr>
              <tr>
                <td style="padding:20px 28px 6px 28px;">
                  <div style="background:#111111;border:1px solid #2b2b2b;border-radius:12px;padding:18px;text-align:center;">
                    <div style="font-size:11px;letter-spacing:1.5px;color:#9ca3af;text-transform:uppercase;margin-bottom:10px;">One-Time Owner Code</div>
                    <div style="font-family:'Courier New',monospace;font-size:42px;line-height:1;letter-spacing:10px;color:#ef4444;font-weight:700;">${code}</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 28px 24px 28px;text-align:center;color:#9ca3af;font-size:12px;line-height:1.6;">
                  This override code expires in 10 minutes. Do not share this code with anyone.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  } 
  
  // 🛡️ ADMIN TEMPLATE (System Admin Vibe)
  else if (role === 'admin') {
    subjectLine = '🛡️ Muzeer - Admin Clearance Code';
    emailHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:28px 12px;font-family:Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f172a;border:1px solid #1e3a8a;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:18px 24px;background:#111c35;border-bottom:1px solid #1f2d4a;color:#60a5fa;font-size:12px;letter-spacing:1.8px;text-transform:uppercase;font-weight:700;text-align:center;">
                  Admin Security Gate
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px 10px 24px;text-align:center;color:#e2e8f0;font-size:15px;line-height:1.6;">
                  Elevated access requested. Use this authentication code to continue.
                </td>
              </tr>
              <tr>
                <td style="padding:8px 24px;">
                  <div style="background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px;text-align:center;">
                    <div style="font-size:38px;line-height:1;letter-spacing:8px;color:#ffffff;font-weight:700;">${code}</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 24px 22px 24px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.5;">
                  Code valid for 10 minutes.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  } 
  
  // 🎧 STANDARD USER TEMPLATE (Classic Muzeer Vibe)
  else {
    subjectLine = 'Muzeer - Your Login Code';
    emailHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#05081b;padding:28px 12px;font-family:Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:linear-gradient(180deg,#0b0f28 0%,#070b20 100%);border:1px solid #2a315e;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:22px 24px 10px 24px;text-align:center;">
                  <h2 style="margin:0;color:#ec4899;font-size:22px;line-height:1.3;">Muzeer Security</h2>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 24px 0 24px;text-align:center;color:#c7d2fe;font-size:15px;line-height:1.6;">
                  Welcome back. Your login verification code is:
                </td>
              </tr>
              <tr>
                <td style="padding:18px 24px 8px 24px;">
                  <div style="background:#0b122e;border:1px solid #2f3b7a;border-radius:10px;padding:16px;text-align:center;">
                    <div style="font-size:40px;line-height:1;letter-spacing:7px;color:#facc15;font-weight:700;">${code}</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 24px 24px 24px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.5;">
                  This code expires in 10 minutes.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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