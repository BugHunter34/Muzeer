const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: String,
  artistName: String,
  thumbnail: String,
  duration: Number,
  webpage_url: String,
  audio_url: String,
  plays: {
    type: Number,
    default: 0,
  }
}, { timestamps: true });

module.exports = mongoose.models.Track || mongoose.model('Track', trackSchema);