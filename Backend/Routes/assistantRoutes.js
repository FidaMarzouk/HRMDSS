const express = require('express');
const c = require('../Controllers/assistantController');
const authMiddleware = require('../Middlewares/authMiddleware');
const roleMiddleware = require('../Middlewares/roleMiddleware');
const { chatbotLimiter } = require('../Middlewares/rateLimiters');
const delegation = require('../services/assistant/delegation');
const sessions = require('../services/sessions');
const accountStatus = require('../services/accountStatus');

const router = express.Router();

// Agent service only: shared secret + the person's delegated token.
const agentOnly = (req, res, next) => {
  if (!delegation.isAgent(req)) return res.status(401).json({ message: 'Unauthorized' });
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const delegated = delegation.verify(token);
  if (!delegated) return res.status(401).json({ message: 'Delegated token missing or expired' });
  if (accountStatus.isArchived(delegated.id) || !sessions.isActive(delegated.sid)) return res.status(401).json({ message: 'Session ended' });
  req.delegated = delegated;
  next();
};

router.get('/tools', agentOnly, c.manifest);
router.post('/tools/:name', agentOnly, c.runTool);
router.post('/runs', agentOnly, c.recordRun);

// The panel, with the person's own session.
router.get('/status', authMiddleware, c.status);
router.get('/thread', authMiddleware, c.getThread);
router.post('/thread/new', authMiddleware, c.newThread);
router.post('/messages', authMiddleware, chatbotLimiter, c.sendMessage);
router.post('/drafts/:id/confirm', authMiddleware, c.confirmDraft);
router.post('/drafts/:id/cancel', authMiddleware, c.cancelDraft);
router.put('/runs/:id/feedback', authMiddleware, c.feedback);
router.get('/stats', authMiddleware, roleMiddleware(['admin', 'superAdmin']), c.stats);

module.exports = router;
