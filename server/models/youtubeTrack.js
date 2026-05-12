

const mongoose = require("mongoose");

const youtubeTrackSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      unique: true,
      index: true,
    },

    title: String,
    artist: String,
    thumbnail: String,
    duration: Number,
    webpage_url: String,

    searchQueries: [String],

    plays: {
      type: Number,
      default: 0,
    },

    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.YoutubeTrack ||
  mongoose.model("YoutubeTrack", youtubeTrackSchema);
