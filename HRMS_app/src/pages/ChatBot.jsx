import { useCallback, useEffect, useRef, useState } from "react";
import { X, Send, Plus, Bot, Zap, Minimize, Trash2, BookOpen, User as UserIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api, { errorMessage } from "../lib/api";

const GREETING = {
  sender: "bot",
  text: "Hello! I'm the **ENOVA Assistant**. Ask me about company policies, how to use the HRMS, or your own leave, attendance and schedule.",
  sources: [],
};

const SOURCE_LABELS = {
  "enova-robotics-handbook.md": "Handbook",
  "hrms-user-guide.md": "HRMS guide",
};

// Suggestions covering the three kinds of questions the assistant answers.
const QUICK_PROMPTS = [
  "How many leave days do I have left?",
  "What is the status of my leave requests?",
  "Who approves my leave?",
  "How is leave counted?",
  "What time am I considered late?",
  "When can I take my lunch break?",
  "What did my attendance look like this week?",
  "What meetings do I have this week?",
  "How do I book a robot or meeting room?",
  "How do I reset my password?",
  "What does Enova Robotics do?",
  "How do I contact HR?",
];

const scrollbarStyle = { scrollbarWidth: "thin", scrollbarColor: "rgb(var(--line-2)) transparent" };

// Markdown elements styled for the dark chat bubbles.
const markdownComponents = {
  table: (props) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse" {...props} /></div>,
  th: (props) => <th className="border border-line-2 px-2 py-1 text-left bg-raise" {...props} />,
  td: (props) => <td className="border border-line-2 px-2 py-1 align-top" {...props} />,
  ul: (props) => <ul className="list-disc pl-5 my-1 space-y-0.5" {...props} />,
  ol: (props) => <ol className="list-decimal pl-5 my-1 space-y-0.5" {...props} />,
  p: (props) => <p className="my-1" {...props} />,
  a: (props) => <a className="text-teal underline" target="_blank" rel="noreferrer" {...props} />,
};

const formatTime = (timestamp) =>
  timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatbotRef = useRef(null);
  const toggleRef = useRef(null);
  // A question sent from elsewhere (command palette) waits until history is in.
  const [historyReady, setHistoryReady] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load previous conversation the first time the assistant is opened.
  useEffect(() => {
    if (!isOpen || historyLoaded) return;
    setHistoryLoaded(true);
    api.get("/api/chatbot/history")
      .then(({ data }) => {
        const history = (data.history || []).map((msg) => ({
          sender: msg.sender,
          text: msg.content,
          sources: msg.sources || [],
          timestamp: msg.timestamp,
        }));
        setConversation(history.length > 0 ? history : [{ ...GREETING, timestamp: new Date() }]);
      })
      .catch(() => setConversation([{ ...GREETING, timestamp: new Date() }]))
      .finally(() => setHistoryReady(true));
  }, [isOpen, historyLoaded]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (isOpen && !isMinimized) inputRef.current?.focus();
  }, [conversation, isTyping, isOpen, isMinimized]);

  // On mobile, tapping outside closes the panel.
  useEffect(() => {
    if (!isMobile || !isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (chatbotRef.current?.contains(event.target) || toggleRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile, isOpen]);

  const sendMessage = useCallback(async (text) => {
    const question = text.trim();
    if (!question || isTyping) return;

    setConversation((prev) => [...prev, { sender: "user", text: question, timestamp: new Date() }]);
    setMessage("");
    setIsTyping(true);

    try {
      const { data } = await api.post("/api/chatbot/message", { message: question });
      setConversation((prev) => [
        ...prev,
        { sender: "bot", text: data.message, sources: data.sources || [], timestamp: new Date() },
      ]);
    } catch (error) {
      setConversation((prev) => [
        ...prev,
        {
          sender: "bot",
          text: errorMessage(error, "Sorry, I couldn't reach the assistant. Please check your connection and try again."),
          sources: [],
          isError: true,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [isTyping]);

  // openAssistant(question) from lib/assistant.js opens the panel and asks.
  useEffect(() => {
    const onAsk = (event) => {
      setIsOpen(true);
      setIsMinimized(false);
      if (event.detail) setPendingQuestion(String(event.detail));
    };
    window.addEventListener("assistant:ask", onAsk);
    return () => window.removeEventListener("assistant:ask", onAsk);
  }, []);

  useEffect(() => {
    if (!historyReady || !pendingQuestion || isTyping) return;
    const question = pendingQuestion;
    setPendingQuestion(null);
    sendMessage(question);
  }, [historyReady, pendingQuestion, isTyping, sendMessage]);

  const clearHistory = async () => {
    try {
      await api.delete("/api/chatbot/history");
    } finally {
      setConversation([{ ...GREETING, timestamp: new Date() }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(message);
    }
  };

  const panelClass = isMobile
    ? isMinimized
      ? "fixed z-50 bottom-24 right-4 left-4 h-16 bg-sunk rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 border border-line"
      : "fixed z-50 bottom-0 left-0 right-0 h-[90vh] max-h-[640px] bg-sunk rounded-t-2xl shadow-2xl overflow-hidden transition-all duration-300 border-t border-line flex flex-col"
    : `fixed z-50 bottom-24 right-6 w-80 md:w-[26rem] bg-sunk rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 border border-line backdrop-blur-xl flex flex-col ${
        isMinimized ? "h-16" : "h-[640px] max-h-[calc(100vh-8rem)]"
      }`;

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        aria-label={isOpen ? "Close ENOVA Assistant" : "Open ENOVA Assistant"}
        onClick={() => {
          setIsOpen((open) => !open);
          setIsMinimized(false);
        }}
        className="fixed z-50 bottom-6 right-6 bg-teal text-on-accent p-4 rounded-full shadow-lg duration-300 flex items-center justify-center"
      >
        <Bot className="w-6 h-6" />
      </button>

      {isOpen && (
        <div ref={chatbotRef} className={panelClass} role="dialog" aria-label="ENOVA Assistant">
          <div className="bg-raise p-4 flex items-center justify-between border-b border-line flex-shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-teal/10 rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-teal" />
              </div>
              <h3 className="font-medium text-ink">ENOVA Assistant</h3>
            </div>
            <div className="flex space-x-1">
              <button type="button" onClick={clearHistory} aria-label="Clear conversation" title="Clear conversation" className="p-1.5 hover:bg-sunk rounded-full">
                <Trash2 className="w-4 h-4 text-ink-2" />
              </button>
              <button type="button" onClick={() => setIsMinimized((m) => !m)} aria-label={isMinimized ? "Expand" : "Minimize"} className="p-1.5 hover:bg-sunk rounded-full">
                {isMinimized ? <Plus className="w-4 h-4 text-ink-2" /> : <Minimize className="w-4 h-4 text-ink-2" />}
              </button>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="p-1.5 hover:bg-sunk rounded-full">
                <X className="w-4 h-4 text-ink-2" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="flex-1 p-4 overflow-y-auto bg-raise space-y-4" style={scrollbarStyle} aria-live="polite">
                {conversation.map((msg, index) => (
                  <div key={index} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[88%] p-3 rounded-lg ${
                        msg.sender === "user"
                          ? "bg-teal text-on-accent rounded-tr-none"
                          : msg.isError
                            ? "bg-red/10 border border-red/30 text-ink rounded-tl-none"
                            : "bg-sunk text-ink rounded-tl-none"
                      }`}
                    >
                      <div className="flex items-center mb-1 space-x-2">
                        {msg.sender === "user" ? <UserIcon className="w-3 h-3 text-ink" /> : <Bot className="w-3 h-3 text-ink" />}
                        <span className="text-xs opacity-70">{msg.sender === "user" ? "You" : "ENOVA Assistant"}</span>
                      </div>
                      <div className="text-sm break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                      {msg.sources?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-line-2 flex flex-wrap gap-1">
                          {msg.sources.map((source) => (
                            <span
                              key={`${source.file}-${source.heading}`}
                              title={`${SOURCE_LABELS[source.file] || source.file} › ${source.heading}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-raise text-[11px] text-teal border border-line"
                            >
                              <BookOpen className="w-3 h-3" />
                              {source.heading.split(" > ").pop()}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-right mt-1">
                        <span className="text-xs opacity-50">{formatTime(msg.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start" aria-label="Assistant is typing">
                    <div className="bg-sunk px-4 py-2 rounded-lg rounded-tl-none">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-ink-3 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-ink-3 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                        <div className="w-2 h-2 bg-ink-3 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              <div className="p-2 bg-sunk border-t border-line overflow-x-auto flex-shrink-0" style={scrollbarStyle}>
                <div className="flex space-x-2 pb-1">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      disabled={isTyping}
                      className="flex-shrink-0 px-3 py-1 bg-raise text-ink text-xs rounded-full hover:bg-sunk disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-sunk border-t border-line flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about policies, the HRMS, or your data…"
                    aria-label="Message the ENOVA Assistant"
                    rows={1}
                    className="flex-1 bg-panel text-ink rounded-lg p-3 resize-none h-10 max-h-24 focus:outline-none focus:ring-1 focus:ring-teal placeholder-ink-3 text-sm"
                    style={{ minHeight: "40px" }}
                  />
                  <button
                    type="button"
                    onClick={() => sendMessage(message)}
                    disabled={isTyping || !message.trim()}
                    aria-label="Send"
                    className={`p-2 rounded-full ${
                      isTyping || !message.trim() ? "bg-sunk text-ink-3 cursor-not-allowed" : "bg-teal text-on-accent hover:bg-teal-hi"
                    } transition-colors`}
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-ink-3 text-center">
                  AI answers are based on the company handbook. Confirm important decisions with HR.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default ChatBot;
