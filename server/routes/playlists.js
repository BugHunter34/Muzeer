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
const SPOTIFY_FALLBACK_TRACK_LIMIT = 150;
const SPOTIFY_CACHE_TTL_DAYS = 7; // Cache Spotify metadata for 7 days

const normalizeSpotifyTrack = (track) => ({
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
});

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

const getSpotifyPlaylistCache = async (spotifyPlaylistId) => {
  const cacheKey = `spotify-cache-${spotifyPlaylistId}`;
  const cached = await Album.findOne({ youtubePlaylistId: cacheKey, type: 'spotify_cache' });
  
  if (cached && cached.cachedAt) {
    const ageInDays = (Date.now() - cached.cachedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < SPOTIFY_CACHE_TTL_DAYS) {
      console.log(`✅ Using cached Spotify playlist data (${ageInDays.toFixed(1)} days old)`);
      return { playlistName: cached.title, trackIds: cached.cachedTrackIds, tracks: cached.cachedTracks };
    }
  }
  return null;
};

const cacheSpotifyPlaylist = async (spotifyPlaylistId, playlistName, trackIds, tracks) => {
  const cacheKey = `spotify-cache-${spotifyPlaylistId}`;
  await Album.updateOne(
    { youtubePlaylistId: cacheKey },
    {
      $set: {
        type: 'spotify_cache',
        title: playlistName,
        cachedTrackIds: trackIds,
        cachedTracks: tracks,
        cachedAt: new Date(),
        status: 'cached'
      }
    },
    { upsert: true }
  );
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

const fetchSpotifyPlaylistFromApi = async (playlistId, accessToken) => {
  const playlist = await fetchSpotifyJson(`/playlists/${playlistId}?market=${SPOTIFY_MARKET}`, accessToken);
  const playlistName = playlist?.name?.trim() || 'Imported Spotify Playlist';
  const tracks = [];
  const seenTrackIds = new Set();
  const limit = 100;
  let offset = 0;

  while (true) {
    const page = await fetchSpotifyJson(
      `/playlists/${playlistId}/tracks?market=${SPOTIFY_MARKET}&limit=${limit}&offset=${offset}`,
      accessToken
    );

    const items = Array.isArray(page?.items) ? page.items : [];
    for (const item of items) {
      const track = item?.track;
      if (!track?.id || seenTrackIds.has(track.id)) continue;
      seenTrackIds.add(track.id);
      tracks.push(normalizeSpotifyTrack(track));
    }

    if (items.length < limit) break;
    offset += limit;

    if (typeof page?.total === 'number' && offset >= page.total) break;
  }

  return {
    playlistName,
    trackIds: tracks.map((track) => track.id),
    tracks
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
  const MAX_RETRIES = 2; // Retry failed conversions up to 2 times

  try {
    // Process in batches of 8 (increased from 4 for faster throughput)
    for (let i = 0; i < tracksToProcess.length; i += 8) {
      const batch = tracksToProcess.slice(i, i + 8);
      
      const promises = batch.map(async (track, _retryCount = 0) => {
        let query = "";
        
        // Handle Spotify vs YouTube raw track data formatting
        if (source === 'spotify') {
          const artistName = track.artists[0]?.name || "Unknown Artist";
          query = `${track.name} ${artistName} official audio`;
        } else {
          query = track.url || track.title; 
        }

        // Retry loop: try up to MAX_RETRIES times
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            const pyRes = await fetch(`${PYTHON_SERVER_URL}/api/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query })
            });

            if (pyRes.ok) {
              const ytResults = await pyRes.json();
              if (ytResults && ytResults.length > 0) return ytResults[0];
            } else if (attempt < MAX_RETRIES) {
              // Exponential backoff: 1s, 2s, 4s
              const delayMs = 1000 * Math.pow(2, attempt);
              console.warn(`⚠️ Retrying track (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${query}`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue;
            }
          } catch (err) {
            if (attempt < MAX_RETRIES) {
              const delayMs = 1000 * Math.pow(2, attempt);
              console.warn(`⚠️ Retrying track after error (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${query}`);
              await new Promise(resolve => setTimeout(resolve, delayMs));
              continue;
            }
            console.warn(`❌ Background Worker failed to convert after ${MAX_RETRIES + 1} attempts: ${query}`);
          }
        }
        return {
          failed: true,
          title: source === 'spotify'
            ? (track?.name || 'Unknown title')
            : (track?.title || 'Unknown title'),
          artist: source === 'spotify'
            ? (track?.artists?.[0]?.name || 'Unknown Artist')
            : (track?.artist || track?.channel || 'Unknown Artist'),
          query
        };
      });

      const batchResults = await Promise.all(promises);
      const convertedTracks = batchResults.filter((item) => item && !item.failed);
      const failedTracks = batchResults.filter((item) => item && item.failed);

      // Batch-insert/upsert all converted tracks at once (instead of N updateOne calls)
      if (convertedTracks.length > 0) {
        const youtubeOpsForInsert = convertedTracks
          .filter(t => t.id)
          .map(t => ({
            updateOne: {
              filter: { videoId: t.id },
              update: {
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
              upsert: true
            }
          }));

        if (youtubeOpsForInsert.length > 0) {
          await YoutubeTrack.bulkWrite(youtubeOpsForInsert, { ordered: false });
        }

        // Batch-push all converted tracks to Album at once
        const tracksToAdd = convertedTracks
          .filter(t => t.id)
          .map(t => ({
            videoId: t.id,
            title: t.title,
            duration: t.duration,
            thumbnail: t.thumbnail,
            status: 'ready'
          }));

        if (tracksToAdd.length > 0) {
          await Album.updateOne(
            { youtubePlaylistId: playlistId },
            { 
              $push: { tracks: { $each: tracksToAdd } },
              $set: { lastUpdated: new Date() }
            }
          );
        }
      }

      // Batch-push all failed tracks at once
      if (failedTracks.length > 0) {
        const failedTracksToAdd = failedTracks.map(failedTrack => ({
          videoId: `failed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: failedTrack.title || 'Unknown title',
          duration: 0,
          thumbnail: null,
          artist: failedTrack.artist || 'Unknown Artist',
          status: 'failed',
          failureReason: 'Track conversion failed'
        }));

        await Album.updateOne(
          { youtubePlaylistId: playlistId },
          {
            $push: { tracks: { $each: failedTracksToAdd } },
            $set: { lastUpdated: new Date() }
          }
        );
      }
      
      console.log(`⏳ Progress: ${Math.min(i + 8, tracksToProcess.length)} / ${tracksToProcess.length} tracks imported into ${playlistId}`);
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
    let expectedTrackCount = 0;
    let importMessage = "";

    // 1. QUICKLY GRAB METADATA (WITH CACHING)
    if (source === 'spotify') {
      const rawId = extractSpotifyPlaylistId(url);
      if (!rawId) throw new Error("Invalid Spotify URL");

      playlistId = `spotify-${rawId}`;
      
      // Check cache first
      const cachedData = await getSpotifyPlaylistCache(rawId);
      if (cachedData) {
        playlistName = cachedData.playlistName;
        rawTracks = cachedData.tracks;
        expectedTrackCount = rawTracks.length;
        importMessage = `✨ Using cached metadata: ${rawTracks.length} tracks from Spotify.`;
      } else {
        const accessToken = await ensureSpotifyAccessToken();
        
        try {
          const spotifyApiData = await fetchSpotifyPlaylistFromApi(rawId, accessToken);
          playlistName = spotifyApiData.playlistName;
          rawTracks = spotifyApiData.tracks;

          if (!rawTracks.length) {
            throw new Error('Spotify playlist API returned no tracks.');
          }

          expectedTrackCount = rawTracks.length;
          importMessage = `Imported ${rawTracks.length} tracks from Spotify.`;
          
          // Cache the metadata for faster future imports
          await cacheSpotifyPlaylist(rawId, playlistName, spotifyApiData.trackIds, rawTracks);
        } catch (apiError) {
          const playlistPageData = await parseSpotifyPlaylistPage(rawId);
          playlistName = playlistPageData.playlistName;

          if (!playlistPageData.trackIds.length) {
            throw new Error('Spotify playlist page did not expose any track IDs.');
          }

          rawTracks = await fetchSpotifyTracksFromPageFallback(playlistPageData.trackIds, accessToken);
          if (!rawTracks.length) {
            throw new Error('Failed to fetch any Spotify track metadata from the playlist page fallback.');
          }

          expectedTrackCount = rawTracks.length;

          importMessage = `Spotify API was unavailable, so ${rawTracks.length} publicly visible tracks were imported from the playlist page.`;
          console.warn('Spotify API playlist import fell back to page scraping:', apiError?.message || apiError);
          
          // Cache the fallback data as well
          await cacheSpotifyPlaylist(rawId, playlistName, playlistPageData.trackIds, rawTracks);
        }
      }

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
      expectedTrackCount = Array.isArray(pyData.tracks) ? pyData.tracks.length : 0;
    }

    // 2. CREATE OR RESET THE PLACEHOLDER PLAYLIST IN MONGODB
    await Album.updateOne(
      { youtubePlaylistId: playlistId },
      {
        $set: {
          title: playlistName,
          type: 'playlist',
          status: 'processing',
          expectedTrackCount,
          tracks: [],
          lastUpdated: new Date()
        }
      },
      { upsert: true }
    );

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

    const populatedTrackById = new Map(populatedTracks.map((track) => [track.videoId, track]));
    const readyTracks = playlist.tracks
      .map((track, index) => {
        if (track?.status === 'failed') {
          return {
            id: track.videoId || `failed-${playlist.youtubePlaylistId}-${index}`,
            title: track.title || 'Unknown title',
            artist: track.artist || 'Unknown Artist',
            thumbnail: track.thumbnail || null,
            duration: track.duration || 0,
            webpage_url: null,
            audio_url: null,
            proxy_url: null,
            state: 'failed',
            failureReason: track.failureReason || 'Track conversion failed',
            order: index
          };
        }

        const populated = populatedTrackById.get(track.videoId);
        if (!populated) return null;

        return {
          id: populated.videoId,
          title: populated.title,
          artist: populated.artist,
          thumbnail: populated.thumbnail,
          duration: populated.duration,
          webpage_url: populated.webpage_url,
          audio_url: populated.audio_url,
          proxy_url: populated.proxy_url,
          state: 'ready',
          order: index
        };
      })
      .filter(Boolean);

    const failedCount = readyTracks.filter((track) => track.state === 'failed').length;
    const loadedCount = readyTracks.filter((track) => track.state === 'ready').length;

    const expectedTrackCount = Math.max(playlist.expectedTrackCount || 0, readyTracks.length);
    const pendingCount = Math.max(0, expectedTrackCount - readyTracks.length);
    const pendingTracks = Array.from({ length: pendingCount }, (_, idx) => ({
      id: `pending-${playlist.youtubePlaylistId}-${idx + 1}`,
      title: `Loading track ${readyTracks.length + idx + 1}`,
      artist: 'Import in progress',
      thumbnail: null,
      duration: 0,
      webpage_url: null,
      audio_url: null,
      proxy_url: null,
      state: 'pending',
      order: readyTracks.length + idx
    }));

    const orderedTracks = [...readyTracks, ...pendingTracks];

    res.json({
      playlist: {
        id: playlist.youtubePlaylistId,
        name: playlist.title,
        status: playlist.status,
        expectedTrackCount,
        loadedTrackCount: loadedCount,
        pendingTrackCount: pendingCount,
        failedTrackCount: failedCount
      },
      tracks: orderedTracks
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;