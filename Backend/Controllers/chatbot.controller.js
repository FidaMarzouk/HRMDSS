const ChatMessage = require('../Models/chatbot.model');
const User = require('../Models/User');
const assistant = require('../services/rag/assistant');
const knowledgeIndex = require('../services/rag/knowledgeIndex');

const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_TURNS = 3; // previous question/answer pairs sent to the model

exports.sendMessage = async (req, res) => {
  try {
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    if (!message) {
      return res.status(400).json({ success: false, message: 'Please type a question.' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: `Questions are limited to ${MAX_MESSAGE_LENGTH} characters.` });
    }

    const userId = req.user.id;
    const [user, recent] = await Promise.all([
      User.findById(userId).select('firstName role').lean(),
      ChatMessage.find({ userId }).sort({ timestamp: -1 }).limit(HISTORY_TURNS).lean(),
    ]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const { answer, sources } = await assistant.answerQuestion({
      user: { id: userId, firstName: user.firstName, role: user.role },
      message,
      history: recent.reverse(),
    });

    await ChatMessage.create({ userId, message, response: answer, sources });

    return res.status(200).json({ success: true, message: answer, sources });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    return res.status(500).json({
      success: false,
      message: 'Sorry, I encountered an error processing your request. Please try again later.'
    });
  }
};

exports.getConversationHistory = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const records = await ChatMessage.find({ userId: req.user.id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const history = records.reverse().flatMap((msg) => [
      { sender: 'user', content: msg.message, timestamp: msg.timestamp },
      { sender: 'bot', content: msg.response, sources: msg.sources || [], timestamp: msg.timestamp },
    ]);

    return res.status(200).json({ success: true, history });
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    return res.status(500).json({ success: false, message: 'Error retrieving conversation history' });
  }
};

exports.clearConversationHistory = async (req, res) => {
  try {
    const result = await ChatMessage.deleteMany({ userId: req.user.id });
    return res.status(200).json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error('Error in clearConversationHistory:', error);
    return res.status(500).json({ success: false, message: 'Error clearing conversation history' });
  }
};

// Rebuild the knowledge index after the Markdown files in Backend/knowledge change.
exports.reindex = async (req, res) => {
  try {
    const stats = await knowledgeIndex.build();
    return res.status(200).json({ success: true, stats });
  } catch (error) {
    console.error('Error rebuilding knowledge index:', error);
    return res.status(500).json({ success: false, message: 'Error rebuilding the knowledge index' });
  }
};
