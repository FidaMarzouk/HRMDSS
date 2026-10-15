const ChatMessage = require('../Models/TeamChat');
const User = require('../Models/User');
const mongoose = require('mongoose');
const { getIO } = require('../Middlewares/notificationService');

// Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user.id;
    
    if (!receiverId || !message || !String(message).trim()) {
      return res.status(400).json({ message: 'Receiver ID and message are required' });
    }
    if (!mongoose.isValidObjectId(receiverId) || !(await User.exists({ _id: receiverId }))) {
      return res.status(404).json({ message: 'Recipient not found' });
    }
    if (String(message).length > 5000) {
      return res.status(400).json({ message: 'Message is too long' });
    }
    
    // Create and save the message
    const newMessage = new ChatMessage({
      sender: senderId,
      receiver: receiverId,
      message,
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
      const userDetails = await User.findById(partnerId).select('firstName lastName email profilePicture role');
      if (!userDetails || !lastMessageData) return null;

      return {
        _id: partnerId,
        userId: userDetails._id,
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        email: userDetails.email,
        profilePicture: userDetails.profilePicture,
        role: userDetails.role,
        lastMessage: lastMessageData.message,
        lastMessageDate: lastMessageData.createdAt,
        unreadCount: unreadCount
      };
    });
    
    const conversations = (await Promise.all(conversationsPromises)).filter(Boolean);
    
    // Sort by most recent message
    conversations.sort((a, b) => b.lastMessageDate - a.lastMessageDate);
    
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Server error' });
  }
};