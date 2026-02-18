const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');   
const admin = require('../middleware/admin'); 
const Login = require('../models/login');     

// 1. GET ALL USERS
router.get('/users', [auth, admin], async (req, res) => {
  try {
    const allUsers = await Login.find().select('-passwordHash');
    // Ensure we are sending a pure array for React's .map()
    res.json(allUsers); 
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 2. TOGGLE ADMIN ROLE
router.patch('/users/:id/role', [auth, admin], async (req, res) => {
  try {
    const userToUpdate = await Login.findById(req.params.id);
    if (!userToUpdate) return res.status(404).json({ message: "User not found" });
    
    // Prevent the admin from demoting themselves!
    if (userToUpdate._id.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot demote yourself!" });
    }

    userToUpdate.role = userToUpdate.role === 'admin' ? 'user' : 'admin';
    await userToUpdate.save();
    
    res.json({ message: "Role updated", user: userToUpdate });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 3. NUKE USER (DELETE)
router.delete('/users/:id', [auth, admin], async (req, res) => {
  try {
    // Prevent the admin from deleting themselves!
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You cannot nuke yourself!" });
    }

    await Login.findByIdAndDelete(req.params.id);
    res.json({ message: "User eradicated" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;