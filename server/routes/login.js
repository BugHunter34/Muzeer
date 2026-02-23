const express = require("express");
const router = express.Router();

const LoginController = require("../controllers/login");
const RegisterController = require("../controllers/register");
const presenceController = require("../controllers/presence");
const meController = require("../controllers/me");

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");


// ----------------------
// PUBLIC
// ----------------------
router.post("/login", LoginController.login);
router.post("/register", RegisterController.register);
router.post("/login/verify-2fa", LoginController.verify2FA);

// ----------------------
// NORMAL USER (Profile)
// ----------------------
router.get("/me", auth, meController.getMe);
router.patch("/me", auth, meController.updateMe);
// pokud máš avatar upload v controlleru:
router.post("/me/avatar", auth, meController.uploadAvatar);

// ----------------------
// PRESENCE
// ----------------------
router.post("/presence", auth, presenceController.updatePresence);

// ----------------------
// ADMIN ONLY  (✅ prefix /users)
// ----------------------
router.get("/users", auth, admin, LoginController.getAllUsers);
router.get("/users/:id", auth, admin, LoginController.getUserById);
router.put("/users/:id", auth, admin, LoginController.updateUser);
router.delete("/users/:id", auth, admin, LoginController.deleteUser);

module.exports = router;