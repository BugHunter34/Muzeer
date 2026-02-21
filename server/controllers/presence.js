// controllers/authController.js
const Login = require('../models/login'); // Adjust the path if your models folder is elsewhere

exports.updatePresence = async (req, res) => {
  try {
    const { title, artist, webpage_url, isPlaying, offset } = req.body;
    
    // authMiddleware should be attaching the decoded user to req.user (or req.userId).
    // Adjust this variable if your middleware uses something like req.userId
    const userId = req.user.id; 

    // Calculate the absolute start time in milliseconds.
    let startTimestamp = null;
    if (isPlaying && offset !== undefined) {
      startTimestamp = Date.now() - Math.floor(offset * 1000);
    }

    // Update the user's document in MongoDB
    await Login.findByIdAndUpdate(userId, {
      presence: {
        title: title || "Unknown Track",
        artist: artist || "Unknown Artist",
        webpage_url: webpage_url || "",
        isPlaying: isPlaying || false,
        startTimestamp: startTimestamp
      }
    });

    return res.status(200).json({ success: true, message: "Presence updated" });
  } catch (error) {
    console.error("Presence update error:", error);
    return res.status(500).json({ error: "Failed to update presence" });
  }
};