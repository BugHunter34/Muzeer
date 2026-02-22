const nodemailer = require('nodemailer');
require("dotenv").config();

const sendEmail = async (to, code) => {
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

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: 'Muzeer - Your Login Code',
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060918;padding:36px 12px;font-family:Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#0b1020;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:26px 26px 12px 26px;text-align:center;">
                  <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#64748b;font-weight:700;">Muzeer Security</div>
                  <h1 style="margin:10px 0 0 0;color:#f8fafc;font-size:28px;line-height:1.25;">Login verification</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 26px 0 26px;text-align:center;color:#94a3b8;font-size:15px;line-height:1.7;">
                  Your login verification code is:
                </td>
              </tr>
              <tr>
                <td style="padding:20px 26px;text-align:center;">
                  <div style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:18px;display:inline-block;">
                    <div style="font-size:36px;letter-spacing:8px;color:#f8fafc;font-weight:700;font-family:'Courier New',monospace;">${code}</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:0 26px 24px 26px;text-align:center;color:#64748b;font-size:12px;line-height:1.6;">
                  This code will expire in 10 minutes. If you didn't request this, you can safely ignore this email.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
