// server/routes/login.js
const express = require("express");
const router = express.Router();

const LoginController = require("../controllers/login");
const RegisterController = require("../controllers/register");
const presenceController = require("../controllers/presence");
const meController = require("../controllers/me");

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

// PUBLIC
router.post("/login", LoginController.login);
router.post("/register", RegisterController.register);
router.post("/login/verify-2fa", LoginController.verify2FA);

// ✅ PROFILE (NORMAL USER) — auth ONLY
router.get("/me", auth, meController.getMe);
router.patch("/me", auth, meController.updateMe);
router.post("/me/avatar", auth, meController.uploadAvatar); // pokud to máš

// presence
router.post("/presence", auth, presenceController.updatePresence);

// ADMIN ONLY — až dole
router.get("/", auth, admin, LoginController.getAllUsers);
router.get("/:id", auth, admin, LoginController.getUserById);
router.put("/:id", auth, admin, LoginController.updateUser);
router.delete("/:id", auth, admin, LoginController.deleteUser);

module.exports = router;