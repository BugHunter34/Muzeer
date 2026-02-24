const mongoose = require('mongoose');

const tokenControlSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    symbol: { type: String, default: 'MUZR' },
    qualifiedSecondsPerToken: { type: Number, default: 180 },
    maxSecondsPerEvent: { type: Number, default: 60 },
    maxDailyQualifiedSeconds: { type: Number, default: 7200 },
    minTrackEventIntervalSeconds: { type: Number, default: 8 },
    maxRepeatTrackEventsPerDay: { type: Number, default: 12 },
    diversityPenaltyPercent: { type: Number, default: 30 },
    suspiciousEventPenaltyThreshold: { type: Number, default: 25 },
    suspiciousEventHardLimit: { type: Number, default: 50 },
    streakMaxDays: { type: Number, default: 7 },
    streakBonusPerDayPercent: { type: Number, default: 5 },
    questDailyListenSecondsTarget: { type: Number, default: 2700 },
    questDailyUniqueArtistsTarget: { type: Number, default: 3 },
    questDailyTokenReward: { type: Number, default: 5 },
    rewardsPaused: { type: Boolean, default: false },
    allowAdminMintBurn: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.TokenControl || mongoose.model('TokenControl', tokenControlSchema);
