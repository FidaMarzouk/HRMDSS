const express = require('express');
const { getInbox, updatePreferences, markBoxRead, getCards } = require('../Controllers/inboxController');
const authMiddleware = require('../Middlewares/authMiddleware');

// Every signed-in user has an inbox; everything is scoped to them in the controller.
const router = express.Router();
router.use(authMiddleware);

router.get('/', getInbox);
router.get('/cards', getCards);
router.put('/preferences', updatePreferences);
router.put('/read', markBoxRead);

module.exports = router;
