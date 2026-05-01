import React, { useEffect, useState } from 'react';
import { FaPlay, FaSearch } from 'react-icons/fa';
import { MdQueueMusic } from 'react-icons/md';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MEDIA_API_BASE_URL } from '../config';

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
    const currentQueue = JSON.parse(localStorage.getItem('queue') || '[]');
    const newQueue = [...currentQueue, ...results];
    localStorage.setItem('queue', JSON.stringify(newQueue));
    alert(`Added ${results.length} tracks to queue`);
  };

  const playAllResults = () => {
    if (!results.length) return;
    localStorage.setItem('searchPlaylist', JSON.stringify(results));
    localStorage.setItem('searchPlaylistIndex', '0');
    localStorage.setItem('pendingTrack', JSON.stringify(results[0]));
    navigate('/');
  };

  const playTrack = (track) => {
    localStorage.setItem('pendingTrack', JSON.stringify(track));
    const trackIndex = results.indexOf(track);
    if (trackIndex !== -1) {
      const remainingTracks = results.slice(trackIndex);
      localStorage.setItem('searchPlaylist', JSON.stringify(remainingTracks));
      localStorage.setItem('searchPlaylistIndex', '0');
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_8%_18%,rgba(48,214,197,0.18),transparent_42%),radial-gradient(circle_at_78%_15%,rgba(255,180,84,0.16),transparent_46%),radial-gradient(circle_at_55%_85%,rgba(22,67,87,0.35),transparent_55%),#06080c] text-white pb-24">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/45">Search for Music</p>
            <h1 className="mt-1 text-3xl font-semibold">
              {initialQuery ? `Results for "${initialQuery}"` : 'Search Results'}
            </h1>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
          >
            Back Home
          </button>
        </header>

        <form onSubmit={handleSubmit} className="relative mb-7 flex w-full items-center gap-3 group">
          <FaSearch className="absolute left-4 text-white/30 group-focus-within:text-pink-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-pink-500/50 focus:outline-none"
            placeholder={loading ? 'Searching...' : 'Type song name or URL...'}
          />
          <button
            type="submit"
            className="rounded-full bg-pink-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-pink-400"
          >
            Search
          </button>
        </form>

        {!initialQuery && (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/45">
            Type a query and press Search.
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/45">
            Searching for “{initialQuery}”...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-rose-300">
            {error}
          </div>
        )}

        {results.length > 0 && !loading && (
          <section className="space-y-4">
            <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-900/10 to-transparent p-6">
              <h2 className="text-2xl font-bold mb-4">Search Playlist ({results.length} tracks)</h2>
              
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={playAllResults}
                  className="inline-flex items-center gap-2 rounded-full bg-[#00ff00] px-6 py-3 text-sm font-bold text-black transition hover:scale-105 hover:bg-[#00cc00]"
                >
                  <FaPlay /> Play All
                </button>
                <button
                  onClick={addToQueue}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <MdQueueMusic /> Queue All
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {results.map((track, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="text-white/40 font-semibold min-w-[2rem]">#{index + 1}</span>
                    
                    {track.thumbnail ? (
                      <div className="h-14 w-14 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center flex-shrink-0">
                        <MdQueueMusic className="text-white/50" />
                      </div>
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{track.title}</p>
                      <p className="text-sm text-white/60 truncate">{track.artist}</p>
                      {track.duration && (
                        <p className="text-xs text-white/40 mt-1">
                          {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => playTrack(track)}
                      className="rounded-full bg-pink-500 p-2.5 text-white transition hover:bg-pink-600 opacity-0 group-hover:opacity-100 transform scale-0 group-hover:scale-100"
                      title="Play this track"
                    >
                      <FaPlay size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && results.length === 0 && initialQuery && (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/45">
            No results found for "{initialQuery}"
          </div>
        )}
      </div>
    </div>
  );
}
