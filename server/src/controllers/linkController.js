const { nanoid } = require('nanoid');
const Link = require('../models/Link');

// Basic URL validation: must parse and be http/https
const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Custom alias rules: 3-30 chars, letters, numbers, hyphen, underscore
const aliasRegex = /^[A-Za-z0-9_-]{3,30}$/;

// POST /api/links  (protected)
const createLink = async (req, res) => {
  try {
    const { originalUrl, customAlias, expiresAt, maxClicks } = req.body;

    if (!originalUrl || !isValidUrl(originalUrl)) {
      return res.status(400).json({ message: 'Please provide a valid http/https URL' });
    }

    let shortCode;
    let isCustomAlias = false;

    if (customAlias) {
      if (!aliasRegex.test(customAlias)) {
        return res.status(400).json({
          message: 'Alias must be 3-30 characters: letters, numbers, - or _',
        });
      }
      const taken = await Link.findOne({ shortCode: customAlias });
      if (taken) {
        return res.status(409).json({ message: 'Alias already taken' });
      }
      shortCode = customAlias;
      isCustomAlias = true;
    } else {
      // Generate a random code; retry on the rare collision
      for (let i = 0; i < 5; i++) {
        const candidate = nanoid(7);
        const exists = await Link.findOne({ shortCode: candidate });
        if (!exists) {
          shortCode = candidate;
          break;
        }
      }
      if (!shortCode) {
        return res.status(500).json({ message: 'Could not generate a unique code, try again' });
      }
    }

    const link = await Link.create({
      user: req.user._id,
      originalUrl,
      shortCode,
      isCustomAlias,
      expiresAt: expiresAt || null,
      maxClicks: maxClicks || null,
    });

    res.status(201).json({
      link: {
        id: link._id,
        originalUrl: link.originalUrl,
        shortCode: link.shortCode,
        shortUrl: `${process.env.BASE_URL}/${link.shortCode}`,
        clickCount: link.clickCount,
        createdAt: link.createdAt,
      },
    });
  } catch (err) {
    // Race condition: two requests grabbed the same code at once
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Alias already taken' });
    }
    res.status(500).json({ message: 'Could not create link', error: err.message });
  }
};

// GET /:shortCode  (public, no login needed)
const redirectToOriginal = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const link = await Link.findOne({ shortCode });

    if (!link) {
      return res.status(404).json({ message: 'Link not found' });
    }

    if (!link.isActive) {
      return res.status(410).json({ message: 'This link is no longer active' });
    }

    // $inc is atomic: safe even if many people click at the same moment
    await Link.updateOne({ _id: link._id }, { $inc: { clickCount: 1 } });

    return res.redirect(302, link.originalUrl);
  } catch (err) {
    res.status(500).json({ message: 'Redirect failed', error: err.message });
  }
};

module.exports = { createLink, redirectToOriginal };