import { useQuery } from "@tanstack/react-query";
import api, { errorMessage } from "../../lib/api";
import { queryClient } from "../../lib/queries";
import { showError, showSuccess } from "../../lib/alerts";

export const profileKeys = {
  all: ["profile"],
  me: ["profile", "me"],
  overview: ["profile", "overview"],
  sessions: ["profile", "sessions"],
};

const get = (url) => async () => (await api.get(url)).data;

export const useProfile = () => useQuery({ queryKey: profileKeys.me, queryFn: get("/api/users/profile") });
export const useProfileOverview = () => useQuery({ queryKey: profileKeys.overview, queryFn: get("/api/users/me/overview") });
export const useSessions = () => useQuery({ queryKey: profileKeys.sessions, queryFn: get("/api/auth/sessions") });

const refresh = () => queryClient.invalidateQueries({ queryKey: profileKeys.all });

/**
 * Save some of your own fields (names, phone, personal email, birthdate,
 * skills, photo, password). Resolves to the updated profile or null.
 */
export async function saveProfile(fields, { file, quiet = false } = {}) {
  try {
    let body = fields;
    if (file) {
      body = new FormData();
      Object.entries(fields).forEach(([k, v]) => body.append(k, typeof v === "object" ? JSON.stringify(v) : v));
      body.append("profileImage", file);
    }
    const { data } = await api.put("/api/users/profile", body);
    queryClient.setQueryData(profileKeys.me, (prev) => (prev ? { ...prev, ...data } : data));
    refresh();
    if (!quiet) showSuccess("Saved");
    return data;
  } catch (err) {
    showError("Could not save", errorMessage(err));
    return null;
  }
}

export async function savePreferences(changes, successText) {
  try {
    const { data } = await api.put("/api/users/me/preferences", changes);
    if (successText) showSuccess(successText);
    queryClient.invalidateQueries({ queryKey: ["inbox"] });
    return data.preferences;
  } catch (err) {
    showError("Could not save the preference", errorMessage(err));
    return null;
  }
}

export async function endSession(id) {
  try {
    await api.delete(`/api/auth/sessions/${id}`);
    showSuccess("Session ended", "That device is signed out.");
    queryClient.invalidateQueries({ queryKey: profileKeys.sessions });
    return true;
  } catch (err) {
    showError("Could not end the session", errorMessage(err));
    return false;
  }
}

export async function signOutOthers() {
  try {
    const { data } = await api.post("/api/auth/sessions/sign-out-others");
    showSuccess(data.ended ? `${data.ended} other session${data.ended === 1 ? "" : "s"} signed out` : "No other sessions were open");
    queryClient.invalidateQueries({ queryKey: profileKeys.sessions });
    return true;
  } catch (err) {
    showError("Could not sign out the other devices", errorMessage(err));
    return false;
  }
}
