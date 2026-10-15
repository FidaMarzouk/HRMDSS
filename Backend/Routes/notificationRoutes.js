const express = require('express');
const router = express.Router();
const notificationController = require('../Controllers/notificationController');
const authMiddleware = require('../Middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/', notificationController.getUserNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
