import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Bot, Loader2, Plus, Send, ThumbsDown, ThumbsUp, Wrench, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/field";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";
import { DraftCard } from "./DraftCard";
import { suggestionsFor } from "./suggestions";
import { decideDraft, fetchStatus, fetchThread, newConversation, sendFeedback, sendMessage } from "./assistantApi";

// What a tool call did, in a few words, for the activity line under a reply.
const TOOL_LABEL = {
  search_handbook: "read the handbook",
  get_my_leave_balance: "checked your balance",
  check_leave_dates: "checked the dates",
  find_people: "looked people up",
  find_free_resources: "looked for free resources",
  list_resources: "listed resources",
  get_my_events: "read your calendar",
  get_my_day: "checked your day",
  get_team_leave: "checked team leave",
  get_who_is_in: "checked who is in",
  get_analytics_signals: "read Analytics",
};
const activity = (tools = []) => [...new Set(tools.filter((t) => !t.startsWith("prepare_")).map((t) => TOOL_LABEL[t] || t.replace(/_/g, " ")))].join(" · ");

function Reply({ item, drafts, onDecide, feedback, onFeedback }) {
  return (
    <li className="grid gap-2">
      {item.text && (
        <div className="assistant-md rounded-xl rounded-tl-sm border border-line bg-raise px-3 py-2 text-[13px] text-ink">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
        </div>
      )}
      {item.sources?.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-3">
          <BookOpen className="h-3 w-3" aria-hidden />
          {item.sources.map((s) => (
            <span key={`${s.file}${s.heading}`} className="rounded border border-line px-1.5">{s.heading}</span>
          ))}
        </p>
      )}
      {(item.draftIds || []).map((id) => drafts[id] && <DraftCard key={id} draft={drafts[id]} onDecide={onDecide} />)}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 truncate text-[11px] text-ink-3">{item.tools?.length ? <><Wrench className="h-3 w-3 flex-none" aria-hidden /> {activity(item.tools)}</> : null}</span>
        {item.runId && (
          <span className="flex flex-none gap-0.5">
            <button type="button" aria-label="Helpful" aria-pressed={feedback === "up"} onClick={() => onFeedback(item.runId, feedback === "up" ? null : "up")} className={cn("grid h-7 w-7 place-items-center rounded-md hover:bg-sunk", feedback === "up" ? "text-teal" : "text-ink-3")}>
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="Not helpful" aria-pressed={feedback === "down"} onClick={() => onFeedback(item.runId, feedback === "down" ? null : "down")} className={cn("grid h-7 w-7 place-items-center rounded-md hover:bg-sunk", feedback === "down" ? "text-red" : "text-ink-3")}>
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * The ENOVA Assistant, docked on the right. It answers, looks things up and
 * prepares actions (leave requests, bookings, punches...) that the person
 * confirms here; it knows which page they are on.
 */
export function AssistantDock({ open, onClose, page, selection }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const loading = useRef(null);
  const context = { page, selection };

  const load = useCallback(async () => {
    try {
      const [thread, health] = await Promise.all([fetchThread(), fetchStatus()]);
      setItems(thread.messages || []);
      setDrafts(thread.drafts || {});
      setStatus(health);
    } catch {
      setStatus({ online: false });
    }
    setLoaded(true);
  }, []);

  // Load the conversation once; a question asked meanwhile waits for it.
  const ensureLoaded = useCallback(() => {
    if (!loading.current) loading.current = load();
    return loading.current;
  }, [load]);

  useEffect(() => {
    if (open && !loaded) ensureLoaded();
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, loaded, ensureLoaded]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [items, busy]);

  useEffect(() => {
    if (!busy) return undefined;
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 500);
    return () => {
      clearInterval(timer);
      setElapsed(0);
    };
  }, [busy]);

  const append = (out) => {
    if (out.drafts?.length) setDrafts((d) => ({ ...d, ...Object.fromEntries(out.drafts.map((x) => [x.id, x])) }));
    const replies = out.replies || [];
    setItems((list) => [
      ...list,
      ...replies.map((r, i) => ({
        ...r,
        role: "assistant",
        runId: i === replies.length - 1 ? out.runId : null,
        tools: i === replies.length - 1 ? out.tools : [],
        draftIds: i === replies.length - 1 ? (out.drafts || []).map((d) => d.id) : [],
      })),
    ]);
  };

  const ask = useCallback(
    async (question) => {
      const q = question.trim();
      if (!q || busy) return;
      setText("");
      setItems((list) => [...list, { id: `u_${Date.now()}`, role: "user", text: q }]);
      setBusy(true);
      const out = await sendMessage(q, context);
      setBusy(false);
      if (!out.ok) {
        setItems((list) => [...list, { id: `e_${Date.now()}`, role: "error", text: out.error }]);
        return;
      }
      append(out);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, page, selection]
  );

  // Ctrl K "Ask the ENOVA Assistant" and other entry points.
  useEffect(() => {
    const onAsk = async (e) => {
      if (!e.detail) return;
      await ensureLoaded();
      ask(e.detail);
    };
    window.addEventListener("assistant:ask", onAsk);
    return () => window.removeEventListener("assistant:ask", onAsk);
  }, [ask, ensureLoaded]);

  const onDecide = async (draft, decision) => {
    const out = await decideDraft(draft.id, decision, context);
    if (!out.ok) {
      setItems((list) => [...list, { id: `e_${Date.now()}`, role: "error", text: out.error }]);
      // The draft may have changed (expired, already decided): reload its state.
      load();
      return;
    }
    setDrafts((d) => ({ ...d, [out.draft.id]: out.draft }));
    append(out);
  };

  const restart = async () => {
    await newConversation().catch(() => {});
    setItems([]);
    setDrafts({});
  };

  const rate = (runId, value) => {
    setFeedback((f) => ({ ...f, [runId]: value }));
    sendFeedback(runId, value);
  };

  if (!open) return null;
  const suggestions = suggestionsFor(page, user?.role);

  return (
    <aside aria-label="ENOVA Assistant" className="fixed inset-0 z-40 flex flex-col border-l border-line bg-panel lg:inset-auto lg:bottom-0 lg:right-0 lg:top-16 lg:w-[420px]">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-teal/10 text-teal" aria-hidden="true">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">ENOVA Assistant</p>
          <p className="flex items-center gap-1.5 text-[11.5px] text-ink-3">
            <span className={cn("h-2 w-2 rounded-full", status?.online ? "bg-teal" : "bg-amber")} aria-hidden="true" />
            {status ? (status.online ? "Can look things up and prepare actions" : "Handbook answers only right now") : "Connecting…"}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={restart} title="New conversation" aria-label="New conversation">
          <Plus aria-hidden />
        </Button>
        <button type="button" onClick={onClose} aria-label="Close the assistant" className="grid h-9 w-9 place-items-center rounded-md text-ink-2 hover:bg-sunk">
          <X className="h-4 w-4" />
        </button>
      </header>

      <ol ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3" aria-live="polite">
        {items.length === 0 && !busy && (
          <li className="grid gap-3 py-4">
            <p className="text-[13px] text-ink-2">
              Ask about policies, or ask me to do something: I prepare it, you confirm. I can check and request leave, book rooms and equipment, set up meetings,
              punch you in or out, ask for time corrections and write to colleagues{user?.role !== "employee" ? ", and help you review what waits on you" : ""}.
            </p>
            <ul className="grid gap-1.5">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => ask(s)} className="w-full rounded-lg border border-line px-3 py-2 text-left text-[12.5px] text-ink hover:border-teal hover:bg-sunk">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </li>
        )}
        {items.map((item) =>
          item.role === "user" ? (
            <li key={item.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-xl rounded-tr-sm border border-teal/30 bg-teal/10 px-3 py-2 text-[13px] text-ink">
              {item.text}
            </li>
          ) : item.role === "error" ? (
            <li key={item.id} role="alert" className="rounded-lg border border-red/40 bg-red/5 px-3 py-2 text-[12.5px] text-red">
              {item.text}
            </li>
          ) : (
            <Reply key={item.id} item={item} drafts={drafts} onDecide={onDecide} feedback={feedback[item.runId]} onFeedback={rate} />
          )
        )}
        {busy && (
          <li className="flex items-center gap-2 text-[12.5px] text-ink-3" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Working on it{elapsed > 2 ? ` · ${elapsed} s` : "…"}
          </li>
        )}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
        className="flex items-end gap-2 border-t border-line p-2"
      >
        <Textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(text);
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Ask or ask me to do something"
          aria-label="Message the assistant"
          className="min-h-[40px] resize-none py-2"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={busy || !text.trim()}>
          <Send aria-hidden />
        </Button>
      </form>
      <p className="px-3 pb-2 text-[10.5px] text-ink-3">I only prepare actions; nothing happens until you confirm. I can be wrong: check the card before confirming.</p>
    </aside>
  );
}
