const express = require('express');
const router = express.Router();
const Album = require('../models/album');
const YoutubeTrack = require('../models/youtubeTrack'); 

router.post('/import', async (req, res) => {
  try {
    const { source, url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: "Missing playlist URL" });
    }

    console.log(`📥 Starting playlist import from ${source}: ${url}`);

    // 1. Ask Python to scrape the playlist
    const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'https://media.muzeer.com';
    const pythonResponse = await fetch(`${PYTHON_SERVER_URL}/api/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, source })
    });

    if (!pythonResponse.ok) {
      const errData = await pythonResponse.json().catch(() => ({}));
      throw new Error(errData.detail || "Python server rejected the playlist import.");
    }

    const data = await pythonResponse.json();

    // 2. Cache the individual tracks in MongoDB so they load instantly next time
    if (data.tracks && data.tracks.length > 0) {
      for (const t of data.tracks) {
        if (!t.id) continue;
        await YoutubeTrack.updateOne(
          { videoId: t.id },
          {
            $set: {
              title: t.title,
              artist: t.artist,
              thumbnail: t.thumbnail,
              duration: t.duration,
              webpage_url: t.webpage_url,
              audio_url: t.audio_url,
              proxy_url: t.proxy_url,
              lastUsedAt: new Date()
            },
            // inject into search query for mongo
            $addToSet: { 
              searchQueries: { $each: [t.title, t.artist] } 
            }
          },
          { upsert: true }
        );
      }

      // 3. Save the Playlist layout to the Album model
      await Album.findOneAndUpdate(
        { youtubePlaylistId: data.playlist.id },
        {
          $set: {
            title: data.playlist.name,
            type: 'playlist',
            tracks: data.tracks.map(t => ({
              videoId: t.id,
              title: t.title,
              duration: t.duration,
              thumbnail: t.thumbnail
            })),
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
    }

    // 4. Send the perfectly formatted data back to React
    res.json(data);

  } catch (err) {
    console.error("Playlist Import Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

module.exports = router;