// Who may see and decide what. One place for rules that controllers, the Today
// view, search and (later) the ENOVA Assistant must agree on.
const { IN_PROGRESS } = require('../constants/leave');

const idOf = (ref) => String(ref && typeof ref === 'object' && ref._id ? ref._id : ref);

// URL segment of the approve/reject endpoints for each reviewing role.
const LEAVE_REVIEW_PATH = { manager: 'manager', admin: 'admin', superAdmin: 'superadmin' };

// Requests with an open counter-proposal wait on the employee, not the reviewer.
const NOT_WAITING_ON_EMPLOYEE = { 'counterProposal.status': { $ne: 'open' } };

/**
 * Mongo filter for leave requests waiting on this user's decision, or null.
 * Mirrors the checks in leaveRequestController (and LeaveRequestsPage).
 *  - manager: requests routed to them, still Pending
 *  - admin (HR): any request not created by an admin, still in progress
 *  - superAdmin (CEO): requests created by admins, still Pending
 * Requests waiting on the employee's answer to a counter-proposal are left out.
 */
const leaveQueueFilter = (user) => {
  switch (user.role) {
    case 'manager':
      return { managerId: user.id, status: 'Pending', employeeId: { $ne: user.id }, ...NOT_WAITING_ON_EMPLOYEE };
    case 'admin':
      return { createdBy: { $ne: 'Admin' }, status: { $in: IN_PROGRESS }, employeeId: { $ne: user.id }, ...NOT_WAITING_ON_EMPLOYEE };
    case 'superAdmin':
      return { createdBy: 'Admin', status: 'Pending', ...NOT_WAITING_ON_EMPLOYEE };
    default:
      return null;
  }
};

const canReviewLeave = (user, request) => {
  if (idOf(request.employeeId) === String(user.id)) return false;
  switch (user.role) {
    case 'manager':
      return idOf(request.managerId) === String(user.id) && request.status === 'Pending';
    case 'admin':
      return request.createdBy !== 'Admin' && IN_PROGRESS.includes(request.status);
    case 'superAdmin':
      return request.createdBy === 'Admin' && request.status === 'Pending';
    default:
      return false;
  }
};

// Only HR administrators approve or decline calendar events and bookings.
const canReviewEvents = (user) => user.role === 'admin';

// Whose presence a user may see on the Today view: HR and the CEO see the whole
// company; managers and employees see their own department.
const presenceScope = (user, departmentId) => {
  if (user.role === 'admin' || user.role === 'superAdmin') return {};
  return departmentId ? { departmentId } : { _id: user.id };
};

/**
 * Whose profile a user may open: HR and the CEO everyone; a manager their
 * direct reports and their department; everyone themselves.
 */
const canSeePerson = (user, target, viewerDepartmentId) => {
  if (user.role === 'admin' || user.role === 'superAdmin') return true;
  const me = String(user.id);
  if (idOf(target._id) === me) return true;
  if (user.role !== 'manager') return false;
  if (idOf(target.managerId) === me) return true;
  return Boolean(viewerDepartmentId && target.departmentId && idOf(target.departmentId) === idOf(viewerDepartmentId));
};

module.exports = {
  idOf,
  canSeePerson,
  LEAVE_REVIEW_PATH,
  leaveQueueFilter,
  canReviewLeave,
  canReviewEvents,
  presenceScope,
};
