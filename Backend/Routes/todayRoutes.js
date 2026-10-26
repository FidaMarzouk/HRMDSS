const express = require('express');
const { getToday, getPresence, getCounts, search } = require('../Controllers/todayController');
const authMiddleware = require('../Middlewares/authMiddleware');

// App shell data for every signed-in role, scoped inside the controller.
// Mounted at /api, so auth is attached per route rather than router-wide.
const router = express.Router();

router.get('/today', authMiddleware, getToday);
router.get('/presence', authMiddleware, getPresence);
router.get('/me/counts', authMiddleware, getCounts);
router.get('/search', authMiddleware, search);

module.exports = router;
