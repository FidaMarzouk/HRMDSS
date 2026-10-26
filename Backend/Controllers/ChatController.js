const ChatMessage = require('../Models/TeamChat');
const User = require('../Models/User');
const mongoose = require('mongoose');
const { getIO } = require('../Middlewares/notificationService');
const LeaveRequest = require('../Models/LeaveRequest');
const CalendarEvent = require('../Models/CalendarEvent');
const AttendanceCorrection = require('../Models/AttendanceCorrection');
const inbox = require('../services/inbox');
const policies = require('../services/policies');
const { loadPresence, coarse } = require('../services/presence');
const { FINAL_APPROVED, IN_PROGRESS } = require('../constants/leave');
const { startOfDay } = require('../utils/time');

const ATTACHABLE = ['leave', 'event', 'correction'];
const ATTACHMENT_LABEL = { leave: 'leave request', event: 'calendar event', correction: 'time correction' };

// Presence for chat partners: full detail inside the viewer's presence scope
// (HR and the CEO: everyone; others: their department), coarse outside it.
const presenceFor = async (viewer, people) => {
  if (!people.length) return new Map();
  const me = await User.findById(viewer.id).select('departmentId').lean();
  const full = viewer.role === 'admin' || viewer.role === 'superAdmin';
  const states = await loadPresence(people.map((p) => p._id));
  return new Map(
    people.map((p) => {
      const id = String(p._id);
      const state = states.get(id);
      const inScope = full || (me?.departmentId && String(p.departmentId?._id || p.departmentId) === String(me.departmentId));
      return [id, inScope ? { status: state.status, since: state.since } : coarse(state)];
    })
  );
};
exports.presenceFor = presenceFor;

// Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, message = '', attachment } = req.body;
    const senderId = req.user.id;

    if (!receiverId || (!String(message).trim() && !attachment)) {
      return res.status(400).json({ message: 'Receiver ID and a message or a request card are required' });
    }
    // A card can only point to something the sender is allowed to see.
    let card = null;
    if (attachment) {
      if (!ATTACHABLE.includes(attachment.kind) || !mongoose.isValidObjectId(attachment.id)) {
        return res.status(400).json({ message: 'Unknown request to attach' });
      }
      const me = await User.findById(senderId).select('departmentId').lean();
      const item = (await inbox.loadItems([attachment])).get(`${attachment.kind}:${attachment.id}`);
      if (!item || !inbox.canSee(attachment.kind, item, req.user, me?.departmentId)) {
        return res.status(404).json({ message: 'Request not found' });
      }
      card = { kind: attachment.kind, id: attachment.id };
    }
    if (!mongoose.isValidObjectId(receiverId) || !(await User.exists({ ...User.ACTIVE, _id: receiverId }))) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    if (String(message).length > 5000) {
      return res.status(400).json({ message: 'Message is too long' });
    }
    
    // Create and save the message
    const newMessage = new ChatMessage({
      sender: senderId,
      receiver: receiverId,
      message: String(message).trim(),
      ...(card ? { attachment: card } : {}),
      isRead: false
    });
    
    await newMessage.save();
    
    // Populate sender and receiver info
    const populatedMessage = await ChatMessage.findById(newMessage._id)
      .populate('sender', 'firstName lastName profilePicture role')
      .populate('receiver', 'firstName lastName profilePicture role');
    
    // Emit the message to both sender and receiver via socket
    const io = getIO();
    if (io) {
      io.to(String(receiverId)).emit('newMessage', populatedMessage);
      io.to(String(senderId)).emit('newMessage', populatedMessage);
    }
    
    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { senderId } = req.body;
    const receiverId = req.user.id;
    
    if (!senderId) {
      return res.status(400).json({ message: 'Sender ID is required' });
    }
    
    // Update all unread messages from the sender to the current user
    const result = await ChatMessage.updateMany(
      { sender: senderId, receiver: receiverId, isRead: false },
      { isRead: true }
    );
    
    // Notify the sender that their messages have been read
    const io = getIO();
    if (io) {
      io.to(senderId).emit('messagesRead', { userId: receiverId });
    }
    
    res.status(200).json({ updated: result.modifiedCount });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.userId;
    
    if (!otherUserId) {
      return res.status(400).json({ message: 'User ID parameter is required' });
    }
    
    const messages = await ChatMessage.find({
      $or: [
        { sender: currentUserId, receiver: otherUserId, deletedForSender: false },
        { sender: otherUserId, receiver: currentUserId, deletedForReceiver: false }
      ]
    }).sort({ createdAt: 1 })
    .populate('sender', 'firstName lastName profilePicture role')
    .populate('receiver', 'firstName lastName profilePicture role');
    
    // Mark messages as read in one operation
    const updateResult = await ChatMessage.updateMany(
      { sender: otherUserId, receiver: currentUserId, isRead: false },
      { isRead: true }
    );
    
    // Only emit if messages were actually marked as read
    if (updateResult.modifiedCount > 0) {
      const io = getIO();
      if (io) {
        io.to(otherUserId).emit('messagesRead', { userId: currentUserId });
      }
    }
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a single message
exports.deleteMessage = async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const userId = req.user.id;
    
    if (!messageId) {
      return res.status(400).json({ message: 'Message ID is required' });
    }
    
    // Find the message and ensure the user is authorized to delete it
    const message = await ChatMessage.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Check if the user is either the sender or receiver
    if (message.sender.toString() !== userId && message.receiver.toString() !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }
    
    // Mark the message as deleted for the specific user instead of deleting it
    const updateData = {};
    if (message.sender.toString() === userId) {
      updateData.deletedForSender = true;
    } else {
      updateData.deletedForReceiver = true;
    }
    
    await ChatMessage.findByIdAndUpdate(messageId, updateData);
    
    // Notify the user about the deleted message (only the user who deleted it)
    const io = getIO();
    if (io) {
      io.to(userId).emit('messageDeleted', { messageId });
    }
    
    res.status(200).json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete entire conversation
exports.deleteConversation = async (req, res) => {
  try {
    const otherUserId = req.params.userId;
    const userId = req.user.id;
    
    if (!otherUserId) {
      return res.status(400).json({ message: 'User ID parameter is required' });
    }
    
    // Hide the conversation for the current user only; the other participant keeps their copy.
    const [sent, received] = await Promise.all([
      ChatMessage.updateMany({ sender: userId, receiver: otherUserId }, { deletedForSender: true }),
      ChatMessage.updateMany({ sender: otherUserId, receiver: userId }, { deletedForReceiver: true })
    ]);

    const io = getIO();
    if (io) {
      io.to(userId).emit('conversationDeleted', { userId: otherUserId });
    }

    res.status(200).json({
      message: 'Conversation deleted successfully',
      deletedCount: sent.modifiedCount + received.modifiedCount
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    // Convert userId to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // First, find all unique conversation partners
    const conversationPartners = await ChatMessage.aggregate([
      {
        $match: {
          $or: [
            { sender: userObjectId, deletedForSender: false },
            { receiver: userObjectId, deletedForReceiver: false }
          ]
        }
      },
      {
        $project: {
          conversationPartner: {
            $cond: [
              { $eq: ["$sender", userObjectId] },
              "$receiver",
              "$sender"
            ]
          }
        }
      },
      {
        $group: {
          _id: "$conversationPartner"
        }
      }
    ]);

    // For each conversation partner, get conversation details
    const conversationsPromises = conversationPartners.map(async (partner) => {
      const partnerId = partner._id;
      
      // Get the most recent message for this conversation
      const lastMessageData = await ChatMessage.findOne({
        $or: [
          { sender: userObjectId, receiver: partnerId, deletedForSender: false },
          { sender: partnerId, receiver: userObjectId, deletedForReceiver: false }
        ]
      }).sort({ createdAt: -1 });
      
      // Count unread messages for this conversation
      const unreadCount = await ChatMessage.countDocuments({
        sender: partnerId,
        receiver: userObjectId,
        isRead: false,
        deletedForReceiver: false
      });
      
      // Get user details (the partner may have been deleted)
      const userDetails = await User.findById(partnerId).select('firstName lastName email profilePicture role position departmentId status').populate('departmentId', 'name');
      if (!userDetails || !lastMessageData) return null;

      return {
        _id: partnerId,
        userId: userDetails._id,
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        email: userDetails.email,
        profilePicture: userDetails.profilePicture,
        role: userDetails.role,
        position: userDetails.position,
        department: userDetails.departmentId?.name || null,
        departmentId: userDetails.departmentId?._id || null,
        archived: userDetails.status === 'archived',
        lastMessage: lastMessageData.message || (lastMessageData.attachment?.kind ? `Shared a ${ATTACHMENT_LABEL[lastMessageData.attachment.kind]}` : ''),
        lastMessageDate: lastMessageData.createdAt,
        unreadCount: unreadCount
      };
    });
    
    const conversations = (await Promise.all(conversationsPromises)).filter(Boolean);
    
    // Sort by most recent message
    conversations.sort((a, b) => b.lastMessageDate - a.lastMessageDate);
    const presence = await presenceFor(req.user, conversations.map((c) => ({ _id: c.userId, departmentId: c.departmentId })));
    conversations.forEach((c) => {
      c.presence = presence.get(String(c.userId)) || null;
      delete c.departmentId;
    });
    
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/chat/attachable?with=<userId>: requests the sender can share as a card
// in this conversation: their own open requests, and the other person's
// requests that wait on the sender's decision.
exports.getAttachable = async (req, res) => {
  try {
    const me = String(req.user.id);
    const other = mongoose.isValidObjectId(req.query.with) ? req.query.with : null;
    const today = startOfDay(new Date());
    const [myLeave, myEvents, myCorrections, theirLeave, theirCorrections, theirEvents] = await Promise.all([
      LeaveRequest.find({ employeeId: me, $or: [{ status: { $in: IN_PROGRESS } }, { status: { $in: FINAL_APPROVED }, endDate: { $gte: today } }] }).sort({ startDate: 1 }).limit(10).select('_id').lean(),
      CalendarEvent.find({ createdBy: me, status: { $ne: 'declined' }, endDateTime: { $gte: today } }).sort({ startDateTime: 1 }).limit(10).select('_id').lean(),
      AttendanceCorrection.find({ userId: me, status: 'pending' }).limit(10).select('_id').lean(),
      other ? LeaveRequest.find({ employeeId: other, status: { $in: IN_PROGRESS } }).limit(10).lean() : [],
      other ? AttendanceCorrection.find({ userId: other, status: 'pending' }).limit(10).lean() : [],
      other && policies.canReviewEvents(req.user) ? CalendarEvent.find({ createdBy: other, status: 'pending', endDateTime: { $gte: today } }).limit(10).select('_id').lean() : [],
    ]);
    const refs = [
      ...theirLeave.filter((r) => policies.canReviewLeave(req.user, r)).map((r) => ({ kind: 'leave', id: r._id, theirs: true })),
      ...theirCorrections.filter((c) => policies.canReviewCorrection(req.user, c)).map((c) => ({ kind: 'correction', id: c._id, theirs: true })),
      ...theirEvents.map((e) => ({ kind: 'event', id: e._id, theirs: true })),
      ...myLeave.map((r) => ({ kind: 'leave', id: r._id })),
      ...myEvents.map((e) => ({ kind: 'event', id: e._id })),
      ...myCorrections.map((c) => ({ kind: 'correction', id: c._id })),
    ];
    const viewer = { id: me, role: req.user.role };
    const meDoc = await User.findById(me).select('departmentId').lean();
    const items = await inbox.loadItems(refs);
    res.json({
      items: refs
        .map((r) => ({ ...inbox.cardFor(r.kind, items.get(`${r.kind}:${String(r.id)}`), viewer, meDoc?.departmentId), theirs: Boolean(r.theirs) }))
        .filter((c) => !c.missing && !c.hidden),
    });
  } catch (error) {
    console.error('Error listing attachable requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
