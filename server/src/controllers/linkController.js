const { nanoid } = require('nanoid');
const Link = require('../models/Link');
const Click = require('../models/Click');
const parseClick = require('../utils/parseClick');
const mongoose = require('mongoose');
const redis = require('../config/redis');
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

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
// GET /:shortCode  (public, no login needed)
const redirectToOriginal = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const cacheKey = `link:${shortCode}`;

    let link = null;
    let cacheStatus = 'MISS';

    // 1. Try the cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        link = JSON.parse(cached);
        cacheStatus = 'HIT';
      }
    } catch (e) {
      console.error('Redis get failed:', e.message);
      cacheStatus = 'BYPASS'; // Redis unavailable, go straight to MongoDB
    }

    // 2. Cache miss: read from MongoDB, then fill the cache
    if (!link) {
      const doc = await Link.findOne({ shortCode });

      if (!doc) {
        return res.status(404).json({ message: 'Link not found' });
      }

      link = {
        id: doc._id.toString(),
        originalUrl: doc.originalUrl,
        isActive: doc.isActive,
        expiresAt: doc.expiresAt,
        maxClicks: doc.maxClicks,
      };

      // Only cache active links, so a disabled link is always re-checked in the DB
      if (doc.isActive && cacheStatus !== 'BYPASS') {
        redis
          .set(cacheKey, JSON.stringify(link), 'EX', CACHE_TTL_SECONDS)
          .catch((e) => console.error('Redis set failed:', e.message));
      }
    }

    if (!link.isActive) {
      return res.status(410).json({ message: 'This link is no longer active' });
    }

    // Analytics: fire and forget, never blocks the redirect
    Click.create({ link: link.id, ...parseClick(req) }).catch((e) =>
      console.error('Click log failed:', e.message)
    );
    Link.updateOne({ _id: link.id }, { $inc: { clickCount: 1 } }).catch((e) =>
      console.error('Count update failed:', e.message)
    );

    res.set('X-Cache', cacheStatus); // handy for testing and for demos
    return res.redirect(302, link.originalUrl);
  } catch (err) {
    res.status(500).json({ message: 'Redirect failed', error: err.message });
  }
};
// GET /api/links  (protected)
const getMyLinks = async (req, res) => {
  try {
    const links = await Link.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('originalUrl shortCode isCustomAlias clickCount isActive expiresAt maxClicks createdAt');

    const result = links.map((link) => ({
      id: link._id,
      originalUrl: link.originalUrl,
      shortCode: link.shortCode,
      shortUrl: `${process.env.BASE_URL}/${link.shortCode}`,
      isCustomAlias: link.isCustomAlias,
      clickCount: link.clickCount,
      isActive: link.isActive,
      expiresAt: link.expiresAt,
      maxClicks: link.maxClicks,
      createdAt: link.createdAt,
    }));

    res.status(200).json({ links: result });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch links', error: err.message });
  }
};

// GET /api/links/:id/analytics?days=7  (protected)
const getLinkAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid link id' });
    }

    // Ownership check: the link must belong to the logged-in user
    const link = await Link.findOne({ _id: id, user: req.user._id });
    if (!link) {
      return res.status(404).json({ message: 'Link not found' });
    }

    // Time window: last N days (1-90), counting today, in UTC
    const days = Math.min(Math.max(parseInt(req.query.days) || 7, 1), 90);
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    // Reusable pipeline: group by a field, count, take the top 10
    const topBy = (field) => [
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ];

    // $facet runs several aggregations over the same matched clicks in ONE query
    const [data] = await Click.aggregate([
      { $match: { link: link._id, createdAt: { $gte: start } } },
      {
        $facet: {
          overTime: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                clicks: { $sum: 1 },
              },
            },
          ],
          devices: topBy('device'),
          browsers: topBy('browser'),
          referrers: topBy('referrer'),
          countries: topBy('country'),
        },
      },
    ]);

    // Days with zero clicks have no documents, so fill them in for a continuous chart
    const byDay = Object.fromEntries(data.overTime.map((d) => [d._id, d.clicks]));
    const clicksOverTime = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      clicksOverTime.push({ date: key, clicks: byDay[key] || 0 });
    }

    const format = (rows) => rows.map((r) => ({ name: r._id, count: r.count }));

    res.status(200).json({
      link: {
        id: link._id,
        shortCode: link.shortCode,
        originalUrl: link.originalUrl,
        totalClicks: link.clickCount,
      },
      days,
      clicksOverTime,
      devices: format(data.devices),
      browsers: format(data.browsers),
      referrers: format(data.referrers),
      countries: format(data.countries),
    });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch analytics', error: err.message });
  }
};

module.exports = { createLink, redirectToOriginal, getMyLinks, getLinkAnalytics };