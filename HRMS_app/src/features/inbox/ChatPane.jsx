import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Paperclip, Search, Send, Trash2, X } from "lucide-react";
import { Avatar } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Input, Textarea } from "../../components/ui/field";
import { Menu } from "../../components/ui/menu";
import { useAuth } from "../../context/AuthContext";
import { useSocketEvent } from "../../context/SocketContext";
import { COMPANY_TZ } from "../../lib/dates";
import { confirmAction } from "../../lib/alerts";
import { queryClient } from "../../lib/queries";
import { cn } from "../../lib/utils";
import { RequestCard } from "./RequestCard";
import {
  deleteConversation,
  deleteMessage,
  inboxKeys,
  sendMessage,
  useAttachable,
  useCards,
  useChatPeople,
  useConversations,
  useThread,
} from "./inboxApi";

const clock = (d) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: COMPANY_TZ });
const dayLabel = (d) => new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: COMPANY_TZ });
const dayKeyOf = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: COMPANY_TZ });

// Presence: Avatar dot and a few words. Detailed inside your presence scope,
// coarse ("in", "away", "out") outside it.
const DOT = { in: "in", late: "late", left: "out", leave: "leave", mission: "leave", away: "leave", absent: "out", out: "out" };
const presenceText = (p) => {
  if (!p) return "";
  switch (p.status) {
    case "in":
    case "late":
      return p.since ? `in since ${clock(p.since)}` : "in";
    case "left":
      return "left for the day";
    case "leave":
      return "on leave";
    case "mission":
      return "on a mission";
    case "away":
      return "away";
    default:
      return "not in";
  }
};

function PersonLine({ person, presence }) {
  const role = [person.position, presenceText(presence)].filter(Boolean).join(" · ");
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar user={person} size="sm" presence={DOT[presence?.status]} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] text-ink">{person.firstName} {person.lastName}</span>
        <span className="block truncate text-[11.5px] text-ink-3">{role}</span>
      </span>
    </span>
  );
}

function ConversationList({ activeId, onOpen }) {
  const [q, setQ] = useState("");
  const conversations = useConversations();
  const people = useChatPeople(q.trim().length > 0);
  const term = q.trim().toLowerCase();
  const list = (conversations.data || []).filter((c) => !term || `${c.firstName} ${c.lastName} ${c.position || ""}`.toLowerCase().includes(term));
  const known = new Set((conversations.data || []).map((c) => String(c.userId)));
  const others = term
    ? (people.data || []).filter((p) => !known.has(String(p._id)) && `${p.firstName} ${p.lastName} ${p.position || ""} ${p.departmentId?.name || ""}`.toLowerCase().includes(term)).slice(0, 8)
    : [];

  return (
    <div className="grid min-h-0 content-start gap-2">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search or start a conversation" aria-label="Search conversations and people" className="h-9 pl-8 text-[13px]" />
      </label>
      <ul className="grid gap-0.5" aria-label="Conversations">
        {list.map((c) => (
          <li key={c.userId}>
            <button
              type="button"
              onClick={() => onOpen(String(c.userId))}
              aria-current={String(c.userId) === activeId ? "true" : undefined}
              className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-sunk", String(c.userId) === activeId && "bg-sunk")}
            >
              <span className="min-w-0">
                <PersonLine person={c} presence={c.presence} />
                <span className={cn("mt-0.5 block truncate pl-[38px] text-[12px]", c.unreadCount ? "font-medium text-ink" : "text-ink-3")}>{c.lastMessage}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="figure text-[10.5px] text-ink-3">{dayKeyOf(c.lastMessageDate) === dayKeyOf(new Date()) ? clock(c.lastMessageDate) : new Date(c.lastMessageDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                {c.unreadCount > 0 && <span className="figure min-w-[18px] rounded-full bg-teal px-1 text-center text-[10.5px] font-semibold text-on-accent">{c.unreadCount}</span>}
              </span>
            </button>
          </li>
        ))}
        {!conversations.isLoading && list.length === 0 && !term && <li className="px-2 py-6 text-center text-[12.5px] text-ink-3">No conversations yet. Search for a colleague to start one.</li>}
      </ul>
      {others.length > 0 && (
        <div>
          <p className="label-key px-2 pb-1">People</p>
          <ul className="grid gap-0.5">
            {others.map((p) => (
              <li key={p._id}>
                <button type="button" onClick={() => onOpen(String(p._id))} className="w-full rounded-lg px-2 py-2 text-left hover:bg-sunk">
                  <PersonLine person={p} presence={p.presence} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AttachPicker({ partnerId, onPick, onClose }) {
  const { data, isLoading } = useAttachable(partnerId, true);
  const items = data?.items || [];
  const groups = [
    { label: "Waiting on you", list: items.filter((i) => i.theirs) },
    { label: "Your requests", list: items.filter((i) => !i.theirs) },
  ].filter((g) => g.list.length);
  return (
    <div role="dialog" aria-label="Share a request" className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-80 overflow-y-auto rounded-[10px] border border-line-2 bg-raise p-2 shadow-pop">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-[12.5px] font-medium text-ink">Share a request as a card</p>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-sunk"><X className="h-3.5 w-3.5" /></button>
      </div>
      {isLoading && <div className="h-20 animate-pulse rounded-md bg-sunk" />}
      {!isLoading && !groups.length && <p className="px-1 py-3 text-[12.5px] text-ink-3">No open requests to share: your leave, events and corrections in progress appear here, and theirs when they wait on you.</p>}
      {groups.map((g) => (
        <div key={g.label} className="grid gap-1 pb-1">
          <p className="label-key px-1">{g.label}</p>
          {g.list.map((c) => (
            <button key={`${c.kind}:${c.id}`} type="button" onClick={() => onPick(c)} className="rounded-md px-2 py-1.5 text-left hover:bg-sunk">
              <span className="block text-[12.5px] text-ink">{c.label} · {c.title}</span>
              <span className="figure block text-[11px] text-ink-3">{c.detail} · {c.status}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function Thread({ partnerId, onBack }) {
  const { user } = useAuth();
  const me = String(user?.id);
  const { data: messages, isLoading } = useThread(partnerId);
  const conversations = useConversations();
  const people = useChatPeople(true);
  const partner =
    (conversations.data || []).find((c) => String(c.userId) === partnerId) ||
    (people.data || []).find((p) => String(p._id) === partnerId);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [picking, setPicking] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const refs = useMemo(() => [...new Set((messages || []).filter((m) => m.attachment?.kind).map((m) => `${m.attachment.kind}:${m.attachment.id}`))], [messages]);
  const cards = useCards(refs);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  useEffect(() => {
    setText("");
    setAttachment(null);
    setPicking(false);
  }, [partnerId]);

  const send = async (e) => {
    e?.preventDefault();
    if (sending || (!text.trim() && !attachment)) return;
    setSending(true);
    const ok = await sendMessage(partnerId, text.trim(), attachment);
    setSending(false);
    if (ok) {
      setText("");
      setAttachment(null);
    }
  };

  const removeConversation = async () => {
    if (await confirmAction("Delete this conversation?", "It is removed from your inbox only; the other person keeps their copy.", "Delete conversation")) {
      if (await deleteConversation(partnerId)) onBack();
    }
  };

  const lastMineRead = [...(messages || [])].reverse().find((m) => String(m.sender?._id) === me);
  let lastDay = null;

  return (
    <section aria-label={partner ? `Conversation with ${partner.firstName} ${partner.lastName}` : "Conversation"} className="flex min-h-[420px] flex-col rounded-xl border border-line">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-sunk lg:hidden"><ArrowLeft className="h-4 w-4" /></button>
        {partner ? <PersonLine person={partner} presence={partner.presence} /> : <span className="text-[13px] text-ink-3">Conversation</span>}
        <span className="ml-auto" />
        <Menu items={[{ label: "Delete conversation", danger: true, onSelect: removeConversation }]} label="Conversation actions" />
      </header>
      <ol className="flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite">
        {isLoading && <li className="h-24 animate-pulse rounded-lg bg-sunk" />}
        {!isLoading && !(messages || []).length && <li className="py-8 text-center text-[12.5px] text-ink-3">No messages yet. Say hello, or share a request as a card.</li>}
        {(messages || []).map((m) => {
          const mine = String(m.sender?._id) === me;
          const day = dayKeyOf(m.createdAt);
          const showDay = day !== lastDay;
          lastDay = day;
          const card = m.attachment?.kind ? cards.data?.cards?.[`${m.attachment.kind}:${m.attachment.id}`] : null;
          return (
            <li key={m._id} className="grid gap-2">
              {showDay && <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">{dayLabel(m.createdAt)}</p>}
              <div className={cn("group flex max-w-[88%] flex-col gap-1", mine ? "ml-auto items-end" : "items-start")}>
                {m.message && (
                  <p className={cn("whitespace-pre-wrap break-words rounded-xl border px-3 py-2 text-[13px]", mine ? "border-teal/30 bg-teal/10 text-ink" : "border-line bg-raise text-ink")}>{m.message}</p>
                )}
                {m.attachment?.kind && (card ? <RequestCard card={card} className="w-full min-w-[260px]" /> : <div className="h-20 w-64 animate-pulse rounded-lg bg-sunk" />)}
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-3">
                  {clock(m.createdAt)}
                  {mine && m._id === lastMineRead?._id && m.isRead && " · read"}
                  <button type="button" onClick={() => deleteMessage(m._id, partnerId)} aria-label="Delete this message for me" className="opacity-0 hover:text-red focus-visible:opacity-100 group-hover:opacity-100">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              </div>
            </li>
          );
        })}
        <li ref={endRef} aria-hidden="true" />
      </ol>
      <form onSubmit={send} className="relative grid gap-2 border-t border-line p-2">
        {picking && <AttachPicker partnerId={partnerId} onClose={() => setPicking(false)} onPick={(c) => { setAttachment(c); setPicking(false); }} />}
        {attachment && (
          <div className="flex items-start gap-2">
            <RequestCard card={{ ...attachment, actions: [] }} className="flex-1" />
            <button type="button" onClick={() => setAttachment(null)} aria-label="Remove the card" className="grid h-8 w-8 place-items-center rounded-md text-ink-3 hover:bg-sunk"><X className="h-4 w-4" /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <Button type="button" variant="ghost" size="icon" aria-label="Share a request" aria-expanded={picking} onClick={() => setPicking((v) => !v)}>
            <Paperclip aria-hidden />
          </Button>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send(e);
            }}
            rows={1}
            maxLength={5000}
            placeholder={partner ? `Message ${partner.firstName}` : "Message"}
            aria-label="Message"
            className="min-h-[40px] resize-none py-2"
          />
          <Button type="submit" size="icon" aria-label="Send" disabled={sending || (!text.trim() && !attachment)}>
            <Send aria-hidden />
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Conversations and the open thread; `with` is the other person's id. */
export function ChatPane({ partnerId, onOpen }) {
  // Live updates on the shared socket: refetch what changed.
  const onMessage = useCallback((m) => {
    const ids = [m?.sender?._id, m?.receiver?._id].filter(Boolean).map(String);
    ids.forEach((id) => queryClient.invalidateQueries({ queryKey: inboxKeys.thread(id) }));
    queryClient.invalidateQueries({ queryKey: inboxKeys.conversations });
  }, []);
  const onRead = useCallback(({ userId }) => queryClient.invalidateQueries({ queryKey: inboxKeys.thread(String(userId)) }), []);
  const onChange = useCallback(() => queryClient.invalidateQueries({ queryKey: ["inbox"] }), []);
  useSocketEvent("newMessage", onMessage);
  useSocketEvent("messagesRead", onRead);
  useSocketEvent("messageDeleted", onChange);
  useSocketEvent("conversationDeleted", onChange);

  return (
    <div className="grid min-h-0 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className={cn(partnerId && "hidden lg:block")}>
        <ConversationList activeId={partnerId} onOpen={onOpen} />
      </div>
      {partnerId ? (
        <Thread partnerId={partnerId} onBack={() => onOpen(null)} />
      ) : (
        <p className="hidden rounded-xl border border-dashed border-line-2 px-4 py-16 text-center text-[13px] text-ink-3 lg:block">Choose a conversation, or search for a colleague to start one.</p>
      )}
    </div>
  );
}
