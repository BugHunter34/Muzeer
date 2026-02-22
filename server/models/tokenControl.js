const mongoose = require('mongoose');

const tokenControlSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    symbol: { type: String, default: 'MUZR' },
    qualifiedSecondsPerToken: { type: Number, default: 180 },
    maxSecondsPerEvent: { type: Number, default: 60 },
    maxDailyQualifiedSeconds: { type: Number, default: 7200 },
    minTrackEventIntervalSeconds: { type: Number, default: 8 },
    rewardsPaused: { type: Boolean, default: false },
    allowAdminMintBurn: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.TokenControl || mongoose.model('TokenControl', tokenControlSchema);
