const Login = require("../models/login");
const TokenControl = require("../models/tokenControl");

const DEFAULT_CONTROL = {
  symbol: process.env.TOKEN_SYMBOL || "MUZR",
  qualifiedSecondsPerToken: Number(process.env.QUALIFIED_SECONDS_PER_TOKEN || 180),
  maxSecondsPerEvent: Number(process.env.MAX_SECONDS_PER_EVENT || 60),
  maxDailyQualifiedSeconds: Number(process.env.MAX_DAILY_QUALIFIED_SECONDS || 7200),
  minTrackEventIntervalSeconds: Number(process.env.MIN_TRACK_EVENT_INTERVAL_SECONDS || 8),
  rewardsPaused: false,
  allowAdminMintBurn: true
};

function getUtcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function clampSeconds(rawSeconds, maxPerEvent) {
  const parsed = Number(rawSeconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), maxPerEvent);
}

async function getTokenControl() {
  let control = await TokenControl.findOne({ key: "global" });
  if (!control) {
    control = await TokenControl.create({
      key: "global",
      ...DEFAULT_CONTROL
    });
  }

  return {
    symbol: control.symbol || DEFAULT_CONTROL.symbol,
    qualifiedSecondsPerToken:
      Number(control.qualifiedSecondsPerToken) > 0
        ? Number(control.qualifiedSecondsPerToken)
        : DEFAULT_CONTROL.qualifiedSecondsPerToken,
    maxSecondsPerEvent:
      Number(control.maxSecondsPerEvent) > 0
        ? Number(control.maxSecondsPerEvent)
        : DEFAULT_CONTROL.maxSecondsPerEvent,
    maxDailyQualifiedSeconds:
      Number(control.maxDailyQualifiedSeconds) > 0
        ? Number(control.maxDailyQualifiedSeconds)
        : DEFAULT_CONTROL.maxDailyQualifiedSeconds,
    minTrackEventIntervalSeconds:
      Number(control.minTrackEventIntervalSeconds) >= 0
        ? Number(control.minTrackEventIntervalSeconds)
        : DEFAULT_CONTROL.minTrackEventIntervalSeconds,
    rewardsPaused: Boolean(control.rewardsPaused),
    allowAdminMintBurn: Boolean(control.allowAdminMintBurn)
  };
}

exports.getConfig = async (req, res) => {
  const control = await getTokenControl();
  return res.status(200).json({
    symbol: control.symbol,
    qualifiedSecondsPerToken: control.qualifiedSecondsPerToken,
    maxSecondsPerEvent: control.maxSecondsPerEvent,
    maxDailyQualifiedSeconds: control.maxDailyQualifiedSeconds,
    minTrackEventIntervalSeconds: control.minTrackEventIntervalSeconds,
    rewardsPaused: control.rewardsPaused
  });
};

exports.getWallet = async (req, res) => {
  try {
    const control = await getTokenControl();
    const user = await Login.findById(req.user.id).select("tokenWallet rewardState");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pendingSeconds = user.rewardState?.pendingQualifiedSeconds || 0;
    const estPendingTokens = pendingSeconds / control.qualifiedSecondsPerToken;
    const rewardedToday = user.rewardState?.rewardedSecondsToday || 0;
    const recentClaims = (user.tokenClaims || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((claim) => ({
        tokens: claim.tokens,
        trackKey: claim.trackKey,
        qualifiedSecondsConsumed: claim.qualifiedSecondsConsumed,
        createdAt: claim.createdAt
      }));

    return res.status(200).json({
      symbol: user.tokenWallet?.symbol || control.symbol,
      balance: user.tokenWallet?.balance || 0,
      totalEarned: user.tokenWallet?.totalEarned || 0,
      pendingQualifiedSeconds: pendingSeconds,
      estimatedPendingTokens: Number(estPendingTokens.toFixed(4)),
      rewardedSecondsToday: rewardedToday,
      dailyRemainingSeconds: Math.max(0, control.maxDailyQualifiedSeconds - rewardedToday),
      rewardsPaused: control.rewardsPaused,
      recentClaims
    });
  } catch (error) {
    console.error("Token wallet fetch error:", error);
    return res.status(500).json({ message: "Failed to fetch token wallet" });
  }
};

exports.submitListenEvent = async (req, res) => {
  try {
    const control = await getTokenControl();
    const { title, artist, isPlaying, listenedSeconds } = req.body;

    if (control.rewardsPaused) {
      return res.status(200).json({
        rewardedTokens: 0,
        reason: "rewards-paused",
        rewardsPaused: true
      });
    }

    if (!isPlaying) {
      return res.status(200).json({ rewardedTokens: 0, reason: "not-playing" });
    }

    if (!title || !artist) {
      return res.status(200).json({ rewardedTokens: 0, reason: "missing-track" });
    }

    const qualifiedSeconds = clampSeconds(listenedSeconds, control.maxSecondsPerEvent);
    if (qualifiedSeconds <= 0) {
      return res.status(200).json({ rewardedTokens: 0, reason: "invalid-seconds" });
    }

    const user = await Login.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.tokenWallet) {
      user.tokenWallet = {
        symbol: control.symbol,
        balance: 0,
        totalEarned: 0
      };
    }

    if (!user.rewardState) {
      user.rewardState = {
        totalQualifiedSeconds: 0,
        pendingQualifiedSeconds: 0,
        lastRewardedTrackKey: ""
      };
    }

    const now = new Date();
    const dayKey = getUtcDayKey(now);
    const trackKey = `${String(title).trim()}::${String(artist).trim()}`;

    if (user.rewardState.rewardDayKey !== dayKey) {
      user.rewardState.rewardDayKey = dayKey;
      user.rewardState.rewardedSecondsToday = 0;
    }

    const lastEventAt = user.rewardState.lastListenEventAt ? new Date(user.rewardState.lastListenEventAt) : null;
    const secondsSinceLastEvent = lastEventAt ? Math.floor((now.getTime() - lastEventAt.getTime()) / 1000) : null;

    if (
      user.rewardState.lastRewardedTrackKey === trackKey &&
      secondsSinceLastEvent !== null &&
      secondsSinceLastEvent < control.minTrackEventIntervalSeconds
    ) {
      return res.status(200).json({
        rewardedTokens: 0,
        reason: "cooldown",
        symbol: user.tokenWallet.symbol,
        balance: user.tokenWallet.balance,
        totalEarned: user.tokenWallet.totalEarned,
        pendingQualifiedSeconds: user.rewardState.pendingQualifiedSeconds,
        rewardedSecondsToday: user.rewardState.rewardedSecondsToday,
        dailyRemainingSeconds: Math.max(0, control.maxDailyQualifiedSeconds - user.rewardState.rewardedSecondsToday)
      });
    }

    const remainingToday = Math.max(0, control.maxDailyQualifiedSeconds - (user.rewardState.rewardedSecondsToday || 0));
    const grantedSeconds = Math.min(qualifiedSeconds, remainingToday);

    if (grantedSeconds <= 0) {
      return res.status(200).json({
        rewardedTokens: 0,
        reason: "daily-cap-reached",
        symbol: user.tokenWallet.symbol,
        balance: user.tokenWallet.balance,
        totalEarned: user.tokenWallet.totalEarned,
        pendingQualifiedSeconds: user.rewardState.pendingQualifiedSeconds,
        rewardedSecondsToday: user.rewardState.rewardedSecondsToday,
        dailyRemainingSeconds: 0
      });
    }

    user.rewardState.totalQualifiedSeconds += grantedSeconds;
    user.rewardState.pendingQualifiedSeconds += grantedSeconds;
    user.rewardState.rewardedSecondsToday += grantedSeconds;
    user.rewardState.lastRewardedTrackKey = trackKey;
    user.rewardState.lastListenEventAt = now;

    const mintedWholeTokens = Math.floor(user.rewardState.pendingQualifiedSeconds / control.qualifiedSecondsPerToken);

    if (mintedWholeTokens > 0) {
      user.rewardState.pendingQualifiedSeconds -= mintedWholeTokens * control.qualifiedSecondsPerToken;
      user.tokenWallet.balance += mintedWholeTokens;
      user.tokenWallet.totalEarned += mintedWholeTokens;
      user.tokenWallet.lastClaimAt = now;
      user.rewardState.lastRewardAt = now;

      if (!Array.isArray(user.tokenClaims)) {
        user.tokenClaims = [];
      }

      user.tokenClaims.unshift({
        tokens: mintedWholeTokens,
        trackKey,
        qualifiedSecondsConsumed: mintedWholeTokens * control.qualifiedSecondsPerToken,
        createdAt: now
      });

      if (user.tokenClaims.length > 20) {
        user.tokenClaims = user.tokenClaims.slice(0, 20);
      }
    }

    user.tokenWallet.symbol = control.symbol;

    await user.save();

    return res.status(200).json({
      rewardedTokens: mintedWholeTokens,
      symbol: user.tokenWallet.symbol,
      balance: user.tokenWallet.balance,
      totalEarned: user.tokenWallet.totalEarned,
      pendingQualifiedSeconds: user.rewardState.pendingQualifiedSeconds,
      qualifiedSecondsAdded: grantedSeconds,
      rewardedSecondsToday: user.rewardState.rewardedSecondsToday,
      dailyRemainingSeconds: Math.max(0, control.maxDailyQualifiedSeconds - user.rewardState.rewardedSecondsToday),
      recentClaims: (user.tokenClaims || []).slice(0, 5)
    });
  } catch (error) {
    console.error("Token listen-event error:", error);
    return res.status(500).json({ message: "Failed to process listen event" });
  }
};
