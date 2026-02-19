// LOGIN - Updated for Backend-Only Cookies
const Login = require("../models/login");
const bcrypt = require("bcrypt"); // Changed from bcryptjs to match your import
const jwt = require("jsonwebtoken");
const sendEmail = require('../utils/codeemailer');

const sanitizeUser = (user) => {
  return {
    _id: user._id,
    email: user.email,
    userName: user.userName,
    role: user.role
  };
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Login.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    // --- NEW: 2FA & VERIFICATION LOGIC STARTS HERE ---
    
    // 1. Check if they clicked the email link from registration
    if (!user.isVerified) {
      return res.status(401).json({ message: "Please verify your email first! Check your inbox." });
    }

    // 2. Generate a 6-digit code for 2FA
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 3. Save the code to the database (expires in 10 minutes)
    user.twoFactorCode = code;
    user.twoFactorExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // 4. Send the code via email using your codeemailer
    await sendEmail(user.email, code, user.role);

    // 5. Tell React to show the 2FA input box instead of logging them in!
    return res.status(200).json({
      message: "2FA code sent to email",
      requires2FA: true,
      email: user.email
    });
    
    // --- 2FA & VERIFICATION LOGIC ENDS HERE ---

  } catch (err) {
    console.error("Login Phase 1 Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// --- 2factor verification route ---
exports.verify2FA = async (req, res) => {
  try {
    const { email, code } = req.body;
    const user = await Login.findOne({ email: email.toLowerCase().trim() });

    if (!user) return res.status(401).json({ message: "User not found" });

    // 1. Zkontroluj, jestli kód sedí
    if (user.twoFactorCode !== code) {
      return res.status(401).json({ message: "Invalid verification code" });
    }

    // 2. Zkontroluj, jestli kód nevypršel
    if (user.twoFactorExpires < Date.now()) {
      return res.status(401).json({ message: "Code has expired. Please log in again." });
    }

    // 3. ÚSPĚCH! Vymaž kód z DB, ať nejde použít znovu
    user.twoFactorCode = undefined;
    user.twoFactorExpires = undefined;
    await user.save();

    // 4. TVŮJ PŮVODNÍ KÓD PRO VYTVOŘENÍ JWT A COOKIES
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS/Ngrok
      maxAge: 2 * 60 * 60 * 1000,
      sameSite: "lax",
    });

    res.status(200).json({
      message: "Login successful",
      token: token, 
      user: { id: user._id, email: user.email, userName: user.userName, role: user.role }
    });

  } catch (err) {
    console.error("Login Phase 2 Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// --- ADMIN PROTECTED ROUTES ---

// 1. Get All Users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await Login.find().select("-passwordHash");
    res.status(200).send(users);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch users", details: err.message });
  }
};

// 2. Get User by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await Login.findById(req.params.id).select("-passwordHash");
    
    if (!user) {
      return res.status(404).send({ message: "Uživatel nenalezen (User not found)" });
    }
    
    res.status(200).send(user);
  } catch (err) {
    res.status(500).send({ error: "Failed to fetch user", details: err.message });
  }
};

// 3. Update User
exports.updateUser = async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.password;
    delete updates.passwordHash;

    const user = await Login.findByIdAndUpdate(
      req.params.id, 
      updates, 
      { new: true, runValidators: true } 
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).send({ message: "Uživatel nenalezen (User not found)" });
    }

    res.status(200).send({ message: "User successfully updated", user });
  } catch (err) {
    res.status(500).send({ error: "Failed to update user", details: err.message });
  }
};

// 4. Delete User
exports.deleteUser = async (req, res) => {
  try {
    const user = await Login.findByIdAndDelete(req.params.id);
    
    if (!user) {
      return res.status(404).send({ message: "Uživatel nenalezen (User not found)" });
    }

    res.status(200).send({ message: "User successfully deleted" });
  } catch (err) {
    res.status(500).send({ error: "Failed to delete user", details: err.message });
  }
};