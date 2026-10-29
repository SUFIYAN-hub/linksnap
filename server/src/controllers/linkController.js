const { nanoid } = require("nanoid");
const Link = require("../models/Link");
const Click = require("../models/Click");
const parseClick = require("../utils/parseClick");
const mongoose = require("mongoose");
const redis = require("../config/redis");
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const QRCode = require("qrcode");

// Basic URL validation: must parse and be http/https
const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// Custom alias rules: 3-30 chars, letters, numbers, hyphen, underscore
const aliasRegex = /^[A-Za-z0-9_-]{3,30}$/;

// POST /api/links  (protected)
const createLink = async (req, res) => {
  try {
    const { originalUrl, customAlias, expiresInDays, maxClicks } = req.body;

    if (!originalUrl || !isValidUrl(originalUrl)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid http/https URL" });
    }

    // Optional expiry by date
    let expiresAt = null;
    if (
      expiresInDays !== undefined &&
      expiresInDays !== null &&
      expiresInDays !== ""
    ) {
      const d = Number(expiresInDays);
      if (!Number.isFinite(d) || d <= 0 || d > 365) {
        return res
          .status(400)
          .json({ message: "expiresInDays must be between 0 and 365" });
      }
      expiresAt = new Date(Date.now() + d * 24 * 60 * 60 * 1000);
    }

    // Optional expiry by clicks
    let clickLimit = null;
    if (maxClicks !== undefined && maxClicks !== null && maxClicks !== "") {
      const m = Number(maxClicks);
      if (!Number.isInteger(m) || m < 1 || m > 1000000) {
        return res
          .status(400)
          .json({ message: "maxClicks must be a whole number of at least 1" });
      }
      clickLimit = m;
    }

    let shortCode;
    let isCustomAlias = false;

    if (customAlias) {
      if (!aliasRegex.test(customAlias)) {
        return res.status(400).json({
          message: "Alias must be 3-30 characters: letters, numbers, - or _",
        });
      }
      const taken = await Link.findOne({ shortCode: customAlias });
      if (taken) {
        return res.status(409).json({ message: "Alias already taken" });
      }
      shortCode = customAlias;
      isCustomAlias = true;
    } else {
      for (let i = 0; i < 5; i++) {
        const candidate = nanoid(7);
        const exists = await Link.findOne({ shortCode: candidate });
        if (!exists) {
          shortCode = candidate;
          break;
        }
      }
      if (!shortCode) {
        return res
          .status(500)
          .json({ message: "Could not generate a unique code, try again" });
      }
    }

    const link = await Link.create({
      user: req.user._id,
      originalUrl,
      shortCode,
      isCustomAlias,
      expiresAt, // plain variables here, not link.xxx
      maxClicks: clickLimit,
    });

    res.status(201).json({
      link: {
        id: link._id,
        originalUrl: link.originalUrl,
        shortCode: link.shortCode,
        shortUrl: `${process.env.BASE_URL}/${link.shortCode}`,
        clickCount: link.clickCount,
        isActive: link.isActive,
        expiresAt: link.expiresAt, // link.xxx is fine here, after creation
        maxClicks: link.maxClicks,
        createdAt: link.createdAt,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Alias already taken" });
    }
    res
      .status(500)
      .json({ message: "Could not create link", error: err.message });
  }
};

// GET /:shortCode  (public, no login needed)
// GET /:shortCode  (public, no login needed)
// GET /:shortCode  (public, no login needed)
const redirectToOriginal = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const cacheKey = `link:${shortCode}`;

    let link = null;
    let cacheStatus = "MISS";

    // 1. Try the cache first
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        link = JSON.parse(cached);
        cacheStatus = "HIT";
      }
    } catch (e) {
      console.error("Redis get failed:", e.message);
      cacheStatus = "BYPASS";
    }

    // 2. Cache miss: read from MongoDB, then fill the cache
    if (!link) {
      const doc = await Link.findOne({ shortCode });
      if (!doc) {
        return res.status(404).json({ message: "Link not found" });
      }

      link = {
        id: doc._id.toString(),
        originalUrl: doc.originalUrl,
        isActive: doc.isActive,
        expiresAt: doc.expiresAt,
        maxClicks: doc.maxClicks,
      };

      // The cache entry must never outlive the link's expiry date
      let ttl = CACHE_TTL_SECONDS;
      if (doc.expiresAt) {
        ttl = Math.min(
          ttl,
          Math.floor((doc.expiresAt.getTime() - Date.now()) / 1000),
        );
      }

      if (doc.isActive && ttl > 0 && cacheStatus !== "BYPASS") {
        redis
          .set(cacheKey, JSON.stringify(link), "EX", ttl)
          .catch((e) => console.error("Redis set failed:", e.message));
      }
    }

    // Helper: disable the link in MongoDB and drop it from the cache
    const deactivate = () => {
      Link.updateOne({ _id: link.id }, { isActive: false }).catch((e) =>
        console.error("Deactivate failed:", e.message),
      );
      redis
        .del(cacheKey)
        .catch((e) => console.error("Redis del failed:", e.message));
    };

    // 3. Disabled
    if (!link.isActive) {
      return res.status(410).json({ message: "This link is no longer active" });
    }

    // 4. Expired by date
    if (link.expiresAt && new Date(link.expiresAt) <= new Date()) {
      deactivate();
      return res.status(410).json({ message: "This link has expired" });
    }

    // 5. Count the click. With a click limit, the check and the increment must be ONE atomic step.
    if (link.maxClicks) {
      const updated = await Link.findOneAndUpdate(
        { _id: link.id, isActive: true, clickCount: { $lt: link.maxClicks } },
        { $inc: { clickCount: 1 } },
        { new: true },
      );

      if (!updated) {
        deactivate();
        return res
          .status(410)
          .json({ message: "This link has reached its click limit" });
      }

      // That was the last allowed click: it still redirects, but the link is now closed
      if (updated.clickCount >= link.maxClicks) deactivate();
    } else {
      Link.updateOne({ _id: link.id }, { $inc: { clickCount: 1 } }).catch((e) =>
        console.error("Count update failed:", e.message),
      );
    }

    Click.create({ link: link.id, ...parseClick(req) }).catch((e) =>
      console.error("Click log failed:", e.message),
    );

    res.set("X-Cache", cacheStatus);
    return res.redirect(302, link.originalUrl);
  } catch (err) {
    res.status(500).json({ message: "Redirect failed", error: err.message });
  }
};
// GET /api/links  (protected)
const getMyLinks = async (req, res) => {
  try {
    const links = await Link.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select(
        "originalUrl shortCode isCustomAlias clickCount isActive expiresAt maxClicks createdAt",
      );

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
    res
      .status(500)
      .json({ message: "Could not fetch links", error: err.message });
  }
};

// GET /api/links/:id/analytics?days=7  (protected)
const getLinkAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid link id" });
    }

    // Ownership check: the link must belong to the logged-in user
    const link = await Link.findOne({ _id: id, user: req.user._id });
    if (!link) {
      return res.status(404).json({ message: "Link not found" });
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
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                clicks: { $sum: 1 },
              },
            },
          ],
          devices: topBy("device"),
          browsers: topBy("browser"),
          referrers: topBy("referrer"),
          countries: topBy("country"),
        },
      },
    ]);

    // Days with zero clicks have no documents, so fill them in for a continuous chart
    const byDay = Object.fromEntries(
      data.overTime.map((d) => [d._id, d.clicks]),
    );
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
    res
      .status(500)
      .json({ message: "Could not fetch analytics", error: err.message });
  }
};

// GET /api/links/:id/qr  (protected)
const getLinkQr = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid link id" });
    }

    // Ownership check, same pattern as analytics
    const link = await Link.findOne({ _id: id, user: req.user._id });
    if (!link) {
      return res.status(404).json({ message: "Link not found" });
    }

    const shortUrl = `${process.env.BASE_URL}/${link.shortCode}`;
    const qr = await QRCode.toDataURL(shortUrl, { width: 300, margin: 2 });

    res.status(200).json({ qr, shortUrl });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Could not generate QR code", error: err.message });
  }
};
module.exports = {
  createLink,
  redirectToOriginal,
  getMyLinks,
  getLinkAnalytics,
  getLinkQr,
};
