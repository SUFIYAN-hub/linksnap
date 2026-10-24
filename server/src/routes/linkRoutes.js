const express = require('express');
const { createLink, getMyLinks, getLinkAnalytics } = require('../controllers/linkController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, createLink);
router.get('/', protect, getMyLinks);
router.get('/:id/analytics', protect, getLinkAnalytics);

module.exports = router;