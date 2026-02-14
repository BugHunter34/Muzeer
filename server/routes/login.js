const express = require("express");
const router = express.Router();

const LoginController = require("../controllers/login");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

// AUTH
router.post("/logout", LoginController.logout);
router.post("/register", LoginController.register);
router.post("/login", LoginController.login);

// ADMIN USER MANAGEMENT
router.get("/", auth, admin, LoginController.getAllUsers);
router.get("/:id", auth, admin, LoginController.getUserById);
router.put("/:id", auth, admin, LoginController.updateUser);
router.delete("/:id", auth, admin, LoginController.deleteUser);

module.exports = router;
