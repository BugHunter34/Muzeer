const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
  youtubePlaylistId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  title: String,
  artistName: String,
  thumbnail: String,
  type: { 
    type: String, 
    enum: ['album', 'playlist'], 
    default: 'album' 
  },
  status: { 
    type: String, 
    enum: ['processing', 'ready', 'failed'], 
    default: 'ready' 
  },
  expectedTrackCount: {
    type: Number,
    default: 0
  },
  tracks: [{
    videoId: String,
    title: String,
    duration: Number,
    thumbnail: String,
    artist: String,
    status: {
      type: String,
      enum: ['ready', 'failed'],
      default: 'ready'
    },
    failureReason: String
  }],
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.models.Album || mongoose.model('Album', albumSchema);