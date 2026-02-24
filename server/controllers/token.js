const Login = require("../models/login");
const TokenControl = require("../models/tokenControl");
const TokenLedger = require("../models/tokenLedger");

const DEFAULT_CONTROL = {
  symbol: process.env.TOKEN_SYMBOL || "MUZR",
  qualifiedSecondsPerToken: Number(process.env.QUALIFIED_SECONDS_PER_TOKEN || 180),
  maxSecondsPerEvent: Number(process.env.MAX_SECONDS_PER_EVENT || 60),
  maxDailyQualifiedSeconds: Number(process.env.MAX_DAILY_QUALIFIED_SECONDS || 7200),
  minTrackEventIntervalSeconds: Number(process.env.MIN_TRACK_EVENT_INTERVAL_SECONDS || 8),
  maxRepeatTrackEventsPerDay: Number(process.env.MAX_REPEAT_TRACK_EVENTS_PER_DAY || 12),
  diversityPenaltyPercent: Number(process.env.DIVERSITY_PENALTY_PERCENT || 30),
  suspiciousEventPenaltyThreshold: Number(process.env.SUSPICIOUS_EVENT_PENALTY_THRESHOLD || 25),
  suspiciousEventHardLimit: Number(process.env.SUSPICIOUS_EVENT_HARD_LIMIT || 50),
  streakMaxDays: Number(process.env.STREAK_MAX_DAYS || 7),
  streakBonusPerDayPercent: Number(process.env.STREAK_BONUS_PER_DAY_PERCENT || 5),
  questDailyListenSecondsTarget: Number(process.env.QUEST_DAILY_LISTEN_SECONDS_TARGET || 2700),
  questDailyUniqueArtistsTarget: Number(process.env.QUEST_DAILY_UNIQUE_ARTISTS_TARGET || 3),
  questDailyTokenReward: Number(process.env.QUEST_DAILY_TOKEN_REWARD || 5),
  rewardsPaused: false,
  allowAdminMintBurn: true
};

const SPEND_CATALOG = {
  playlist_boost: { key: "playlist_boost", label: "Playlist Boost", cost: 20, durationHours: 24 },
  profile_glow: { key: "profile_glow", label: "Profile Glow", cost: 35, durationHours: 72 },
  queue_priority_day: { key: "queue_priority_day", label: "Queue Priority", cost: 50, durationHours: 24 },
  double_xp_hour: { key: "double_xp_hour", label: "Double XP Hour", cost: 120, durationHours: 1 }
};

function getUtcDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function getSeasonKey(date = new Date()) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

function clampSeconds(rawSeconds, maxPerEvent) {
  const parsed = Number(rawSeconds);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.floor(parsed), maxPerEvent);
}

function safeObj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getTier(totalEarned) {
  if (totalEarned >= 5000) return { name: "Gold", multiplierHint: "+25% max streak" };
  if (totalEarned >= 1500) return { name: "Silver", multiplierHint: "+20% max streak" };
  if (totalEarned >= 300) return { name: "Bronze", multiplierHint: "+15% max streak" };
  return { name: "Starter", multiplierHint: "+10% max streak" };
}

function buildDailyQuests(rewardState, control) {
  const todayListen = Number(rewardState?.dailyListenSecondsToday || 0);
  const uniqueArtists = Array.isArray(rewardState?.dailyUniqueArtists)
    ? rewardState.dailyUniqueArtists.length
    : 0;
  const claimedKeys = Array.isArray(rewardState?.dailyQuestClaimedKeys)
    ? rewardState.dailyQuestClaimedKeys
    : [];

  const quests = [
    {
      key: "listen_45m",
      title: "Listen 45 minutes",
      progress: Math.min(todayListen, control.questDailyListenSecondsTarget),
      target: control.questDailyListenSecondsTarget,
      unit: "seconds",
      rewardTokens: control.questDailyTokenReward
    },
    {
      key: "discover_3_artists",
      title: "Discover 3 unique artists",
      progress: Math.min(uniqueArtists, control.questDailyUniqueArtistsTarget),
      target: control.questDailyUniqueArtistsTarget,
      unit: "artists",
      rewardTokens: control.questDailyTokenReward
    }
  ].map((quest) => ({
    ...quest,
    completed: quest.progress >= quest.target,
    claimed: claimedKeys.includes(quest.key)
  }));

  return quests;
}

async function addLedgerEntry({ userId, symbol, type, delta, reason, metadata, date = new Date() }) {
  await TokenLedger.create({
    userId,
    symbol,
    type,
    delta,
    reason,
    seasonKey: getSeasonKey(date),
    metadata: metadata || {}
  });
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
    maxRepeatTrackEventsPerDay:
      Number(control.maxRepeatTrackEventsPerDay) >= 1
        ? Number(control.maxRepeatTrackEventsPerDay)
        : DEFAULT_CONTROL.maxRepeatTrackEventsPerDay,
    diversityPenaltyPercent:
      Number(control.diversityPenaltyPercent) >= 0
        ? Number(control.diversityPenaltyPercent)
        : DEFAULT_CONTROL.diversityPenaltyPercent,
    suspiciousEventPenaltyThreshold:
      Number(control.suspiciousEventPenaltyThreshold) >= 0
        ? Number(control.suspiciousEventPenaltyThreshold)
        : DEFAULT_CONTROL.suspiciousEventPenaltyThreshold,
    suspiciousEventHardLimit:
      Number(control.suspiciousEventHardLimit) >= 1
        ? Number(control.suspiciousEventHardLimit)
        : DEFAULT_CONTROL.suspiciousEventHardLimit,
    streakMaxDays:
      Number(control.streakMaxDays) >= 1
        ? Number(control.streakMaxDays)
        : DEFAULT_CONTROL.streakMaxDays,
    streakBonusPerDayPercent:
      Number(control.streakBonusPerDayPercent) >= 0
        ? Number(control.streakBonusPerDayPercent)
        : DEFAULT_CONTROL.streakBonusPerDayPercent,
    questDailyListenSecondsTarget:
      Number(control.questDailyListenSecondsTarget) >= 1
        ? Number(control.questDailyListenSecondsTarget)
        : DEFAULT_CONTROL.questDailyListenSecondsTarget,
    questDailyUniqueArtistsTarget:
      Number(control.questDailyUniqueArtistsTarget) >= 1
        ? Number(control.questDailyUniqueArtistsTarget)
        : DEFAULT_CONTROL.questDailyUniqueArtistsTarget,
    questDailyTokenReward:
      Number(control.questDailyTokenReward) >= 1
        ? Number(control.questDailyTokenReward)
        : DEFAULT_CONTROL.questDailyTokenReward,
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
    maxRepeatTrackEventsPerDay: control.maxRepeatTrackEventsPerDay,
    diversityPenaltyPercent: control.diversityPenaltyPercent,
    suspiciousEventPenaltyThreshold: control.suspiciousEventPenaltyThreshold,
    suspiciousEventHardLimit: control.suspiciousEventHardLimit,
    streakMaxDays: control.streakMaxDays,
    streakBonusPerDayPercent: control.streakBonusPerDayPercent,
    questDailyListenSecondsTarget: control.questDailyListenSecondsTarget,
    questDailyUniqueArtistsTarget: control.questDailyUniqueArtistsTarget,
    questDailyTokenReward: control.questDailyTokenReward,
    rewardsPaused: control.rewardsPaused
  });
};

exports.getWallet = async (req, res) => {
  try {
    const control = await getTokenControl();
    const user = await Login.findById(req.user.id).select("tokenWallet rewardState tokenClaims");
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

    const quests = buildDailyQuests(user.rewardState || {}, control);
    const tier = getTier(user.tokenWallet?.totalEarned || 0);
    const progressToNextToken = Number(
      ((pendingSeconds / control.qualifiedSecondsPerToken) * 100).toFixed(2)
    );
    const remainingSecondsToNextToken = Math.max(0, control.qualifiedSecondsPerToken - pendingSeconds);
    const remainingMinutesToNextToken = Number((remainingSecondsToNextToken / 60).toFixed(1));

    return res.status(200).json({
      symbol: user.tokenWallet?.symbol || control.symbol,
      balance: user.tokenWallet?.balance || 0,
      totalEarned: user.tokenWallet?.totalEarned || 0,
      pendingQualifiedSeconds: pendingSeconds,
      qualifiedSecondsPerToken: control.qualifiedSecondsPerToken,
      remainingSecondsToNextToken,
      remainingMinutesToNextToken,
      estimatedPendingTokens: Number(estPendingTokens.toFixed(4)),
      rewardedSecondsToday: rewardedToday,
      dailyRemainingSeconds: Math.max(0, control.maxDailyQualifiedSeconds - rewardedToday),
      dailyListenSecondsToday: user.rewardState?.dailyListenSecondsToday || 0,
      dailyCapSeconds: control.maxDailyQualifiedSeconds,
      capProgressPercent: Number(((rewardedToday / control.maxDailyQualifiedSeconds) * 100).toFixed(2)),
      streakDays: user.rewardState?.streakDays || 0,
      suspiciousScore: user.rewardState?.suspiciousScore || 0,
      progressToNextToken,
      tier,
      spendCatalog: Object.values(SPEND_CATALOG),
      quests,
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
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = getUtcDayKey(yesterday);
    const trackKey = `${String(title).trim()}::${String(artist).trim()}`;
    const normalizedArtist = String(artist).trim().toLowerCase();

    if (user.rewardState.rewardDayKey !== dayKey) {
      user.rewardState.rewardDayKey = dayKey;
      user.rewardState.rewardedSecondsToday = 0;
      user.rewardState.dailyListenSecondsToday = 0;
      user.rewardState.dailyUniqueArtists = [];
      user.rewardState.trackEventCountsToday = {};
      user.rewardState.artistEventCountsToday = {};
      user.rewardState.dailyQuestClaimedDayKey = dayKey;
      user.rewardState.dailyQuestClaimedKeys = [];

      if (user.rewardState.lastActiveDayKey === yesterdayKey) {
        user.rewardState.streakDays = Math.min(
          Number(user.rewardState.streakDays || 0) + 1,
          control.streakMaxDays
        );
      } else {
        user.rewardState.streakDays = 1;
      }
    }

    if (!user.rewardState.lastActiveDayKey) {
      user.rewardState.streakDays = Math.max(1, Number(user.rewardState.streakDays || 0));
    }

    user.rewardState.lastActiveDayKey = dayKey;

    if (user.rewardState.dailyQuestClaimedDayKey !== dayKey) {
      user.rewardState.dailyQuestClaimedDayKey = dayKey;
      user.rewardState.dailyQuestClaimedKeys = [];
    }

    const lastEventAt = user.rewardState.lastListenEventAt ? new Date(user.rewardState.lastListenEventAt) : null;
    const secondsSinceLastEvent = lastEventAt ? Math.floor((now.getTime() - lastEventAt.getTime()) / 1000) : null;

    if (
      user.rewardState.lastRewardedTrackKey === trackKey &&
      secondsSinceLastEvent !== null &&
      secondsSinceLastEvent < control.minTrackEventIntervalSeconds
    ) {
      user.rewardState.suspiciousScore = Number(user.rewardState.suspiciousScore || 0) + 2;
      await user.save();
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
    const baseGrantedSeconds = Math.min(qualifiedSeconds, remainingToday);

    if (baseGrantedSeconds <= 0) {
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

    const trackEventCountsToday = safeObj(user.rewardState.trackEventCountsToday);
    const artistEventCountsToday = safeObj(user.rewardState.artistEventCountsToday);
    const trackEventsForThisTrack = Number(trackEventCountsToday[trackKey] || 0) + 1;
    const artistEventsForThisArtist = Number(artistEventCountsToday[normalizedArtist] || 0) + 1;

    trackEventCountsToday[trackKey] = trackEventsForThisTrack;
    artistEventCountsToday[normalizedArtist] = artistEventsForThisArtist;

    user.rewardState.trackEventCountsToday = trackEventCountsToday;
    user.rewardState.artistEventCountsToday = artistEventCountsToday;

    let suspiciousScore = Number(user.rewardState.suspiciousScore || 0);
    if (trackEventsForThisTrack > control.maxRepeatTrackEventsPerDay) suspiciousScore += 1;
    if (secondsSinceLastEvent !== null && secondsSinceLastEvent === control.minTrackEventIntervalSeconds) suspiciousScore += 1;
    user.rewardState.suspiciousScore = suspiciousScore;

    if (suspiciousScore >= control.suspiciousEventHardLimit) {
      await user.save();
      return res.status(200).json({
        rewardedTokens: 0,
        reason: "suspicious-throttled",
        symbol: user.tokenWallet.symbol,
        balance: user.tokenWallet.balance,
        totalEarned: user.tokenWallet.totalEarned,
        pendingQualifiedSeconds: user.rewardState.pendingQualifiedSeconds,
        rewardedSecondsToday: user.rewardState.rewardedSecondsToday,
        dailyRemainingSeconds: Math.max(0, control.maxDailyQualifiedSeconds - user.rewardState.rewardedSecondsToday)
      });
    }

    const streakDays = Math.max(1, Number(user.rewardState.streakDays || 1));
    const streakBonusMultiplier =
      1 + ((Math.max(0, streakDays - 1) * control.streakBonusPerDayPercent) / 100);

    let effectiveGrantedSeconds = Math.max(1, Math.floor(baseGrantedSeconds * streakBonusMultiplier));

    if (trackEventsForThisTrack > control.maxRepeatTrackEventsPerDay) {
      effectiveGrantedSeconds = Math.max(
        1,
        Math.floor(effectiveGrantedSeconds * (1 - control.diversityPenaltyPercent / 100))
      );
    }

    if (suspiciousScore >= control.suspiciousEventPenaltyThreshold) {
      effectiveGrantedSeconds = Math.max(1, Math.floor(effectiveGrantedSeconds * 0.5));
    }

    const uniqueArtistsSet = new Set(Array.isArray(user.rewardState.dailyUniqueArtists) ? user.rewardState.dailyUniqueArtists : []);
    uniqueArtistsSet.add(normalizedArtist);
    user.rewardState.dailyUniqueArtists = Array.from(uniqueArtistsSet).slice(0, 50);

    user.rewardState.totalQualifiedSeconds += effectiveGrantedSeconds;
    user.rewardState.pendingQualifiedSeconds += effectiveGrantedSeconds;
    user.rewardState.rewardedSecondsToday += baseGrantedSeconds;
    user.rewardState.dailyListenSecondsToday = Number(user.rewardState.dailyListenSecondsToday || 0) + baseGrantedSeconds;
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

      await addLedgerEntry({
        userId: user._id,
        symbol: control.symbol,
        type: "reward",
        delta: mintedWholeTokens,
        reason: "listen-event",
        metadata: {
          trackKey,
          baseGrantedSeconds,
          effectiveGrantedSeconds,
          streakDays,
          suspiciousScore,
          trackEventsForThisTrack
        },
        date: now
      });
    }

    user.tokenWallet.symbol = control.symbol;

    await user.save();

    return res.status(200).json({
      rewardedTokens: mintedWholeTokens,
      symbol: user.tokenWallet.symbol,
      balance: user.tokenWallet.balance,
      totalEarned: user.tokenWallet.totalEarned,
      pendingQualifiedSeconds: user.rewardState.pendingQualifiedSeconds,
      qualifiedSecondsPerToken: control.qualifiedSecondsPerToken,
      remainingSecondsToNextToken: Math.max(0, control.qualifiedSecondsPerToken - user.rewardState.pendingQualifiedSeconds),
      remainingMinutesToNextToken: Number((Math.max(0, control.qualifiedSecondsPerToken - user.rewardState.pendingQualifiedSeconds) / 60).toFixed(1)),
      qualifiedSecondsAdded: baseGrantedSeconds,
      effectiveQualifiedSecondsAdded: effectiveGrantedSeconds,
      streakDays: user.rewardState.streakDays || 0,
      streakBonusMultiplier: Number(streakBonusMultiplier.toFixed(3)),
      suspiciousScore: user.rewardState.suspiciousScore || 0,
      dailyUniqueArtistsCount: (user.rewardState.dailyUniqueArtists || []).length,
      rewardedSecondsToday: user.rewardState.rewardedSecondsToday,
      dailyRemainingSeconds: Math.max(0, control.maxDailyQualifiedSeconds - user.rewardState.rewardedSecondsToday),
      quests: buildDailyQuests(user.rewardState || {}, control),
      recentClaims: (user.tokenClaims || []).slice(0, 5)
    });
  } catch (error) {
    console.error("Token listen-event error:", error);
    return res.status(500).json({ message: "Failed to process listen event" });
  }
};

exports.claimQuest = async (req, res) => {
  try {
    const control = await getTokenControl();
    const { questKey } = req.body || {};

    if (!questKey) {
      return res.status(400).json({ message: "questKey is required" });
    }

    const user = await Login.findById(req.user.id).select("tokenWallet rewardState tokenClaims");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const dayKey = getUtcDayKey(new Date());
    if (user.rewardState?.dailyQuestClaimedDayKey !== dayKey) {
      user.rewardState.dailyQuestClaimedDayKey = dayKey;
      user.rewardState.dailyQuestClaimedKeys = [];
    }

    const quests = buildDailyQuests(user.rewardState || {}, control);
    const quest = quests.find((entry) => entry.key === questKey);

    if (!quest) {
      return res.status(404).json({ message: "Quest not found" });
    }

    if (!quest.completed) {
      return res.status(400).json({ message: "Quest is not completed yet" });
    }

    if (quest.claimed) {
      return res.status(400).json({ message: "Quest already claimed" });
    }

    if (!user.tokenWallet) {
      user.tokenWallet = { symbol: control.symbol, balance: 0, totalEarned: 0 };
    }

    const claimedKeys = Array.isArray(user.rewardState.dailyQuestClaimedKeys)
      ? user.rewardState.dailyQuestClaimedKeys
      : [];
    claimedKeys.push(quest.key);
    user.rewardState.dailyQuestClaimedKeys = claimedKeys;

    user.tokenWallet.symbol = control.symbol;
    user.tokenWallet.balance += control.questDailyTokenReward;
    user.tokenWallet.totalEarned += control.questDailyTokenReward;
    user.tokenWallet.lastClaimAt = new Date();

    if (!Array.isArray(user.tokenClaims)) {
      user.tokenClaims = [];
    }

    user.tokenClaims.unshift({
      tokens: control.questDailyTokenReward,
      trackKey: `QUEST::${quest.key}::${dayKey}`,
      qualifiedSecondsConsumed: 0,
      createdAt: new Date()
    });

    if (user.tokenClaims.length > 20) {
      user.tokenClaims = user.tokenClaims.slice(0, 20);
    }

    await user.save();

    await addLedgerEntry({
      userId: user._id,
      symbol: control.symbol,
      type: "quest",
      delta: control.questDailyTokenReward,
      reason: `quest-${quest.key}`,
      metadata: { questKey: quest.key, dayKey }
    });

    return res.status(200).json({
      message: "Quest claimed",
      claimedQuestKey: quest.key,
      rewardTokens: control.questDailyTokenReward,
      balance: user.tokenWallet.balance,
      totalEarned: user.tokenWallet.totalEarned,
      quests: buildDailyQuests(user.rewardState || {}, control)
    });
  } catch (error) {
    console.error("Token claim-quest error:", error);
    return res.status(500).json({ message: "Failed to claim quest" });
  }
};

exports.spendTokens = async (req, res) => {
  try {
    const control = await getTokenControl();
    const actionKey = String(req.body?.actionKey || "").trim();
    const action = SPEND_CATALOG[actionKey];

    if (!action) {
      return res.status(400).json({ message: "Invalid actionKey" });
    }

    const user = await Login.findById(req.user.id).select("tokenWallet rewardState");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const balance = Number(user.tokenWallet?.balance || 0);
    if (balance < action.cost) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    user.tokenWallet.balance = balance - action.cost;
    user.tokenWallet.symbol = control.symbol;

    const spendHistory = Array.isArray(user.rewardState?.recentSpends)
      ? user.rewardState.recentSpends
      : [];

    spendHistory.unshift({
      actionKey: action.key,
      cost: action.cost,
      createdAt: new Date()
    });

    user.rewardState.recentSpends = spendHistory.slice(0, 20);
    await user.save();

    await addLedgerEntry({
      userId: user._id,
      symbol: control.symbol,
      type: "spend",
      delta: -action.cost,
      reason: `spend-${action.key}`,
      metadata: { actionKey: action.key, durationHours: action.durationHours }
    });

    return res.status(200).json({
      message: "Spend applied",
      action,
      balance: user.tokenWallet.balance,
      symbol: control.symbol
    });
  } catch (error) {
    console.error("Token spend error:", error);
    return res.status(500).json({ message: "Failed to spend tokens" });
  }
};

exports.getSeasonLeaderboard = async (req, res) => {
  try {
    const seasonKey = String(req.query?.seasonKey || getSeasonKey());

    const rows = await TokenLedger.aggregate([
      {
        $match: {
          seasonKey,
          type: { $in: ["reward", "quest"] },
          delta: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: "$userId",
          seasonEarned: { $sum: "$delta" }
        }
      },
      { $sort: { seasonEarned: -1 } },
      { $limit: 20 }
    ]);

    const userIds = rows.map((row) => row._id);
    const users = await Login.find({ _id: { $in: userIds } }).select("userName").lean();
    const userMap = new Map(users.map((user) => [String(user._id), user.userName]));

    const leaderboard = rows.map((row, idx) => ({
      rank: idx + 1,
      userId: row._id,
      userName: userMap.get(String(row._id)) || "Unknown",
      seasonEarned: row.seasonEarned
    }));

    return res.status(200).json({ seasonKey, leaderboard });
  } catch (error) {
    console.error("Token leaderboard error:", error);
    return res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
};
