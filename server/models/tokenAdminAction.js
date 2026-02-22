const mongoose = require('mongoose');

const tokenAdminActionSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Login', required: true },
    adminUserName: { type: String, required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'Login', required: true },
    targetUserName: { type: String, required: true },
    delta: { type: Number, required: true },
    resultingBalance: { type: Number, required: true },
    symbol: { type: String, default: 'MUZR' }
  },
  { timestamps: true }
);

module.exports = mongoose.models.TokenAdminAction || mongoose.model('TokenAdminAction', tokenAdminActionSchema);
