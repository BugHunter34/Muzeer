const path = require("path");
const fs = require("fs");
const multer = require("multer");
const Login = require("../models/login");
const { isBannedUsername } = require("../utils/bannedUsernames");

// -------------------- security helpers --------------------
const looksLikeInjection = (value) => {
  if (typeof value !== "string") return true;

  const s = value.trim();

  // block typical injection-ish patterns (SQL-like & general)
  if (/[;]|--|\/\*|\*\//.test(s)) return true;                 // ; -- /* */
  if (/\b(or|and)\b\s+\w+\s*=\s*\w+/i.test(s)) return true;    // OR x = y
  if (/\b\d+\s*=\s*\d+\b/.test(s)) return true;                // 1=1, 2 = 2
  if (/\b(select|insert|update|delete|drop|union)\b/i.test(s)) return true;

  // block mongo operator injection attempts
  if (s.includes("$") || s.includes("{") || s.includes("}")) return true;

  return false;
};

const cleanUsername = (v) => v.replace(/\s+/g, " ").trim();

// -------------------- multer setup --------------------
const safeFilename = (name) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = safeFilename(path.basename(file.originalname || "avatar", ext));
    cb(null, `avatar_${req.user._id}_${Date.now()}_${base}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  if (!ok) return cb(new Error("Only JPG/PNG/WEBP allowed"), false);
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

// -------------------- GET /api/auth/me --------------------

// GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    // req.user už dává auth middleware
    return res.json({ user: req.user });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/auth/me (update profile)
exports.updateMe = async (req, res) => {
  try {
    const updates = {};
    const { email, userName } = req.body;

    if (typeof email === "string") {
      const trimmed = email.trim().toLowerCase();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(trimmed);
      if (!ok) return res.status(400).json({ message: "Neplatný email." });

      const exists = await Login.findOne({ email: trimmed, _id: { $ne: req.user._id } });
      if (exists) return res.status(409).json({ message: "Tento email už někdo používá." });

      updates.email = trimmed;
    }

    if (typeof userName === "string") {
      const trimmed = userName.trim();
      if (trimmed.length < 2) return res.status(400).json({ message: "Jméno je moc krátké." });
      updates.userName = trimmed;
    }

    const updated = await Login.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-passwordHash -twoFactorCode -twoFactorExpires -verifyToken");

    return res.json({ user: updated, message: "Profil uložen." });
  } catch (err) {
    console.error("updateMe error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// -------------------- POST /api/auth/me/avatar --------------------
exports.uploadAvatar = [
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Chybí soubor." });

      const user = await Login.findById(req.user._id);
      const old = user.avatarUrl;

      // save url to Mongo
      const avatarUrl = `/uploads/${req.file.filename}`;
      user.avatarUrl = avatarUrl;
      await user.save();

      // delete old file safely (bugfix: "/uploads/..." must be relative)
      if (old && typeof old === "string" && old.startsWith("/uploads/")) {
        const oldRel = old.replace(/^\/+/, ""); // "uploads/abc.png"
        const oldPath = path.join(__dirname, "..", oldRel);
        fs.unlink(oldPath, () => {});
      }

      const fresh = await Login.findById(req.user._id).select("-passwordHash -twoFactorCode -twoFactorExpires -verifyToken");
      return res.json({ user: fresh, avatarUrl, message: "Avatar uložen." });
    } catch (err) {
      console.error("POST /api/auth/me/avatar error:", err);
      return res.status(500).json({ message: "Server error." });
    }
  }
];