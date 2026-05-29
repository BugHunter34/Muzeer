const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: String,
  artist: String, // Changed from artistName to artist to match Python!
  thumbnail: String,
  duration: Number,
  webpage_url: String,
  audio_url: String,
  proxy_url: String, // Added this!
  plays: {
    type: Number,
    default: 0,
  },
  lastUsedAt: Date, // Added this!
  searchQueries: [{ type: String }] // Added this array so $addToSet works!
}, { timestamps: true });

module.exports = mongoose.models.Track || mongoose.model('Track', trackSchema);