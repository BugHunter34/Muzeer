// LOGIN - Updated for Backend-Only Cookies
const Login = require("../models/Login");
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

    if (!email || !password) {
      return res.status(400).send({ message: "Chybí email nebo heslo" });
    }

    const user = await Login.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).send({ message: "Špatné přihlašovací údaje" });
    }

 const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
     return res.status(401).send({ message: "Špatné přihlašovací údaje" });
}

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    // --- NEW: SET COOKIE INSTEAD OF JUST SENDING TOKEN ---
    res.cookie("token", token, {
      httpOnly: true,       // Cannot be accessed by frontend JS (XSS Protection)
      secure: false,        // Set to true in production (requires HTTPS)
      maxAge: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
      sameSite: "lax",      // Helps against CSRF
    });

    res.status(200).send({
      message: "Login successful",
      // We still send user data, but the token is now in the browser's cookie jar
      user: sanitizeUser(user) 
    });

  } catch (err) {
    res.status(500).send({ error: err.message });
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