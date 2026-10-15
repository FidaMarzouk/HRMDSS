const express = require('express');
const {
  punchIn, punchOut, startBreak, endBreak, getAttendanceHistory, getTodaySessions,
  getUserAttendanceByDateRange, getManagedEmployeesAttendance, getAllEmployeesAttendance
} = require('../Controllers/attendanceController.js');
const authMiddleware = require('../Middlewares/authMiddleware.js');
const roleMiddleware = require('../Middlewares/roleMiddleware.js');

const router = express.Router();

router.use(authMiddleware);

// Self-service: always acts on the authenticated user
router.post('/punch-in', punchIn);
router.post('/punch-out', punchOut);
router.post('/break/start', startBreak);
router.post('/break/end', endBreak);
router.get('/history', getAttendanceHistory);
router.get('/today', getTodaySessions);
router.get('/date-range', getUserAttendanceByDateRange);

// Team and company views
router.get('/managed', roleMiddleware(['manager']), getManagedEmployeesAttendance);
router.get('/all', roleMiddleware(['admin', 'superAdmin']), getAllEmployeesAttendance);

module.exports = router;
