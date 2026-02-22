const nodemailer = require('nodemailer');
require("dotenv").config();

const sendVerifyEmail = async (to, userName, verifyLink) => {
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
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:36px 12px;font-family:Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
              <tr>
                <td style="padding:26px 26px 12px 26px;text-align:center;">
                  <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#64748b;font-weight:700;">Muzeer Account</div>
                  <h1 style="margin:10px 0 0 0;color:#0f172a;font-size:28px;line-height:1.25;">Verify your email</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:2px 26px 0 26px;text-align:center;color:#1e293b;font-size:18px;font-weight:600;line-height:1.4;">
                  Hello, ${userName}
                </td>
              </tr>
              <tr>
                <td style="padding:12px 26px 0 26px;text-align:center;color:#475569;font-size:15px;line-height:1.7;">
                  Thanks for registering with Muzeer. Please confirm your email address to activate your account.
                </td>
              </tr>
              <tr>
                <td style="padding:24px 26px 10px 26px;text-align:center;">
                  <a href="${verifyLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:8px;font-size:15px;font-weight:700;letter-spacing:0.2px;">
                    Verify account
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 26px 0 26px;text-align:center;color:#64748b;font-size:12px;line-height:1.6;">
                  If you didn’t request this, you can safely ignore this email.
                </td>
              </tr>
              <tr>
                <td style="padding:14px 26px 24px 26px;text-align:center;color:#94a3b8;font-size:11px;line-height:1.6;">
                  If the button doesn’t work, copy and paste this URL into your browser:<br />
                  <a href="${verifyLink}" style="color:#2563eb;text-decoration:none;word-break:break-all;">${verifyLink}</a>
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