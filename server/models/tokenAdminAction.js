const mongoose = require('mongoose');

const tokenAdminActionSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Login', required: true },
    adminUserName: { type: String, required: true },
    actionType: { type: String, default: 'token_adjust' },
    summary: { type: String, required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'Login' },
    targetUserName: { type: String },
    delta: { type: Number },
    resultingBalance: { type: Number },
    symbol: { type: String, default: 'MUZR' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.models.TokenAdminAction || mongoose.model('TokenAdminAction', tokenAdminActionSchema);
