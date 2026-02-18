const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');   // Checks if logged in
const admin = require('../middleware/admin'); // Checks if admin
const Login = require('../models/login');     // Your database model

// GET /api/admin/users
// Notice we use BOTH middlewares: [auth, admin]
router.get('/users', [auth, admin], async (req, res) => {
  try {
    // Fetch all users, but DO NOT send password hashes back!
    const allUsers = await Login.find().select('-passwordHash');
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;