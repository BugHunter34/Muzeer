import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import './App.css'
import './index.css'
import { FaPlay, FaPause, FaVolumeUp, FaPlus, FaHeart, FaSearch, FaSlidersH, FaTrash, FaRedo, FaRetweet, FaBan, FaCloudDownloadAlt } from 'react-icons/fa'
import { MdQueueMusic } from 'react-icons/md'
import TokenCompartment from './components/TokenCompartment'
import { API_BASE_URL, API_ORIGIN, MEDIA_API_BASE_URL, toAbsoluteApiUrl } from './config'

// Add this to your CSS or a style tag to force icons to show
const iconStyle = { display: 'inline-block', visibility: 'visible', opacity: 1 };

const DEFAULT_TOKEN_WALLET = {
  symbol: 'MUZR',
  balance: 0,
  totalEarned: 0,
  pendingQualifiedSeconds: 0,
  qualifiedSecondsPerToken: 180,
  remainingSecondsToNextToken: 180,
  remainingMinutesToNextToken: 3,
  estimatedPendingTokens: 0,
  rewardedSecondsToday: 0,
  dailyRemainingSeconds: 0,
  dailyListenSecondsToday: 0,
  dailyCapSeconds: 7200,
  capProgressPercent: 0,
  streakDays: 0,
  suspiciousScore: 0,
  progressToNextToken: 0,
  tier: { name: 'Starter', multiplierHint: '+10% max streak' },
  quests: [],
  spendCatalog: [],
  recentClaims: [],
  rewardsPaused: false,
  activeEffects: []
}

const detectLowPowerDevice = () => {
  if (typeof window === 'undefined') return false

  const nav = window.navigator
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection
  const lowCpu = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4
  const saveData = Boolean(connection?.saveData)

    const reducedMotion = Boolean(
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    )

    return lowCpu || lowMemory || saveData || reducedMotion
  }

const storageGet = (key) => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

const storageSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore blocked storage in restrictive TV webviews
  }
}

const storageRemove = (key) => {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore blocked storage in restrictive TV webviews
  }
}

const PLAYER_STATE_KEY = 'muzeer-player-state'

const DEFAULT_PLAYLISTS = [
  { id: 'daily-mix-1', name: 'Daily Mix 1', tracks: [] },
  { id: 'chill-focus', name: 'Chill Focus', tracks: [] }
]

function App() {
  const [appName] = useState('Muzeer')
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const serverBase = API_ORIGIN;

  // --- Google OAuth callback handler ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('googleAuth')) return;
    // Strip the param from URL without reload
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    // Fetch user object using the cookie that was set by the backend
    fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          const u = data.user;
          storageSet('user', JSON.stringify({ _id: u._id, email: u.email, userName: u.userName, role: u.role }));
          window.dispatchEvent(new Event('userUpdated'));
        }
      })
      .catch(() => {});
  }, []);

  // Ôťů 1) Sync user (localStorage + event userUpdated + storage)
  useEffect(() => {
    const syncUser = () => {
      try {
        const savedUser = storageGet('user');
        setUser(savedUser ? JSON.parse(savedUser) : null);
      } catch {
        setUser(null);
      }
    };

    syncUser();
    window.addEventListener("userUpdated", syncUser);
    window.addEventListener("storage", syncUser);

    return () => {
      window.removeEventListener("userUpdated", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  // Ôťů Avatar URL helper (for sidebar etc.)
  const avatarSrc =
    user?.avatarUrl
      ? (user.avatarUrl.startsWith("http")
        ? user.avatarUrl
        : toAbsoluteApiUrl(user.avatarUrl))
      : "";

  // --- Data State ---
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [visibleSearchCount, setVisibleSearchCount] = useState(0)
  const [searchProgress, setSearchProgress] = useState(0)
  const [searchProgressTarget, setSearchProgressTarget] = useState(0)
  const [isSearchResultsOpen, setIsSearchResultsOpen] = useState(false)
  const [featuredSongs, setFeaturedSongs] = useState([]) // Trending
  const [quickPicks, setQuickPicks] = useState([]) // Most Played
  const [loading, setLoading] = useState(false)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenWallet, setTokenWallet] = useState(DEFAULT_TOKEN_WALLET)
  const [tokenLeaderboard, setTokenLeaderboard] = useState([])

  // --- Theme State ---
  const [themeOpen, setThemeOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false)
  const [accentStart, setAccentStart] = useState('#3bf0d1')
  const [accentEnd, setAccentEnd] = useState('#ffb454')
  const [speakerGlow, setSpeakerGlow] = useState('#3bf0d1')
  const [intensity, setIntensity] = useState(1)
  const [potatoMode, setPotatoMode] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = storageGet('muzeer-potato-mode')
    if (saved === '1') return true
    if (saved === '0') return false
    return detectLowPowerDevice()
  })
  const [textCutoutMode, setTextCutoutMode] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = storageGet('muzeer-text-cutout-mode')
    if (saved === '0') return false
    return true
  })

  // --- Playlist & Queue State ---
  const [playlists, setPlaylists] = useState(DEFAULT_PLAYLISTS)
  const [activePlaylistId, setActivePlaylistId] = useState(DEFAULT_PLAYLISTS[0].id)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [importSource, setImportSource] = useState('youtube')
  const [importUrl, setImportUrl] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState('')
  const [importStatus, setImportStatus] = useState('')
  const [rightPanelMode, setRightPanelMode] = useState('queue')
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [playbackSource, setPlaybackSource] = useState('queue')
  const [playlistPlaybackTracks, setPlaylistPlaybackTracks] = useState([])
  const [playlistPlaybackIndex, setPlaylistPlaybackIndex] = useState(0)

  // --- Audio Player State ---
  const audioRef = useRef(null);
  if (!audioRef.current) {
    const sharedAudio = typeof window !== 'undefined' ? window.__muzeerAudio : null
    if (sharedAudio) {
      audioRef.current = sharedAudio
    } else {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = "anonymous";
      if (typeof window !== 'undefined') {
        window.__muzeerAudio = audioRef.current
      }
    }
  }
  const ambienceRef = useRef(null)
  const wavesRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const dataArrayRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const rafRef = useRef(null)
  const lastVizFrameRef = useRef(0)
  const silentAnalyserFramesRef = useRef(0)
  const forceAnimateRef = useRef(false)
  const searchRevealTimerRef = useRef(null)
  const searchFetchProgressTimerRef = useRef(null)
  const searchFinalizeProgressTimerRef = useRef(null)
  const searchSmoothProgressTimerRef = useRef(null)
  const tokenTickAtRef = useRef(Date.now())
  const loopModeRef = useRef(0)
  const queueRef = useRef([])
  const queueIndexRef = useRef(0)
  const playbackSourceRef = useRef('queue')
  const playlistPlaybackTracksRef = useRef([])
  const playlistPlaybackIndexRef = useRef(0)
  const currentTrackRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loopMode, setLoopMode] = useState(0) // 0: no loop, 1: loop all, 2: loop one
  const [currentTrack, setCurrentTrack] = useState({
    title: 'Select a track',
    artist: '...',
    thumbnail: null,
    audio_url: null
  })

  useEffect(() => {
    loopModeRef.current = loopMode
  }, [loopMode])

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    queueIndexRef.current = queueIndex
  }, [queueIndex])

  useEffect(() => {
    playbackSourceRef.current = playbackSource
  }, [playbackSource])

  useEffect(() => {
    playlistPlaybackTracksRef.current = playlistPlaybackTracks
  }, [playlistPlaybackTracks])

  useEffect(() => {
    playlistPlaybackIndexRef.current = playlistPlaybackIndex
  }, [playlistPlaybackIndex])

  useEffect(() => {
    currentTrackRef.current = currentTrack
  }, [currentTrack])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const raw = storageGet(PLAYER_STATE_KEY)
    if (!raw) return

    try {
      const saved = JSON.parse(raw)
      if (!saved || !saved.title || saved.title === 'Select a track') return

      setCurrentTrack((prev) => ({
        ...prev,
        ...sanitizeTrackForPlayback(saved)
      }))

      applyThemeFromImage(saved.thumbnail, saved)

      if (typeof saved.currentTime === 'number' && Number.isFinite(saved.currentTime)) {
        setCurrentTime(saved.currentTime)
      }
      if (typeof audio.duration === 'number' && Number.isFinite(audio.duration)) {
        setDuration(audio.duration)
      }

      if (typeof saved.playbackSource === 'string') {
        setPlaybackSource(saved.playbackSource === 'playlist' ? 'playlist' : 'queue')
      }
      if (typeof saved.queueIndex === 'number' && Number.isFinite(saved.queueIndex)) {
        setQueueIndex(Math.max(0, Math.floor(saved.queueIndex)))
      }
      if (typeof saved.playlistPlaybackIndex === 'number' && Number.isFinite(saved.playlistPlaybackIndex)) {
        setPlaylistPlaybackIndex(Math.max(0, Math.floor(saved.playlistPlaybackIndex)))
      }

      const activelyPlaying = Boolean(audio.src && !audio.paused)
      setIsPlaying(activelyPlaying)
    } catch {
      // ignore corrupted player snapshot
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const isTrackSelected = currentTrack?.title && currentTrack.title !== 'Select a track'
    if (!isTrackSelected) return

    storageSet(PLAYER_STATE_KEY, JSON.stringify({
      ...currentTrack,
      currentTime: audio.currentTime || 0,
      isPlaying: !audio.paused,
      volume: audio.volume,
      playbackSource,
      queueIndex,
      playlistPlaybackIndex
    }))
  }, [currentTrack, isPlaying, playbackSource, queueIndex, playlistPlaybackIndex])

useEffect(() => {
  if (!user) return;

  const heartbeat = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/verify`, {
        method: 'GET',
        credentials: 'include'
      });

      // 401: Token Expired, Missing, or User Deleted
      if (res.status === 401) {
        storageRemove('user');
        storageRemove('token');
        window.dispatchEvent(new Event("userUpdated"));
        // Optional: redirect to login
      } 
      
      // 403: User is actively BANNED in the database
      else if (res.status === 403) {
        const data = await res.json();
        if (data.isBanned) {
          storageSet('banned', 'true');
          storageRemove('user');
          storageRemove('token');
          window.dispatchEvent(new Event("userUpdated"));
          window.location.href = '/'; // Kick them out to the homepage/ban screen
        }
      } 
      
      // 404: Server is unreachable
      else if (res.status === 404) {
        console.log("Can't connect to server");
      }
    } catch (err) {
      // silent fail to avoid spamming the console if network drops
    }
  }, 10000);

  return () => clearInterval(heartbeat);
}, [user]);

  // --- Current listen HEARTBEAT ---
  useEffect(() => {
    if (!user || !isPlaying) return;

    tokenTickAtRef.current = Date.now()

    const presenceSync = setInterval(async () => {
      try {
        const liveTrack = currentTrackRef.current
        const audio = audioRef.current

        if (!liveTrack?.title || liveTrack.title === 'Select a track') return
        if (!audio || audio.paused) return

        const now = Date.now()
        const elapsedSeconds = Math.max(5, Math.min(15, Math.round((now - tokenTickAtRef.current) / 1000) || 10))
        tokenTickAtRef.current = now

        await fetch(`${API_BASE_URL}/me/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: liveTrack.title,
            artist: liveTrack.artist || 'Unknown artist',
            webpage_url: liveTrack.webpage_url,
            currentTime: audio.currentTime
          })
        });

        const tokenRes = await fetch(`${API_BASE_URL}/token/listen-event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: liveTrack.title,
            artist: liveTrack.artist || 'Unknown artist',
            isPlaying: true,
            listenedSeconds: elapsedSeconds
          })
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          setTokenWallet((prev) => ({
            ...prev,
            symbol: tokenData.symbol || prev.symbol,
            balance: typeof tokenData.balance === 'number' ? tokenData.balance : prev.balance,
            totalEarned: typeof tokenData.totalEarned === 'number' ? tokenData.totalEarned : prev.totalEarned,
            pendingQualifiedSeconds: typeof tokenData.pendingQualifiedSeconds === 'number' ? tokenData.pendingQualifiedSeconds : prev.pendingQualifiedSeconds,
            qualifiedSecondsPerToken: typeof tokenData.qualifiedSecondsPerToken === 'number'
              ? tokenData.qualifiedSecondsPerToken
              : prev.qualifiedSecondsPerToken,
            remainingSecondsToNextToken: typeof tokenData.remainingSecondsToNextToken === 'number'
              ? tokenData.remainingSecondsToNextToken
              : Math.max(0, (prev.qualifiedSecondsPerToken || 180) - (typeof tokenData.pendingQualifiedSeconds === 'number' ? tokenData.pendingQualifiedSeconds : prev.pendingQualifiedSeconds)),
            remainingMinutesToNextToken: typeof tokenData.remainingMinutesToNextToken === 'number'
              ? tokenData.remainingMinutesToNextToken
              : Number((Math.max(0, (prev.qualifiedSecondsPerToken || 180) - (typeof tokenData.pendingQualifiedSeconds === 'number' ? tokenData.pendingQualifiedSeconds : prev.pendingQualifiedSeconds)) / 60).toFixed(1)),
            estimatedPendingTokens: typeof tokenData.pendingQualifiedSeconds === 'number'
              ? Number((tokenData.pendingQualifiedSeconds / (prev.qualifiedSecondsPerToken || 180)).toFixed(4))
              : prev.estimatedPendingTokens,
            rewardedSecondsToday: typeof tokenData.rewardedSecondsToday === 'number' ? tokenData.rewardedSecondsToday : prev.rewardedSecondsToday,
            dailyRemainingSeconds: typeof tokenData.dailyRemainingSeconds === 'number' ? tokenData.dailyRemainingSeconds : prev.dailyRemainingSeconds,
            streakDays: typeof tokenData.streakDays === 'number' ? tokenData.streakDays : prev.streakDays,
            suspiciousScore: typeof tokenData.suspiciousScore === 'number' ? tokenData.suspiciousScore : prev.suspiciousScore,
            quests: Array.isArray(tokenData.quests) ? tokenData.quests : prev.quests,
            recentClaims: Array.isArray(tokenData.recentClaims) ? tokenData.recentClaims : prev.recentClaims,
            progressToNextToken: typeof tokenData.progressToNextToken === 'number'
              ? tokenData.progressToNextToken
              : Number((((typeof tokenData.pendingQualifiedSeconds === 'number' ? tokenData.pendingQualifiedSeconds : prev.pendingQualifiedSeconds) / (prev.qualifiedSecondsPerToken || 180)) * 100).toFixed(2)),
            capProgressPercent: typeof tokenData.capProgressPercent === 'number' ? tokenData.capProgressPercent : prev.capProgressPercent,
            dailyListenSecondsToday: typeof tokenData.dailyListenSecondsToday === 'number' ? tokenData.dailyListenSecondsToday : prev.dailyListenSecondsToday,
            dailyCapSeconds: typeof tokenData.dailyCapSeconds === 'number' ? tokenData.dailyCapSeconds : prev.dailyCapSeconds,
            rewardsPaused: typeof tokenData.rewardsPaused === 'boolean' ? tokenData.rewardsPaused : prev.rewardsPaused,
            activeEffects: Array.isArray(tokenData.activeEffects) ? tokenData.activeEffects : prev.activeEffects
          }));
        }
      } catch (err) {
        console.error("Failed to sync presence", err);
      }
    }, 10000);

    return () => clearInterval(presenceSync);
  }, [user, isPlaying]);

  const loadTokenWallet = async () => {
    if (!user) return;

    setTokenLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/token/wallet`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok) return;
      const data = await res.json();
      setTokenWallet({
        ...DEFAULT_TOKEN_WALLET,
        symbol: data.symbol || 'MUZR',
        balance: data.balance || 0,
        totalEarned: data.totalEarned || 0,
        pendingQualifiedSeconds: data.pendingQualifiedSeconds || 0,
        qualifiedSecondsPerToken: data.qualifiedSecondsPerToken || 180,
        remainingSecondsToNextToken: data.remainingSecondsToNextToken ?? 180,
        remainingMinutesToNextToken: data.remainingMinutesToNextToken ?? 3,
        estimatedPendingTokens: data.estimatedPendingTokens || 0,
        rewardedSecondsToday: data.rewardedSecondsToday || 0,
        dailyRemainingSeconds: data.dailyRemainingSeconds || 0,
        dailyListenSecondsToday: data.dailyListenSecondsToday || 0,
        dailyCapSeconds: data.dailyCapSeconds || 7200,
        capProgressPercent: data.capProgressPercent || 0,
        streakDays: data.streakDays || 0,
        suspiciousScore: data.suspiciousScore || 0,
        progressToNextToken: data.progressToNextToken || 0,
        tier: data.tier || DEFAULT_TOKEN_WALLET.tier,
        quests: Array.isArray(data.quests) ? data.quests : [],
        spendCatalog: Array.isArray(data.spendCatalog) ? data.spendCatalog : [],
        recentClaims: Array.isArray(data.recentClaims) ? data.recentClaims : [],
        rewardsPaused: data.rewardsPaused || false,
        activeEffects: Array.isArray(data.activeEffects) ? data.activeEffects : []
      });
    } catch (err) {
      console.error('Failed to load token wallet', err);
    } finally {
      setTokenLoading(false);
    }
  };

  const loadTokenLeaderboard = async () => {
    if (!user) return;

    try {
      const res = await fetch(`${API_BASE_URL}/token/leaderboard`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!res.ok) return;
      const data = await res.json();
      setTokenLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard.slice(0, 5) : []);
    } catch (err) {
      console.error('Failed to load token leaderboard', err);
    }
  };

  const handleClaimQuest = async (questKey) => {
    if (!questKey) return;

    try {
      const res = await fetch(`${API_BASE_URL}/token/claim-quest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ questKey })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || 'Quest claim failed');
        return;
      }

      await loadTokenWallet();
      await loadTokenLeaderboard();
    } catch (err) {
      console.error('Failed to claim quest', err);
    }
  };

  const handleSpendTokens = async (actionKey) => {
    if (!actionKey) return;

    try {
      const res = await fetch(`${API_BASE_URL}/token/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ actionKey })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || 'Spend failed');
        return;
      }

      await loadTokenWallet();
    } catch (err) {
      console.error('Failed to spend tokens', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadTokenWallet();
      loadTokenLeaderboard();
    } else {
      setTokenWallet(DEFAULT_TOKEN_WALLET);
      setTokenLeaderboard([]);
    }
  }, [user]);

  const extractVideoIdFromUrl = (rawUrl) => {
    const value = String(rawUrl || '').trim()
    if (!value) return null

    try {
      const parsed = new URL(value)
      const byVid = parsed.searchParams.get('vid')
      if (byVid) return byVid

      const byV = parsed.searchParams.get('v')
      if (byV) return byV

      if (parsed.hostname === 'youtu.be') {
        const shortId = parsed.pathname.replace(/^\//, '')
        return shortId || null
      }
    } catch {
      return null
    }

    return null
  }

  const sanitizeTrackForPlayback = (track) => {
    if (!track || typeof track !== 'object') return track

    const normalized = { ...track }
    const videoId = normalized.video_id
      || extractVideoIdFromUrl(normalized.webpage_url)
      || extractVideoIdFromUrl(normalized.audio_url)
      || extractVideoIdFromUrl(normalized.proxy_url)

    if (videoId) {
      normalized.video_id = videoId
      normalized.proxy_url = `${MEDIA_API_BASE_URL}/stream?vid=${encodeURIComponent(videoId)}`
    }

    return normalized
  }

  useEffect(() => {
    try {
      const raw = storageGet('muzeer-playlists')
      const parsed = raw ? JSON.parse(raw) : null
      if (!Array.isArray(parsed) || parsed.length === 0) return

      const sanitized = parsed
        .filter((playlist) => playlist && typeof playlist.name === 'string')
        .map((playlist, idx) => ({
          id: playlist.id || `playlist-${Date.now()}-${idx}`,
          name: playlist.name.trim() || `Playlist ${idx + 1}`,
          tracks: Array.isArray(playlist.tracks)
            ? playlist.tracks.map((track) => sanitizeTrackForPlayback(track))
            : []
        }))

      if (sanitized.length > 0) {
        setPlaylists(sanitized)
        setActivePlaylistId(sanitized[0].id)
      }
    } catch {
      // ignore invalid local cache
    }
  }, [])

  useEffect(() => {
    storageSet('muzeer-playlists', JSON.stringify(playlists))
  }, [playlists])

  useEffect(() => {
    if (!playlists.some((playlist) => playlist.id === activePlaylistId)) {
      setActivePlaylistId(playlists[0]?.id || null)
    }
  }, [playlists, activePlaylistId])

  // ---------------------------------------------------------
  // 1. INITIAL APP LOAD
  // ---------------------------------------------------------
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch(`${MEDIA_API_BASE_URL}/trending`)
        const data = await res.json()
        setFeaturedSongs(data)
      } catch (e) { console.error("Trending fetch error", e) }
    }

    fetchTrending();
    loadQuickPicks();
  }, []);

  // ---------------------------------------------------------
  // 2. VOLUME CONTROLLER
  // ---------------------------------------------------------
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // ---------------------------------------------------------
  // 3. AUDIO ENGINE & DISCORD PRESENCE
  // ---------------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.crossOrigin = 'anonymous';

    const updatePresence = (playing) => {
      if (!currentTrack || !currentTrack.title || currentTrack.title === 'Select a track') return;

      fetch(`${API_BASE_URL}/auth/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: currentTrack.title,
          artist: currentTrack.artist,
          webpage_url: currentTrack.webpage_url,
          isPlaying: playing,
          offset: audio.currentTime
        })
      }).catch(err => console.log("Presence sync failed", err));
    };

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const onEnded = () => handleNextTrack();

    const onPlay = () => {
      updatePresence(true);
      setIsPlaying(true);
      startVisualizer();
    };
    const onPause = () => {
      updatePresence(false);
      setIsPlaying(false);
      stopVisualizer();
    };
    const onSeeked = () => updatePresence(true);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('seeked', onSeeked);

    // Resync UI immediately in case metadata/events fired before listeners were attached.
    updateTime();
    updateDuration();
    setIsPlaying(Boolean(audio.src && !audio.paused));

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('seeked', onSeeked);

      if (searchRevealTimerRef.current) clearInterval(searchRevealTimerRef.current);
      if (searchFetchProgressTimerRef.current) clearInterval(searchFetchProgressTimerRef.current);
      if (searchFinalizeProgressTimerRef.current) clearInterval(searchFinalizeProgressTimerRef.current);
      if (searchSmoothProgressTimerRef.current) clearInterval(searchSmoothProgressTimerRef.current);
    }
  }, [currentTrack]);

  useEffect(() => {
    return () => {
      stopVisualizer();
    }
  }, []);

  // Self-heal visualizer in case loop/track transitions stop RAF unexpectedly.
  useEffect(() => {
    if (isPlaying && !rafRef.current) {
      startVisualizer()
    }
  }, [isPlaying, currentTrack?.audio_url, currentTrack?.proxy_url, currentTrack?.webpage_url]);

  // --- LOGIC: LOCAL PLAY COUNT ---
  const recordPlay = (track) => {
    const history = JSON.parse(storageGet('playHistory') || '[]')
    const existingIndex = history.findIndex(item => item.title === track.title)

    if (existingIndex > -1) {
      history[existingIndex].count += 1
      history[existingIndex].lastPlayed = new Date()
    } else {
      history.push({
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        webpage_url: track.webpage_url,
        count: 1,
        lastPlayed: new Date()
      })
    }
    storageSet('playHistory', JSON.stringify(history))
    loadQuickPicks()
  }

  const loadQuickPicks = () => {
    const history = JSON.parse(storageGet('playHistory') || '[]')
    const sorted = history.sort((a, b) => b.count - a.count).slice(0, 6)
    setQuickPicks(sorted)
  }

  // --- LOGIC: PLAYER ---
  const handleNextTrack = () => {
    const liveLoopMode = loopModeRef.current
    const livePlaybackSource = playbackSourceRef.current
    const liveTracks = livePlaybackSource === 'playlist' ? playlistPlaybackTracksRef.current : queueRef.current
    const liveTrackIndex = livePlaybackSource === 'playlist' ? playlistPlaybackIndexRef.current : queueIndexRef.current
    const liveCurrentTrack = currentTrackRef.current

    // Loop one: restart current track
    if (liveLoopMode === 2) {
      const loopTrack = liveTracks[liveTrackIndex] || liveCurrentTrack
      if (loopTrack && (loopTrack.proxy_url || loopTrack.audio_url || loopTrack.webpage_url)) {
        playTrack(loopTrack, false)
      }
      return
    }

    // Move to next track
    if (liveTracks.length > liveTrackIndex + 1) {
      const nextIndex = liveTrackIndex + 1
      if (livePlaybackSource === 'playlist') {
        setPlaylistPlaybackIndex(nextIndex)
      } else {
        setQueueIndex(nextIndex)
      }
      playTrack(liveTracks[nextIndex], false)
    } 
    // Loop all: go back to first track
    else if (liveLoopMode === 1) {
      if (liveTracks.length > 0) {
        if (livePlaybackSource === 'playlist') {
          setPlaylistPlaybackIndex(0)
        } else {
          setQueueIndex(0)
        }
        playTrack(liveTracks[0], false)
      } else if (liveCurrentTrack && (liveCurrentTrack.proxy_url || liveCurrentTrack.audio_url || liveCurrentTrack.webpage_url)) {
        playTrack(liveCurrentTrack, false)
      } else {
        setIsPlaying(false)
        stopVisualizer()
      }
    }
    // No loop: stop
    else {
      setIsPlaying(false)
      stopVisualizer()
    }
  }

  const cycleLoopMode = () => {
    setLoopMode((prev) => {
      const next = (prev + 1) % 3
      loopModeRef.current = next
      return next
    })
  }

  const handlePrevTrack = () => {
    if (playbackSource === 'playlist') {
      if (playlistPlaybackIndex > 0) {
        const prevIndex = playlistPlaybackIndex - 1
        setPlaylistPlaybackIndex(prevIndex)
        playTrack(playlistPlaybackTracks[prevIndex], false)
      }
      return
    }

    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1
      setQueueIndex(prevIndex)
      playTrack(queue[prevIndex], false)
    }
  }

  const setupAudioGraph = () => {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;

    const audioEl = audioRef.current
    if (!audioEl) return

    const sharedGraph = typeof window !== 'undefined' ? window.__muzeerAudioGraph : null
    if (
      sharedGraph &&
      sharedGraph.audio === audioEl &&
      sharedGraph.ctx &&
      sharedGraph.analyser &&
      sharedGraph.dataArray
    ) {
      audioContextRef.current = sharedGraph.ctx
      analyserRef.current = sharedGraph.analyser
      sourceNodeRef.current = sharedGraph.source || null
      dataArrayRef.current = sharedGraph.dataArray
      return
    }

    if (audioContextRef.current && analyserRef.current && dataArrayRef.current) return;

    try {
      const ctx = new AudioContextConstructor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      let source = sourceNodeRef.current;
      if (!source) {
        source = ctx.createMediaElementSource(audioEl);
        sourceNodeRef.current = source;
      }

      try { source.disconnect(); } catch (e) { }
      try { analyser.disconnect(); } catch (e) { }

      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      if (typeof window !== 'undefined') {
        window.__muzeerAudioGraph = {
          audio: audioEl,
          ctx,
          analyser,
          source,
          dataArray: dataArrayRef.current,
        }
      }
    } catch (err) {
      console.warn('Audio graph setup safely skipped:', err.message);
    }
  }

  const updateVisualizer = (timestamp = 0) => {
    const analyser = analyserRef.current
    const dataArray = dataArrayRef.current
    const container = wavesRef.current

    // In low power mode, update at ~15 FPS to reduce CPU/GPU load.
    if (potatoMode && timestamp - lastVizFrameRef.current < 66) {
      rafRef.current = requestAnimationFrame(updateVisualizer)
      return
    }
    lastVizFrameRef.current = timestamp

    let energy = 0
    let forceAnimate = false

    if (analyser && dataArray) {
      analyser.getByteFrequencyData(dataArray)
      const lowBand = Math.max(1, Math.floor(dataArray.length * (potatoMode ? 0.2 : 0.35)))
      let sum = 0
      for (let i = 0; i < lowBand; i += 1) sum += dataArray[i]
      const analyserEnergy = sum / (lowBand * 255)

      // Some TV browsers expose analyser but keep returning near-zero data.
      if (isPlaying && analyserEnergy < 0.01) {
        silentAnalyserFramesRef.current += 1
      } else {
        silentAnalyserFramesRef.current = 0
      }

      if (silentAnalyserFramesRef.current > 20 && isPlaying) {
        const t = audioRef.current?.currentTime || (timestamp / 1000)
        const vol = audioRef.current?.volume ?? 0.5
        const pulse = 0.16 + Math.abs(Math.sin(t * 3.2)) * 0.5
        energy = pulse * Math.max(0.35, vol)
        forceAnimate = true
      } else {
        energy = analyserEnergy
      }
    } else {
      // Fallback for browsers where MediaElementSource/Analyser is blocked.
      const t = audioRef.current?.currentTime || (timestamp / 1000)
      const vol = audioRef.current?.volume ?? 0.5
      const pulse = 0.16 + Math.abs(Math.sin(t * 3.2)) * 0.5
      energy = isPlaying ? pulse * Math.max(0.35, vol) : 0
      forceAnimate = true
    }

    if (container) {
      container.style.setProperty('--hz-energy', energy.toFixed(3))
      const scale = 0.8 + (energy * 0.35)
      const opacity = 0.18 + (energy * 0.32)
      container.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`
      container.style.opacity = opacity.toFixed(3)

      if (forceAnimate !== forceAnimateRef.current) {
        container.classList.toggle('hz-force-animate', forceAnimate)
        forceAnimateRef.current = forceAnimate
      }

      if (ambienceRef.current) ambienceRef.current.style.setProperty('--hz-energy', energy.toFixed(3))
    }
    rafRef.current = requestAnimationFrame(updateVisualizer)
  }

  const startVisualizer = async () => {
    try {
      setupAudioGraph()
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
    } catch (err) {
      console.warn('Audio context resume failed:', err)
    } finally {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(updateVisualizer)
      }
    }
  }

  const stopVisualizer = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const container = wavesRef.current
    if (container) {
      container.style.setProperty('--hz-energy', '0')
      container.style.transform = 'translate(-50%, -50%) scale(0.8)'
      container.style.opacity = '0.2'
      container.classList.remove('hz-force-animate')
    }
    if (ambienceRef.current) ambienceRef.current.style.setProperty('--hz-energy', '0')
    silentAnalyserFramesRef.current = 0
    forceAnimateRef.current = false
  }

  useEffect(() => {
    storageSet('muzeer-potato-mode', potatoMode ? '1' : '0')

    // Keep visualizer active in potato mode; only stop when playback is stopped.
    if (!isPlaying) {
      stopVisualizer()
    } else if (!rafRef.current) {
      startVisualizer()
    }
  }, [potatoMode, isPlaying])

  useEffect(() => {
    storageSet('muzeer-text-cutout-mode', textCutoutMode ? '1' : '0')
  }, [textCutoutMode])

  const playTrack = async (trackInput, isNewPlay = true) => {
    let track = sanitizeTrackForPlayback(trackInput)

    if (audioRef.current) {
      audioRef.current.pause();
    }

    let streamUrl = track.proxy_url || track.audio_url

    if (!streamUrl && track.video_id) {
      streamUrl = `${MEDIA_API_BASE_URL}/stream?vid=${encodeURIComponent(track.video_id)}`
      track = { ...track, proxy_url: streamUrl }
    }

    if (!streamUrl && track.webpage_url) {
      setLoading(true)
      try {
        const res = await fetch(`${MEDIA_API_BASE_URL}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: track.webpage_url }),
        })
        const data = await res.json()
        const trackData = sanitizeTrackForPlayback(Array.isArray(data) ? data[0] : data)
        streamUrl = trackData?.proxy_url || trackData?.audio_url
        track = { ...track, ...trackData }
      } catch (e) { console.error(e) }
      setLoading(false)
    }

    if (!streamUrl) return

    if (isNewPlay) recordPlay(track)
    applyThemeFromImage(track.thumbnail, track)
    setCurrentTrack(track)

    audioRef.current.src = streamUrl
    audioRef.current.load()

    try {
      await audioRef.current.play()
      setIsPlaying(true)
      startVisualizer()
      return true
    } catch (e) {
      console.log("Playback error:", e)
      setIsPlaying(false)
      stopVisualizer()
      return false
    }
  }

  const addToQueue = (track) => {
    const newQueue = [...queue, track]
    setQueue(newQueue)
  }

  const playFromSearchResults = (track, index) => {
    const safeIndex = Math.max(0, index || 0)
    const nextQueue = searchResults.slice(safeIndex)

    if (nextQueue.length > 0) {
      setQueue(nextQueue)
      setQueueIndex(0)
      setPlaybackSource('queue')
      setRightPanelMode('queue')
    }

    playTrack(track, true)
  }

  const playFromQueue = (index) => {
    if (!queue[index]) return
    setPlaybackSource('queue')
    setQueueIndex(index)
    setRightPanelMode('queue')
    playTrack(queue[index], true)
  }

  const playFromPlaylist = (tracks, index) => {
    const safeIndex = Math.max(0, index || 0)
    if (!Array.isArray(tracks) || !tracks[safeIndex]) return

    const sanitizedTracks = tracks.map((item) => sanitizeTrackForPlayback(item))
    setPlaybackSource('playlist')
    setPlaylistPlaybackTracks(sanitizedTracks)
    setPlaylistPlaybackIndex(safeIndex)
    setRightPanelMode('playlist')
    playTrack(sanitizedTracks[safeIndex], true)
  }

  const togglePlayback = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      stopVisualizer()
    } else {
      try {
        await audioRef.current.play()
        setIsPlaying(true)
        startVisualizer()
      } catch (e) {
        console.log("Playback error:", e)
        setIsPlaying(false)
        stopVisualizer()
      }
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        const activeTag = document.activeElement.tagName.toUpperCase();
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

        e.preventDefault();
        togglePlayback();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    if (searchSmoothProgressTimerRef.current) {
      clearInterval(searchSmoothProgressTimerRef.current)
      searchSmoothProgressTimerRef.current = null
    }

    searchSmoothProgressTimerRef.current = setInterval(() => {
      setSearchProgress((prev) => {
        const diff = searchProgressTarget - prev
        if (Math.abs(diff) < 0.35) {
          if (searchSmoothProgressTimerRef.current) {
            clearInterval(searchSmoothProgressTimerRef.current)
            searchSmoothProgressTimerRef.current = null
          }
          return searchProgressTarget
        }
        const step = Math.max(0.35, Math.abs(diff) * 0.16)
        return prev + Math.sign(diff) * step
      })
    }, 16)

    return () => {
      if (searchSmoothProgressTimerRef.current) {
        clearInterval(searchSmoothProgressTimerRef.current)
        searchSmoothProgressTimerRef.current = null
      }
    }
  }, [searchProgressTarget])

  useEffect(() => {
    setAvatarLoadFailed(false)
  }, [avatarSrc])

  useEffect(() => {
    const pendingTrackRaw = storageGet('pendingTrack')
    if (!pendingTrackRaw) return

    // If shared player is already active, do not force replay pendingTrack.
    if (audioRef.current?.src && !audioRef.current?.paused) {
      storageRemove('pendingTrack')
      return
    }

    try {
      const pendingTrack = JSON.parse(pendingTrackRaw)
      if (pendingTrack) {
        playTrack(pendingTrack).then((played) => {
          storageRemove('pendingTrack')
          if (!played) {
            // autoplay blocked ÔÇô ok
          }
        })
      }
    } catch {
      storageRemove('pendingTrack')
    }
  }, [])

  useEffect(() => {
    const searchPlaylistRaw = storageGet('searchPlaylist')
    if (!searchPlaylistRaw) return

    try {
      const searchTracks = JSON.parse(searchPlaylistRaw)
      if (Array.isArray(searchTracks) && searchTracks.length > 0) {
        setQueue(searchTracks)
        setQueueIndex(0)
        setPlaybackSource('queue')
        storageRemove('searchPlaylist')
        storageRemove('searchPlaylistIndex')
      }
    } catch {
      storageRemove('searchPlaylist')
    }
  }, [])

  const handleAuthMock = () => {
    if (user) {
      storageRemove('token');
      storageRemove('user');
      window.dispatchEvent(new Event("userUpdated"));
      setUser(null);
    } else {
      navigate('/login');
    }
  };

  const handleRegisterMock = () => {
    if (user) {
      storageRemove('token');
      storageRemove('user');
      window.dispatchEvent(new Event("userUpdated"));
      setUser(null);
    } else {
      navigate('/register');
    }
  };

  const handleProfileMock = () => {
    if (user) navigate('/profile');
    else navigate('/login');
  };

  const createPlaylist = (incomingName) => {
    const cleanName = (incomingName ?? newPlaylistName).trim()
    if (!cleanName) return

    const alreadyExists = playlists.some((playlist) => playlist.name.toLowerCase() === cleanName.toLowerCase())
    if (alreadyExists) return

    const id = `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const next = [...playlists, { id, name: cleanName, tracks: [] }]
    setPlaylists(next)
    setActivePlaylistId(id)
    setRightPanelMode('playlist')
    setNewPlaylistName('')
  }

  const createUniquePlaylistName = (incomingName) => {
    const base = (incomingName || 'Imported playlist').trim() || 'Imported playlist'
    const existing = new Set(playlists.map((playlist) => playlist.name.toLowerCase()))

    if (!existing.has(base.toLowerCase())) return base

    let attempt = 2
    while (existing.has(`${base} (${attempt})`.toLowerCase())) {
      attempt += 1
    }

    return `${base} (${attempt})`
  }

  const isActiveTrack = (track) => Boolean(currentTrack) && (
    (track?.video_id && currentTrack.video_id && track.video_id === currentTrack.video_id) ||
    (track?.webpage_url && currentTrack.webpage_url && track.webpage_url === currentTrack.webpage_url)
  )

  const resolvePlaylistPreview = async (playlistId, tracks) => {

    const unresolved = tracks
      .filter((t) => !t.proxy_url && !t.audio_url && t.webpage_url)
      .slice(0, 3)

    for (const track of unresolved) {
      try {
        const res = await fetch(`${MEDIA_API_BASE_URL}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: track.webpage_url })
        })
        if (!res.ok) continue
        const data = await res.json()
        const resolved = Array.isArray(data) ? data[0] : data
        if (resolved?.proxy_url || resolved?.audio_url) {
          setPlaylists((prev) =>
            prev.map((pl) => {
              if (pl.id !== playlistId) return pl
              return {
                ...pl,
                tracks: pl.tracks.map((t) =>
                  t.webpage_url === track.webpage_url ? { ...t, ...resolved } : t
                )
              }
            })
          )
        }
      } catch { /* silent ÔÇö preview resolution is best-effort */ }
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  const normalizeImportedTrack = (track) => {
    const webpageUrl = track?.webpage_url || track?.url || track?.link || null
    const videoId = track?.video_id || null
    const derivedProxyUrl = videoId ? `${MEDIA_API_BASE_URL}/stream?vid=${encodeURIComponent(videoId)}` : null

    return sanitizeTrackForPlayback({
      title: track?.title || 'Unknown title',
      artist: track?.artist || track?.channel || 'Unknown artist',
      thumbnail: track?.thumbnail || null,
      webpage_url: webpageUrl,
      audio_url: track?.audio_url || null,
      proxy_url: track?.proxy_url || derivedProxyUrl,
      source: track?.source || importSource,
      video_id: videoId
    })
  }

  const handleImportPlaylist = async () => {
    const cleanedUrl = importUrl.trim()
    if (!cleanedUrl || importBusy) return

    setImportBusy(true)
    setImportError('')
    setImportStatus('Importing playlist...')

    try {
      const response = await fetch(`${API_BASE_URL}/playlists/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          source: importSource,
          url: cleanedUrl
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data?.error || `Import failed (${response.status})`)
      }

      const importedTracks = Array.isArray(data?.tracks)
        ? data.tracks.map(normalizeImportedTrack).filter((track) => track.webpage_url || track.audio_url || track.proxy_url)
        : []

      if (!importedTracks.length) {
        throw new Error('No playable tracks were found in the imported playlist.')
      }

      const importedName = createUniquePlaylistName(data?.playlist?.name || `${importSource} import`)
      const importedId = `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      setPlaylists((prev) => [...prev, {
        id: importedId,
        name: importedName,
        tracks: importedTracks
      }])

      setActivePlaylistId(importedId)
      setRightPanelMode('playlist')
      setImportUrl('')
      setImportStatus(`Imported ${importedTracks.length} tracks into "${importedName}".`)
      setActivePlaylistId(importedId)
      setRightPanelMode('playlist')
      setImportUrl('')
      setImportStatus(`Imported ${importedTracks.length} tracks into "${importedName}".`)
      resolvePlaylistPreview(importedId, importedTracks)
    } catch (err) {
      setImportError(err?.message || 'Playlist import failed.')
      setImportStatus('')
    } finally {
      setImportBusy(false)
    }
  }

  const removePlaylist = (playlistId) => {
    if (playlists.length <= 1) return
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== playlistId))
  }

  const addTrackToPlaylist = (track, playlistId = activePlaylistId) => {
    if (!track || !playlistId) return

    setPlaylists((prev) => prev.map((playlist) => {
      if (playlist.id !== playlistId) return playlist

      const exists = playlist.tracks.some((item) => {
        const sameUrl = (item.webpage_url || item.audio_url || item.proxy_url) === (track.webpage_url || track.audio_url || track.proxy_url)
        const sameTitle = (item.title || '').toLowerCase() === (track.title || '').toLowerCase()
        return sameUrl || sameTitle
      })

      if (exists) return playlist
      return { ...playlist, tracks: [...playlist.tracks, track] }
    }))
  }

  const removeTrackFromPlaylist = (playlistId, trackIndex) => {
    setPlaylists((prev) => prev.map((playlist) => {
      if (playlist.id !== playlistId) return playlist
      return {
        ...playlist,
        tracks: playlist.tracks.filter((_, index) => index !== trackIndex)
      }
    }))
  }

  const activePlaylist = playlists.find((playlist) => playlist.id === activePlaylistId) || null

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setSearchResults([])
    setVisibleSearchCount(0)
    setSearchProgress(0)
    setSearchProgressTarget(0)
    setIsSearchResultsOpen(true)

    if (searchRevealTimerRef.current) clearInterval(searchRevealTimerRef.current)
    if (searchFetchProgressTimerRef.current) clearInterval(searchFetchProgressTimerRef.current)
    if (searchFinalizeProgressTimerRef.current) clearInterval(searchFinalizeProgressTimerRef.current)

    searchFetchProgressTimerRef.current = setInterval(() => {
      setSearchProgressTarget((prev) => (prev >= 65 ? prev : prev + 2.5))
    }, 120)

    try {
      const response = await fetch(`${API_BASE_URL}/media/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Search failed')

      const normalizedResults = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.tracks)
              ? data.tracks
              : (data?.title || data?.webpage_url || data?.audio_url || data?.proxy_url)
                ? [data]
                : []

      if (searchFetchProgressTimerRef.current) {
        clearInterval(searchFetchProgressTimerRef.current)
        searchFetchProgressTimerRef.current = null
      }

      setSearchResults(normalizedResults)
      setIsSearchResultsOpen(normalizedResults.length > 0)

      if (normalizedResults.length > 0) {
        setSearchProgressTarget((prev) => Math.max(prev, 72))
        setVisibleSearchCount(1)

        const finalizeStart = Date.now()
        const finalizeDuration = Math.max(700, normalizedResults.length * 120)
        searchFinalizeProgressTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - finalizeStart
          const ratio = Math.min(1, elapsed / finalizeDuration)
          const target = 72 + ratio * 28
          setSearchProgressTarget((prevTarget) => Math.max(prevTarget, target))
          if (ratio >= 1) {
            clearInterval(searchFinalizeProgressTimerRef.current)
            searchFinalizeProgressTimerRef.current = null
          }
        }, 40)

        searchRevealTimerRef.current = setInterval(() => {
          setVisibleSearchCount((prev) => {
            const next = prev + 1
            if (next >= normalizedResults.length) {
              clearInterval(searchRevealTimerRef.current)
              searchRevealTimerRef.current = null
              if (searchFinalizeProgressTimerRef.current) {
                clearInterval(searchFinalizeProgressTimerRef.current)
                searchFinalizeProgressTimerRef.current = null
              }
              setSearchProgressTarget(100)
              return normalizedResults.length
            }
            return next
          })
        }, 90)
      } else {
        setSearchProgressTarget(100)
      }
    } catch (err) {
      console.error(err)
      if (searchFetchProgressTimerRef.current) clearInterval(searchFetchProgressTimerRef.current)
      if (searchFinalizeProgressTimerRef.current) clearInterval(searchFinalizeProgressTimerRef.current)
      setSearchProgressTarget(0)
    }
    finally { setLoading(false) }
  }

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
  }

  const themePalettes = [
    ['#3bf0d1', '#ffb454', '#3bf0d1'],
    ['#8ef3ff', '#ffe08a', '#7be1ff'],
    ['#9dffe5', '#ff9b6b', '#63f7c6'],
    ['#b8a1ff', '#ffd6a6', '#9c9bff'],
    ['#6de2ff', '#ff6f91', '#6de2ff'],
    ['#c1ff78', '#ffa76a', '#c1ff78'],
  ]

  const clampChannel = (value, min = 25, max = 235) => Math.min(max, Math.max(min, value))

  const rgbToHsl = (r, g, b) => {
    const rNorm = r / 255
    const gNorm = g / 255
    const bNorm = b / 255
    const max = Math.max(rNorm, gNorm, bNorm)
    const min = Math.min(rNorm, gNorm, bNorm)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const delta = max - min
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
      switch (max) {
        case rNorm:
          h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0)
          break
        case gNorm:
          h = (bNorm - rNorm) / delta + 2
          break
        default:
          h = (rNorm - gNorm) / delta + 4
          break
      }
      h /= 6
    }

    return { h, s, l }
  }

  const toHex = (value) => clampChannel(Math.round(value)).toString(16).padStart(2, '0')
  const rgbToHex = (r, g, b) => `#${toHex(r)}${toHex(g)}${toHex(b)}`

  const hashString = (value) => {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash)
  }

  const applyPalette = (palette) => {
    setAccentStart(palette[0])
    setAccentEnd(palette[1])
    setSpeakerGlow(palette[2])
  }

  const applyFallbackTheme = (track) => {
    const seed = `${track?.title || ''}${track?.artist || ''}${track?.webpage_url || ''}`
    const index = seed ? hashString(seed) % themePalettes.length : 0
    applyPalette(themePalettes[index])
  }

  const applyThemeFromImage = (imageUrl, track) => {
    if (!imageUrl) {
      applyFallbackTheme(track)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) {
        applyFallbackTheme(track)
        return
      }

      const size = 48
      canvas.width = size
      canvas.height = size
      context.drawImage(img, 0, 0, size, size)

      let avgR = 0
      let avgG = 0
      let avgB = 0
      let count = 0
      let best = { r: 0, g: 0, b: 0, score: 0 }

      try {
        const data = context.getImageData(0, 0, size, size).data
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3]
          if (alpha < 10) continue
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const { s, l } = rgbToHsl(r, g, b)
          const score = s * 0.7 + l * 0.3

          avgR += r
          avgG += g
          avgB += b
          count += 1

          if (score > best.score) best = { r, g, b, score }
        }
      } catch (err) {
        applyFallbackTheme(track)
        return
      }

      if (!count) {
        applyFallbackTheme(track)
        return
      }

      const avgColor = rgbToHex(avgR / count, avgG / count, avgB / count)
      const vibrant = rgbToHex(best.r, best.g, best.b)
      applyPalette([avgColor, vibrant, vibrant])
    }

    img.onerror = () => applyFallbackTheme(track)
  }

  const themeVars = {
    '--accent-start': accentStart,
    '--accent-end': accentEnd,
    '--speaker-glow': speakerGlow,
    '--hz-intensity': intensity,
    '--bg-intensity': intensity,
  }

  return (
    <div className={`app-shell h-screen overflow-hidden text-[color:var(--ink)] ${potatoMode ? 'potato-mode' : ''} ${textCutoutMode ? 'text-cutout-mode' : ''}`} style={themeVars}>
      {/* Background Ambience (Pinkwave) */}
      <div ref={ambienceRef} className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {potatoMode ? (
          <div className="potato-static-bg" aria-hidden="true" />
        ) : (
          <>
            <div className="liquid-flow" aria-hidden="true" />
            <div className={`edge-glow ${isPlaying ? 'is-playing' : 'is-paused'}`} aria-hidden="true" />
            <div className="absolute -left-32 top-10 h-72 w-72 rounded-full blur-[120px]" style={{ backgroundColor: accentEnd, opacity: 0.3 }} />
            <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full blur-[140px]" style={{ backgroundColor: accentStart, opacity: 0.25 }} />
            <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full blur-[160px]" style={{ backgroundColor: speakerGlow, opacity: 0.2 }} />
          </>
        )}

        <div ref={wavesRef} className={`hz-waves hz-liquid ${potatoMode ? 'hz-lite' : ''} ${isPlaying ? 'is-playing' : 'is-paused'}`} aria-hidden="true">
          <div className="hz-spikes" aria-hidden="true" />
          <div className="speaker" aria-hidden="true">
            <div className="speaker__rim" />
            <div className="speaker__cone" />
            <div className="speaker__cap" />
            <div className="speaker__ring speaker__ring--outer" />
            <div className="speaker__ring speaker__ring--mid" />
            <div className="speaker__ring speaker__ring--inner" />
          </div>
        </div>
      </div>

      <div className="app-content">
        {/* --- NAVBAR --- */}
        <nav className="nav-shell sticky top-0 z-50 mx-auto w-full max-w-[1600px] rounded-b-3xl border-b border-white/10 bg-[color:var(--panel)]/95 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="brand-mark h-8 w-8 overflow-hidden rounded-lg border border-white/15 bg-black/20">
                <img
                  src="/muzeer.png"
                  alt={`${appName} logo`}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="brand-title brand-title--cutout font-bold tracking-wide text-lg">
                {appName}
              </span>
            </div>

            <div className="brand-slogan hidden md:block">
              {user?.role === 'admin' ||user?.role === 'owner' ? (
                <button
                  onClick={() => navigate('/admin')}
                  className="text-[10px] text-yellow-400 font-bold hover:text-yellow-500 transition-colors border border-yellow-400/30 rounded-full px-4 py-1 bg-yellow-400/10 tracking-[0.1em] uppercase"
                >
                  Admin Abuse Panel
                </button>
              ) : (
                <div className="text-xs font-medium tracking-[0.3em] uppercase text-white/50">
                  Where Music Lives
                </div>
              )}
            </div>

            <div className="relative flex items-center gap-3">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-1 py-1 text-white/90 transition hover:text-white"
                    aria-label="Open profile menu"
                  >
                    <span className="h-9 w-9 rounded-full overflow-hidden border border-white/20 bg-white/5 flex items-center justify-center">
                      {avatarSrc && !avatarLoadFailed ? (
                        <img
                          src={avatarSrc}
                          alt="avatar"
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.preventDefault()
                            setAvatarLoadFailed(true)
                          }}
                        />
                      ) : (
                        <span className="font-bold text-white uppercase text-sm">
                          {user?.userName ? user.userName.charAt(0) : 'U'}
                        </span>
                      )}
                    </span>
                    <span className="max-w-[130px] truncate text-sm font-semibold">
                      {user.userName ? user.userName : 'User'}
                    </span>
                  </button>

                  {profileMenuOpen && (
                    <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-xl border border-white/10 bg-[color:var(--panel)]/95 p-1.5 text-left shadow-[0_14px_30px_rgba(0,0,0,0.35)] backdrop-blur">
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false)
                          navigate('/profile')
                        }}
                        className="w-full rounded-lg px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
                      >
                        Open Profile
                      </button>
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false)
                          handleAuthMock()
                        }}
                        className="mt-1 w-full rounded-lg px-3 py-2 text-xs text-rose-300 transition hover:bg-rose-500/15 hover:text-rose-200"
                      >
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button onClick={handleAuthMock} className="text-xs text-white/60 hover:text-white">Login</button>
              )}

              <button
                onClick={() => setThemeOpen((prev) => !prev)}
                className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition hover:text-white"
                aria-label="Open theme settings"
              >
                <FaSlidersH className="text-sm" />
              </button>

              {themeOpen && (
                <div className="absolute right-0 top-full mt-3 w-64 rounded-2xl border border-white/10 bg-[color:var(--panel)]/95 p-4 text-xs shadow-[0_18px_40px_rgba(0,0,0,0.4)] backdrop-blur">
                  <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/40"><FaSlidersH className="text-[11px]" /> Theme</p>
                  <div className="mt-3 space-y-3">
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Potato mode</span>
                      <button
                        onClick={() => setPotatoMode((prev) => !prev)}
                        className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] transition ${potatoMode ? 'border-emerald-300/60 bg-emerald-300/20 text-emerald-200' : 'border-white/20 bg-white/5 text-white/60'}`}
                      >
                        {potatoMode ? 'On' : 'Off'}
                      </button>
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Text cutout mode</span>
                      <button
                        onClick={() => setTextCutoutMode((prev) => !prev)}
                        className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] transition ${textCutoutMode ? 'border-fuchsia-300/60 bg-fuchsia-300/20 text-fuchsia-200' : 'border-white/20 bg-white/5 text-white/60'}`}
                      >
                        {textCutoutMode ? 'On' : 'Off'}
                      </button>
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Gradient start</span>
                      <input type="color" value={accentStart} onChange={(e) => setAccentStart(e.target.value)} className="h-7 w-10 cursor-pointer rounded" />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Gradient end</span>
                      <input type="color" value={accentEnd} onChange={(e) => setAccentEnd(e.target.value)} className="h-7 w-10 cursor-pointer rounded" />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Speaker glow</span>
                      <input type="color" value={speakerGlow} onChange={(e) => setSpeakerGlow(e.target.value)} className="h-7 w-10 cursor-pointer rounded" />
                    </label>
                    <label className="flex items-center justify-between gap-3">
                      <span className="text-white/70">Intensity</span>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.05"
                        value={intensity}
                        onChange={(e) => setIntensity(parseFloat(e.target.value))}
                        className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Main Grid Layout */}
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-6 px-4 pt-6 sm:px-5 lg:grid-cols-[320px_1fr_340px] lg:pt-8">

          {/* --- LEFT SIDEBAR --- */}
          <aside className="hidden flex-col gap-6 lg:flex max-h-[calc(100vh-var(--player-offset)-96px)] min-h-0">
            <div className="rounded-3xl border border-white/10 bg-[color:var(--panel)]/80 p-5 backdrop-blur h-full min-h-0 flex flex-col overflow-hidden">
              <nav className="space-y-2 text-sm border-b border-white/10 pb-4">
                {['Home', 'Search', 'Your Library'].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      if (item === 'Home') navigate('/')
                      if (item === 'Search') {
                        const searchInput = document.getElementById('landing-search-input')
                        if (searchInput) {
                          searchInput.focus()
                          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-white/10 hover:bg-white/5 group"
                  >
                    <span>{item}</span>
                    <span className="text-xs text-[color:var(--muted)] opacity-0 group-hover:opacity-100 transition">ÔÇ║</span>
                  </button>
                ))}
              </nav>

              <div className="mt-4 flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Playlists</p>
                  <button
                    onClick={() => createPlaylist()}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 hover:text-white transition"
                  >
                    <FaPlus className="text-[10px]" />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        createPlaylist()
                      }
                    }}
                    placeholder="New playlist name"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/35 outline-none focus:border-pink-500/50"
                  />
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/45"><FaCloudDownloadAlt className="text-[11px]" /> Import Playlist</p>
                    <FaCloudDownloadAlt className="text-[12px] text-white/45" />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={importSource}
                      onChange={(e) => {
                        setImportSource(e.target.value)
                        setImportError('')
                        setImportStatus('')
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[11px] text-white outline-none focus:border-pink-500/50"
                    >
                      <option value="youtube">YouTube</option>
                      <option value="spotify">Spotify</option>
                    </select>

                    <input
                      type="text"
                      value={importUrl}
                      onChange={(e) => {
                        setImportUrl(e.target.value)
                        setImportError('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleImportPlaylist()
                        }
                      }}
                      placeholder="PAste URL"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white placeholder:text-white/30 outline-none focus:border-pink-500/50"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleImportPlaylist}
                    disabled={importBusy || !importUrl.trim()}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {importBusy ? 'Importing...' : `Import from ${importSource === 'youtube' ? 'YouTube' : 'Spotify'}`}
                  </button>

                  {importError && (
                    <p className="mt-2 text-[10px] text-rose-300">{importError}</p>
                  )}
                  {importStatus && (
                    <p className="mt-2 text-[10px] text-emerald-300">{importStatus}</p>
                  )}
                </div>

                <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar space-y-1 text-sm text-[color:var(--muted)]">
                  {playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      className={`w-full min-w-0 rounded-xl border px-2 py-2 transition cursor-pointer flex items-center justify-between gap-2 ${playlist.id === activePlaylistId ? 'border-pink-500/30 bg-pink-500/10 text-white' : 'border-transparent hover:bg-white/5 hover:text-white'}`}
                      onClick={() => {
                        setActivePlaylistId(playlist.id)
                        setRightPanelMode('playlist')
                      }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{playlist.name}</p>
                        <p className="text-[10px] text-white/45">{playlist.tracks.length} tracks</p>
                      </div>
                      <button
                        type="button"
                        disabled={playlists.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          removePlaylist(playlist.id)
                        }}
                        className="text-white/30 hover:text-rose-300 disabled:opacity-20 disabled:cursor-not-allowed"
                        aria-label={`Delete ${playlist.name}`}
                      >
                        <FaTrash className="text-[11px]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* --- MIDDLE CONTENT --- */}
          <main className="min-w-0 space-y-6 overflow-y-auto pr-1 custom-scrollbar max-h-[calc(100vh-var(--player-offset)-96px)]">
            <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted)]">Text</p>
                <h1 className="mt-2 text-3xl font-semibold">Good evening, {user ? user.userName : 'Guest'}</h1>
              </div>

              <form onSubmit={handleSearch} className="flex w-full items-center gap-3 relative group sm:w-auto">
                <FaSearch className="absolute right-5  text-white/30 group-focus-within:text-pink-500" />
                <input
                  id="landing-search-input"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder:text-[color:var(--muted)] focus:border-pink-500/50 focus:outline-none sm:w-64 sm:focus:w-80 transition-all"
                  placeholder={loading ? "Searching..." : "Type song name or URL..."}
                />
              </form>
            </header>

            {/* Search Results */}
            {loading && (
              <section className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-900/10 to-transparent p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Searching...</h2>
                  <span className="text-xs text-pink-300 animate-pulse">{Math.round(searchProgress)}%</span>
                </div>

                <div className="mb-4 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-pink-400 transition-all duration-200" style={{ width: `${Math.max(0, Math.min(100, searchProgress))}%` }} />
                </div>

                <div className="grid gap-4">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="min-w-0 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center animate-pulse">
                      <div className="h-24 w-24 shrink-0 rounded-2xl bg-white/10" />
                      <div className="min-w-0 flex-1">
                        <div className="h-4 w-2/3 rounded bg-white/10" />
                        <div className="mt-3 h-3 w-1/2 rounded bg-white/10" />
                      </div>
                      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                        <div className="h-9 w-full rounded-full bg-white/10 sm:w-24" />
                        <div className="h-9 w-full rounded-full bg-white/10 sm:w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {searchResults.length > 0 && (
              <section className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-900/10 to-transparent p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold">Search results</h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-pink-300">{searchResults.length} found</span>
                    {visibleSearchCount < searchResults.length && (
                      <span className="text-xs text-pink-300">{Math.round(searchProgress)}%</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsSearchResultsOpen((prev) => !prev)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 transition hover:bg-white/10"
                    >
                      {isSearchResultsOpen ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                {isSearchResultsOpen && (
                  <div className="grid gap-4">
                    {searchResults.slice(0, visibleSearchCount || searchResults.length).map((result, index) => (
                      <div key={`${result.webpage_url || result.title || 'result'}-${index}`} className="relative min-w-0 flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${index * 60}ms` }}>
                        {result.thumbnail ? (
                          <button
                            type="button"
                            onClick={() => playFromSearchResults(result, index)}
                            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl shadow-[0_10px_30px_rgba(236,72,153,0.25)]"
                            aria-label={`Play ${result.title || 'track'}`}
                          >
                            <img src={result.thumbnail} alt="Thumbnail" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                              <FaPlay className="text-white" />
                            </div>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => playFromSearchResults(result, index)}
                            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500"
                            aria-label={`Play ${result.title || 'track'}`}
                          >
                            <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                              <FaPlay className="text-white" />
                            </div>
                          </button>
                        )}

                        <div className="min-w-0 flex-1 pr-16 md:pr-24 xl:pr-28 flex flex-col items-start">
                          <p className="truncate text-lg font-semibold w-full">{result.title || 'Unknown title'}</p>
                          <p
                            onClick={(e) => { e.stopPropagation(); if (result.artist && result.artist !== 'Unknown artist' && result.artist !== '...') { navigate(`/artist/${encodeURIComponent(result.artist)}`); } }}
                            className="mt-1 truncate text-sm text-white/60 cursor-pointer hover:text-pink-400 hover:underline transition-colors max-w-full"
                            title={`Zobrazit profil interpreta ${result.artist}`}
                          >{result.artist || 'Unknown artist'}</p>
                        </div>

                        <div className="absolute right-0 top-0 bottom-0 flex w-14 flex-col border-l border-white/10 bg-white/[0.03] md:w-20 xl:w-24">
                          <button
                            onClick={() => playFromSearchResults(result, index)}
                            className="flex flex-1 items-center justify-center gap-1.5 border-b border-white/10 text-[10px] font-semibold text-[#00ff99] transition hover:bg-white/10 md:gap-2"
                          >
                            <FaPlay size={11} />
                            <span className="whitespace-nowrap text-[9px] leading-none">Play</span>
                          </button>
                          <button
                            onClick={() => addToQueue(result)}
                            className="flex flex-1 items-center justify-center gap-1.5 border-b border-white/10 text-[10px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white md:gap-2"
                          >
                            <MdQueueMusic size={13} />
                            <span className="whitespace-nowrap text-[9px] leading-none">Queue</span>
                          </button>
                          <button
                            onClick={() => addTrackToPlaylist(result)}
                            className="flex flex-1 items-center justify-center gap-1.5 text-[10px] font-semibold text-pink-200 transition hover:bg-pink-500/20 md:gap-2"
                          >
                            <FaPlus size={11} />
                            <span className="whitespace-nowrap text-[9px] leading-none">Save</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Featured / Trending */}
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-pink-500/10 via-transparent to-transparent p-5 sm:p-6 overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Trending Now</h2>
                <button className="text-xs text-pink-400 hover:text-white transition">Czech Top 8</button>
              </div>

              <div className="grid min-w-0 gap-4 min-[1180px]:grid-cols-2">
                {featuredSongs.length > 0 ? featuredSongs.slice(0, 8).map((song, i) => (
                  <div
                    key={i}
                    onClick={() => playTrack(song)}
                    className="group relative flex w-full min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-pink-500/30 hover:bg-white/10 cursor-pointer min-[1180px]:flex-row min-[1180px]:items-center min-[1180px]:gap-4">
                    <div className="relative h-16 w-16 min-w-[4rem]">
                      <img src={song.thumbnail} className="h-full w-full rounded-xl object-cover" alt="art" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-xl">
                        <FaPlay className="text-white" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 overflow-hidden pr-10 md:pr-12 2xl:pr-16">
                      <p className="text-sm font-semibold truncate">{song.title}</p>
                      <p onClick={(e) => { e.stopPropagation(); if (song.artist && song.artist !== 'Unknown Artist' && song.artist !== '...') { navigate(`/artist/${encodeURIComponent(song.artist)}`); } }} className="text-xs text-[color:var(--muted)] truncate cursor-pointer hover:text-pink-400 hover:underline transition-colors" title={`Zobrazit profil interpreta ${song.artist}`}>{song.artist}</p>
                    </div>

                    <div className="absolute right-0 top-0 bottom-0 flex w-10 flex-col border-l border-white/10 bg-white/[0.03] md:w-11 2xl:w-16">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playTrack(song);
                        }}
                        className="flex flex-1 items-center justify-center gap-1 border-b border-white/10 text-[#00ff99] transition hover:bg-white/10 2xl:flex-col 2xl:gap-0.5"
                        aria-label={`Play ${song.title || 'track'}`}
                        title="Play"
                      >
                        <FaPlay size={10} />
                        <span className="hidden 2xl:block text-[8px] leading-none">Play</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToQueue(song);
                        }}
                        className="flex flex-1 items-center justify-center gap-1 border-b border-white/10 text-white/75 transition hover:bg-white/10 hover:text-white 2xl:flex-col 2xl:gap-0.5"
                        aria-label={`Queue ${song.title || 'track'}`}
                        title="Queue"
                      >
                        <MdQueueMusic size={12} />
                        <span className="hidden 2xl:block text-[8px] leading-none">Queue</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addTrackToPlaylist(song);
                        }}
                        className="flex flex-1 items-center justify-center gap-1 text-pink-200 transition hover:bg-pink-500/20 2xl:flex-col 2xl:gap-0.5"
                        aria-label={`Save ${song.title || 'track'}`}
                        title="Save"
                      >
                        <FaPlus size={10} />
                        <span className="hidden 2xl:block text-[8px] leading-none">Save</span>
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-2 py-8 text-center text-white/30 text-sm">Loading trends...</div>
                )}
              </div>
            </section>

            {/* Quick Picks */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Quick picks (Most Played)</h3>
                <button className="text-sm text-[color:var(--muted)] hover:text-white">See all</button>
              </div>

              {quickPicks.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center text-white/30 text-sm">
                  Play some music to see your history here!
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {quickPicks.map((item, i) => (
                    <div key={i} onClick={() => playTrack(item)} className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-pink-500/30 cursor-pointer">
                      <div className="h-16 w-16 rounded-2xl bg-white/10 overflow-hidden relative">
                        <img src={item.thumbnail} className="h-full w-full object-cover" alt="" />
                        <button
                          onClick={() => playTrack(item)}
                          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
                          <FaPlay className="text-white" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-hidden pr-10 md:pr-12 2xl:pr-16">
                        <p className="text-sm font-semibold truncate">{item.title}</p>
                        <p onClick={(e) => { e.stopPropagation(); if (item.artist && item.artist !== 'Unknown Artist' && item.artist !== '...') { navigate(`/artist/${encodeURIComponent(item.artist)}`); } }} className="text-xs text-[color:var(--muted)] truncate cursor-pointer hover:text-pink-400 hover:underline transition-colors" title={`Zobrazit profil interpreta ${item.artist}`}>{item.artist}</p>
                        <p className="text-[10px] text-pink-400 mt-1">{item.count} plays</p>
                      </div>

                      <div className="absolute right-0 top-0 bottom-0 flex w-10 flex-col border-l border-white/10 bg-white/[0.03] md:w-11 2xl:w-16">
                        <button
                          onClick={(e) => { e.stopPropagation(); playTrack(item); }}
                          className="flex flex-1 items-center justify-center gap-1 border-b border-white/10 text-[#00ff99] transition hover:bg-white/10 2xl:flex-col 2xl:gap-0.5"
                          aria-label={`Play ${item.title || 'track'}`}
                        >
                          <FaPlay size={10} />
                          <span className="hidden 2xl:block text-[8px] leading-none">Play</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); addToQueue(item); }}
                          className="flex flex-1 items-center justify-center gap-1 border-b border-white/10 text-white/75 transition hover:bg-white/10 hover:text-white 2xl:flex-col 2xl:gap-0.5"
                          aria-label={`Queue ${item.title || 'track'}`}
                        >
                          <MdQueueMusic size={12} />
                          <span className="hidden 2xl:block text-[8px] leading-none">Queue</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); addTrackToPlaylist(item); }}
                          className="flex flex-1 items-center justify-center gap-1 text-pink-200 transition hover:bg-pink-500/20 2xl:flex-col 2xl:gap-0.5"
                          aria-label={`Save ${item.title || 'track'}`}
                        >
                          <FaPlus size={10} />
                          <span className="hidden 2xl:block text-[8px] leading-none">Save</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>

          {/* --- RIGHT SIDEBAR --- */}
          <aside className="hidden space-y-6 xl:flex xl:flex-col h-[calc(100vh-var(--player-offset)-96px)] sticky top-24">
            <TokenCompartment
              tokenWallet={tokenWallet}
              onRefresh={loadTokenWallet}
              onClaimQuest={handleClaimQuest}
              onSpendTokens={handleSpendTokens}
              leaderboard={tokenLeaderboard}
              loading={tokenLoading}
              isLoggedIn={Boolean(user)}
            />

            <div className="rounded-3xl border border-white/10 bg-[color:var(--panel)]/80 p-5 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
                  <MdQueueMusic className="text-[14px]" />
                  {rightPanelMode === 'playlist' ? (activePlaylist?.name || 'Playlist') : 'Queue'}
                </p>
                <span className="text-[10px] text-white/30">
                  {rightPanelMode === 'playlist' ? `${activePlaylist?.tracks?.length || 0} tracks` : `${queue.length} tracks`}
                </span>
              </div>

              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() => setRightPanelMode('queue')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${rightPanelMode === 'queue' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                >
                  <MdQueueMusic className="text-[12px]" />
                  Queue
                </button>
                <button
                  onClick={() => setRightPanelMode('playlist')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${rightPanelMode === 'playlist' ? 'bg-pink-500/25 text-pink-100' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                >
                  <FaCloudDownloadAlt className="text-[11px]" />
                  Playlist
                </button>
              </div>

              <div className="mt-2 flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {rightPanelMode === 'playlist' ? (
                  activePlaylist?.tracks?.length ? (
                    activePlaylist.tracks.map((track, index) => (
                      <div
                        key={`${track.webpage_url || track.title}-${index}`}
                        onClick={() => playFromPlaylist(activePlaylist.tracks, index)}
                        className={`flex items-center gap-3 p-2 rounded-xl transition cursor-pointer ${isActiveTrack(track) ? 'bg-pink-500/10 border border-pink-500/20' : 'hover:bg-white/5 border border-transparent'}`}
                      >
                        <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 relative">
                          {track.thumbnail ? (
                            <img src={track.thumbnail} className={`h-full w-full object-cover ${isActiveTrack(track) ? 'opacity-40' : ''}`} alt="" />
                          ) : (
                            <div className="h-full w-full bg-white/10" />
                          )}
                          {isActiveTrack(track) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-1 h-3 bg-[#00ff00] animate-pulse mx-[1px]"></div>
                              <div className="w-1 h-4 bg-[#00ff00] animate-pulse mx-[1px]"></div>
                              <div className="w-1 h-2 bg-[#00ff00] animate-pulse mx-[1px]"></div>
                            </div>
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className={`text-xs font-bold truncate ${isActiveTrack(track) ? 'text-[#00ff00]' : 'text-white'}`}>{track.title}</p>
                          <p className="text-[10px] text-[color:var(--muted)] truncate">{track.artist}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-white/20 text-center">
                      <FaPlus className="text-xl mb-2 opacity-50" />
                      <p className="text-xs">Playlist is empty</p>
                    </div>
                  )
                ) : queue.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 text-center">
                    <MdQueueMusic className="text-3xl mb-2 opacity-50" />
                    <p className="text-xs">Queue is empty</p>
                  </div>
                ) : (
                  queue.map((track, i) => (
                    <div
                      key={i}
                      onClick={() => playFromQueue(i)}
                      className={`flex items-center gap-3 p-2 rounded-xl transition cursor-pointer ${playbackSource === 'queue' && i === queueIndex ? 'bg-pink-500/10 border border-pink-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                      <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 relative">
                        <img src={track.thumbnail} className={`h-full w-full object-cover ${playbackSource === 'queue' && i === queueIndex ? 'opacity-40' : ''}`} alt="" />
                        {playbackSource === 'queue' && i === queueIndex && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-1 h-3 bg-[#00ff00] animate-pulse mx-[1px]"></div>
                            <div className="w-1 h-4 bg-[#00ff00] animate-pulse mx-[1px]"></div>
                            <div className="w-1 h-2 bg-[#00ff00] animate-pulse mx-[1px]"></div>
                          </div>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className={`text-xs font-bold truncate ${playbackSource === 'queue' && i === queueIndex ? 'text-[#00ff00]' : 'text-white'}`}>{track.title}</p>
                        <p className="text-[10px] text-[color:var(--muted)] truncate">{track.artist}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* --- BOTTOM PLAYER --- */}
        <div className="fixed bottom-0 left-0 right-0 z-[100] px-2 pb-3 sm:px-3 sm:pb-4">
          <div className="mx-auto max-w-[1580px] rounded-3xl border border-white/10 bg-[color:var(--panel)]/95 px-4 py-3 backdrop-blur sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">

              <div className="flex items-center gap-4 w-full sm:w-1/4 sm:min-w-[200px]">
                {currentTrack.thumbnail ? (
                  <div className="h-12 w-12 rounded-2xl overflow-hidden relative group">
                    <img src={currentTrack.thumbnail} className="h-full w-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition"></div>
                  </div>
                ) : (
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                    <MdQueueMusic className="text-white/50" />
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-sm font-semibold truncate cursor-pointer hover:underline">{currentTrack.title}</p>
                  <p onClick={(e) => { e.stopPropagation(); if (currentTrack.artist && currentTrack.artist !== 'Unknown Artist' && currentTrack.artist !== '...') { navigate(`/artist/${encodeURIComponent(currentTrack.artist)}`); } }} className="text-xs text-[color:var(--muted)] truncate cursor-pointer hover:text-pink-400 hover:underline transition-colors" title={`Zobrazit profil interpreta ${currentTrack.artist}`}>{currentTrack.artist}</p>
                </div>
                <FaHeart className="ml-2 text-white/20 hover:text-pink-500 transition cursor-pointer" />
              </div>

              <div className="flex flex-col items-center w-full sm:flex-1 sm:max-w-lg">
                <div className="flex items-center gap-6 mb-1">
                  <button
                    className={`player-skip ${isPlaying ? 'is-stop' : 'is-play'}`}
                    onClick={handlePrevTrack}
                    aria-label="Previous track"
                  >
                    <span className="player-skip__glyph" aria-hidden="true">{"\u23EA"}</span>
                  </button>

                  <button
                    onClick={togglePlayback}
                    className={`player-toggle ${isPlaying ? 'is-stop' : 'is-play'}`}
                    aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
                  >
                    <span className="player-toggle__glow" aria-hidden="true" />
                    {isPlaying ? (<FaPause style={iconStyle} className="relative z-10 text-white fill-current drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" />)
                      : (<FaPlay style={iconStyle} className="ml-0.5 relative z-10 text-white fill-current drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]" />)}
                  </button>

                  <button
                    className={`player-skip ${isPlaying ? 'is-stop' : 'is-play'}`}
                    onClick={handleNextTrack}
                    aria-label="Next track"
                  >
                    <span className="player-skip__glyph" aria-hidden="true">{"\u23E9"}</span>
                  </button>
                </div>

                <div className="w-full flex items-center gap-3 text-xs sm:text-[15px] text-pink-500 font-bold ">
                  <span>{formatTime(currentTime)}</span>
                  <div className="flex-1 h-1 bg-white/10 rounded-full relative group cursor-pointer">
                    <div
                      className="absolute top-0 left-0 h-full bg-[#00ff00] rounded-full group-hover:bg-[#00cc00]"
                      style={{ width: `${(currentTime / duration) * 100}%` }}>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        audioRef.current.currentTime = val;
                        setCurrentTime(val);
                      }}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="hidden items-center gap-3 w-1/4 justify-end sm:flex">
                <button
                  onClick={cycleLoopMode}
                  title={loopMode === 0 ? "Loop off" : loopMode === 1 ? "Loop all" : "Loop one"}
                  className={`transition ${
                    loopMode === 0 ? 'text-[color:var(--muted)] hover:text-white' : 'text-pink-500'
                  }`}
                >
                  {loopMode === 2 ? (
                    <div className="relative">
                      <FaRedo style={iconStyle} />
                      <span className="absolute top-0 right-0 text-[10px] font-bold">1</span>
                    </div>
                  ) : loopMode === 1 ? (
                    <FaRetweet style={iconStyle} />
                  ) : (
                    <FaBan style={iconStyle} />
                  )}
                </button>
                <FaVolumeUp className="text-[color:var(--muted)]" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

export default App
