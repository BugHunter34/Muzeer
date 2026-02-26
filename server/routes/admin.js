const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');   
const admin = require('../middleware/admin'); 
const owner = require('../middleware/owner');
const Login = require('../models/login');     
const TokenAdminAction = require('../models/tokenAdminAction');
const TokenControl = require('../models/tokenControl');
const TokenLedger = require('../models/tokenLedger');

const DEFAULT_TOKEN_CONTROL = {
  symbol: 'MUZR',
  qualifiedSecondsPerToken: 180,
  maxSecondsPerEvent: 60,
  maxDailyQualifiedSeconds: 7200,
  minTrackEventIntervalSeconds: 8,
  maxRepeatTrackEventsPerDay: 12,
  diversityPenaltyPercent: 30,
  suspiciousEventPenaltyThreshold: 25,
  suspiciousEventHardLimit: 50,
  streakMaxDays: 7,
  streakBonusPerDayPercent: 5,
  questDailyListenSecondsTarget: 2700,
  questDailyUniqueArtistsTarget: 3,
  questDailyTokenReward: 5,
  rewardsPaused: false,
  allowAdminMintBurn: true
};

async function getOrCreateTokenControl() {
  let control = await TokenControl.findOne({ key: 'global' });
  if (!control) {
    control = await TokenControl.create({ key: 'global', ...DEFAULT_TOKEN_CONTROL });
  }
  return control;
}

async function logAdminAction(req, payload) {
  const normalizedPayload = {
    actionType: payload?.actionType || 'admin_action',
    summary: payload?.summary || 'Admin action executed',
    targetUserId: payload?.targetUserId || req.user.id,
    targetUserName: payload?.targetUserName || req.user.userName || req.user.email || 'system',
    delta: Number.isFinite(payload?.delta) ? Number(payload.delta) : 0,
    resultingBalance: Number.isFinite(payload?.resultingBalance) ? Number(payload.resultingBalance) : 0,
    symbol: payload?.symbol || 'MUZR',
    metadata: payload?.metadata || {}
  };

  return TokenAdminAction.create({
    adminId: req.user.id,
    adminUserName: req.user.userName || req.user.email || 'admin',
    ...normalizedPayload
  });
}

// 1. GET ALL USERS
router.get('/users', [auth, admin], async (req, res) => {
  try {
    const allUsers = await Login.find().select('-passwordHash');
    // Ensure we are sending a pure array for React's .map()
    res.json(allUsers); 
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Toggle Ban Status
router.patch('/users/:userId/ban', [auth, admin], async (req, res) => {
  try {
    const { isBanned } = req.body;
    const nextBanState = Boolean(isBanned);
    
    // Prevent admin from banning themselves
    if (req.user && req.user.id === req.params.userId) {
      return res.status(403).json({ message: "You cannot ban yourself." });
    }

    const existingUser = await Login.findById(req.params.userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const wasBanned = Boolean(existingUser.isBanned);
    existingUser.isBanned = nextBanState;
    await existingUser.save();

    const updatedUser = existingUser;

    await logAdminAction(req, {
      actionType: nextBanState ? 'ban_user' : 'unban_user',
      summary: `${nextBanState ? 'Banned' : 'Unbanned'} ${updatedUser.userName}`,
      targetUserId: updatedUser._id,
      targetUserName: updatedUser.userName,
      metadata: {
        wasBanned,
        isBanned: nextBanState
      }
    });

    res.status(200).json({ message: "Ban status updated", user: updatedUser });
  } catch (error) {
    console.error("Ban Error:", error);
    res.status(500).json({ message: "Server error updating ban status" });
  }
});
// 2. TOGGLE ADMIN ROLE
router.patch('/users/:id/role', [auth, admin], async (req, res) => {
  try {
    const userToUpdate = await Login.findById(req.params.id);
    if (!userToUpdate) return res.status(404).json({ message: "User not found" });

    // 1. Protection: If the target is an owner, don't let anyone touch them
    if (userToUpdate.role === 'owner') {
      return res.status(403).json({ message: "Owner roles cannot be modified." });
    }
    
    // 2. Protection: Prevent the admin from demoting themselves!
    if (userToUpdate._id.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot demote yourself!" });
    }

    // 3. Correct Logic: If they are admin, make them user. Otherwise, make them admin.
    userToUpdate.role = (userToUpdate.role === 'admin') ? 'user' : 'admin';
    
    await userToUpdate.save();

    await logAdminAction(req, {
      actionType: userToUpdate.role === 'admin' ? 'grant_admin' : 'revoke_admin',
      summary: `${userToUpdate.role === 'admin' ? 'Granted admin to' : 'Revoked admin from'} ${userToUpdate.userName}`,
      targetUserId: userToUpdate._id,
      targetUserName: userToUpdate.userName,
      metadata: { role: userToUpdate.role }
    });
    
    res.json({ message: "Role updated successfully", user: userToUpdate });
  } catch (err) {
    console.error("Role Update Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// 3. NUKE USER (DELETE)
router.delete('/users/:id', [auth, admin], async (req, res) => {
  try {
    // Prevent the admin from deleting themselves!
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You cannot nuke yourself!" });
    }

    const userToDelete = await Login.findById(req.params.id);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    await Login.findByIdAndDelete(req.params.id);

    await logAdminAction(req, {
      actionType: 'delete_user',
      summary: `Deleted user ${userToDelete.userName}`,
      targetUserId: userToDelete._id,
      targetUserName: userToDelete.userName
    });

    res.json({ message: "User eradicated" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 4. ADMIN TOKEN ADJUST (mint/burn for testing)
router.patch('/users/:id/token', [auth, owner], async (req, res) => {
  try {
    const control = await getOrCreateTokenControl();
    if (!control.allowAdminMintBurn) {
      return res.status(403).json({ message: 'Admin mint/burn is disabled by token control settings' });
    }

    const delta = Number(req.body?.delta);

    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
      return res.status(400).json({ message: 'delta must be a non-zero integer' });
    }

    if (Math.abs(delta) > 1000000) {
      return res.status(400).json({ message: 'delta too large' });
    }

    const userToUpdate = await Login.findById(req.params.id);
    if (!userToUpdate) return res.status(404).json({ message: 'User not found' });

    if (!userToUpdate.tokenWallet) {
      userToUpdate.tokenWallet = {
        symbol: 'MUZR',
        balance: 0,
        totalEarned: 0
      };
    }

    const nextBalance = (userToUpdate.tokenWallet.balance || 0) + delta;
    if (nextBalance < 0) {
      return res.status(400).json({ message: 'Insufficient balance for burn' });
    }

    userToUpdate.tokenWallet.balance = nextBalance;
    if (delta > 0) {
      userToUpdate.tokenWallet.totalEarned = (userToUpdate.tokenWallet.totalEarned || 0) + delta;
      userToUpdate.tokenWallet.lastClaimAt = new Date();
    }

    if (!Array.isArray(userToUpdate.tokenClaims)) {
      userToUpdate.tokenClaims = [];
    }

    userToUpdate.tokenClaims.unshift({
      tokens: delta,
      trackKey: `ADMIN_ADJUSTMENT::${req.user.id}`,
      qualifiedSecondsConsumed: 0,
      createdAt: new Date()
    });

    if (userToUpdate.tokenClaims.length > 20) {
      userToUpdate.tokenClaims = userToUpdate.tokenClaims.slice(0, 20);
    }

    await userToUpdate.save();

    await logAdminAction(req, {
      actionType: 'token_adjust',
      summary: `${delta > 0 ? 'Minted' : 'Burned'} ${Math.abs(delta)} ${userToUpdate.tokenWallet.symbol || 'MUZR'} ${delta > 0 ? 'to' : 'from'} ${userToUpdate.userName}`,
      targetUserId: userToUpdate._id,
      targetUserName: userToUpdate.userName,
      delta,
      resultingBalance: userToUpdate.tokenWallet.balance,
      symbol: userToUpdate.tokenWallet.symbol || 'MUZR'
    });

    await TokenLedger.create({
      userId: userToUpdate._id,
      symbol: userToUpdate.tokenWallet.symbol || 'MUZR',
      type: delta >= 0 ? 'admin' : 'burn',
      delta,
      reason: 'admin-adjustment',
      metadata: {
        adminId: req.user.id,
        targetUserName: userToUpdate.userName
      }
    });

    res.json({
      message: 'Token wallet updated',
      user: {
        _id: userToUpdate._id,
        userName: userToUpdate.userName,
        email: userToUpdate.email,
        role: userToUpdate.role,
        tokenWallet: userToUpdate.tokenWallet
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 5. SET EXACT USER TOKEN BALANCE (full control)
router.put('/users/:id/token', [auth, owner], async (req, res) => {
  try {
    const nextBalance = Number(req.body?.balance);

    if (!Number.isFinite(nextBalance) || !Number.isInteger(nextBalance) || nextBalance < 0) {
      return res.status(400).json({ message: 'balance must be a non-negative integer' });
    }

    const userToUpdate = await Login.findById(req.params.id);
    if (!userToUpdate) return res.status(404).json({ message: 'User not found' });

    if (!userToUpdate.tokenWallet) {
      userToUpdate.tokenWallet = { symbol: 'MUZR', balance: 0, totalEarned: 0 };
    }

    const prevBalance = userToUpdate.tokenWallet.balance || 0;
    const delta = nextBalance - prevBalance;

    userToUpdate.tokenWallet.balance = nextBalance;
    if (delta > 0) {
      userToUpdate.tokenWallet.totalEarned = (userToUpdate.tokenWallet.totalEarned || 0) + delta;
    }

    await userToUpdate.save();

    await logAdminAction(req, {
      actionType: 'token_set_balance',
      summary: `Set ${userToUpdate.userName} balance to ${nextBalance} ${userToUpdate.tokenWallet.symbol || 'MUZR'}`,
      targetUserId: userToUpdate._id,
      targetUserName: userToUpdate.userName,
      delta,
      resultingBalance: userToUpdate.tokenWallet.balance,
      symbol: userToUpdate.tokenWallet.symbol || 'MUZR'
    });

    await TokenLedger.create({
      userId: userToUpdate._id,
      symbol: userToUpdate.tokenWallet.symbol || 'MUZR',
      type: delta >= 0 ? 'admin' : 'burn',
      delta,
      reason: 'admin-set-balance',
      metadata: {
        adminId: req.user.id,
        targetUserName: userToUpdate.userName,
        previousBalance: prevBalance,
        nextBalance
      }
    });

    res.json({
      message: 'User token balance set',
      user: {
        _id: userToUpdate._id,
        userName: userToUpdate.userName,
        email: userToUpdate.email,
        role: userToUpdate.role,
        tokenWallet: userToUpdate.tokenWallet
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 6. RECENT ADMIN TOKEN ACTIONS
router.get('/token-actions', [auth, admin], async (req, res) => {
  try {
    const actions = await TokenAdminAction.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(actions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// 7. TOKEN CONTROL SETTINGS (global)
router.get('/token-control', [auth, admin], async (req, res) => {
  try {
    const control = await getOrCreateTokenControl();
    res.json(control);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/token-control', [auth, owner], async (req, res) => {
  try {
    const control = await getOrCreateTokenControl();

    const allowedFields = [
      'symbol',
      'qualifiedSecondsPerToken',
      'maxSecondsPerEvent',
      'maxDailyQualifiedSeconds',
      'minTrackEventIntervalSeconds',
      'maxRepeatTrackEventsPerDay',
      'diversityPenaltyPercent',
      'suspiciousEventPenaltyThreshold',
      'suspiciousEventHardLimit',
      'streakMaxDays',
      'streakBonusPerDayPercent',
      'questDailyListenSecondsTarget',
      'questDailyUniqueArtistsTarget',
      'questDailyTokenReward',
      'rewardsPaused',
      'allowAdminMintBurn'
    ];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        control[field] = req.body[field];
      }
    }

    control.symbol = String(control.symbol || 'MUZR').trim().toUpperCase().slice(0, 10) || 'MUZR';

    const numericFields = [
      'qualifiedSecondsPerToken',
      'maxSecondsPerEvent',
      'maxDailyQualifiedSeconds',
      'minTrackEventIntervalSeconds',
      'maxRepeatTrackEventsPerDay',
      'diversityPenaltyPercent',
      'suspiciousEventPenaltyThreshold',
      'suspiciousEventHardLimit',
      'streakMaxDays',
      'streakBonusPerDayPercent',
      'questDailyListenSecondsTarget',
      'questDailyUniqueArtistsTarget',
      'questDailyTokenReward'
    ];

    for (const field of numericFields) {
      const num = Number(control[field]);
      if (!Number.isFinite(num) || num < 0) {
        return res.status(400).json({ message: `Invalid value for ${field}` });
      }
      control[field] = Math.floor(num);
    }

    if (control.qualifiedSecondsPerToken < 1) {
      return res.status(400).json({ message: 'qualifiedSecondsPerToken must be at least 1' });
    }

    if (control.maxSecondsPerEvent < 1) {
      return res.status(400).json({ message: 'maxSecondsPerEvent must be at least 1' });
    }

    control.rewardsPaused = Boolean(control.rewardsPaused);
    control.allowAdminMintBurn = Boolean(control.allowAdminMintBurn);

    await control.save();

    await logAdminAction(req, {
      actionType: 'token_control_update',
      summary: 'Updated global token control settings',
      metadata: {
        symbol: control.symbol,
        rewardsPaused: control.rewardsPaused,
        allowAdminMintBurn: control.allowAdminMintBurn
      }
    });

    res.json({ message: 'Token control updated', control });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;