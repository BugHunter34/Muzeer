const express = require('express');
const router = express.Router();
const artistController = require('../controllers/artist');


router.get('/info', artistController.getArtistInfo);

module.exports = router;