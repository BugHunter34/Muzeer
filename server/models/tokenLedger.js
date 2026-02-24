const mongoose = require('mongoose');

const tokenLedgerSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'Login', required: true, index: true },
    symbol: { type: String, default: 'MUZR' },
    type: {
      type: String,
      enum: ['reward', 'quest', 'spend', 'admin', 'burn', 'mint'],
      required: true,
      index: true
    },
    delta: { type: Number, required: true },
    reason: { type: String, required: true },
    seasonKey: { type: String, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

tokenLedgerSchema.index({ seasonKey: 1, delta: -1, type: 1 });

tokenLedgerSchema.pre('validate', function tokenLedgerPreValidate(next) {
  if (!this.seasonKey) {
    const date = this.createdAt ? new Date(this.createdAt) : new Date();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    this.seasonKey = `${date.getUTCFullYear()}-${month}`;
  }
  next();
});

module.exports = mongoose.models.TokenLedger || mongoose.model('TokenLedger', tokenLedgerSchema);
