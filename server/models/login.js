const mongoose = require("mongoose");

const loginSchema = new mongoose.Schema({
  // --- 2FA + email verify ---
  twoFactorCode: { type: String },
  twoFactorExpires: { type: Date },
  isVerified: { type: Boolean, default: false },
  verifyToken: { type: String },

  // --- basic identity ---
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

  // --- Discord link (separátně od avataru) ---
  discordId: { type: String, sparse: true },   // Discord user ID
  discordName: { type: String, default: "" },  // Discord username/nick
  discordLinkedAt: { type: Date },             // When it was linked

  // --- Presence ---
  presence: {
    title: String,
    artist: String,
    webpage_url: String,
    isPlaying: Boolean,
    startTimestamp: Number
  },

  // --- Real-time listening state ---
  currentlyPlaying: {
    title: String,
    artist: String,
    webpage_url: String,
    currentTime: Number,
    updatedAt: Date
  },

  // --- Token wallet ---
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

  // --- Profile avatar ---
  avatarUrl: { type: String, default: "" },
  avatarUpdatedAt: { type: Date }, // (doporučeno pro cooldown, můžeš zatím nevyužít)

  // --- Token claims ---
  tokenClaims: [{
    tokens: { type: Number, required: true },
    trackKey: { type: String, required: true },
    qualifiedSecondsConsumed: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
  }]

}, { timestamps: true });

module.exports = mongoose.models.Login || mongoose.model("Login", loginSchema);