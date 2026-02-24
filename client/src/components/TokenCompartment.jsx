import React, { useMemo, useState } from 'react'
import { FaCoins } from 'react-icons/fa'

function TokenCompartment({
  tokenWallet,
  onRefresh,
  onClaimQuest,
  onSpendTokens,
  leaderboard,
  loading,
  isLoggedIn
}) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const pendingMinutes = Math.floor((tokenWallet?.pendingQualifiedSeconds || 0) / 60)
  const dailyRemainingMinutes = Math.floor((tokenWallet?.dailyRemainingSeconds || 0) / 60)
  const recentClaims = tokenWallet?.recentClaims || []
  const quests = tokenWallet?.quests || []
  const spendCatalog = tokenWallet?.spendCatalog || []
  const capProgressPercent = Math.max(0, Math.min(100, Number(tokenWallet?.capProgressPercent || 0)))
  const nextTokenProgress = Math.max(0, Math.min(100, Number(tokenWallet?.progressToNextToken || 0)))
  const nextTokenMinutesLeft = Number.isFinite(Number(tokenWallet?.remainingMinutesToNextToken))
    ? Number(tokenWallet?.remainingMinutesToNextToken)
    : Number((Math.max(0, (tokenWallet?.qualifiedSecondsPerToken || 180) - (tokenWallet?.pendingQualifiedSeconds || 0)) / 60).toFixed(1))

  const nextClaimableQuest = useMemo(
    () => quests.find((quest) => quest.completed && !quest.claimed),
    [quests]
  )

  const cheapestSpend = useMemo(() => {
    if (!spendCatalog.length) return null
    return [...spendCatalog].sort((a, b) => (a.cost || 0) - (b.cost || 0))[0]
  }, [spendCatalog])

  const questSummary = nextClaimableQuest
    ? `Quest ready: ${nextClaimableQuest.title}`
    : 'No quest reward ready'

  return (
    <div className="rounded-3xl border border-emerald-400/20 bg-[color:var(--panel)]/80 p-4 shrink-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] text-white/70">
            <FaCoins className="text-emerald-300" />
            <span>Muzeer Token</span>
          </div>
          <p className="mt-1.5 text-[22px] font-semibold leading-none text-white truncate">
            {(tokenWallet?.balance || 0).toLocaleString()} {tokenWallet?.symbol || 'MUZR'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDetailsOpen((prev) => !prev)}
          className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[9px] uppercase tracking-[0.1em] text-white/70 hover:bg-white/10"
        >
          {detailsOpen ? 'Less' : 'More'}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-white/65">
          <p>Streak</p>
          <p className="mt-0.5 font-semibold text-white">{tokenWallet?.streakDays || 0}d</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-white/65">
          <p>Tier</p>
          <p className="mt-0.5 font-semibold text-white truncate">{tokenWallet?.tier?.name || 'Starter'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-white/65">
          <p>Next</p>
          <p className="mt-0.5 font-semibold text-white">{nextTokenMinutesLeft.toFixed(1)}m</p>
        </div>
      </div>

      <div className="mt-1.5 space-y-1">
        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-white/60">
            <span>Next token</span>
            <span>{nextTokenProgress.toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${nextTokenProgress}%` }} />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-white/60">
            <span>Daily cap</span>
            <span>{capProgressPercent.toFixed(0)}%</span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-pink-400" style={{ width: `${capProgressPercent}%` }} />
          </div>
        </div>
      </div>

      {isLoggedIn && (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-[10px] text-white/65">
          <p className="truncate">{questSummary}</p>
        </div>
      )}

      {isLoggedIn && (
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-lg border border-white/20 bg-white/5 px-2 py-1.5 text-[10px] font-semibold text-white transition hover:bg-white/10"
            disabled={loading}
          >
            {loading ? '...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => nextClaimableQuest && onClaimQuest?.(nextClaimableQuest.key)}
            disabled={!nextClaimableQuest || loading}
            className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-2 py-1.5 text-[10px] font-semibold text-emerald-100 disabled:opacity-40"
          >
            Claim
          </button>
          <button
            type="button"
            onClick={() => cheapestSpend && onSpendTokens?.(cheapestSpend.key)}
            disabled={!cheapestSpend || loading || (tokenWallet?.balance || 0) < (cheapestSpend?.cost || 0)}
            className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            {cheapestSpend ? `-${cheapestSpend.cost}` : 'Use'}
          </button>
        </div>
      )}

      {detailsOpen && isLoggedIn && (
        <div className="mt-1.5 max-h-40 overflow-y-auto custom-scrollbar rounded-md border border-white/10 bg-white/5 p-1.5 space-y-1.5 text-[8px] text-white/70">
          <div className="grid grid-cols-2 gap-1">
            <p>Pending: <span className="text-white/90">{pendingMinutes}m</span></p>
            <p>Daily left: <span className="text-white/90">{dailyRemainingMinutes}m</span></p>
            <p>Total earned: <span className="text-white/90">{(tokenWallet?.totalEarned || 0).toLocaleString()}</span></p>
            <p>Claims: <span className="text-white/90">{recentClaims.length}</span></p>
          </div>

          <div>
            <p className="mb-0.5 text-white/50 uppercase tracking-[0.08em]">Leaderboard</p>
            {(Array.isArray(leaderboard) ? leaderboard : []).slice(0, 3).map((entry) => (
              <div key={`${entry.userId}-${entry.rank}`} className="flex items-center justify-between gap-2">
                <span className="truncate">#{entry.rank} {entry.userName}</span>
                <span className="text-emerald-300">{entry.seasonEarned}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoggedIn && (
        <p className="mt-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-center text-[9px] text-white/70">
          Login to activate listen-to-earn
        </p>
      )}
    </div>
  )
}

export default TokenCompartment
