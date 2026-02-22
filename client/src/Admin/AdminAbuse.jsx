import React, { useEffect, useState } from 'react';
import { FaSearch, FaShieldAlt, FaTrash, FaUserShield } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function AdminAbuse() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tokenAmountByUser, setTokenAmountByUser] = useState({});
  const [tokenUpdatingUserId, setTokenUpdatingUserId] = useState('');
  const [tokenActions, setTokenActions] = useState([]);
  const [tokenControl, setTokenControl] = useState({
    symbol: 'MUZR',
    qualifiedSecondsPerToken: 180,
    maxSecondsPerEvent: 60,
    maxDailyQualifiedSeconds: 7200,
    minTrackEventIntervalSeconds: 8,
    rewardsPaused: false,
    allowAdminMintBurn: true
  });
  const [savingTokenControl, setSavingTokenControl] = useState(false);
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

  const fetchTokenActions = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/token-actions', {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) return;

      setTokenActions(Array.isArray(data) ? data : []);
    } catch (err) {
    }
  };

  const fetchTokenControl = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/admin/token-control', {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) return;

      setTokenControl((prev) => ({
        ...prev,
        ...data
      }));
    } catch (err) {
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTokenActions();
    fetchTokenControl();
  }, []);

  const updateTokenControlField = (field, value) => {
    setTokenControl((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const saveTokenControl = async () => {
    try {
      setSavingTokenControl(true);
      const payload = {
        symbol: String(tokenControl.symbol || 'MUZR').toUpperCase(),
        qualifiedSecondsPerToken: Number(tokenControl.qualifiedSecondsPerToken),
        maxSecondsPerEvent: Number(tokenControl.maxSecondsPerEvent),
        maxDailyQualifiedSeconds: Number(tokenControl.maxDailyQualifiedSeconds),
        minTrackEventIntervalSeconds: Number(tokenControl.minTrackEventIntervalSeconds),
        rewardsPaused: Boolean(tokenControl.rewardsPaused),
        allowAdminMintBurn: Boolean(tokenControl.allowAdminMintBurn)
      };

      const response = await fetch('http://localhost:3000/api/admin/token-control', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        alert(data?.message || `Failed to update token control (HTTP ${response.status})`);
        return;
      }

      setTokenControl((prev) => ({ ...prev, ...(data.control || {}) }));
      alert('Token control updated');
    } catch (err) {
      alert('Server error while updating token control');
    } finally {
      setSavingTokenControl(false);
    }
  };

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

  const setTokenAmountForUser = (userId, value) => {
    setTokenAmountByUser((prev) => ({
      ...prev,
      [userId]: value
    }));
  };

  const adjustUserTokens = async (userId, direction) => {
    const rawValue = tokenAmountByUser[userId] ?? '1';
    const parsedAmount = Number(rawValue);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Enter a valid positive token amount.');
      return;
    }

    const amount = Math.floor(parsedAmount);
    const delta = direction === 'mint' ? amount : -amount;

    try {
      setTokenUpdatingUserId(userId);
      const res = await fetch(`http://localhost:3000/api/admin/users/${userId}/token`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to adjust tokens');
        return;
      }

      fetchUsers();
      fetchTokenActions();
    } catch (err) {
      alert('Server error while adjusting tokens');
    } finally {
      setTokenUpdatingUserId('');
    }
  };

  const setUserTokenBalance = async (userId) => {
    const rawValue = tokenAmountByUser[userId] ?? '0';
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      alert('Enter a valid non-negative balance.');
      return;
    }

    const balance = Math.floor(parsed);

    try {
      setTokenUpdatingUserId(userId);
      const res = await fetch(`http://localhost:3000/api/admin/users/${userId}/token`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Failed to set user token balance');
        return;
      }

      fetchUsers();
      fetchTokenActions();
    } catch (err) {
      alert('Server error while setting token balance');
    } finally {
      setTokenUpdatingUserId('');
    }
  };

  // 4. Real-time Search Filter
  const filteredUsers = users.filter(u => 
    u.userName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen w-full overflow-y-auto bg-[radial-gradient(circle_at_8%_18%,rgba(48,214,197,0.18),transparent_42%),radial-gradient(circle_at_78%_15%,rgba(255,180,84,0.16),transparent_46%),radial-gradient(circle_at_55%_85%,rgba(22,67,87,0.35),transparent_55%),#06080c] text-white">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6">
        
        {/* HEADER */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-yellow-400/80">God Mode</p>
            <h1 className="mt-1 text-3xl font-semibold text-yellow-400">Admin Abuse Center</h1>
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
          <FaSearch className="absolute right-4 text-white/30 group-focus-within:text-yellow-400" />
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

        {!loading && !error && (
          <section className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-cyan-200">Global Token Control</h2>
              <button
                onClick={saveTokenControl}
                disabled={savingTokenControl}
                className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
              >
                {savingTokenControl ? 'Saving...' : 'Save Control'}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-white/75">
                Symbol
                <input value={tokenControl.symbol || ''} onChange={(e) => updateTokenControlField('symbol', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
              </label>
              <label className="text-xs text-white/75">
                Sec / Token
                <input type="number" min="1" value={tokenControl.qualifiedSecondsPerToken ?? 180} onChange={(e) => updateTokenControlField('qualifiedSecondsPerToken', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
              </label>
              <label className="text-xs text-white/75">
                Max Sec / Event
                <input type="number" min="1" value={tokenControl.maxSecondsPerEvent ?? 60} onChange={(e) => updateTokenControlField('maxSecondsPerEvent', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
              </label>
              <label className="text-xs text-white/75">
                Daily Sec Cap
                <input type="number" min="1" value={tokenControl.maxDailyQualifiedSeconds ?? 7200} onChange={(e) => updateTokenControlField('maxDailyQualifiedSeconds', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
              </label>
              <label className="text-xs text-white/75 sm:col-span-2 lg:col-span-1">
                Min Track Cooldown (sec)
                <input type="number" min="0" value={tokenControl.minTrackEventIntervalSeconds ?? 8} onChange={(e) => updateTokenControlField('minTrackEventIntervalSeconds', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:border-cyan-400/50 focus:outline-none" />
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85">
                <input type="checkbox" checked={Boolean(tokenControl.rewardsPaused)} onChange={(e) => updateTokenControlField('rewardsPaused', e.target.checked)} />
                Rewards Paused
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85">
                <input type="checkbox" checked={Boolean(tokenControl.allowAdminMintBurn)} onChange={(e) => updateTokenControlField('allowAdminMintBurn', e.target.checked)} />
                Allow Admin Mint/Burn
              </label>
            </div>
          </section>
        )}

        {!loading && !error && (
          <section className="mb-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-emerald-200">Recent Token Admin Actions</h2>
              <button
                onClick={fetchTokenActions}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10"
              >
                Refresh
              </button>
            </div>
            {tokenActions.length === 0 ? (
              <p className="mt-3 text-xs text-white/60">No token admin actions yet.</p>
            ) : (
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1 text-xs text-white/80">
                {tokenActions.slice(0, 8).map((action) => (
                  <div key={action._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                    <span className="truncate">
                      {action.adminUserName} → {action.targetUserName} ({action.delta > 0 ? '+' : ''}{action.delta} {action.symbol || 'MUZR'})
                    </span>
                    <span className="text-white/50">
                      {new Date(action.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* USER LIST RESULTS */}
        {!loading && !error && (
          <div className="grid max-h-[62vh] gap-4 overflow-y-auto pr-1">
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
                        <p className="text-xs text-emerald-300/80 mt-1">
                          Token balance: {u.tokenWallet?.balance || 0} {u.tokenWallet?.symbol || 'MUZR'}
                        </p>
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

                  <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Token Control</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={tokenAmountByUser[u._id] ?? '1'}
                        onChange={(e) => setTokenAmountForUser(u._id, e.target.value)}
                        className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:border-emerald-400/50 focus:outline-none"
                      />
                      <button
                        onClick={() => adjustUserTokens(u._id, 'mint')}
                        disabled={tokenUpdatingUserId === u._id}
                        className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-60"
                      >
                        Mint
                      </button>
                      <button
                        onClick={() => adjustUserTokens(u._id, 'burn')}
                        disabled={tokenUpdatingUserId === u._id}
                        className="rounded-full border border-red-400/40 bg-red-500/15 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/25 disabled:opacity-60"
                      >
                        Burn
                      </button>
                      <button
                        onClick={() => setUserTokenBalance(u._id)}
                        disabled={tokenUpdatingUserId === u._id}
                        className="rounded-full border border-cyan-300/40 bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-60"
                      >
                        Set Exact
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