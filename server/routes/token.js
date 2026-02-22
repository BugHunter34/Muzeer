const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const tokenController = require("../controllers/token");

router.get("/config", auth, tokenController.getConfig);
router.get("/wallet", auth, tokenController.getWallet);
router.post("/listen-event", auth, tokenController.submitListenEvent);

module.exports = router;
