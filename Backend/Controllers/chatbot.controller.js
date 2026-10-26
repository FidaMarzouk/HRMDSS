// The conversation itself moved to the ENOVA Assistant (Controllers/assistantController.js
// and the Agent/ service). What stays here is maintenance of its knowledge base.
const knowledgeIndex = require('../services/rag/knowledgeIndex');

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
