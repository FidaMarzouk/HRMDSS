const express = require('express');
const {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  updateAttendeeStatus,
  adminReviewEvent,
  checkResourceAvailability,
  getResources,
  getResourceById,
  getResourceWeek,
  getUsersInvolved
} = require('../Controllers/calendarController.js');
const authMiddleware = require('../Middlewares/authMiddleware.js');
const roleMiddleware = require('../Middlewares/roleMiddleware.js');
const { broadcastOnSuccess } = require('../Middlewares/notificationService');

const queueChanged = broadcastOnSuccess('queue:changed');

const router = express.Router();

router.use(authMiddleware);

// Events visible to the current user (filterable with query params)
router.get('/events', getEvents);

// Create an event organized by the current user
router.post('/event', queueChanged, createEvent);

// Update / delete (organizer or admin)
router.put('/event/:eventId', queueChanged, updateEvent);
router.delete('/event/:eventId', queueChanged, deleteEvent);

// Current user accepts or declines an invitation
router.put('/event/:eventId/respond', queueChanged, updateAttendeeStatus);

// Admin approves or declines an event
router.put('/event/:eventId/review/:status', queueChanged, roleMiddleware(['admin']), adminReviewEvent);

// Resources
router.get('/resource-availability', checkResourceAvailability);
router.get('/resources', getResources);
// One lane per resource for a week (registered before /resources/:id)
router.get('/resources/week', getResourceWeek);
router.get('/resources/:id', getResourceById);

// People who can be invited to events
router.get('/users', getUsersInvolved);

module.exports = router;
