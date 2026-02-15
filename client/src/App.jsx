import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import './App.css'
import './index.css'
// Make sure to install: npm install react-icons
import { FaPlay, FaPause, FaStepForward, FaStepBackward, FaVolumeUp, FaPlus, FaHeart, FaSearch, FaSlidersH } from 'react-icons/fa'
import { MdQueueMusic } from 'react-icons/md'

// Add this to your CSS or a style tag to force icons to show
const iconStyle = { display: 'inline-block', visibility: 'visible', opacity: 1 };

// --- Mock Data for Static UI Elements ---
const friends = [
  { name: 'Zoe', track: 'Pink Mirage', artist: 'Lumen' },
  { name: 'Kai', track: 'Aria', artist: 'Nightcaps' },
  { name: 'Mira', track: 'Light Trails', artist: 'Glasswave' },
]

function App() {
  const [appName] = useState('Muzeer') 

  // --- Auth State ---
  // null = guest, object = logged in. Toggle this to see 'My Account'
  const [user, setUser] = useState(null) 

  // --- Data State ---
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [featuredSongs, setFeaturedSongs] = useState([]) // Trending
  const [quickPicks, setQuickPicks] = useState([]) // Most Played
  const [loading, setLoading] = useState(false)

  // --- Theme State ---
  const [themeOpen, setThemeOpen] = useState(false)
  const [accentStart, setAccentStart] = useState('#3bf0d1')
  const [accentEnd, setAccentEnd] = useState('#ffb454')
  const [speakerGlow, setSpeakerGlow] = useState('#3bf0d1')
  const [intensity, setIntensity] = useState(1)
  
  // --- Playlist & Queue State ---
  const [playlists, setPlaylists] = useState(['Daily Mix 1', 'Chill Focus', 'Pinkwave Essentials']) 
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)

  // --- Audio Player State ---
  const audioRef = useRef(new Audio())
  const ambienceRef = useRef(null)
  const wavesRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const dataArrayRef = useRef(null)
  const sourceNodeRef = useRef(null)
  const rafRef = useRef(null)
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

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
    // 1. Fetch Trending
    const fetchTrending = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/trending')
        const data = await res.json()
        setFeaturedSongs(data)
      } catch (e) { console.error("Trending fetch error", e) }
    }
    fetchTrending()

    // 2. Load "Most Played"
    loadQuickPicks()

    // 3. Audio Listeners
    const audio = audioRef.current
    audio.crossOrigin = 'anonymous'
    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => setDuration(audio.duration)
    const onEnded = () => handleNextTrack()

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('ended', onEnded)
    audio.volume = volume

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('ended', onEnded)
      stopVisualizer()
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])


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
      const sorted = history.sort((a, b) => b.count - a.count).slice(0, 6) // Top 6
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
    if (audioContextRef.current) return
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextConstructor) return
    try {
      const ctx = new AudioContextConstructor()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      const source = ctx.createMediaElementSource(audioRef.current)
      source.connect(analyser)
      analyser.connect(ctx.destination)
      audioContextRef.current = ctx
      analyserRef.current = analyser
      sourceNodeRef.current = source
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount)
    } catch (err) {
      console.warn('Audio graph setup failed:', err)
      audioContextRef.current = null
      analyserRef.current = null
      sourceNodeRef.current = null
      dataArrayRef.current = null
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
      for (let i = 0; i < lowBand; i += 1) {
        sum += dataArray[i]
      }
      const energy = sum / (lowBand * 255)
      container.style.setProperty('--hz-energy', energy.toFixed(3))
      if (ambienceRef.current) {
        ambienceRef.current.style.setProperty('--hz-energy', energy.toFixed(3))
      }
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
    if (container) {
      container.style.setProperty('--hz-energy', '0')
    }
    if (ambienceRef.current) {
      ambienceRef.current.style.setProperty('--hz-energy', '0')
    }
  }

  const playTrack = async (track, isNewPlay = true) => {
    let streamUrl = track.proxy_url || track.audio_url

    // Fetch stream if missing (e.g. from Trending/History list)
    if (!streamUrl && track.webpage_url) {
      setLoading(true)
      try {
        const res = await fetch('http://localhost:3000/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: track.webpage_url }),
        })
        const data = await res.json()
        streamUrl = data.proxy_url || data.audio_url
        track = { ...track, ...data }
      } catch(e) { console.error(e) }
      setLoading(false)
    }

    if (!streamUrl) return
    
    if (isNewPlay) {
        recordPlay(track)
    }

    applyThemeFromImage(track.thumbnail, track)

    setCurrentTrack(track)
    audioRef.current.src = streamUrl
    audioRef.current.play().catch(e => console.log("Playback error:", e))
    setIsPlaying(true)
    startVisualizer()
  }

  const addToQueue = (track) => {
      const newQueue = [...queue, track]
      setQueue(newQueue)
  }

  const playFromQueue = (index) => {
      setQueueIndex(index)
      playTrack(queue[index], true) 
  }

  const navigate = useNavigate();


  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // If a token exists, you can consider the user "logged in" 
      // Ideally, you'd fetch the user profile from /api/auth/me here
      setUser({ name: 'User' }); 
    }
  }, []);

  const handleAuthMock = () => {
    if (user) {
      // Log out logic
      setUser(null);
      localStorage.removeItem('token'); // Clear the token on logout
    } else {
      // 3. Redirect to the login page instead of the alert
      navigate('/login');
    }
  };

  const handleRegisterMock = () => {
    if (user) {
      // Log out logic
      setUser(null);
      localStorage.removeItem('token'); // Clear the token on logout
    } else {
      // 3. Redirect to the login page instead of the alert
      navigate('/Register');
    }
  };

  const handleLogOutMock = () => {
    if (user) {
      // Log out logic
      setUser(null);
      localStorage.removeItem('token'); // Clear the token on logout
    } else {
      // 3. Redirect to the login page instead of the alert
      alert("Logging out")
    }
  };

  const createPlaylist = () => {
    alert("Database not operational")
  }
  // --- LOGIC: SEARCH ---
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!query) return
    setLoading(true)
    setSearchResult(null)
    try {
      const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setSearchResult(data)
    } catch (err) { console.error(err) } 
    finally { setLoading(false) }
  }

  // --- LOGIC: FORMATTER ---
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

          if (score > best.score) {
            best = { r, g, b, score }
          }
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

    img.onerror = () => {
      applyFallbackTheme(track)
    }
  }

  const themeVars = {
    '--accent-start': accentStart,
    '--accent-end': accentEnd,
    '--speaker-glow': speakerGlow,
    '--hz-intensity': intensity,
    '--bg-intensity': intensity,
  }

  return (
    <div className="app-shell h-screen overflow-hidden text-[color:var(--ink)]" style={themeVars}>
      {/* Background Ambience (Pinkwave) */}
      <div
        ref={ambienceRef}
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="liquid-flow" aria-hidden="true" />
        <div className={`edge-glow ${isPlaying ? 'is-playing' : 'is-paused'}`} aria-hidden="true" />
        <div
          className="absolute -left-32 top-10 h-72 w-72 rounded-full blur-[120px]"
          style={{ backgroundColor: accentEnd, opacity: 0.3 }}
        />
        <div
          className="absolute right-0 top-1/3 h-72 w-72 rounded-full blur-[140px]"
          style={{ backgroundColor: accentStart, opacity: 0.25 }}
        />
        <div
          className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full blur-[160px]"
          style={{ backgroundColor: speakerGlow, opacity: 0.2 }}
        />
        <div
          ref={wavesRef}
          className={`hz-waves hz-liquid ${isPlaying ? 'is-playing' : 'is-paused'}`}
          aria-hidden="true"
        >
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
             {/* Logo Section */}
             <div className="flex items-center gap-3">
                {/* Replace with <img src="/logo.png" /> if you have it */}
                <div className="brand-mark h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-300 to-amber-400 flex items-center justify-center font-bold text-black">M</div>
                <span className="brand-title font-bold tracking-wide text-lg bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 to-amber-200">
                  {appName}
                </span>
             </div>
             
             {/* Center Text */}
             <div className="brand-slogan hidden md:block text-xs font-medium tracking-[0.3em] uppercase text-white/50">
               Where Music Lives
             </div>

              {/* Auth + Theme */}
              <div className="relative flex items-center gap-3">
                  {user ? (
                      <span className="text-xs text-emerald-300">Welcome, {user.name}</span>
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
                          <span className="text-white/70">Gradient start</span>
                          <input
                            type="color"
                            value={accentStart}
                            onChange={(e) => setAccentStart(e.target.value)}
                            className="h-7 w-10 cursor-pointer rounded"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-white/70">Gradient end</span>
                          <input
                            type="color"
                            value={accentEnd}
                            onChange={(e) => setAccentEnd(e.target.value)}
                            className="h-7 w-10 cursor-pointer rounded"
                          />
                        </label>
                        <label className="flex items-center justify-between gap-3">
                          <span className="text-white/70">Speaker glow</span>
                          <input
                            type="color"
                            value={speakerGlow}
                            onChange={(e) => setSpeakerGlow(e.target.value)}
                            className="h-7 w-10 cursor-pointer rounded"
                          />
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

        {/* Main Grid Layout - WIDENED */}
        <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-6 px-4 pt-6 sm:px-5 lg:grid-cols-[260px_1fr_340px] lg:pt-8">
        
        {/* --- LEFT SIDEBAR (Nav & Auth) --- */}
        <aside className="hidden flex-col gap-6 lg:flex max-h-[calc(100vh-220px)]">
            <div className="rounded-3xl border border-white/10 bg-[color:var(--panel)]/80 p-5 backdrop-blur h-full flex flex-col">
                <div className="flex flex-col items-center gap-3 mb-6">
                    {/* Logo Image Placeholder */}
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-500/80 to-rose-500/80 shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center justify-center">
                        <img src="/logo.png" alt="M" className="h-12 w-12 object-contain" onError={(e) => e.target.style.display='none'} />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-semibold">{appName}</p>
                        <p className="text-xs text-[color:var(--muted)]">Pinkwave edition</p>
                    </div>
                </div>

                {/* Login / Auth Logic */}
                <div className="mb-6 border-b border-white/10 pb-6">
                    {user ? (
                        <div className="rounded-xl bg-white/5 p-3 text-center">
                            <div className="mx-auto h-10 w-10 rounded-full bg-pink-500 flex items-center justify-center font-bold text-black mb-2">
                                {user.name[0]}
                            </div>
                            <p className="text-sm font-semibold">My Account</p>
                            <button onClick={handleLogOutMock} className="text-xs text-pink-400 hover:text-pink-300 mt-1">Log Out</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={handleAuthMock} className="rounded-xl bg-pink-500 px-3 py-2 text-xs font-bold text-black hover:bg-pink-400 transition">
                                Login
                            </button>
                            <button onClick={handleRegisterMock} className="rounded-xl border border-white/10 px-3 py-2 text-xs hover:bg-white/5 transition">
                                Register
                            </button>
                        </div>
                    )}
                </div>

                <nav className="space-y-2 text-sm">
                    {['Home', 'Search', 'Your Library', 'Create Playlist'].map((item) => (
                    <button
                        key={item}
                        className="flex w-full items-center justify-between rounded-xl border border-transparent px-3 py-2 text-left transition hover:border-white/10 hover:bg-white/5 group"
                    >
                        <span>{item}</span>
                        <span className="text-xs text-[color:var(--muted)] opacity-0 group-hover:opacity-100 transition">›</span>
                    </button>
                    ))}
                </nav>

                <div className="mt-8 flex-1">
                    <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Playlists</p>
                        <button onClick={createPlaylist}><FaPlus className="text-[12px] text-white/40 cursor-pointer hover:text-white" /></button>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-[color:var(--muted)]">
                        {playlists.map((list) => (
                            <div key={list} className="rounded-lg px-2 py-1.5 transition hover:bg-white/5 hover:text-white cursor-pointer truncate">
                                {list}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </aside>

        {/* --- MIDDLE CONTENT (Search & Feed) --- */}
        <main className="min-w-0 space-y-6 overflow-y-auto pr-1 custom-scrollbar max-h-[calc(100vh-220px)]">
          <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-[color:var(--muted)]">Now Trending</p>
              <h1 className="mt-2 text-3xl font-semibold">Good evening, {user ? user.name : 'Guest'}</h1>
            </div>
            
            <form onSubmit={handleSearch} className="flex w-full items-center gap-3 relative group sm:w-auto">
                <FaSearch className="absolute left-4 text-white/30 group-focus-within:text-pink-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder:text-[color:var(--muted)] focus:border-pink-500/50 focus:outline-none sm:w-64 sm:focus:w-80 transition-all"
                  placeholder={loading ? "Searching..." : "Type song name or URL..."}
                />
            </form>
          </header>

          {/* Search Result */}
          {searchResult && (
            <section className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-900/10 to-transparent p-5 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    {searchResult.thumbnail ? (
                        <img src={searchResult.thumbnail} alt="Thumbnail" className="h-40 w-40 rounded-3xl object-cover shadow-[0_10px_40px_rgba(236,72,153,0.3)]" />
                    ) : (
                        <div className="h-40 w-40 rounded-3xl bg-gradient-to-br from-pink-500 to-rose-500" />
                    )}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                             <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300 text-[10px] font-bold uppercase tracking-wider">Top Result</span>
                        </div>
                        <h2 className="text-2xl font-bold">{searchResult.title}</h2>
                        <p className="text-white/60 text-sm mt-1 mb-4">{searchResult.artist}</p>
                        
                        <div className="flex gap-3">
                            <button 
                                onClick={() => playTrack(searchResult)}
                                className="flex items-center gap-2 rounded-full bg-[#00ff00] px-6 py-2.5 text-sm font-bold text-black transition hover:scale-105 hover:bg-[#00cc00]">
                                <FaPlay /> Play Now
                            </button>
                            <button 
                                onClick={() => addToQueue(searchResult)}
                                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10">
                                <MdQueueMusic /> Queue
                            </button>
                        </div>
                    </div>
                </div>
            </section>
          )}

          {/* Featured / Trending Section */}
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
                  className="group flex w-full min-w-0 max-w-full flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-pink-500/30 hover:bg-white/10 cursor-pointer min-[1180px]:flex-row min-[1180px]:items-center min-[1180px]:gap-4">
                    {/* 1. Thumbnail */}
                    <div className="relative h-16 w-16 min-w-[4rem]">
                        <img src={song.thumbnail} className="h-full w-full rounded-xl object-cover" alt="art" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-xl">
                            <FaPlay className="text-white" />
                        </div>
                    </div>

                    {/* 2. Text Content (Added flex-1 to push the button right) */}
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="text-sm font-semibold truncate">{song.title}</p>
                        <p className="text-xs text-[color:var(--muted)] truncate">{song.artist}</p>
                    </div>

                    {/* 3. Queue Button */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); // Stops the parent div from firing playTrack()
                            addToQueue(song);    // Swapped searchResult for the mapped 'song'
                        }}
                      className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 min-[1180px]:mt-0 min-[1180px]:w-auto min-[1180px]:shrink-0 min-[1180px]:px-4 min-[1180px]:text-sm"
                    >
                        <MdQueueMusic size={18} /> Queue
                    </button>
                </div>
                 )) : (
                    <div className="col-span-2 py-8 text-center text-white/30 text-sm">Loading trends...</div>
                 )}
             </div>
          </section>

          {/* Quick Picks (Most Played from LocalStorage) */}
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
                    <div key={i} className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-pink-500/30">
                    <div className="h-16 w-16 rounded-2xl bg-white/10 overflow-hidden relative">
                         <img src={item.thumbnail} className="h-full w-full object-cover" alt="" />
                         <button 
                            onClick={() => playTrack(item)}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
                            <FaPlay className="text-white" />
                         </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-semibold truncate">{item.title}</p>
                        <p className="text-xs text-[color:var(--muted)] truncate">{item.artist}</p>
                        <p className="text-[10px] text-pink-400 mt-1">{item.count} plays</p>
                    </div>
                    </div>
                ))}
                </div>
            )}
          </section>
        </main>

        {/* --- RIGHT SIDEBAR (Queue & Friends) --- */}
        <aside className="hidden space-y-6 xl:flex xl:flex-col h-[calc(100vh-220px)] sticky top-24">
          
          {/* Friends Widget */}
          <div className="rounded-3xl border border-white/10 bg-[color:var(--panel)]/80 p-5 shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Friend activity</h3>
              <button className="text-xs text-[color:var(--muted)]">Settings</button>
            </div>
            <div className="mt-4 space-y-4">
              {friends.map((friend) => (
                <div key={friend.name} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500" />
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold">{friend.name}</p>
                    <p className="text-xs text-[color:var(--muted)] truncate">
                      {friend.track} • {friend.artist}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Queue Widget (Dynamic) */}
          <div className="rounded-3xl border border-white/10 bg-[color:var(--panel)]/80 p-5 flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">Queue</p>
                <span className="text-[10px] text-white/30">{queue.length} tracks</span>
            </div>
            
            <div className="mt-2 flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {queue.length === 0 ? (
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
      <div className="fixed bottom-0 left-0 right-0 z-[100] px-4 pb-3 sm:px-5 sm:pb-4">
        <div className="mx-auto max-w-[1600px] rounded-3xl border border-white/10 bg-[color:var(--panel)]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          
          {/* Track Info */}
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

          {/* Controls */}
           <div className="flex flex-col items-center w-full sm:flex-1 sm:max-w-lg">
             <div className="flex items-center gap-6 mb-1">
                <button className="text-[color:var(--muted)] hover:text-white" onClick={handlePrevTrack}><FaStepBackward className="text-[#00ff00]"/></button>
                
                <button 
                    onClick={async () => {
                        if (isPlaying) {
                          audioRef.current.pause()
                          setIsPlaying(false)
                          stopVisualizer()
                          return
                        }
                        await startVisualizer()
                        audioRef.current.play().catch(e => console.log("Playback error:", e))
                        setIsPlaying(true)
                    }}
                    className="relative z-0 rounded-full bg-[#00ff00] flex items-center justify-center shadow-[0_0_15px_rgba(0,255,0,0.4)] hover:scale-110 transition text-black">
                    {isPlaying ? (<FaPause style={iconStyle} className="relative z-10 text-black fill-current"/>) 
                                : (<FaPlay style={iconStyle} className="ml-1 relative z-10 text-black fill-current" />)}
                </button>
                
                <button className="text-[color:var(--muted)] hover:text-white" onClick={handleNextTrack}><FaStepForward className="text-[#00ff00]"/></button>
             </div>
             
             {/* Progress Bar */}
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

          {/* Volume */}
          <div className="hidden items-center gap-3 w-1/4 justify-end sm:flex">
            <FaVolumeUp className="text-[color:var(--muted)]" />
            <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={volume} 
                onChange={(e) => {
                    const val = parseFloat(e.target.value)
                    setVolume(val)
                    audioRef.current.volume = val
                }}
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