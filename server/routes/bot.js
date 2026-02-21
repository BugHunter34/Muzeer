const express = require('express');
const router = express.Router();

// Import your controller and middleware
const discordController = require('../controllers/discord');
const authMiddleware = require('../middleware/auth'); 

// GET request for the Python Bot (No auth needed, just fetching public info)
router.get('/listening/:discordId', discordController.getListeningStatus);

// POST request for the React Frontend (Requires authMiddleware to know WHO is linking)
router.post('/link-discord', authMiddleware, discordController.linkDiscord);

module.exports = router;