import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import './App.css'
import './index.css'
import { FaPlay, FaPause, FaVolumeUp, FaPlus, FaHeart, FaSearch, FaSlidersH, FaTrash } from 'react-icons/fa'
import { MdQueueMusic } from 'react-icons/md'
import TokenCompartment from './components/TokenCompartment'

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
  recentClaims: []
}

const detectLowPowerDevice = () => {
  if (typeof window === 'undefined') return false

  const nav = window.navigator
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection
  const lowCpu = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4
  const saveData = Boolean(connection?.saveData)
  const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)

  return lowCpu || lowMemory || saveData || reducedMotion
}

const DEFAULT_PLAYLISTS = [
  { id: 'daily-mix-1', name: 'Daily Mix 1', tracks: [] },
  { id: 'chill-focus', name: 'Chill Focus', tracks: [] }
]

function App() {
  const [appName] = useState('Muzeer')
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const serverBase = "http://localhost:3000";

  // ✅ 1) Sync user (localStorage + event userUpdated + storage)
  useEffect(() => {
    const syncUser = () => {
      const savedUser = localStorage.getItem('user');
      setUser(savedUser ? JSON.parse(savedUser) : null);
    };

    syncUser();
    window.addEventListener("userUpdated", syncUser);
    window.addEventListener("storage", syncUser);

    return () => {
      window.removeEventListener("userUpdated", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  // ✅ Avatar URL helper (for sidebar etc.)
  const avatarSrc =
    user?.avatarUrl
      ? (user.avatarUrl.startsWith("http")
        ? user.avatarUrl
        : `${serverBase}${user.avatarUrl}`)
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
    const saved = window.localStorage.getItem('muzeer-potato-mode')
    if (saved === '1') return true
    if (saved === '0') return false
    return detectLowPowerDevice()
  })

  // --- Playlist & Queue State ---
  const [playlists, setPlaylists] = useState(DEFAULT_PLAYLISTS)
  const [activePlaylistId, setActivePlaylistId] = useState(DEFAULT_PLAYLISTS[0].id)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [rightPanelMode, setRightPanelMode] = useState('queue')
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)

  // --- Audio Player State ---
  const audioRef = useRef(null);
  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.crossOrigin = "anonymous";
  }
  const ambienceRef = useRef(null)
  const wavesRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const dataArrayRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const rafRef = useRef(null)
  const searchRevealTimerRef = useRef(null)
  const searchFetchProgressTimerRef = useRef(null)
  const searchFinalizeProgressTimerRef = useRef(null)
  const searchSmoothProgressTimerRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTrack, setCurrentTrack] = useState({
    title: 'Select a track',
    artist: '...',
    thumbnail: null,
    audio_url: null
  })

useEffect(() => {
  if (!user) return;

  const heartbeat = setInterval(async () => {
    try {
      const res = await fetch('http://localhost:3000/api/auth/verify', {
        method: 'GET',
        credentials: 'include'
      });

      // 401: Token Expired, Missing, or User Deleted
      if (res.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.dispatchEvent(new Event("userUpdated"));
        // Optional: redirect to login
      } 
      
      // 403: User is actively BANNED in the database
      else if (res.status === 403) {
        const data = await res.json();
        if (data.isBanned) {
          localStorage.setItem('banned', 'true');
          localStorage.removeItem('user');
          localStorage.removeItem('token');
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
    if (!user || !isPlaying || !currentTrack.title) return;

    const presenceSync = setInterval(async () => {
      try {
        await fetch('http://localhost:3000/api/me/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: currentTrack.title,
            artist: currentTrack.artist,
            webpage_url: currentTrack.webpage_url,
            currentTime: audioRef.current.currentTime
          })
        });

        const tokenRes = await fetch('http://localhost:3000/api/token/listen-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title: currentTrack.title,
            artist: currentTrack.artist,
            isPlaying: true,
            listenedSeconds: 10
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
            recentClaims: Array.isArray(tokenData.recentClaims) ? tokenData.recentClaims : prev.recentClaims
          }));
        }
      } catch (err) {
        console.error("Failed to sync presence", err);
      }
    }, 10000);

    return () => clearInterval(presenceSync);
  }, [user, isPlaying, currentTrack]);

  const loadTokenWallet = async () => {
    if (!user) return;

    setTokenLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/token/wallet', {
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
        recentClaims: Array.isArray(data.recentClaims) ? data.recentClaims : []
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
      const res = await fetch('http://localhost:3000/api/token/leaderboard', {
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
      const res = await fetch('http://localhost:3000/api/token/claim-quest', {
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
      const res = await fetch('http://localhost:3000/api/token/spend', {
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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('muzeer-playlists')
      const parsed = raw ? JSON.parse(raw) : null
      if (!Array.isArray(parsed) || parsed.length === 0) return

      const sanitized = parsed
        .filter((playlist) => playlist && typeof playlist.name === 'string')
        .map((playlist, idx) => ({
          id: playlist.id || `playlist-${Date.now()}-${idx}`,
          name: playlist.name.trim() || `Playlist ${idx + 1}`,
          tracks: Array.isArray(playlist.tracks) ? playlist.tracks : []
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
    window.localStorage.setItem('muzeer-playlists', JSON.stringify(playlists))
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
        const res = await fetch('http://localhost:5000/api/trending')
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

      fetch('http://localhost:3000/api/auth/presence', {
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

    const onPlay = () => updatePresence(true);
    const onPause = () => updatePresence(false);
    const onSeeked = () => updatePresence(true);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('seeked', onSeeked);

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

      stopVisualizer();
    }
  }, [currentTrack]);

  // --- LOGIC: LOCAL PLAY COUNT ---
  const recordPlay = (track) => {
    const history = JSON.parse(localStorage.getItem('playHistory') || '[]')
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
    localStorage.setItem('playHistory', JSON.stringify(history))
    loadQuickPicks()
  }

  const loadQuickPicks = () => {
    const history = JSON.parse(localStorage.getItem('playHistory') || '[]')
    const sorted = history.sort((a, b) => b.count - a.count).slice(0, 6)
    setQuickPicks(sorted)
  }

  // --- LOGIC: PLAYER ---
  const handleNextTrack = () => {
    if (queue.length > queueIndex + 1) {
      const nextIndex = queueIndex + 1
      setQueueIndex(nextIndex)
      playTrack(queue[nextIndex], false)
    } else {
      setIsPlaying(false)
      stopVisualizer()
    }
  }

  const handlePrevTrack = () => {
    if (queueIndex > 0) {
      const prevIndex = queueIndex - 1
      setQueueIndex(prevIndex)
      playTrack(queue[prevIndex], false)
    }
  }

  const setupAudioGraph = () => {
    if (audioContextRef.current) return;
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return;

    try {
      const ctx = new AudioContextConstructor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      let source = sourceNodeRef.current;
      if (!source) {
        source = ctx.createMediaElementSource(audioRef.current);
        sourceNodeRef.current = source;
      }

      try { source.disconnect(); } catch (e) { }

      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (err) {
      console.warn('Audio graph setup safely skipped:', err.message);
    }
  }

  const updateVisualizer = () => {
    const analyser = analyserRef.current
    const dataArray = dataArrayRef.current
    const container = wavesRef.current
    if (!analyser || !dataArray) return
    analyser.getByteFrequencyData(dataArray)
    if (container) {
      const lowBand = Math.max(1, Math.floor(dataArray.length * 0.35))
      let sum = 0
      for (let i = 0; i < lowBand; i += 1) sum += dataArray[i]
      const energy = sum / (lowBand * 255)
      container.style.setProperty('--hz-energy', energy.toFixed(3))
      if (ambienceRef.current) ambienceRef.current.style.setProperty('--hz-energy', energy.toFixed(3))
    }
    rafRef.current = requestAnimationFrame(updateVisualizer)
  }

  const startVisualizer = async () => {
    if (potatoMode) {
      stopVisualizer()
      return
    }

    try {
      setupAudioGraph()
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
    } catch (err) {
      console.warn('Audio context resume failed:', err)
    } finally {
      if (!rafRef.current && analyserRef.current) {
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
    if (container) container.style.setProperty('--hz-energy', '0')
    if (ambienceRef.current) ambienceRef.current.style.setProperty('--hz-energy', '0')
  }

  useEffect(() => {
    window.localStorage.setItem('muzeer-potato-mode', potatoMode ? '1' : '0')
    if (potatoMode) {
      stopVisualizer()
    }
  }, [potatoMode])

  const playTrack = async (track, isNewPlay = true) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }

    let streamUrl = track.proxy_url || track.audio_url

    if (!streamUrl && track.webpage_url) {
      setLoading(true)
      try {
        const res = await fetch('http://localhost:5000/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: track.webpage_url }),
        })
        const data = await res.json()
        streamUrl = data.proxy_url || data.audio_url
        track = { ...track, ...data }
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

  const playFromQueue = (index) => {
    setQueueIndex(index)
    playTrack(queue[index], true)
  }

  const togglePlayback = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
      stopVisualizer()
    } else {
      await startVisualizer()
      audioRef.current.play().catch(e => console.log("Playback error:", e))
      setIsPlaying(true)
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
    const pendingTrackRaw = localStorage.getItem('pendingTrack')
    if (!pendingTrackRaw) return

    try {
      const pendingTrack = JSON.parse(pendingTrackRaw)
      if (pendingTrack) {
        playTrack(pendingTrack).then((played) => {
          localStorage.removeItem('pendingTrack')
          if (!played) {
            // autoplay blocked – ok
          }
        })
      }
    } catch {
      localStorage.removeItem('pendingTrack')
    }
  }, [])

  const handleAuthMock = () => {
    if (user) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event("userUpdated"));
      setUser(null);
    } else {
      navigate('/login');
    }
  };

  const handleRegisterMock = () => {
    if (user) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
      const response = await fetch('http://localhost:5000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

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
    <div className={`app-shell h-screen overflow-hidden text-[color:var(--ink)] ${potatoMode ? 'potato-mode' : ''}`} style={themeVars}>
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
            <div ref={wavesRef} className={`hz-waves hz-liquid ${isPlaying ? 'is-playing' : 'is-paused'}`} aria-hidden="true">
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
          </>
        )}
      </div>

      <div className="app-content">
        {/* --- NAVBAR --- */}
        <nav className="nav-shell sticky top-0 z-50 mx-auto w-full max-w-[1600px] rounded-b-3xl border-b border-white/10 bg-[color:var(--panel)]/95 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-4 sm:px-5">
            <div className="flex items-center gap-3">
              <div className="brand-mark h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-300 to-amber-400 flex items-center justify-center font-bold text-black">M</div>
              <span className="brand-title font-bold tracking-wide text-lg bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-amber-200">
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
                  <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Theme</p>
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
                    <span className="text-xs text-[color:var(--muted)] opacity-0 group-hover:opacity-100 transition">›</span>
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
                            onClick={() => playTrack(result)}
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
                            onClick={() => playTrack(result)}
                            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500"
                            aria-label={`Play ${result.title || 'track'}`}
                          >
                            <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition group-hover:opacity-100">
                              <FaPlay className="text-white" />
                            </div>
                          </button>
                        )}

                        <div className="min-w-0 flex-1 pr-16 md:pr-24 xl:pr-28">
                          <p className="truncate text-lg font-semibold">{result.title || 'Unknown title'}</p>
                          <p className="mt-1 truncate text-sm text-white/60">{result.artist || 'Unknown artist'}</p>
                        </div>

                        <div className="absolute right-0 top-0 bottom-0 flex w-14 flex-col border-l border-white/10 bg-white/[0.03] md:w-20 xl:w-24">
                          <button
                            onClick={() => playTrack(result)}
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
                      <p className="text-xs text-[color:var(--muted)] truncate">{song.artist}</p>
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
                    <div key={i} className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-pink-500/30">
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
                        <p className="text-xs text-[color:var(--muted)] truncate">{item.artist}</p>
                        <p className="text-[10px] text-pink-400 mt-1">{item.count} plays</p>
                      </div>

                      <div className="absolute right-0 top-0 bottom-0 flex w-10 flex-col border-l border-white/10 bg-white/[0.03] md:w-11 2xl:w-16">
                        <button
                          onClick={() => playTrack(item)}
                          className="flex flex-1 items-center justify-center gap-1 border-b border-white/10 text-[#00ff99] transition hover:bg-white/10 2xl:flex-col 2xl:gap-0.5"
                          aria-label={`Play ${item.title || 'track'}`}
                        >
                          <FaPlay size={10} />
                          <span className="hidden 2xl:block text-[8px] leading-none">Play</span>
                        </button>
                        <button
                          onClick={() => addToQueue(item)}
                          className="flex flex-1 items-center justify-center gap-1 border-b border-white/10 text-white/75 transition hover:bg-white/10 hover:text-white 2xl:flex-col 2xl:gap-0.5"
                          aria-label={`Queue ${item.title || 'track'}`}
                        >
                          <MdQueueMusic size={12} />
                          <span className="hidden 2xl:block text-[8px] leading-none">Queue</span>
                        </button>
                        <button
                          onClick={() => addTrackToPlaylist(item)}
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
                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
                  {rightPanelMode === 'playlist' ? (activePlaylist?.name || 'Playlist') : 'Queue'}
                </p>
                <span className="text-[10px] text-white/30">
                  {rightPanelMode === 'playlist' ? `${activePlaylist?.tracks?.length || 0} tracks` : `${queue.length} tracks`}
                </span>
              </div>

              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() => setRightPanelMode('queue')}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${rightPanelMode === 'queue' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                >
                  Queue
                </button>
                <button
                  onClick={() => setRightPanelMode('playlist')}
                  className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${rightPanelMode === 'playlist' ? 'bg-pink-500/25 text-pink-100' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                >
                  Playlist
                </button>
              </div>

              <div className="mt-2 flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {rightPanelMode === 'playlist' ? (
                  activePlaylist?.tracks?.length ? (
                    activePlaylist.tracks.map((track, index) => (
                      <div
                        key={`${track.webpage_url || track.title}-${index}`}
                        onClick={() => playTrack(track)}
                        className="flex items-center gap-3 p-2 rounded-xl transition cursor-pointer hover:bg-white/5 border border-transparent"
                      >
                        <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 relative">
                          {track.thumbnail ? (
                            <img src={track.thumbnail} className="h-full w-full object-cover" alt="" />
                          ) : (
                            <div className="h-full w-full bg-white/10" />
                          )}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold truncate text-white">{track.title}</p>
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
                      className={`flex items-center gap-3 p-2 rounded-xl transition cursor-pointer ${i === queueIndex ? 'bg-pink-500/10 border border-pink-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                      <div className="h-10 w-10 rounded-lg overflow-hidden shrink-0 relative">
                        <img src={track.thumbnail} className={`h-full w-full object-cover ${i === queueIndex ? 'opacity-40' : ''}`} alt="" />
                        {i === queueIndex && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-1 h-3 bg-[#00ff00] animate-pulse mx-[1px]"></div>
                            <div className="w-1 h-4 bg-[#00ff00] animate-pulse mx-[1px]"></div>
                            <div className="w-1 h-2 bg-[#00ff00] animate-pulse mx-[1px]"></div>
                          </div>
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <p className={`text-xs font-bold truncate ${i === queueIndex ? 'text-[#00ff00]' : 'text-white'}`}>{track.title}</p>
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
                  <p className="text-xs text-[color:var(--muted)] truncate">{currentTrack.artist}</p>
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
                    <span className="player-skip__glyph" aria-hidden="true">⏮</span>
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
                    <span className="player-skip__glyph" aria-hidden="true">⏭</span>
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