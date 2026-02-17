const Login = require("../models/login"); // Ujisti se, že cesta k modelu sedí
const bcrypt = require("bcryptjs");

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
      // We use the 'Login' model you defined earlier
      const existingUser = await Login.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(400).send({ error: "User already exists" });
      }
  
      // 4. Hash the password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
  
      // 5. Create the new user
      const newUser = new Login({
        email: normalizedEmail,
        userName: userName.trim(),
        passwordHash: passwordHash,
        role: "user" // Default role
      });
  
      // 6. Save to MongoDB
      await newUser.save();
  
      // 7. Success Response
      res.status(201).send({ ok: true, message: "User created successfully" });
  
    } catch (err) {
      console.error("Register Error:", err);
      res.status(500).send({ error: err.message });
    }
  };