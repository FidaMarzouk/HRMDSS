const express = require('express');
const router = express.Router();
const employeeDashboardController = require('../Controllers/employeeDashboardController');
const authMiddleware = require("../Middlewares/authMiddleware");
const roleMiddleware = require('../Middlewares/roleMiddleware');

// Main dashboard route
router.get('/dashboard', authMiddleware,  roleMiddleware(['employee', 'manager', 'admin']), employeeDashboardController.getEmployeeDashboardData);

module.exports = router;