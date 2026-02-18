// utils/sendEmail.js
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
    subject: 'Muzeer - Your 2FA Login Code',
    html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px; background-color: #02021a; color: white;">
        <h2 style="color: #ec4899;">Muzeer Security</h2>
        <p>Your login verification code is:</p>
        <h1 style="font-size: 40px; letter-spacing: 5px; color: #facc15;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;