const mongoose = require('mongoose');

const artistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true, 
  },
  bio: {
    type: String,
    default: '',
  },
  imageUrl: {
    type: String,
    default: '',
  },
  tags: [{
    type: String,
  }],
  lastUpdated: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.models.Artist || mongoose.model('Artist', artistSchema);