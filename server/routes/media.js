// routes/media.js

const express = require("express");
const router = express.Router();

const YoutubeTrack = require("../models/youtubeTrack");

router.post("/cache", async (req, res) => {
  try {
    const tracks = req.body?.tracks || [];

    if (!Array.isArray(tracks)) {
      return res.status(400).json({
        message: "tracks must be array"
      });
    }

    for (const track of tracks) {
      if (!track?.id) continue;

      await YoutubeTrack.updateOne(
        { videoId: track.id },
        {
          $set: {
            title: track.title,
            artist: track.artist,
            thumbnail: track.thumbnail,
            duration: track.duration,
            webpage_url: track.webpage_url,
            lastUsedAt: new Date(),
          },

          $inc: {
            plays: 1,
          },

          $addToSet: {
            searchQueries: track.searchQuery || "",
          },
        },
        { upsert: true }
      );
    }

    return res.json({
      success: true,
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "server error"
    });
  }
});

module.exports = router;