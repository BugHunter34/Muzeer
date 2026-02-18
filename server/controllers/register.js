const Login = require("../models/login"); // Ujisti se, že cesta k modelu sedí
const bcrypt = require("bcryptjs");
const crypto = require("crypto"); // Vestavěný modul pro generování bezpečných kódů
const sendVerifyEmail = require("../utils/verifyemailer"); // Tvůj nový pošťák pro registrace

exports.register = async (req, res) => {
    try {
      const { email, password, userName } = req.body;
  
      // 1. Validation: Ensure all fields are present
      if (!email || !password || !userName) {
        return res.status(400).send({ error: "Missing email, password, or username" });
      }
  
      // 2. Normalization
      const normalizedEmail = email.toLowerCase().trim();
  
      // 3. Check if user already exists
      const existingUser = await Login.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(400).send({ error: "User already exists" });
      }
  
      // 4. Hash the password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
  
      // 5. NOVÉ: Vygeneruj bezpečný, unikátní token pro ověřovací link
      const verifyToken = crypto.randomBytes(32).toString('hex');
  
      // 6. Create the new user (s novými poli pro ověření)
      const newUser = new Login({
        email: normalizedEmail,
        userName: userName.trim(),
        passwordHash: passwordHash,
        role: "user", // Default role
        isVerified: false,           // Zablokováno, dokud neklikne na link
        verifyToken: verifyToken     // Uložení tokenu, abychom ho mohli později zkontrolovat
      });
  
      // 7. Save to MongoDB
      await newUser.save();
  
      // 8. NOVÉ: Vytvoř link a odešli email
      const verifyLink = `http://localhost:3000/api/auth/verify-email/${verifyToken}`;
      await sendVerifyEmail(normalizedEmail, userName, verifyLink);
  
      // 9. Success Response
      res.status(201).send({ ok: true, message: "Registration successful. Please check your email to verify your account." });
  
    } catch (err) {
      console.error("Register Error:", err);
      res.status(500).send({ error: err.message });
    }
  };