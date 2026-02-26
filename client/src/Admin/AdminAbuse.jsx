import React, { useEffect, useState } from 'react';
import { FaSearch, FaShieldAlt, FaTrash, FaUserShield, FaBan, FaCrown } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function AdminAbuse() {
  const navigate = useNavigate();
  const currentUser = (() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  const isSystemOwner = currentUser?.role === 'owner';
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [logsSearchQuery, setLogsSearchQuery] = useState('');
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
    if (!isSystemOwner) {
      alert('Only system owners can update Muzeercoin control settings.');
      return;
    }

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
  const toggleRole = async (userId, currentRole) => {
    if (currentRole === 'owner') return; // Extra safety: prevent touching owners

    const newRole = currentRole === 'admin' ? 'user' : 'admin';

    try {
      const res = await fetch(`http://localhost:3000/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }) // Tell the backend exactly what we want
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Failed to update role");
        return;
      }

      // Optimistic UI update so it feels instant
      setUsers((prevUsers) => 
        prevUsers.map((u) => 
          u._id === userId ? { ...u, role: newRole } : u
        )
      );
      fetchTokenActions();
      
    } catch (err) {
      alert("Server error while updating role");
    }
  };

  // 3. Handle Ban User (Soft Delete / Suspension)
  const toggleBan = async (userId, userName, isCurrentlyBanned) => {
    const action = isCurrentlyBanned ? "unban" : "ban";
    if (!window.confirm(`Are you sure you want to ${action} ${userName}?`)) return;

    try {
      const res = await fetch(`http://localhost:3000/api/admin/users/${userId}/ban`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBanned: !isCurrentlyBanned })
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || `Failed to ${action} user`);
        return;
      }
      fetchUsers(); // Refresh the list
      fetchTokenActions();
    } catch (err) {
      alert(`Server error while trying to ${action} user`);
    }
  };

  // 4. Handle Nuke User (Hard Delete)
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
      fetchTokenActions();
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
    if (!isSystemOwner) {
      alert('Only system owners can mint or burn Muzeercoin.');
      return;
    }

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
    if (!isSystemOwner) {
      alert('Only system owners can set Muzeercoin balances.');
      return;
    }

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

  // Real-time Search Filter
  const filteredUsers = users.filter(u => 
    u.userName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getLogTone = (actionType) => {
    switch (actionType) {
      case 'ban_user':
        return 'border-orange-400/30 bg-orange-500/10 text-orange-100';
      case 'unban_user':
        return 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100';
      case 'grant_admin':
        return 'border-amber-400/30 bg-amber-500/10 text-amber-100';
      case 'revoke_admin':
        return 'border-yellow-300/30 bg-yellow-500/10 text-yellow-100';
      case 'delete_user':
        return 'border-rose-400/30 bg-rose-500/10 text-rose-100';
      case 'token_adjust':
      case 'token_set_balance':
        return 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100';
      case 'token_control_update':
        return 'border-violet-400/30 bg-violet-500/10 text-violet-100';
      default:
        return 'border-white/15 bg-white/5 text-white/90';
    }
  };

  const getTokenLogText = (action) => {
    const adminName = action.adminUserName || 'unknown';

    if (action.actionType === 'token_adjust') {
      const delta = Number(action.delta || 0);
      const actionName = delta >= 0 ? 'mint' : 'burn';
      return `${adminName}: ${actionName} ${Math.abs(delta)} ${action.symbol || 'MUZR'} ${delta >= 0 ? 'to' : 'from'} ${action.targetUserName || 'user'}`;
    }

    if (action.actionType === 'token_set_balance') {
      return `${adminName}: set ${action.resultingBalance ?? 0} ${action.symbol || 'MUZR'} for ${action.targetUserName || 'user'}`;
    }

    if (action.actionType === 'token_control_update') {
      const changes = [];
      if (action.metadata && typeof action.metadata === 'object') {
        if (Object.prototype.hasOwnProperty.call(action.metadata, 'symbol')) {
          changes.push(`symbol=${action.metadata.symbol}`);
        }
        if (Object.prototype.hasOwnProperty.call(action.metadata, 'rewardsPaused')) {
          changes.push(`rewardsPaused=${action.metadata.rewardsPaused}`);
        }
        if (Object.prototype.hasOwnProperty.call(action.metadata, 'allowAdminMintBurn')) {
          changes.push(`allowAdminMintBurn=${action.metadata.allowAdminMintBurn}`);
        }
      }
      return `${adminName}: edited ${changes.join(', ') || 'token settings'}`;
    }

    return null;
  };

  const getReadableLogText = (action) => {
    const tokenText = getTokenLogText(action);
    if (tokenText) return tokenText;

    const adminName = action.adminUserName || 'unknown';

    if (action.summary) {
      return `${adminName}: ${action.summary}`;
    }

    if (action.actionType) {
      return `${adminName}: ${action.actionType.replace(/_/g, ' ')}`;
    }

    if (action.metadata && typeof action.metadata === 'object') {
      if (Object.prototype.hasOwnProperty.call(action.metadata, 'isBanned')) {
        return `${adminName}: ${action.metadata.isBanned ? 'Banned' : 'Unbanned'} ${action.targetUserName || 'user'}`;
      }
      if (Object.prototype.hasOwnProperty.call(action.metadata, 'role') && action.targetUserName) {
        return `${adminName}: ${action.metadata.role === 'admin' ? 'Granted admin to' : 'Revoked admin from'} ${action.targetUserName}`;
      }
    }

    if (typeof action.delta === 'number') {
      const delta = Number(action.delta || 0);
      const actionName = delta > 0 ? 'mint' : delta < 0 ? 'burn' : 'set';
      const details = delta === 0
        ? `${action.resultingBalance ?? 0} ${action.symbol || 'MUZR'} for ${action.targetUserName || 'user'}`
        : `${Math.abs(delta)} ${action.symbol || 'MUZR'} ${delta > 0 ? 'to' : 'from'} ${action.targetUserName || 'user'}`;
      return `${adminName}: ${actionName} ${details}`;
    }

    if (action.targetUserName) {
      return `${adminName}: Updated ${action.targetUserName}`;
    }

    return `${adminName}: Logged event`;
  };

  const filteredTokenActions = tokenActions.filter((action) => {
    const query = logsSearchQuery.trim().toLowerCase();
    if (!query) return true;

    const searchable = [
      getReadableLogText(action),
      action.adminUserName,
      action.targetUserName,
      action.summary,
      action.actionType
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(query);
  });

  return (
    <div className="admin-scrollbar h-screen w-full overflow-y-auto bg-[radial-gradient(circle_at_8%_18%,rgba(48,214,197,0.18),transparent_42%),radial-gradient(circle_at_78%_15%,rgba(255,180,84,0.16),transparent_46%),radial-gradient(circle_at_55%_85%,rgba(22,67,87,0.35),transparent_55%),#06080c] text-white">
      <div className="mx-auto w-full max-w-[1700px] px-4 py-8 sm:px-6">
        
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

        {/* ERROR / LOADING STATES */}
        {loading && <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/45">Fetching database...</div>}
        {error && <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-rose-300">{error}</div>}

        {!loading && !error && (
          <div className="grid items-start gap-6 xl:grid-cols-[440px_1fr_440px]">
            <aside className="space-y-6 xl:sticky xl:top-6">
              <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-cyan-200">Global Token Control</h2>
                  <button
                    onClick={saveTokenControl}
                    disabled={savingTokenControl || !isSystemOwner}
                    className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100 transition hover:bg-cyan-500/20 disabled:opacity-60"
                  >
                    {savingTokenControl ? 'Saving...' : 'Save Control'}
                  </button>
                </div>
                {!isSystemOwner && (
                  <p className="mb-3 text-sm text-cyan-100/70">Only system owner can edit Muzeercoin settings.</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <label className="text-sm text-white/75">
                    Symbol
                    <input disabled={!isSystemOwner} value={tokenControl.symbol || ''} onChange={(e) => updateTokenControlField('symbol', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-base text-white focus:border-cyan-400/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                  </label>
                  <label className="text-sm text-white/75">
                    Sec / Token
                    <input disabled={!isSystemOwner} type="number" min="1" value={tokenControl.qualifiedSecondsPerToken ?? 180} onChange={(e) => updateTokenControlField('qualifiedSecondsPerToken', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-base text-white focus:border-cyan-400/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                  </label>
                  <label className="text-sm text-white/75">
                    Max Sec / Event
                    <input disabled={!isSystemOwner} type="number" min="1" value={tokenControl.maxSecondsPerEvent ?? 60} onChange={(e) => updateTokenControlField('maxSecondsPerEvent', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-base text-white focus:border-cyan-400/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                  </label>
                  <label className="text-sm text-white/75">
                    Daily Sec Cap
                    <input disabled={!isSystemOwner} type="number" min="1" value={tokenControl.maxDailyQualifiedSeconds ?? 7200} onChange={(e) => updateTokenControlField('maxDailyQualifiedSeconds', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-base text-white focus:border-cyan-400/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                  </label>
                  <label className="text-sm text-white/75">
                    Min Track Cooldown (sec)
                    <input disabled={!isSystemOwner} type="number" min="0" value={tokenControl.minTrackEventIntervalSeconds ?? 8} onChange={(e) => updateTokenControlField('minTrackEventIntervalSeconds', e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-base text-white focus:border-cyan-400/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60" />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                    <input disabled={!isSystemOwner} type="checkbox" checked={Boolean(tokenControl.rewardsPaused)} onChange={(e) => updateTokenControlField('rewardsPaused', e.target.checked)} />
                    Rewards Paused
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                    <input disabled={!isSystemOwner} type="checkbox" checked={Boolean(tokenControl.allowAdminMintBurn)} onChange={(e) => updateTokenControlField('allowAdminMintBurn', e.target.checked)} />
                    Allow Admin Mint/Burn
                  </label>
                </div>
              </section>
            </aside>

            <main>
              <div className="relative mb-5 flex w-full items-center gap-3 group">
                <FaSearch className="absolute right-4 text-white/30 group-focus-within:text-yellow-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-yellow-400/50 focus:outline-none transition-all"
                  placeholder="Search users by name or email..."
                />
              </div>

              {/* USER LIST RESULTS */}
              <div className="admin-scrollbar grid max-h-[74vh] gap-4 overflow-y-auto pr-1">
                {filteredUsers.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-10 text-center text-white/45">
                    No users match your search.
                  </div>
                ) : (
                  filteredUsers.map(u => (
                    <section key={u._id} className={`rounded-2xl border transition p-5 ${u.isBanned ? 'border-orange-500/40 bg-orange-500/5' : 'border-white/10 bg-gradient-to-br from-white/5 to-transparent hover:border-yellow-400/30 hover:bg-white/10'}`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    
                    {/* User Info */}
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-xl uppercase ${u.isBanned ? 'bg-orange-500/50 text-orange-200' : 'bg-gradient-to-br from-pink-500 to-rose-500'}`}>
                        {u.userName ? u.userName.charAt(0) : '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className={`text-xl font-bold ${u.isBanned ? 'line-through text-white/60' : ''}`}>{u.userName}</h2>
                          
                          {/* Role Badges */}
                          {u.role === 'owner' && <FaCrown className="text-purple-400" title="Server Owner" />}
                          {u.role === 'admin' && <FaUserShield className="text-yellow-400" title="Admin" />}
                          
                          {u.isBanned && <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded">Banned</span>}
                        </div>
                        <p className="text-sm text-white/60">{u.email}</p>
                        <p className="mt-1 text-xs text-emerald-300/80">
                          Token balance: {u.tokenWallet?.balance || 0} {u.tokenWallet?.symbol || 'MUZR'}
                        </p>
                      </div>
                    </div>

                    {/* Admin Action Buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                      
                      {/* Only show Grant/Revoke if the user is NOT an owner */}
                      {u.role !== 'owner' ? (
                        <button
                          onClick={() => toggleRole(u._id, u.role)}
                          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition ${
                            u.role === 'admin' 
                              ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-400 hover:bg-yellow-400/20' 
                              : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                          }`}
                        >
                          <FaShieldAlt /> {u.role === 'admin' ? 'Revoke Admin' : 'Grant Admin'}
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-5 py-2 text-sm font-medium text-purple-300 cursor-not-allowed">
                          <FaCrown /> System Owner
                        </span>
                      )}

                      {/* Ban Toggle Button (Also hidden for owners, you can't ban the boss) */}
                      {u.role !== 'owner' && (
                        <button
                          onClick={() => toggleBan(u._id, u.userName, u.isBanned)}
                          className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition ${
                            u.isBanned
                              ? 'border-orange-500/50 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20'
                              : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                          }`}
                        >
                          <FaBan /> {u.isBanned ? 'Unban User' : 'Ban User'}
                        </button>
                      )}
                      
                      {/* Existing Nuke Button (Hidden for owners) */}
                      {u.role !== 'owner' && (
                        <button
                          onClick={() => nukeUser(u._id, u.userName)}
                          className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-5 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500 hover:text-white"
                        >
                          <FaTrash /> Nuke User
                        </button>
                      )}
                    </div>

                  </div>

                  <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80">Token Control</p>
                    {!isSystemOwner && (
                      <p className="mt-2 text-xs text-emerald-100/70">Only system owner can edit user Muzeercoin balance.</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        disabled={!isSystemOwner}
                        value={tokenAmountByUser[u._id] ?? '1'}
                        onChange={(e) => setTokenAmountForUser(u._id, e.target.value)}
                        className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white focus:border-emerald-400/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <button
                        onClick={() => adjustUserTokens(u._id, 'mint')}
                        disabled={tokenUpdatingUserId === u._id || !isSystemOwner}
                        className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-4 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-60"
                      >
                        Mint
                      </button>
                      <button
                        onClick={() => adjustUserTokens(u._id, 'burn')}
                        disabled={tokenUpdatingUserId === u._id || !isSystemOwner}
                        className="rounded-full border border-red-400/40 bg-red-500/15 px-4 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/25 disabled:opacity-60"
                      >
                        Burn
                      </button>
                      <button
                        onClick={() => setUserTokenBalance(u._id)}
                        disabled={tokenUpdatingUserId === u._id || !isSystemOwner}
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
            </main>

            <aside className="space-y-6 xl:sticky xl:top-6">
              <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-emerald-200">Logs</h2>
                  <button
                    onClick={fetchTokenActions}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
                  >
                    Refresh
                  </button>
                </div>
                <div className="relative mt-3 flex w-full items-center gap-2 group">
                  <FaSearch className="absolute right-4 text-white/30 group-focus-within:text-emerald-300" />
                  <input
                    type="text"
                    value={logsSearchQuery}
                    onChange={(e) => setLogsSearchQuery(e.target.value)}
                    className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-4 pr-10 text-sm text-white placeholder:text-white/40 focus:border-emerald-400/50 focus:outline-none transition-all"
                    placeholder="Search logs..."
                  />
                </div>
                {tokenActions.length === 0 ? (
                  <p className="mt-3 text-sm text-white/60">No admin logs yet.</p>
                ) : filteredTokenActions.length === 0 ? (
                  <p className="mt-3 text-sm text-white/60">No logs match your search.</p>
                ) : (
                  <div className="admin-scrollbar mt-3 max-h-[74vh] space-y-2 overflow-y-auto pr-1 text-base text-white/85">
                    {filteredTokenActions.slice(0, 20).map((action) => (
                      <div key={action._id} className={`rounded-lg border px-3 py-2 ${getLogTone(action.actionType)}`}>
                        <p className="text-base font-medium text-white/90">
                          {getReadableLogText(action)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-sm text-white/65">
                          <span className="text-white/50">
                            {new Date(action.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}