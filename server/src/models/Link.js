const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // we'll constantly query "all links belonging to this user"
    },
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    shortCode: {
      type: String,
      required: true,
      unique: true, // this is the redirect lookup key — must be unique + indexed
    },
    isCustomAlias: {
      type: Boolean,
      default: false,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true, // flips to false when expired (by date or click limit)
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    maxClicks: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Link', linkSchema);