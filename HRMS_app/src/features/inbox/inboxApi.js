import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api, { errorMessage } from "../../lib/api";
import { invalidateShell, queryClient } from "../../lib/queries";
import { showError, showSuccess } from "../../lib/alerts";
import { approveItem } from "../today/decisions";

export const inboxKeys = {
  all: ["inbox"],
  box: (box) => ["inbox", "box", box],
  cards: (refs) => ["inbox", "cards", refs],
  conversations: ["inbox", "conversations"],
  people: ["inbox", "people"],
  thread: (id) => ["inbox", "thread", id],
  attachable: (id) => ["inbox", "attachable", id],
};

const get = (url, params) => async () => (await api.get(url, { params })).data;

export const useInbox = (box) => useQuery({ queryKey: inboxKeys.box(box), queryFn: get("/api/inbox", { box }), placeholderData: keepPreviousData });
export const useConversations = () => useQuery({ queryKey: inboxKeys.conversations, queryFn: get("/api/chat/conversations") });
export const useChatPeople = (enabled = true) => useQuery({ queryKey: inboxKeys.people, queryFn: get("/api/chat/users"), staleTime: 60_000, enabled });
// Loading a thread marks it read on the server; refresh the list and badges
// once that has happened (not in parallel with it).
export const useThread = (id) =>
  useQuery({
    queryKey: inboxKeys.thread(id),
    queryFn: async () => {
      const data = (await api.get(`/api/chat/messages/${id}`)).data;
      queryClient.refetchQueries({ queryKey: inboxKeys.conversations, type: "active" }, { cancelRefetch: true });
      queryClient.invalidateQueries({ queryKey: ["counts"] });
      return data;
    },
    enabled: Boolean(id),
  });
export const useAttachable = (id, enabled) =>
  useQuery({ queryKey: inboxKeys.attachable(id), queryFn: get("/api/chat/attachable", { with: id }), enabled: Boolean(id) && enabled });
export const useCards = (refs) =>
  useQuery({ queryKey: inboxKeys.cards(refs), queryFn: get("/api/inbox/cards", { refs: refs.join(",") }), enabled: refs.length > 0, placeholderData: keepPreviousData });

export const refreshInbox = () => {
  queryClient.invalidateQueries({ queryKey: inboxKeys.all });
  invalidateShell();
};

export async function markRead(id) {
  try {
    await api.put(`/api/notifications/${id}/read`);
  } catch {
    // Reading is best effort.
  }
  queryClient.invalidateQueries({ queryKey: inboxKeys.all });
}

export async function markInfoRead() {
  try {
    await api.put("/api/inbox/read");
    refreshInbox();
  } catch (err) {
    showError("Could not mark them read", errorMessage(err));
  }
}

export async function deleteNotification(id) {
  try {
    await api.delete(`/api/notifications/${id}`);
    refreshInbox();
  } catch (err) {
    showError("Could not delete the notification", errorMessage(err));
  }
}

export async function setDigest(digest) {
  try {
    await api.put("/api/inbox/preferences", { digest });
    showSuccess(
      digest ? "Daily digest on" : "Daily digest off",
      digest ? "Low-urgency alerts arrive in one summary at 09:00 on working days." : "Alerts arrive as they happen."
    );
    refreshInbox();
  } catch (err) {
    showError("Could not change the digest", errorMessage(err));
  }
}

const DONE = {
  decline: "Event declined",
  accept: "Invitation accepted",
  decline_invite: "Invitation declined",
  accept_dates: "New dates accepted",
  keep_dates: "Original dates kept",
};

/**
 * Run an action from a card. Approvals go through the shared approve-with-undo
 * flow (same as Today); the rest are sent at once.
 */
export async function runAction(card, action) {
  if (action.kind === "approve") {
    approveItem({ id: card.id, kind: card.kind, title: card.title, approve: { method: action.method, url: action.url } });
    return true;
  }
  try {
    await api.request({ method: action.method, url: action.url, data: action.body });
    showSuccess(DONE[action.id] || "Done", card.title);
    refreshInbox();
    queryClient.invalidateQueries({ queryKey: ["calendar"] });
    queryClient.invalidateQueries({ queryKey: ["leave"] });
    return true;
  } catch (err) {
    showError("Could not do that", errorMessage(err));
    refreshInbox();
    return false;
  }
}

export async function sendMessage(receiverId, message, attachment) {
  try {
    const { data } = await api.post("/api/chat/messages", {
      receiverId,
      message,
      attachment: attachment ? { kind: attachment.kind, id: attachment.id } : undefined,
    });
    queryClient.invalidateQueries({ queryKey: inboxKeys.thread(receiverId) });
    queryClient.invalidateQueries({ queryKey: inboxKeys.conversations });
    return data;
  } catch (err) {
    showError("Message not sent", errorMessage(err));
    return null;
  }
}

export async function deleteMessage(id, partnerId) {
  try {
    await api.delete(`/api/chat/messages/${id}`);
    queryClient.invalidateQueries({ queryKey: inboxKeys.thread(partnerId) });
    queryClient.invalidateQueries({ queryKey: inboxKeys.conversations });
  } catch (err) {
    showError("Could not delete the message", errorMessage(err));
  }
}

export async function deleteConversation(partnerId) {
  try {
    await api.delete(`/api/chat/conversations/${partnerId}`);
    queryClient.invalidateQueries({ queryKey: inboxKeys.conversations });
    queryClient.removeQueries({ queryKey: inboxKeys.thread(partnerId) });
    return true;
  } catch (err) {
    showError("Could not delete the conversation", errorMessage(err));
    return false;
  }
}
