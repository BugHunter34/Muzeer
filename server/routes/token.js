const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const tokenController = require("../controllers/token");

router.get("/config", auth, tokenController.getConfig);
router.get("/wallet", auth, tokenController.getWallet);
router.get("/leaderboard", auth, tokenController.getSeasonLeaderboard);
router.post("/listen-event", auth, tokenController.submitListenEvent);
router.post("/claim-quest", auth, tokenController.claimQuest);
router.post("/spend", auth, tokenController.spendTokens);

module.exports = router;
