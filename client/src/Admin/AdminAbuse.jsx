import React, { useEffect, useState } from 'react';
import { FaSearch, FaShieldAlt, FaTrash, FaUserShield } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function AdminAbuse() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 1. Fetch all users on load
  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/users', {
        method: 'GET',
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Access Denied');
      
      // Safety check in case backend sends { users: [...] } instead of [...]
      setUsers(Array.isArray(data) ? data : (data.users || []));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 2. Handle Promote/Demote
  const toggleRole = async (userId) => {
    try {
      const res = await fetch(`http://localhost:3000/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Failed to update role");
        return;
      }
      fetchUsers(); // Refresh the list to show new role
    } catch (err) {
      alert("Server error while updating role");
    }
  };

  // 3. Handle Nuke User
  const nukeUser = async (userId, userName) => {
    if (!window.confirm(`Are you SURE you want to eradicate ${userName}? This cannot be undone.`)) return;
    
    try {
      const res = await fetch(`http://localhost:3000/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Failed to nuke user");
        return;
      }
      fetchUsers(); // Refresh the list
    } catch (err) {
      alert("Server error while nuking user");
    }
  };

  // 4. Real-time Search Filter
  const filteredUsers = users.filter(u => 
    u.userName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(circle_at_8%_18%,rgba(48,214,197,0.18),transparent_42%),radial-gradient(circle_at_78%_15%,rgba(255,180,84,0.16),transparent_46%),radial-gradient(circle_at_55%_85%,rgba(22,67,87,0.35),transparent_55%),#06080c] text-white">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
        
        {/* HEADER */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-yellow-400/80">God Mode</p>
            <h1 className="mt-1 text-3xl font-semibold text-yellow-400">Admin Command Center</h1>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
          >
            Back Home
          </button>
        </header>

        {/* SEARCH BAR */}
        <div className="relative mb-7 flex w-full items-center gap-3 group">
          <FaSearch className="absolute left-4 text-white/30 group-focus-within:text-yellow-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-yellow-400/50 focus:outline-none transition-all"
            placeholder="Search users by name or email..."
          />
        </div>

        {/* ERROR / LOADING STATES */}
        {loading && <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/45">Fetching database...</div>}
        {error && <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-rose-300">{error}</div>}

        {/* USER LIST RESULTS */}
        {!loading && !error && (
          <div className="grid gap-4">
            {filteredUsers.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/45">
                No users match your search.
              </div>
            ) : (
              filteredUsers.map(u => (
                <section key={u._id} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-5 transition hover:border-yellow-400/30 hover:bg-white/10">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    
                    {/* User Info */}
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center font-bold text-xl uppercase">
                        {u.userName ? u.userName.charAt(0) : '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold">{u.userName}</h2>
                          {u.role === 'admin' && <FaUserShield className="text-yellow-400" title="Admin" />}
                        </div>
                        <p className="text-sm text-white/60">{u.email}</p>
                      </div>
                    </div>

                    {/* Admin Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => toggleRole(u._id)}
                        className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition ${
                          u.role === 'admin' 
                            ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20' 
                            : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                        }`}
                      >
                        <FaShieldAlt /> {u.role === 'admin' ? 'Revoke Admin' : 'Grant Admin'}
                      </button>
                      
                      <button
                        onClick={() => nukeUser(u._id, u.userName)}
                        className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-5 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500 hover:text-white"
                      >
                        <FaTrash /> Nuke User
                      </button>
                    </div>

                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}