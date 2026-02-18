const mongoose = require("mongoose");

const loginSchema = new mongoose.Schema({
  // Add this inside your loginSchema:
  twoFactorCode: { type: String },
  twoFactorExpires: { type: Date },
  isVerified: { type: Boolean, default: false },
  verifyToken: { type: String },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  userName: { 
    type: String, 
    required: true, 
    trim: true 
  },
   passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    enum: ["user", "admin"], 
    default: "user" 
  }
}, { timestamps: true });

module.exports = mongoose.models.Login || mongoose.model("Login", loginSchema);