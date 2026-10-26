const express = require('express');
const {
  punchIn, punchOut, startBreak, endBreak, getAttendanceHistory, getTodaySessions,
  getUserAttendanceByDateRange, getManagedEmployeesAttendance, getAllEmployeesAttendance
} = require('../Controllers/attendanceController.js');
const authMiddleware = require('../Middlewares/authMiddleware.js');
const roleMiddleware = require('../Middlewares/roleMiddleware.js');
const { broadcastOnSuccess } = require('../Middlewares/notificationService');
const time = require('../Controllers/timeController');

const presenceChanged = broadcastOnSuccess('presence:changed');

const router = express.Router();

router.use(authMiddleware);

// Self-service: always acts on the authenticated user
router.post('/punch-in', presenceChanged, punchIn);
router.post('/punch-out', presenceChanged, punchOut);
router.post('/break/start', presenceChanged, startBreak);
router.post('/break/end', presenceChanged, endBreak);
router.get('/history', getAttendanceHistory);
router.get('/today', getTodaySessions);
router.get('/date-range', getUserAttendanceByDateRange);

// Team and company views
router.get('/managed', roleMiddleware(['manager']), getManagedEmployeesAttendance);
router.get('/all', roleMiddleware(['admin', 'superAdmin']), getAllEmployeesAttendance);

// Time page: day ribbons, own recent days, correction requests
router.get('/day', time.getDay);
router.get('/mine', time.getMine);
router.get('/corrections', time.listCorrections);
router.post('/corrections', broadcastOnSuccess('queue:changed'), time.createCorrection);
router.put('/corrections/:id/approve', broadcastOnSuccess('queue:changed'), presenceChanged, time.approveCorrection);
router.put('/corrections/:id/reject', broadcastOnSuccess('queue:changed'), time.rejectCorrection);

module.exports = router;
