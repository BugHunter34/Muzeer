import React from 'react'
import { FaCoins } from 'react-icons/fa'

function TokenCompartment({ tokenWallet, onRefresh, loading, isLoggedIn }) {
  const handleOpenTokenModule = () => {
    console.log('Token module hook: add wallet/reward logic here')
  }

  const pendingMinutes = Math.floor((tokenWallet?.pendingQualifiedSeconds || 0) / 60)
  const dailyRemainingMinutes = Math.floor((tokenWallet?.dailyRemainingSeconds || 0) / 60)
  const recentClaims = tokenWallet?.recentClaims || []

  return (
    <div className="rounded-3xl border border-emerald-400/20 bg-[color:var(--panel)]/80 p-5 shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FaCoins className="text-emerald-300" />
          <h3 className="text-sm font-semibold">Muzeer Token</h3>
        </div>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
          beta
        </span>
      </div>

      <div className="mt-4 space-y-2 text-xs text-[color:var(--muted)]">
        <p>Symbol: {tokenWallet?.symbol || 'MUZR'}</p>
        <p>Balance: {(tokenWallet?.balance || 0).toLocaleString()}</p>
        <p>Total earned: {(tokenWallet?.totalEarned || 0).toLocaleString()}</p>
        <p>Pending listen time: {pendingMinutes} min</p>
        <p>Pending est: {tokenWallet?.estimatedPendingTokens || 0} {(tokenWallet?.symbol || 'MUZR')}</p>
        <p>Daily remaining: {dailyRemainingMinutes} min</p>
      </div>

      {isLoggedIn && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70">Recent claims</p>
          {recentClaims.length === 0 ? (
            <p className="mt-2 text-xs text-white/60">No claims yet.</p>
          ) : (
            <div className="mt-2 space-y-1.5 text-xs text-white/80">
              {recentClaims.map((claim, idx) => (
                <div key={`${claim.createdAt}-${idx}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">+{claim.tokens} {(tokenWallet?.symbol || 'MUZR')}</span>
                  <span className="text-white/50">{new Date(claim.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoggedIn ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={handleOpenTokenModule}
            className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
          >
            Open Module
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/70">
          Login to activate listen-to-earn
        </p>
      )}
    </div>
  )
}

export default TokenCompartment
