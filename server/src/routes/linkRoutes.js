const express = require('express');
const { createLink } = require('../controllers/linkController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, createLink);

module.exports = router;