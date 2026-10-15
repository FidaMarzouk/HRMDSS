const express = require('express');
const router = express.Router();
const managerDashboardController = require('../Controllers/managerDashboardController');
const authMiddleware = require("../Middlewares/authMiddleware");
const roleMiddleware = require('../Middlewares/roleMiddleware');

// Main dashboard route
router.get('/dashboard', authMiddleware,  roleMiddleware(['manager']), managerDashboardController.getManagerDashboardData);

module.exports = router;