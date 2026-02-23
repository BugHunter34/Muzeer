const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

// GET /api/me -> vrátí aktuálně přihlášeného usera
router.get("/", auth, (req, res) => {
  return res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      userName: req.user.userName,
      role: req.user.role,
      discordId: req.user.discordId,
      discordName: req.user.discordName,
    },
  });
});

// PUT /api/me -> update profilu (zatím userName)
router.put("/", auth, async (req, res) => {
  try {
    const { userName } = req.body;

    if (typeof userName !== "string" || userName.trim().length < 2) {
      return res.status(400).json({ message: "Username must be at least 2 characters" });
    }
    if (userName.trim().length > 24) {
      return res.status(400).json({ message: "Username too long (max 24)" });
    }

    req.user.userName = userName.trim();
    await req.user.save();

    return res.json({
      message: "Profile updated",
      user: {
        id: req.user._id,
        email: req.user.email,
        userName: req.user.userName,
        role: req.user.role,
        discordId: req.user.discordId,
        discordName: req.user.discordName,
      },
    });
  } catch (err) {
    console.error("ME PUT ERROR:", err);
    return res.status(500).json({ message: "Failed to update profile", error: err.message });
  }
});

module.exports = router;