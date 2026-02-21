const express = require("express");
const router = express.Router();

// 1. Importujeme oba controllery
const LoginController = require("../controllers/login");
const RegisterController = require("../controllers/register"); // Tady načítáme ten tvůj nový soubor
const authController = require("../controllers/presence"); // Pro aktualizaci přítomnosti

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

// --- PUBLIC ROUTES (Veřejné) ---
// Login je v souboru controllers/login.js
router.post("/login", LoginController.login);


router.post("/register", RegisterController.register); 

// 2Fac
router.post('/login/verify-2fa', LoginController.verify2FA);

// --- PRESENCE SYNC ENDPOINT ---
router.post('/presence', auth, authController.updatePresence);

  
// --- PROTECTED ROUTES (Admin) ---
// Tyto funkce jsou (zatím) definované v LoginControlleru (jak jsme řešili dříve)
router.get("/", auth, admin, LoginController.getAllUsers);
router.get("/:id", auth, admin, LoginController.getUserById);
router.put("/:id", auth, admin, LoginController.updateUser);
router.delete("/:id", auth, admin, LoginController.deleteUser);

module.exports = router;