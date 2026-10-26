// Open the ENOVA Assistant panel (pages/ChatBot.jsx), optionally asking a question.
export const openAssistant = (question) => window.dispatchEvent(new CustomEvent("assistant:ask", { detail: question || null }));
