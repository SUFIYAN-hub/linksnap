const express = require('express');
const {
  createLink,
  getMyLinks,
  getLinkAnalytics,
  getLinkQr,
} = require('../controllers/linkController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, createLink);
router.get('/', protect, getMyLinks);
router.get('/:id/analytics', protect, getLinkAnalytics);
router.get('/:id/qr', protect, getLinkQr);

module.exports = router;