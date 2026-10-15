const mongoose = require('mongoose');
const CalendarEvent = require('../Models/CalendarEvent');
const User = require('../Models/User'); 
const Department = require('../Models/Department'); 
const Resource = require('../Models/Resource'); 
const { sendNotificationToUser, sendNotificationToRole } = require('../Middlewares/notificationService');

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
      if (!body.location || body.location.trim() === '') {
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
    meeting: () => ({ location: body.location }),
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
      const departmentUsers = await User.find({ 
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

const checkResourceConflicts = async (resourceId, startDateTime, endDateTime, excludeEventId = null) => {
  // First, check if the resource exists
  const resource = mongoose.isValidObjectId(resourceId) ? await Resource.findById(resourceId) : null;
  if (!resource) {
    return {
      available: false,
      resourceStatus: "not_found",
      message: "Resource not found",
      conflictingEvents: []
    };
  }

  // Check if resource is under maintenance
  if (resource.status === "maintenance") {
    return {
      available: false,
      resourceStatus: "maintenance",
      message: "Resource is under maintenance",
      conflictingEvents: []
    };
  }

  // Query for conflicting events
  let query = {
    eventType: "resourceReservation",
    resource: resourceId,
    status: { $ne: "declined" }, // Ignore declined reservations
    $or: [
      { startDateTime: { $lt: new Date(endDateTime), $gte: new Date(startDateTime) } }, // Event starts within the requested period
      { endDateTime: { $gt: new Date(startDateTime), $lte: new Date(endDateTime) } }, // Event ends within the requested period
      { 
        $and: [
          { startDateTime: { $lte: new Date(startDateTime) } }, 
          { endDateTime: { $gte: new Date(endDateTime) } } // Existing event fully overlaps the requested period
        ] 
      }
    ]
  };

  // Exclude the currently edited event (if provided)
  if (excludeEventId) {
    query._id = { $ne: excludeEventId };
  }

  // Find conflicting events
  const conflictingEvents = await CalendarEvent.find(query)
    .populate("createdBy", "firstName lastName");

  return {
    available: conflictingEvents.length === 0,
    resourceStatus: conflictingEvents.length > 0 ? "unavailable" : "available",
    message: conflictingEvents.length > 0 ? "Resource already reserved for this time period" : "Resource is available",
    conflictingEvents: conflictingEvents
  };
};

exports.getEvents = async (req, res) => {
  try {
    const { startDate, endDate, eventType, visibility, status } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    const user = await User.findById(userId);
    const userDepartmentId = user.departmentId;
    
    let query = {};
    
    // Apply date range filtering
    if (startDate && endDate) {
      query.startDateTime = { $lte: new Date(endDate) };
      query.endDateTime = { $gte: new Date(startDate) };
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
      .sort({ startDateTime: 1 });
      
    res.status(200).json(events);
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
    
    // Check resource availability for resource reservations
    if (eventType === 'resourceReservation') {
      const availabilityCheck = await checkResourceConflicts(
        req.body.resource, 
        req.body.startDateTime, 
        req.body.endDateTime
      );
      
      if (!availabilityCheck.available) {
        return res.status(400).json({ 
          message: availabilityCheck.message,
          status: 'resource_conflict',
          conflictingEvents: availabilityCheck.conflictingEvents
        });
      }
    }
    
    // Build event data structure
    let eventData = buildEventData(eventType, req.body, userId, user);
    
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
    
    res.status(201).json(event);
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
      meeting: ['location'],
      mission: ['destination']
    };
    
    const fieldsToAdd = typeSpecificFieldMap[event.eventType] || [];
    fieldsToAdd.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // Add users involved if present
    if (Array.isArray(req.body.usersInvolved)) {
      // Keep existing responses for people who were already invited.
      const previous = new Map(event.usersInvolved.map((u) => [u.userId.toString(), u.status]));
      updateData.usersInvolved = req.body.usersInvolved.map((u) => {
        const id = (typeof u === 'object' ? (u.userId?._id || u.userId) : u).toString();
        return { userId: id, status: previous.get(id) || 'pending' };
      });
    }
    
    // Resource availability check
    if ((req.body.startDateTime || req.body.endDateTime || req.body.resource) && 
        event.eventType === 'resourceReservation') {
      const resourceId = req.body.resource || event.resource;
      const startDateTime = req.body.startDateTime || event.startDateTime;
      const endDateTime = req.body.endDateTime || event.endDateTime;
      
      const availabilityCheck = await checkResourceConflicts(
        resourceId, 
        startDateTime, 
        endDateTime, 
        eventId
      );
      
      if (!availabilityCheck.available) {
        return res.status(400).json({ 
          status: 'resource_conflict',
          conflictingEvents: availabilityCheck.conflictingEvents
        });
      }
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
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: 'No valid update fields provided',
        status: 'invalid_update'
      });
    }
    
    const updatedEvent = await CalendarEvent.findByIdAndUpdate(
      eventId,
      updateData,
      { new: true, runValidators: true }
    );
    
    // Handle notifications for newly added users
    await notifyNewlyAddedUsers(event, req.body.usersInvolved, creator);

    res.status(200).json(updatedEvent);
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

    // Prepare admin action data
    const adminActionData = {};
    
    if (status === 'approved') {
      adminActionData.approvedBy = adminId;
      adminActionData.approvedAt = new Date();
    } else {
      adminActionData.declinedBy = adminId;
      adminActionData.declinedAt = new Date();
    }
    
    const updatedEvent = await CalendarEvent.findByIdAndUpdate(
      eventId,
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

    // Call helper function, passing eventId to exclude it from conflicts
    const availabilityResult = await checkResourceConflicts(resourceId, startDateTime, endDateTime, eventId);

    res.status(200).json(availabilityResult);
  } catch (error) {
    console.error("Error checking resource availability:", error);
    res.status(400).json({ message: error.message });
  }
};

exports.getUsersInvolved = async (req, res) => {
  try {
    const users = await User.find()
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