const express = require('express');
const router = express.Router();
const Album = require('../models/album');
const YoutubeTrack = require('../models/youtubeTrack'); // Adjust if yours is named youtubeTrack.js
const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

const SPOTIFY_MARKET = 'US';
const SPOTIFY_FALLBACK_TRACK_LIMIT = 30;

const extractSpotifyPlaylistId = (input) => {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // spotify:playlist:<id>
  const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uriMatch) return uriMatch[1];

  // https://open.spotify.com/playlist/<id>?si=...
  // also supports locale prefixes like /intl-cs/playlist/<id>
  const urlMatch = trimmed.match(/spotify\.com\/(?:intl-[a-z-]+\/)?playlist\/([a-zA-Z0-9]+)(?:\?.*)?$/i);
  if (urlMatch) return urlMatch[1];

  return null;
};

const ensureSpotifyAccessToken = async () => {
  try {
    const auth = await spotifyApi.clientCredentialsGrant();
    const token = auth?.body?.access_token;
    if (!token) throw new Error('Missing Spotify access token from credentials grant');
    spotifyApi.setAccessToken(token);
    return token;
  } catch (grantError) {
    const fallbackToken =
      process.env.SPOTIFY_ACCESS_TOKEN ||
      process.env.SPOTIFY_TOKEN ||
      process.env.SpotifyTokenForSomeReason;

    if (fallbackToken) {
      spotifyApi.setAccessToken(fallbackToken);
      return fallbackToken;
    }

    throw grantError;
  }
};

const fetchSpotifyJson = async (path, accessToken) => {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    let details = `Spotify API request failed (${response.status})`;

    try {
      const payload = await response.json();
      const apiMessage = payload?.error?.message;
      if (apiMessage) details = apiMessage;
    } catch {
      // ignore malformed Spotify error bodies
    }

    const error = new Error(`An error occurred while communicating with Spotify's Web API.\nDetails: ${details}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
};

const parseSpotifyPlaylistPage = async (playlistId) => {
  const response = await fetch(`https://open.spotify.com/playlist/${playlistId}`);
  if (!response.ok) {
    throw new Error(`Failed to load Spotify playlist page (${response.status})`);
  }

  const html = await response.text();
  const rawTitle = html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim() || '';
  const playlistName = rawTitle
    .replace(/\s*-\s*playlist\s+by\s+.*$/i, '')
    .replace(/\s*\|\s*Spotify(?:\s*Playlist)?$/i, '')
    .trim() || 'Imported Spotify Playlist';

  const trackIds = [...new Set(
    Array.from(html.matchAll(/spotify:track:([A-Za-z0-9]+)/g), (match) => match[1])
  )].slice(0, SPOTIFY_FALLBACK_TRACK_LIMIT);

  return {
    playlistName,
    trackIds
  };
};

const fetchSpotifyTrack = async (trackId, accessToken) => {
  const track = await fetchSpotifyJson(`/tracks/${trackId}?market=${SPOTIFY_MARKET}`, accessToken);

  return {
    id: track.id,
    name: track.name,
    artists: Array.isArray(track.artists)
      ? track.artists.map((artist) => ({ name: artist?.name || 'Unknown Artist' }))
      : [{ name: 'Unknown Artist' }],
    external_urls: track.external_urls || {},
    album: track.album
      ? {
          images: Array.isArray(track.album.images) ? track.album.images : []
        }
      : { images: [] },
    duration_ms: track.duration_ms || 0,
    url: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`
  };
};

const fetchSpotifyTracksFromPageFallback = async (trackIds, accessToken) => {
  const tracks = [];

  for (let index = 0; index < trackIds.length; index += 5) {
    const batch = trackIds.slice(index, index + 5);
    const batchResults = await Promise.all(
      batch.map(async (trackId) => {
        try {
          return await fetchSpotifyTrack(trackId, accessToken);
        } catch (error) {
          console.warn(`Failed to fetch Spotify track ${trackId}:`, error?.message || error);
          return null;
        }
      })
    );

    tracks.push(...batchResults.filter(Boolean));
  }

  return tracks;
};

// --- THE BACKGROUND WORKER ---
// This function runs completely detached from the HTTP request!
async function processBackgroundImport(playlistId, tracksToProcess, source) {
  console.log(`🚀 Background worker started for ${playlistId}. Processing ${tracksToProcess.length} tracks...`);
  const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'https://media.muzeer.com';

  try {
    // Process in batches of 4 to be fast but not crash Python
    for (let i = 0; i < tracksToProcess.length; i += 4) {
      const batch = tracksToProcess.slice(i, i + 4);
      
      const promises = batch.map(async (track) => {
        let query = "";
        
        // Handle Spotify vs YouTube raw track data formatting
        if (source === 'spotify') {
          const artistName = track.artists[0]?.name || "Unknown Artist";
          query = `${track.name} ${artistName} official audio`;
        } else {
          query = track.url || track.title; 
        }

        try {
          const pyRes = await fetch(`${PYTHON_SERVER_URL}/api/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
          });

          if (pyRes.ok) {
            const ytResults = await pyRes.json();
            if (ytResults && ytResults.length > 0) return ytResults[0];
          }
        } catch (err) {
          console.warn(`⚠️ Background Worker failed to convert: ${query}`);
        }
        return null;
      });

      const convertedTracks = (await Promise.all(promises)).filter(Boolean);

      // Save each converted track to the global database
      for (const t of convertedTracks) {
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
            $addToSet: { searchQueries: { $each: [t.title, t.artist] } }
          },
          { upsert: true }
        );

        // Push the newly converted track into the Album instantly
        await Album.updateOne(
          { youtubePlaylistId: playlistId },
          { 
            $push: { 
              tracks: {
                videoId: t.id,
                title: t.title,
                duration: t.duration,
                thumbnail: t.thumbnail
              } 
            },
            $set: { lastUpdated: new Date() }
          }
        );
      }
      
      console.log(`⏳ Progress: ${Math.min(i + 4, tracksToProcess.length)} / ${tracksToProcess.length} tracks imported into ${playlistId}`);
    }

    // Mark the playlist as fully complete!
    await Album.updateOne(
      { youtubePlaylistId: playlistId },
      { $set: { status: 'ready' } }
    );
    console.log(`✅ Background import completely finished for ${playlistId}!`);

  } catch (error) {
    console.error(`❌ Background Worker crashed for ${playlistId}:`, error);
    await Album.updateOne({ youtubePlaylistId: playlistId }, { $set: { status: 'failed' } });
  }
}


// --- THE FAST HTTP ROUTE ---
router.post('/import', async (req, res) => {
  try {
    const { source, url } = req.body;
    if (!url) return res.status(400).json({ error: "Missing playlist URL" });

    let playlistId = "";
    let playlistName = "";
    let rawTracks = [];
    let importMessage = "";

    // 1. QUICKLY GRAB METADATA
    if (source === 'spotify') {
      const accessToken = await ensureSpotifyAccessToken();

      const rawId = extractSpotifyPlaylistId(url);
      if (!rawId) throw new Error("Invalid Spotify URL");

      const playlistPageData = await parseSpotifyPlaylistPage(rawId);
      playlistId = `spotify-${rawId}`;
      playlistName = playlistPageData.playlistName;

      if (!playlistPageData.trackIds.length) {
        throw new Error('Spotify playlist page did not expose any track IDs.');
      }

      rawTracks = await fetchSpotifyTracksFromPageFallback(playlistPageData.trackIds, accessToken);
      if (!rawTracks.length) {
        throw new Error('Failed to fetch any Spotify track metadata from the playlist page fallback.');
      }

      importMessage = `Spotify restricted direct playlist access. Importing ${rawTracks.length} publicly visible tracks from the playlist page.`;

    } else {
      // YouTube Logic (Requires a slight refactor to just get the track URLs quickly from Python)
      // For now, if the user imports a 1000 song YT playlist, Python will block this for a bit. 
      // But the logic is exactly the same!
      const PYTHON_SERVER_URL = process.env.PYTHON_SERVER_URL || 'https://media.muzeer.com';
      const pythonResponse = await fetch(`${PYTHON_SERVER_URL}/api/playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, source })
      });
      if (!pythonResponse.ok) throw new Error("Python rejected import");
      const pyData = await pythonResponse.json();
      playlistId = pyData.playlist.id;
      playlistName = pyData.playlist.name;
      rawTracks = pyData.tracks;
    }

    // 2. CREATE THE PLACEHOLDER PLAYLIST IN MONGODB
    const existingPlaylist = await Album.findOne({ youtubePlaylistId: playlistId });
    if (!existingPlaylist) {
      await Album.create({
        youtubePlaylistId: playlistId,
        title: playlistName,
        type: 'playlist',
        status: 'processing', // Marks it as downloading!
        tracks: [],
      });
    }

    // 3. RESPOND TO THE FRONTEND INSTANTLY
    res.json({
      success: true,
      playlist: { id: playlistId, name: playlistName, status: 'processing' },
      message: importMessage || `Importing ${rawTracks.length} tracks in the background. You can close this window!`
    });

    // 4. FIRE AND FORGET THE BACKGROUND WORKER
    // Notice there is NO 'await' here!
    processBackgroundImport(playlistId, rawTracks, source);

  } catch (err) {
    console.error("Import API Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- FETCH PLAYLIST DATA ROUTE ---
// Your frontend will call this to get the updated songs!
router.get('/:id', async (req, res) => {
  try {
    const playlist = await Album.findOne({ youtubePlaylistId: req.params.id });
    if (!playlist) return res.status(404).json({ error: "Playlist not found" });
    
    // Grab the actual streamable data for the tracks from the DB
    const populatedTracks = await YoutubeTrack.find({ 
      videoId: { $in: playlist.tracks.map(t => t.videoId) } 
    });

    res.json({
      playlist: { id: playlist.youtubePlaylistId, name: playlist.title, status: playlist.status },
      tracks: populatedTracks
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;