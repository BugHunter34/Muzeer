const Login = require('../models/login'); // Or whatever your path is

// 1. The existing listening status fetcher
exports.getListeningStatus = async (req, res) => {
  try {
    const user = await Login.findOne({ discordId: req.params.discordId });
    if (!user) return res.status(404).json({ error: "User has not linked their Muzeer account." });

    return res.status(200).json({ userName: user.userName, presence: user.presence });
  } catch (error) {
    console.error("Bot fetch error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// 2. NEW: The account linking logic
exports.linkDiscord = async (req, res) => {
  try {
    const { discordId, discordName } = req.body;
    
    await Login.findByIdAndUpdate(req.user.id, { 
      discordId: discordId,
      discordName: discordName // Add this to your MongoDB Schema as a String!
    });
    
    return res.status(200).json({ success: true, message: "Discord linked!" });
  } catch (error) {
    console.error("Link error:", error);
    return res.status(500).json({ error: "Failed to link account" });
  }
};