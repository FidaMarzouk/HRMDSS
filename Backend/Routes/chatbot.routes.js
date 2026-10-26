const express = require('express');
const router = express.Router();
const chatbotController = require('../Controllers/chatbot.controller');
const authMiddleware = require('../Middlewares/authMiddleware');
const roleMiddleware = require('../Middlewares/roleMiddleware');

// Conversations go through /api/assistant (Routes/assistantRoutes.js).
router.use(authMiddleware);
router.post('/reindex', roleMiddleware(['admin', 'superAdmin']), chatbotController.reindex);

module.exports = router;
