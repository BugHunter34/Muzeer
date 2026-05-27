const express = require("express");
const router = express.Router();
const YoutubeTrack = require("../models/youtubeTrack");

router.get("/search", async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: "Missing query" });
  }

  try {
    const dbResults = await YoutubeTrack.find({
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { artist: { $regex: query, $options: 'i' } },
        { searchQueries: { $regex: query, $options: 'i' } }
      ]
    }).limit(15);

    if (dbResults.length >= 3) {
      const formattedResults = dbResults.map(track => ({
        id: track.videoId,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        duration: track.duration,
        webpage_url: track.webpage_url,
        audio_url: track.audio_url,
        proxy_url: track.proxy_url || ""
      }));
      return res.json({ source: 'database', results: formattedResults });
    }

    const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'http://localhost:5000';
    
    const pythonResponse = await fetch(`${PYTHON_SERVER_URL}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    if (!pythonResponse.ok) {
      throw new Error("Python server error");
    }

    const tracks = await pythonResponse.json();
    const normalizedTracks = Array.isArray(tracks) ? tracks : [];
    
    for (const track of normalizedTracks) {
      if (!track.id) continue;

      await YoutubeTrack.updateOne(
        { videoId: track.id },
        {
          $set: {
            title: track.title,
            artist: track.artist,
            thumbnail: track.thumbnail,
            duration: track.duration,
            webpage_url: track.webpage_url,
            audio_url: track.audio_url,
            proxy_url: track.proxy_url,
            lastUsedAt: new Date(),
          },
          $inc: { plays: 0 },
          $addToSet: { searchQueries: query }
        },
        { upsert: true }
      );
    }

    return res.json({ source: 'youtube', results: normalizedTracks });

  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

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
    return res.status(500).json({
      message: "server error"
    });
  }
});

module.exports = router;