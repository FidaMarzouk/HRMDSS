const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authController');
const authMiddleware = require('../Middlewares/authMiddleware');
const { authLimiter } = require('../Middlewares/rateLimiters');

router.post('/login', authLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/verify', authMiddleware, authController.verifyToken);

// Your own sessions (profile › Security)
router.get('/sessions', authMiddleware, authController.listSessions);
router.post('/sessions/sign-out-others', authMiddleware, authController.signOutOthers);
router.delete('/sessions/:id', authMiddleware, authController.endSession);

router.post('/forgot-password', authLimiter, authController.requestPasswordReset);
router.get('/reset-password/:token', authController.verifyResetToken);
router.post('/reset-password/:token', authLimiter, authController.resetPassword);

module.exports = router;
