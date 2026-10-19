// Open the ENOVA Assistant dock (features/assistant/AssistantDock.jsx), optionally asking a question.
export const openAssistant = (question) => window.dispatchEvent(new CustomEvent("assistant:ask", { detail: question || null }));
