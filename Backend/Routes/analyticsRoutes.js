const express = require('express');
const { getOverview } = require('../Controllers/analyticsController');
const authMiddleware = require('../Middlewares/authMiddleware');
const roleMiddleware = require('../Middlewares/roleMiddleware');

// Scoped in the controller: HR and the CEO see the company, a manager their department.
const router = express.Router();
router.use(authMiddleware);

router.get('/overview', roleMiddleware(['admin', 'superAdmin', 'manager']), getOverview);

module.exports = router;
