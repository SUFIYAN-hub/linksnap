const express = require('express');
const { createLink, getMyLinks } = require('../controllers/linkController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, createLink);
router.get('/', protect, getMyLinks);

module.exports = router;