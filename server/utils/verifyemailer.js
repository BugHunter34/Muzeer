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
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 40px 20px; background-color: #02021a; color: white; border-radius: 10px;">
        <h1 style="color: #facc15; margin-bottom: 5px;">Welcome to Muzeer!</h1>
        <h3 style="color: #ec4899; margin-top: 0;">Hello, ${userName}</h3>
        <p style="color: rgba(255,255,255,0.7); font-size: 16px; margin-bottom: 30px;">
          Your curated soundtrack is almost ready. Please verify your email to unlock your account.
        </p>
        <a href="${verifyLink}" style="background-color: #ec4899; color: #02021a; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; transition: 0.3s;">
          Verify My Account
        </a>
        <p style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 40px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendVerifyEmail;