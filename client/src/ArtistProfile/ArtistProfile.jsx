import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

export default function ArtistProfile() {
  const { name } = useParams(); 
  const navigate = useNavigate();
  
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchArtist = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/artist/info?name=${encodeURIComponent(name)}`);
        
        if (!response.ok) {
          throw new Error('Nepodařilo se načíst informace o interpretovi.');
        }
        
        const data = await response.json();
        setArtist(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (name) {
      fetchArtist();
    }
  }, [name]);

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_8%_18%,rgba(48,214,197,0.18),transparent_42%),radial-gradient(circle_at_78%_15%,rgba(255,180,84,0.16),transparent_46%),radial-gradient(circle_at_55%_85%,rgba(22,67,87,0.35),transparent_55%),#06080c] text-white">
      <div className="mx-auto w-full max-w-[1000px] px-4 py-8 sm:px-6">
        
      
        <button
          onClick={() => navigate(-1)}
          className="mb-8 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
        >
          ← Zpět
        </button>

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/45 animate-pulse">
            Načítám profil pro "{name}"...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-rose-300">
            {error}
          </div>
        )}

        {artist && !loading && (
          <div className="rounded-3xl border border-pink-500/20 bg-gradient-to-br from-pink-500/10 via-purple-900/10 to-transparent p-6 sm:p-10">
            <div className="flex flex-col gap-8 md:flex-row md:items-start">
              
             
              {artist.imageUrl ? (
                <img 
                  src={artist.imageUrl} 
                  alt={artist.name} 
                  className="h-48 w-48 rounded-full object-cover shadow-[0_10px_40px_rgba(236,72,153,0.3)] md:h-64 md:w-64 border-4 border-white/10" 
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-4xl font-bold md:h-64 md:w-64">
                  {artist.name.charAt(0)}
                </div>
              )}

             
              <div className="flex-1">
                <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">{artist.name}</h1>
                
                
                {artist.tags && artist.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {artist.tags.slice(0, 5).map(tag => (
                      <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

               
                <div className="mt-6 text-white/70 leading-relaxed text-sm sm:text-base">
                  {artist.bio ? (
                    <div dangerouslySetInnerHTML={{ __html: artist.bio }} />
                  ) : (
                    <p className="italic opacity-50">Biografie není k dispozici.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}