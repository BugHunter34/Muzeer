const nodemailer = require('nodemailer');
require("dotenv").config();

const sendVerifyEmail = async (to, userName, verifyLink) => {
    console.log("TESTING ENV VARIABLES:", process.env.EMAIL_USER, process.env.EMAIL_PASS);
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true pro port 465, false pro ostatní
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // Tohle pomůže, pokud tvůj počítač blbně s certifikáty
    }
    });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: to,
    subject: 'Muzeer - Verify Your Account',
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#060918;padding:30px 12px;font-family:Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:linear-gradient(180deg,#0b1030 0%,#070b1f 100%);border:1px solid #2f3b7a;border-radius:16px;overflow:hidden;">
              <tr>
                <td style="padding:26px 26px 12px 26px;text-align:center;">
                  <div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#a5b4fc;font-weight:700;">Muzeer Account</div>
                  <h1 style="margin:10px 0 0 0;color:#facc15;font-size:28px;line-height:1.25;">Welcome to Muzeer</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:2px 26px 0 26px;text-align:center;color:#f9a8d4;font-size:18px;font-weight:600;line-height:1.4;">
                  Hello, ${userName}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 26px 0 26px;text-align:center;color:#cbd5e1;font-size:15px;line-height:1.7;">
                  Your curated soundtrack is almost ready. Verify your email to unlock your account.
                </td>
              </tr>
              <tr>
                <td style="padding:24px 26px 10px 26px;text-align:center;">
                  <a href="${verifyLink}" style="display:inline-block;background:linear-gradient(90deg,#ec4899 0%,#22d3ee 100%);color:#061020;text-decoration:none;padding:13px 26px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.2px;">
                    Verify My Account
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 26px 24px 26px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.6;">
                  If you didn’t request this, you can safely ignore this email.
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

module.exports = sendVerifyEmail;