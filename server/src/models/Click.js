const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema(
  {
    link: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Link',
      required: true,
    },
    device: { type: String, default: 'unknown' },   // mobile, tablet, desktop
    browser: { type: String, default: 'unknown' },  // Chrome, Firefox, ...
    os: { type: String, default: 'unknown' },       // Windows, Android, ...
    referrer: { type: String, default: 'direct' },  // domain the click came from
    country: { type: String, default: 'unknown' },
    city: { type: String, default: 'unknown' },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // a click never gets updated
);

// Every analytics query filters by link and sorts/groups by time
clickSchema.index({ link: 1, createdAt: -1 });

module.exports = mongoose.model('Click', clickSchema);