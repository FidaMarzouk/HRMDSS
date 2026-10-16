const express = require("express");
const router = express.Router();
const {
  managerApproveRequest,
  managerRejectRequest,
  adminApproveRequest,
  adminRejectRequest,
  getAllLeaveRequests,
  getAdminCreatedLeaveRequests,
  superAdminRejectRequest,
  superAdminApproveRequest,
  createLeaveRequest,
  getApprover
} = require("../Controllers/leaveRequestController");
const authMiddleware = require("../Middlewares/authMiddleware");
const roleMiddleware = require("../Middlewares/roleMiddleware");
const { broadcastOnSuccess } = require("../Middlewares/notificationService");

// Any successful create or decision changes someone's queue.
const queueChanged = broadcastOnSuccess("queue:changed");

const requesters = roleMiddleware(['admin', 'manager', 'employee']);

// Who the current user's leave requests are routed to
router.get("/approver", authMiddleware, requesters, getApprover);

// Create leave requests
router.post("/create", authMiddleware, queueChanged, requesters, createLeaveRequest);

// Manager approval routes
router.put("/manager/:id/approve", authMiddleware, queueChanged, roleMiddleware("manager"), managerApproveRequest);
router.put("/manager/:id/reject", authMiddleware, queueChanged, roleMiddleware("manager"), managerRejectRequest);

// Admin approval routes
router.put("/admin/:id/approve", authMiddleware, queueChanged, roleMiddleware("admin"), adminApproveRequest);
router.put("/admin/:id/reject", authMiddleware, queueChanged, roleMiddleware("admin"), adminRejectRequest);

router.get("/", authMiddleware, roleMiddleware(['admin', 'superAdmin', 'manager', 'employee']), getAllLeaveRequests);

// CEO (superAdmin) reviews requests created by admins
router.get("/superadmin/admin-leave-requests", authMiddleware, roleMiddleware("superAdmin"), getAdminCreatedLeaveRequests);
router.put("/superadmin/:id/approve", authMiddleware, queueChanged, roleMiddleware("superAdmin"), superAdminApproveRequest);
router.put("/superadmin/:id/reject", authMiddleware, queueChanged, roleMiddleware("superAdmin"), superAdminRejectRequest);

module.exports = router;
