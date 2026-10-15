const express = require('express');
const router = express.Router();
const chatbotController = require('../Controllers/chatbot.controller');
const authMiddleware = require('../Middlewares/authMiddleware');
const roleMiddleware = require('../Middlewares/roleMiddleware');
const { chatbotLimiter } = require('../Middlewares/rateLimiters');

router.use(authMiddleware);

router.post('/message', chatbotLimiter, chatbotController.sendMessage);
router.get('/history', chatbotController.getConversationHistory);
router.delete('/history', chatbotController.clearConversationHistory);
router.post('/reindex', roleMiddleware(['admin', 'superAdmin']), chatbotController.reindex);

module.exports = router;
