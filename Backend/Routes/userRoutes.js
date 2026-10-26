const express = require('express');
const { createUser, updateUser, getUsers, getRemainingLeaveDays, updateProfile, getProfile, getCurrentUser } = require('../Controllers/userController');
const authMiddleware = require('../Middlewares/authMiddleware');
const roleMiddleware = require('../Middlewares/roleMiddleware');
const upload = require('../Middlewares/upload');
const { addUserValidationRules, updateUserValidationRules, updateProfileValidationRules, validate } = require('../Middlewares/validators');
const router = express.Router();

// Self-service (must be declared before '/:id')
router.get('/me', authMiddleware, getCurrentUser);
router.get('/remaining-leave-days', authMiddleware, getRemainingLeaveDays);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, upload.single('profileImage'), updateProfileValidationRules, validate, updateProfile);

// Directory
router.get('/', authMiddleware, roleMiddleware(['admin', 'manager', 'superAdmin']), getUsers);

// Administration (admin only)
router.post('/', authMiddleware, roleMiddleware('admin'), upload.single('profilePicture'), addUserValidationRules, validate, createUser);
router.put('/:id', authMiddleware, roleMiddleware('admin'), upload.single('profilePicture'), updateUserValidationRules, validate, updateUser);
// People are archived, never deleted: POST /api/people/:id/archive

module.exports = router;
