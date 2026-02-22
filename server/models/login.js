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
    enum: ["user", "admin", "owner"], 
    default: "user" 
  },
  discordId: { type: String, sparse: true }, // To link the accounts
  presence: {
    title: String,
    artist: String,
    webpage_url: String,
    isPlaying: Boolean,
    startTimestamp: Number // The exact UNIX time the song started (or resumed)
  },

  // 2. Real-time listening state
  currentlyPlaying: {
    title: String,
    artist: String,
    webpage_url: String, // Link to the music
    currentTime: Number,
    updatedAt: Date
  },

  tokenWallet: {
    symbol: { type: String, default: "MUZR" },
    balance: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    lastClaimAt: { type: Date }
  },

  rewardState: {
    totalQualifiedSeconds: { type: Number, default: 0 },
    pendingQualifiedSeconds: { type: Number, default: 0 },
    lastRewardedTrackKey: { type: String, default: "" },
    lastRewardAt: { type: Date },
    lastListenEventAt: { type: Date },
    rewardDayKey: { type: String, default: "" },
    rewardedSecondsToday: { type: Number, default: 0 }
  },

  tokenClaims: [{
    tokens: { type: Number, required: true },
    trackKey: { type: String, required: true },
    qualifiedSecondsConsumed: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.models.Login || mongoose.model("Login", loginSchema);