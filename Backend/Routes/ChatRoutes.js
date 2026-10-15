const express = require('express');
const router = express.Router();
const chatController = require('../Controllers/ChatController');
const User = require('../Models/User');
const authMiddleware = require('../Middlewares/authMiddleware.js');

router.use(authMiddleware);

// Colleagues the current user can message (public directory fields only)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('firstName lastName email profilePicture role position departmentId')
      .populate('departmentId', 'name');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/conversations', chatController.getConversations);
router.get('/messages/:userId', chatController.getMessages);
router.post('/messages', chatController.sendMessage);
router.put('/messages/read', chatController.markAsRead);
router.delete('/messages/:messageId', chatController.deleteMessage);
router.delete('/conversations/:userId', chatController.deleteConversation);

module.exports = router;
