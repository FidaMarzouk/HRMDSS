const express = require('express');
const router = express.Router();
const hrDashboardController = require('../Controllers/hrDashboardController');
const authMiddleware = require("../Middlewares/authMiddleware");
const roleMiddleware = require('../Middlewares/roleMiddleware');

// Main dashboard route
router.get('/dashboard', authMiddleware, roleMiddleware(['admin','superAdmin']),hrDashboardController.getHRDashboardData);
module.exports = router;