const mongoose = require('mongoose');
const CalendarEvent = require('../Models/CalendarEvent');
const User = require('../Models/User'); 
const Department = require('../Models/Department'); 
const Resource = require('../Models/Resource'); 
const { sendNotificationToUser, sendNotificationToRole } = require('../Middlewares/notificationService');
const clash = require('../services/clash');
const policies = require('../services/policies');
const { startOfDay, toCompanyDate, dayKey, isWeekend } = require('../utils/time');

const MODELS = { Resource, CalendarEvent };
const DAY_MS = 24 * 60 * 60 * 1000;

// 409 (or 404) with the bookings in the way, for create, move and approve.
const refuseBooking = (res, check) =>
  res.status(check.httpStatus || 409).json({
    message: check.message,
    status: check.status,
    conflicts: check.conflicts,
    // Older clients read `conflictingEvents`.
    conflictingEvents: check.conflicts,
  });


const isAdminRole = (role) => role === 'admin' || role === 'superAdmin';

// Loads an event and checks that the current user may modify it (creator or admin).
const loadEditableEvent = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.eventId)) {
    res.status(404).json({ message: 'Event not found', status: 'not_found' });
    return null;
  }
  const event = await CalendarEvent.findById(req.params.eventId);
  if (!event) {
    res.status(404).json({ message: 'Event not found', status: 'not_found' });
    return null;
  }
  if (event.createdBy.toString() !== req.user.id && !isAdminRole(req.user.role)) {
    res.status(403).json({ message: 'Only the organizer or an admin can change this event', status: 'forbidden' });
    return null;
  }
  return event;
};

// Helper function to validate event duration
const validateEventDuration = (startDateTime, endDateTime) => {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  const minimumDuration = 10 * 60 * 1000; // 10 minutes in milliseconds
  
  if (start >= end) {
    return { valid: false, status: 'invalid_dates' };
  }
  
  if ((end - start) < minimumDuration) {
    return { valid: false, status: 'duration_too_short' };
  }
  
  return { valid: true };
};

// Helper function to validate event fields based on event type
const validateEventFields = (eventType, body) => {
  const validations = {
    resourceReservation: () => {
      if (!body.resource) {
        return { valid: false, status: 'missing_resource' };
      }
      return { valid: true };
    },
        meeting: () => {
      if (!body.description || body.description.trim() === '') {
        return { valid: false, status: 'missing_description' };
      }
      // A booked room counts as the location.
      if ((!body.location || body.location.trim() === '') && !body.resource) {
        return { valid: false, status: 'missing_location' };
      }
      return { valid: true };
    },
    mission: () => {
      if (!body.description || body.description.trim() === '') {
        return { valid: false, status: 'missing_description' };
      }
      if (!body.destination || body.destination.trim() === '') {
        return { valid: false, status: 'missing_destination' };
      }
      return { valid: true };
    },
    default: () => ({ valid: true })
  };
  
  const validator = validations[eventType] || validations.default;
  return validator();
};

// Helper function to build event data structure based on event type
const buildEventData = (eventType, body, userId, user) => {
  // Common fields for all event types
  const eventData = {
    createdBy: userId,
    departmentId: user.departmentId,
    eventType,
    title: body.title,
    startDateTime: body.startDateTime,
    endDateTime: body.endDateTime,
    description: body.description,
    visibility: ['public', 'private', 'department'].includes(body.visibility) 
      ? body.visibility 
      : 'public'
  };
  
  // Add type-specific fields
  const typeSpecificFields = {
        resourceReservation: () => ({ resource: body.resource }),
    meeting: () => ({ location: body.location, resource: body.resource || undefined }),
    mission: () => ({ destination: body.destination })
  };
  
  const addFields = typeSpecificFields[eventType];
  if (addFields) {
    Object.assign(eventData, addFields());
  }
  
  // Add users involved if present
  if (body.usersInvolved && Array.isArray(body.usersInvolved)) {
    eventData.usersInvolved = body.usersInvolved.map(user => {
      // Handle both string IDs and objects
      const userId = typeof user === 'object' ? 
        (user.userId || user) : 
        user;
      
      return {
        userId: new mongoose.Types.ObjectId(userId),
        status: 'pending'
      };
    });
  }
  
  return eventData;
};

// Helper function to handle event notifications
const handleEventNotifications = async (eventData, user, userId) => {
  try {
    // 1. Send notification to admin
    await sendNotificationToRole('admin', {
      title: 'New Event Created',
      message: `${user.firstName} ${user.lastName} has created a new ${eventData.eventType}: "${eventData.title}"`,
      type: 'event',
      relatedId: eventData._id
    });

    // 2. Send notifications to invited users
    if (eventData.usersInvolved && eventData.usersInvolved.length > 0) {
      const eventTypeName = eventData.eventType;
      for (const userInvolved of eventData.usersInvolved) {
        await sendNotificationToUser(userInvolved.userId, {
          title: `New ${eventTypeName} Invitation`,
          message: `${user.firstName} ${user.lastName} has invited you to ${eventData.title} on ${new Date(eventData.startDateTime).toLocaleDateString()}`,
          type: 'event',
          relatedId: eventData._id
        });
      }
    }

    // 3. Send notifications to department users if event visibility is department-wide
    if (eventData.visibility === 'department') {
      const departmentUsers = await User.find({ ...User.ACTIVE, 
        departmentId: user.departmentId, 
        _id: { $ne: userId } 
      });

      for (const deptUser of departmentUsers) {
        await sendNotificationToUser(deptUser._id, {
          title: 'New Department Event',
          message: `${user.firstName} ${user.lastName} has created a new event: "${eventData.title}"`,
          type: 'event_invitation',
          relatedId: eventData._id
        });
      }
    }
  } catch (error) {
    console.error('Error in handleEventNotifications:', error);
  }
};

// Helper for handling notification for newly added users
const notifyNewlyAddedUsers = async (event, updatedUsersInvolved, creator) => {
  if (!updatedUsersInvolved || !event.usersInvolved) return;
  
  // Find users who were newly added
  const existingUserIds = event.usersInvolved.map(u => u.userId.toString());
  const newlyAddedUsers = updatedUsersInvolved.filter(u => {
    const userId = typeof u === 'object' ? u.userId : u;
    return !existingUserIds.includes(userId.toString());
  });
  
  // If there are new users, notify them
  if (newlyAddedUsers.length > 0) {
    const eventTypeName = event.eventType;
    
    for (const newUser of newlyAddedUsers) {
      const userId = typeof newUser === 'object' ? newUser.userId : newUser;
      await sendNotificationToUser(userId, {
        title: `New ${eventTypeName} Invitation`,
        message: `${creator.firstName} ${creator.lastName} has invited you to "${event.title}" on ${new Date(event.startDateTime).toLocaleDateString()}`,
        type: 'event_invitation',
        relatedId: event._id
      });
    }
  }
};

exports.getEvents = async (req, res) => {
  try {
    const { startDate, endDate, eventType, visibility, status } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    const user = await User.findById(userId);
    const userDepartmentId = user.departmentId;
    
    let query = {};
    
    // Apply date range filtering ("YYYY-MM-DD" are company days; the end day is included)
    let windowStart = null;
    let windowEnd = null;
    if (startDate && endDate) {
      windowStart = toCompanyDate(startDate);
      windowEnd = new Date(toCompanyDate(endDate).getTime() + DAY_MS);
      query.startDateTime = { $lt: windowEnd };
      query.endDateTime = { $gt: windowStart };
    }
    
    // Apply role-based and visibility filtering
    if (userRole !== 'admin' && userRole !== 'superAdmin') {
      // Non-admin users have restricted visibility
      query.$or = [
        // Public events visible to all
        { visibility: 'public' },
        // Department events - only visible to users in the same department
        { visibility: 'department', departmentId: userDepartmentId },
        // Private events - only visible to creator and invitees
        { visibility: 'private', createdBy: userId },
        // Events where user is invited
        { visibility: 'private', 'usersInvolved.userId': userId }
      ];
    }
    
    // Additional filters
    if (eventType) query.eventType = eventType;
    if (visibility) query.visibility = visibility;
    if (status) query.status = status;
    
    const events = await CalendarEvent.find(query)
      .populate('createdBy', 'firstName lastName')
      .populate('departmentId', 'name')
      .populate('resource', 'name type')
      .populate('usersInvolved.userId', 'firstName lastName')
      .populate('adminActions.approvedBy', 'firstName lastName')
      .populate('adminActions.declinedBy', 'firstName lastName')
      .sort({ startDateTime: 1 })
      .lean();

    // Clash state for events that hold a resource, compared with every live
    // booking of those resources (including ones this user cannot see).
    const resourceIds = [...new Set(events.filter((e) => e.resource).map((e) => String(e.resource._id || e.resource)))];
    const bookings = resourceIds.length
      ? await CalendarEvent.find({
          resource: { $in: resourceIds },
          status: { $ne: 'declined' },
          ...(windowStart ? { startDateTime: { $lt: new Date(windowEnd.getTime() + DAY_MS) }, endDateTime: { $gt: new Date(windowStart.getTime() - DAY_MS) } } : {}),
        })
          .select('title resource status startDateTime endDateTime')
          .lean()
      : [];
    const withState = events.map((e) => {
      const own = { ...e, resource: e.resource ? e.resource._id || e.resource : undefined };
      const clashes = clash.clashesOf(own, bookings);
      return { ...e, state: clash.bookingState(e, clashes), clashCount: clashes.length };
    });

    res.status(200).json(withState);
  } catch (error) {
    console.error("Error in getEvents:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create a new event - Refactored
exports.createEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const { eventType } = req.body;
    if (!['meeting', 'mission', 'resourceReservation'].includes(eventType)) {
      return res.status(400).json({ status: 'invalid_event_type' });
    }

    // Validate event duration
    const durationValidation = validateEventDuration(req.body.startDateTime, req.body.endDateTime);
    if (!durationValidation.valid) {
      return res.status(400).json({ status: durationValidation.status });
    }

    // Validate event fields based on type
    const fieldsValidation = validateEventFields(eventType, req.body);
    if (!fieldsValidation.valid) {
      return res.status(400).json({ status: fieldsValidation.status });
    }
    
        // A booked resource (reservation, or a meeting's room) must be free:
    // a confirmed booking at that time refuses it with 409; pending requests
    // at that time are allowed and reported back as clashes.
    let check = { ok: true, clashes: [] };
    if (req.body.resource && ['resourceReservation', 'meeting'].includes(eventType)) {
      check = await clash.checkBooking({ resourceId: req.body.resource, startDateTime: req.body.startDateTime, endDateTime: req.body.endDateTime, models: MODELS });
      if (!check.ok) return refuseBooking(res, check);
    }

    // Build event data structure
    let eventData = buildEventData(eventType, req.body, userId, user);
    if (eventType === 'meeting' && check.resource && !eventData.location) eventData.location = check.resource.name;
    
    // Set approval status based on user role
    if (isAdminRole(req.user.role)) {
      eventData.status = 'approved';
      eventData.adminActions = {
        approvedBy: req.user.id,
        approvedAt: new Date()
      };
    } else {
      eventData.status = 'pending';
    }
    
    // Create the event
    const event = await CalendarEvent.create(eventData);
    
    // Handle notifications
    await handleEventNotifications(event, user, userId);
    
        res.status(201).json({ ...event.toObject(), clashes: check.clashes });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update an event - Refactored
exports.updateEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const event = await loadEditableEvent(req, res);
    if (!event) return;
    const creator = await User.findById(event.createdBy);
  
    // Event type change validation
    if (req.body.eventType && req.body.eventType !== event.eventType) {
      return res.status(400).json({ status: 'invalid_update' });
    }

    // Date validation
    if (req.body.startDateTime && req.body.endDateTime) {
      const durationValidation = validateEventDuration(req.body.startDateTime, req.body.endDateTime);
      if (!durationValidation.valid) {
        return res.status(400).json({ status: durationValidation.status });
      }
    }
    
    // Field validation based on event type
    if (Object.keys(req.body).some(key => ['description', 'destination', 'location', 'resource'].includes(key))) {
      const fieldsValidation = validateEventFields(event.eventType, {
        ...event.toObject(),
        ...req.body
      });
      
      if (!fieldsValidation.valid) {
        return res.status(400).json({ status: fieldsValidation.status });
      }
    }
    
    // Create updateData with common fields
    const updateData = {
      title: req.body.title,
      visibility: req.body.visibility,
      startDateTime: req.body.startDateTime,
      endDateTime: req.body.endDateTime,
      description: req.body.description,
    };
    
    // Add type-specific fields based on event type
        const typeSpecificFieldMap = {
      resourceReservation: ['resource'],
      meeting: ['location', 'resource'],
      mission: ['destination']
    };
    
    const fieldsToAdd = typeSpecificFieldMap[event.eventType] || [];
        fieldsToAdd.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    // A meeting can give its room back ("" or null): unset it.
    const unset = {};
    if (event.eventType === 'meeting' && 'resource' in req.body && !req.body.resource) {
      delete updateData.resource;
      unset.resource = 1;
    }
    
    // Add users involved if present
    if (Array.isArray(req.body.usersInvolved)) {
      // Keep existing responses for people who were already invited.
      const previous = new Map(event.usersInvolved.map((u) => [u.userId.toString(), u.status]));
      updateData.usersInvolved = req.body.usersInvolved.map((u) => {
        const id = (typeof u === 'object' ? (u.userId?._id || u.userId) : u).toString();
        return { userId: id, status: previous.get(id) || 'pending' };
      });
    }
    
        // Resource availability check (reservations and meeting rooms)
    let check = { ok: true, clashes: [] };
    const resourceId = unset.resource ? null : (req.body.resource || event.resource);
    if (resourceId && (req.body.startDateTime || req.body.endDateTime || req.body.resource)) {
      check = await clash.checkBooking({
        resourceId,
        startDateTime: req.body.startDateTime || event.startDateTime,
        endDateTime: req.body.endDateTime || event.endDateTime,
        excludeId: eventId,
        models: MODELS,
      });
      if (!check.ok) return refuseBooking(res, check);
      if (event.eventType === 'meeting' && req.body.resource && !req.body.location) updateData.location = check.resource.name;
    }
    
    // Handle visibility validation
    if (req.body.visibility && !['public', 'private', 'department'].includes(req.body.visibility)) {
      updateData.visibility = 'public';
    }
    
    // Reset approval status if key details change (unless done by admin)
    const keyDetailsChanged = req.body.startDateTime || req.body.endDateTime || req.body.resource;
    const isNotAdmin = !isAdminRole(req.user.role);
    const isCurrentlyApproved = event.status === 'approved';
    
    if (keyDetailsChanged && isNotAdmin && isCurrentlyApproved) {
      updateData.status = 'pending';
      updateData.adminActions = {};
      
      // Notify admins about the change requiring re-approval
      await sendNotificationToRole('admin', {
        title: 'Event Update Requires Approval',
        message: `${creator.firstName} ${creator.lastName} has updated event "${event.title}" which requires re-approval`,
        type: 'event',
        relatedId: event._id
      });
    }
    
    Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

    // Check if update object has any properties
        if (Object.keys(updateData).length === 0 && Object.keys(unset).length === 0) {
      return res.status(400).json({
        message: 'No valid update fields provided',
        status: 'invalid_update'
      });
    }
    
        const updatedEvent = await CalendarEvent.findByIdAndUpdate(
      eventId,
      Object.keys(unset).length ? { ...updateData, $unset: unset } : updateData,
      { new: true, runValidators: true }
    );

    // Handle notifications for newly added users
    await notifyNewlyAddedUsers(event, req.body.usersInvolved, creator);

    res.status(200).json({ ...updatedEvent.toObject(), clashes: check.clashes });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete an event
exports.deleteEvent = async (req, res) => {
  try {
    const event = await loadEditableEvent(req, res);
    if (!event) return;

    await CalendarEvent.findByIdAndDelete(event._id);
    
    res.status(200).json({ 
      message: 'Event deleted successfully',
      status: 'success'
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update attendee status
exports.updateAttendeeStatus = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const userId = req.user.id;
    // 'approved' is accepted as an alias for older clients.
    const status = req.body.status === 'approved' ? 'accepted' : req.body.status;
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Status must be accepted or declined', status: 'invalid_status' });
    }
    const user = await User.findById(userId);
    const event = await CalendarEvent.findOneAndUpdate(
      { 
        _id: eventId,
        'usersInvolved.userId': userId 
      },
      { 
        $set: { 'usersInvolved.$.status': status } 
      },
      { new: true }
    ).populate('createdBy', 'firstName lastName');

    if (!event) {
      return res.status(404).json({ message: 'You are not invited to this event', status: 'not_found' });
    }

    await sendNotificationToUser(event.createdBy._id, {
      title: `Event Response: ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
      message: `${user.firstName} ${user.lastName} has ${status} your invitation to "${event.title}"`,
      type: 'event_response',
      relatedId: event._id
    });
    
    res.status(200).json(event);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Admin approval or decline for events
exports.adminReviewEvent = async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const adminId = req.user.id;
    const admin = await User.findById(adminId);
    const status = req.params.status;
    if (!['approved', 'declined'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or declined', status: 'invalid_status' });
    }

        if (!mongoose.isValidObjectId(eventId)) {
      return res.status(404).json({ message: 'Event not found', status: 'not_found' });
    }
    const current = await CalendarEvent.findById(eventId).lean();
    if (!current) {
      return res.status(404).json({ message: 'Event not found', status: 'not_found' });
    }
    if (current.status !== 'pending') {
      return res.status(409).json({ message: `This event is already ${current.status}`, status: 'already_reviewed' });
    }
    // Clashes are blocked before approval, not discovered on the day.
    if (status === 'approved' && current.resource) {
      const check = await clash.checkBooking({ resourceId: current.resource, startDateTime: current.startDateTime, endDateTime: current.endDateTime, excludeId: eventId, models: MODELS });
      if (!check.ok) return refuseBooking(res, check);
    }

    // Prepare admin action data
    const adminActionData = {};
    
    if (status === 'approved') {
      adminActionData.approvedBy = adminId;
      adminActionData.approvedAt = new Date();
    } else {
      adminActionData.declinedBy = adminId;
      adminActionData.declinedAt = new Date();
    }
    
        // Conditional on still being pending, so two reviewers cannot both decide.
    const updatedEvent = await CalendarEvent.findOneAndUpdate(
      { _id: eventId, status: 'pending' },
      {
        status: status,
        adminActions: adminActionData
      },
      { new: true }
    ).populate('createdBy');

    if (!updatedEvent) {
      return res.status(404).json({ message: 'Event not found', status: 'not_found' });
    }

    await sendNotificationToUser(updatedEvent.createdBy._id, {
      title: `Event ${status === 'approved' ? 'Approved' : 'Declined'}`,
      message: `Your event "${updatedEvent.title}" has been ${status} by ${admin.firstName} ${admin.lastName}`,
      type: 'event_response',
      relatedId: updatedEvent._id
    });
    
    // If the event was approved/declined and has users involved, notify them too
    if (updatedEvent.usersInvolved && updatedEvent.usersInvolved.length > 0) {
      for (const userInvolved of updatedEvent.usersInvolved) {
        await sendNotificationToUser(userInvolved.userId, {
          title: `Event ${status === 'approved' ? 'Approved' : 'Declined'}`,
          message: `The event "${updatedEvent.title}" has been ${status} by the administrator`,
          type: 'event_response',
          relatedId: updatedEvent._id
        });
      }
    }

    res.status(200).json(updatedEvent);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Check resource availability
exports.checkResourceAvailability = async (req, res) => {
  try {
    const { resourceId, startDateTime, endDateTime, eventId } = req.query; // Accept eventId

    if (!resourceId || !startDateTime || !endDateTime) {
      return res.status(400).json({
        message: "Missing required parameters",
        status: "missing_params"
      });
    }

        const check = await clash.checkBooking({ resourceId, startDateTime, endDateTime, excludeId: eventId, models: MODELS });
    res.status(200).json({
      available: check.ok,
      resourceStatus: check.ok ? 'available' : check.status === 'resource_maintenance' ? 'maintenance' : check.status === 'resource_not_found' ? 'not_found' : 'unavailable',
      message: check.ok ? (check.clashes.length ? 'Other requests are pending for this time' : 'Resource is available') : check.message,
      conflictingEvents: check.ok ? [] : check.conflicts,
      // Pending requests for the same time: allowed, the reviewer picks one.
      pendingClashes: check.ok ? check.clashes : [],
    });
  } catch (error) {
    console.error("Error checking resource availability:", error);
    res.status(400).json({ message: error.message });
  }
};

exports.getUsersInvolved = async (req, res) => {
  try {
    const users = await User.find(User.ACTIVE)
      .select('firstName lastName email position role departmentId profilePicture')
      .populate({
        path: "departmentId",
        select: "name"
    });

    return res.status(200).json({ users });
  } catch (err) {
    console.error('Error retrieving users:', err);
    res.status(500).json({ 
        message: 'Server error'
    });
  }
};

// Get resources list 
exports.getResources = async (req, res) => {
  try {
    const { type, date } = req.query;
    const now = new Date();
    
    // Base query for resources
    let query = {};
    
    // Add type filter if provided
    if (type) query.type = type;
    
    const resources = await Resource.find(query).sort({ name: 1 });
    
    // For each resource, check its availability status
    const result = await Promise.all(resources.map(async (resource) => {
      // Convert mongoose document to plain object so we can modify it
      const resourceObj = resource.toObject();
      
      // Check for ongoing reservations (current)
      const currentReservations = await CalendarEvent.find({
        eventType: 'resourceReservation',
        resource: resource._id,
        status: 'approved',
        startDateTime: { $lte: now },
        endDateTime: { $gt: now }
      }).sort({ startDateTime: 1 });
      
      // Mark as unavailable if there's an active reservation
      if (currentReservations.length > 0) {
        resourceObj.status = resource.status === 'maintenance' ? 'maintenance' : 'unavailable';
        resourceObj.currentReservation = {
          id: currentReservations[0]._id,
          title: currentReservations[0].title,
          endsAt: currentReservations[0].endDateTime
        };
      } else {
        resourceObj.status = resource.status === 'maintenance' ? 'maintenance' : 'available';
      }
      return resourceObj;
    }));
    
    // Filter results based on requested status
    const finalResult = req.query.status ? 
      result.filter(r => r.status === req.query.status) : 
      result;
    
    res.status(200).json(finalResult);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getResourceById = async (req, res) => {
  try {
    const resourceId = req.params.id;
    const resource = await Resource.findById(resourceId);
    
    if (!resource) {
      return res.status(404).json({
        message: 'Resource not found',
        status: 'not_found'
      });
    }
    
    // Return a more detailed response
    res.status(200).json({
      _id: resource._id,
      name: resource.name,
      type: resource.type,
      status: resource.status,
      description: resource.description,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Monday of the week containing `date`, in company time.
const mondayOf = (date) => {
  const d = startOfDay(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

// GET /api/calendar/resources/week?start=YYYY-MM-DD&days=5
// One lane per resource with its bookings in the window: confirmed, pending
// or clash. Private bookings show as "Private booking" to people who cannot
// see them; the lane still shows the resource is taken.
exports.getResourceWeek = async (req, res) => {
  try {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(req.query.start || '') ? toCompanyDate(req.query.start) : mondayOf(new Date());
    const span = Math.min(14, Math.max(1, parseInt(req.query.days, 10) || 5));
    const end = new Date(start);
    end.setDate(end.getDate() + span);

    const [resources, events, me] = await Promise.all([
      Resource.find().sort({ type: 1, name: 1 }).lean(),
      // A little wider than the window so clashes with bookings that start
      // before or end after it are still found.
      CalendarEvent.find({
        resource: { $ne: null },
        status: { $ne: 'declined' },
        startDateTime: { $lt: new Date(end.getTime() + DAY_MS) },
        endDateTime: { $gt: new Date(start.getTime() - DAY_MS) },
      })
        .populate('createdBy', 'firstName lastName')
        .lean(),
      User.findById(req.user.id).select('departmentId').lean(),
    ]);

    const userId = String(req.user.id);
    const canSee = (e) =>
      isAdminRole(req.user.role) ||
      e.visibility === 'public' ||
      (e.visibility === 'department' && me?.departmentId && String(e.departmentId) === String(me.departmentId)) ||
      String(e.createdBy?._id || e.createdBy) === userId ||
      (e.usersInvolved || []).some((u) => String(u.userId) === userId);

    const inWindow = (e) => new Date(e.startDateTime) < end && new Date(e.endDateTime) > start;
    const byResource = new Map();
    events.filter(inWindow).forEach((e) => {
      const clashes = clash.clashesOf(e, events);
      const visible = canSee(e);
      const list = byResource.get(String(e.resource)) || [];
      list.push({
        id: String(e._id),
        title: visible ? e.title : 'Private booking',
        private: !visible,
        eventType: e.eventType,
        startDateTime: e.startDateTime,
        endDateTime: e.endDateTime,
        status: e.status,
        state: clash.bookingState(e, clashes),
        by: visible && e.createdBy ? { id: String(e.createdBy._id), name: `${e.createdBy.firstName} ${e.createdBy.lastName}` } : null,
        mine: String(e.createdBy?._id || e.createdBy) === userId,
        clashesWith: clashes.map((c) => ({ id: String(c._id), title: canSee(c) ? c.title : 'Private booking', status: c.status })),
        // Approving is refused while a confirmed booking overlaps.
        approvable: e.status === 'pending' && !clash.blocking(clashes).length,
      });
      byResource.set(String(e.resource), list);
    });

    const days = [];
    for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) days.push({ date: dayKey(d), weekend: isWeekend(d) });

    res.json({
      start: dayKey(start),
      days,
      canReview: policies.canReviewEvents(req.user),
      resources: resources.map((r) => ({
        id: String(r._id),
        name: r.name,
        type: r.type,
        status: r.status,
        description: r.description,
        bookings: (byResource.get(String(r._id)) || []).sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime)),
      })),
    });
  } catch (error) {
    console.error('Error in getResourceWeek:', error);
    res.status(500).json({ message: 'Could not load resource bookings' });
  }
};
