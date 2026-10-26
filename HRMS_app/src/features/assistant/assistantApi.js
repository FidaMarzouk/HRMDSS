import api, { errorMessage } from "../../lib/api";
import { invalidateShell, queryClient } from "../../lib/queries";

const get = async (url) => (await api.get(url)).data;

export const fetchThread = () => get("/api/assistant/thread");
export const fetchStatus = () => get("/api/assistant/status");

export async function sendMessage(text, context) {
  try {
    const { data } = await api.post("/api/assistant/messages", { text, context });
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "The assistant could not answer right now."), status: err.response?.status };
  }
}

// Data the confirmed action may have changed, everywhere in the app.
const refreshAfterAction = () => {
  invalidateShell();
  ["leave", "calendar", "time", "inbox", "people", "profile"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
};

export async function decideDraft(id, decision, context) {
  try {
    const { data } = await api.post(`/api/assistant/drafts/${id}/${decision}`, { context });
    if (decision === "confirm" && data.draft?.status === "confirmed") refreshAfterAction();
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "That could not be done."), status: err.response?.status };
  }
}

export const newConversation = () => api.post("/api/assistant/thread/new");

export const sendFeedback = (runId, value) => api.put(`/api/assistant/runs/${runId}/feedback`, { value }).catch(() => {});
