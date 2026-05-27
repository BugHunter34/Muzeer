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
  tracks: [{
    videoId: String,
    title: String,
    duration: Number,
    thumbnail: String
  }],
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.models.Album || mongoose.model('Album', albumSchema);