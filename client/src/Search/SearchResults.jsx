import React, { useEffect, useState } from 'react';
import { FaPlay, FaSearch } from 'react-icons/fa';
import { MdQueueMusic } from 'react-icons/md';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function SearchResults() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialQuery.trim()) {
      setResult(null);
      setError('');
      return;
    }

    const fetchResult = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('http://localhost:3000/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: initialQuery })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Search failed');
        }

        setResult(data);
      } catch (err) {
        setResult(null);
        setError(err.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [initialQuery]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchParams({ q: trimmed });
  };

  const addToQueue = () => {
    if (!result) return;
    const currentQueue = JSON.parse(localStorage.getItem('queue') || '[]');
    const newQueue = [...currentQueue, result];
    localStorage.setItem('queue', JSON.stringify(newQueue));
    alert('Added to local queue.');
  };

  const playInMuzeer = () => {
    if (!result) return;
    localStorage.setItem('pendingTrack', JSON.stringify(result));
    navigate('/');
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_8%_18%,rgba(48,214,197,0.18),transparent_42%),radial-gradient(circle_at_78%_15%,rgba(255,180,84,0.16),transparent_46%),radial-gradient(circle_at_55%_85%,rgba(22,67,87,0.35),transparent_55%),#06080c] text-white">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-white/45">Search</p>
            <h1 className="mt-1 text-3xl font-semibold">Search Results</h1>
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

        {result && !loading && (
          <section className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-900/10 to-transparent p-5 sm:p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              {result.thumbnail ? (
                <img src={result.thumbnail} alt="Thumbnail" className="h-40 w-40 rounded-3xl object-cover shadow-[0_10px_40px_rgba(236,72,153,0.3)]" />
              ) : (
                <div className="h-40 w-40 rounded-3xl bg-gradient-to-br from-pink-500 to-rose-500" />
              )}

              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-pink-500/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-pink-300">Top Result</span>
                </div>
                <h2 className="text-2xl font-bold">{result.title}</h2>
                <p className="mb-4 mt-1 text-sm text-white/60">{result.artist}</p>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={playInMuzeer}
                    className="inline-flex items-center gap-2 rounded-full bg-[#00ff00] px-6 py-2.5 text-sm font-bold text-black transition hover:scale-105 hover:bg-[#00cc00]"
                  >
                    <FaPlay /> Play in Muzeer
                  </button>
                  <button
                    onClick={addToQueue}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <MdQueueMusic /> Queue
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
