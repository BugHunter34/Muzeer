// LOGIN - Updated for Backend-Only Cookies
const Login = require("../models/login");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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

    // IMPORTANT: Send the token in the body too if your React code expects it there
    res.status(200).json({
      message: "Login successful",
      token: token, 
      user: { id: user._id, email: user.email, userName: user.userName, role: user.role }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// --- ADMIN PROTECTED ROUTES ---

// 1. Get All Users
exports.getAllUsers = async (req, res) => {
  try {
    // .find() gets all documents. 
    // .select("-passwordHash") ensures we don't accidentally send hashed passwords to the frontend.
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
    // We create a copy of the request body to update
    const updates = { ...req.body };
    
    // Security measure: Prevent changing passwords through this generic update route
    // (Password changes should require hashing and a dedicated route)
    delete updates.password;
    delete updates.passwordHash;

    const user = await Login.findByIdAndUpdate(
      req.params.id, 
      updates, 
      { new: true, runValidators: true } // 'new: true' returns the updated document, not the old one
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