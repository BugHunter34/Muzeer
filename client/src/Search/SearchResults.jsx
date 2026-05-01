import React, { useEffect, useState } from 'react';
import { FaPlay, FaSearch } from 'react-icons/fa';
import { MdQueueMusic } from 'react-icons/md';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MEDIA_API_BASE_URL } from '../config';

const ui = {
  page: {
    minHeight: '100vh',
    background: '#06080c',
    color: '#ffffff',
    fontFamily: 'Segoe UI, Tahoma, sans-serif',
    padding: '20px'
  },
  shell: {
    maxWidth: '1100px',
    margin: '0 auto'
  },
  row: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  input: {
    flex: '1 1 340px',
    minWidth: '220px',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #3b4a5c',
    background: '#111821',
    color: '#fff'
  },
  button: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #4d5f75',
    background: '#1a2430',
    color: '#fff',
    cursor: 'pointer'
  },
  card: {
    border: '1px solid #2f3b4a',
    borderRadius: '10px',
    background: '#0d141d',
    padding: '12px',
    marginTop: '10px'
  },
  track: {
    borderTop: '1px solid #243243',
    padding: '10px 0',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    alignItems: 'center'
  }
};

const storageGet = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const storageSet = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore blocked storage in restrictive TV webviews
  }
};

export default function SearchResults() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialQuery.trim()) {
      setResults([]);
      setError('');
      return;
    }

    const fetchResults = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${MEDIA_API_BASE_URL}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: initialQuery })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Search failed');
        }

        const resultsArray = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [data];
        setResults(resultsArray.filter(r => r && r.title));
      } catch (err) {
        setResults([]);
        setError(err.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [initialQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchParams({ q: trimmed });
  };

  const addToQueue = () => {
    if (!results.length) return;
    const currentQueue = JSON.parse(storageGet('queue') || '[]');
    const newQueue = [...currentQueue, ...results];
    storageSet('queue', JSON.stringify(newQueue));
    alert(`Added ${results.length} tracks to queue`);
  };

  const playAllResults = () => {
    if (!results.length) return;
    storageSet('searchPlaylist', JSON.stringify(results));
    storageSet('searchPlaylistIndex', '0');
    storageSet('pendingTrack', JSON.stringify(results[0]));
    navigate('/');
  };

  const playTrack = (track) => {
    storageSet('pendingTrack', JSON.stringify(track));
    const trackIndex = results.indexOf(track);
    if (trackIndex !== -1) {
      const remainingTracks = results.slice(trackIndex);
      storageSet('searchPlaylist', JSON.stringify(remainingTracks));
      storageSet('searchPlaylistIndex', '0');
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full" style={ui.page}>
      <div style={ui.shell}>
        <div style={{ ...ui.row, justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <p style={{ margin: 0, color: '#9fb2c8', fontSize: '12px' }}>Search for Music</p>
            <h1 style={{ margin: '4px 0 0 0', fontSize: '28px' }}>
              {initialQuery ? `Results for "${initialQuery}"` : 'Search Results'}
            </h1>
          </div>
          <button onClick={() => navigate('/')} style={ui.button}>Back Home</button>
        </div>

        <form onSubmit={handleSubmit} style={{ ...ui.row, marginBottom: '12px' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={ui.input}
            placeholder={loading ? 'Searching...' : 'Type song name or URL...'}
          />
          <button type="submit" style={ui.button}>Search</button>
        </form>

        {!initialQuery && <div style={ui.card}>Type a query and press Search.</div>}
        {loading && <div style={ui.card}>Searching for "{initialQuery}"...</div>}
        {error && !loading && <div style={{ ...ui.card, borderColor: '#7f2f2f', color: '#ffb0b0' }}>{error}</div>}

        {results.length > 0 && !loading && (
          <div style={ui.card}>
            <h2 style={{ marginTop: 0 }}>Search Playlist ({results.length} tracks)</h2>
            <div style={{ ...ui.row, marginBottom: '8px' }}>
              <button onClick={playAllResults} style={ui.button}><FaPlay /> Play All</button>
              <button onClick={addToQueue} style={ui.button}><MdQueueMusic /> Queue All</button>
            </div>

            {results.map((track, index) => (
              <div key={index} style={ui.track}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: '#9fb2c8', fontSize: '12px' }}>#{index + 1}</div>
                  <div style={{ fontWeight: 700 }}>{track.title}</div>
                  <div style={{ color: '#a7b7ca', fontSize: '13px' }}>{track.artist}</div>
                  {track.duration && (
                    <div style={{ color: '#8f9fb2', fontSize: '12px' }}>
                      {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                    </div>
                  )}
                </div>
                <button onClick={() => playTrack(track)} style={ui.button}>Play</button>
              </div>
            ))}
          </div>
        )}

        {!loading && results.length === 0 && initialQuery && (
          <div style={ui.card}>No results found for "{initialQuery}"</div>
        )}
      </div>
    </div>
  );
}
