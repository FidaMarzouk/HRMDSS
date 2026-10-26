import { useQuery } from "@tanstack/react-query";
import api, { errorMessage } from "../../lib/api";
import { invalidateShell, queryClient } from "../../lib/queries";
import { showError, showSuccess } from "../../lib/alerts";

export const timeKeys = {
  all: ["time"],
  day: (date) => ["time", "day", date],
  mine: ["time", "mine"],
  corrections: (scope) => ["time", "corrections", scope],
};

const get = (url, params) => async () => (await api.get(url, { params })).data;

export const useDay = (date, enabled = true) => useQuery({ queryKey: timeKeys.day(date), queryFn: get("/api/attendance/day", { date }), enabled });
export const useMine = () => useQuery({ queryKey: timeKeys.mine, queryFn: get("/api/attendance/mine", { days: 10 }) });
export const useCorrections = (scope, enabled = true) =>
  useQuery({ queryKey: timeKeys.corrections(scope), queryFn: get("/api/attendance/corrections", { scope }), enabled });

export const refreshTime = () => {
  queryClient.invalidateQueries({ queryKey: timeKeys.all });
  invalidateShell();
};

// Punch actions shared by the punch card and the command palette.
export async function punch(path, title) {
  try {
    await api.post(path);
    showSuccess(title);
    refreshTime();
    return true;
  } catch (err) {
    showError("Could not update attendance", errorMessage(err));
    return false;
  }
}

export async function requestCorrection(body) {
  try {
    const { data } = await api.post("/api/attendance/corrections", body);
    showSuccess("Correction requested", `${data.reviewer.firstName} ${data.reviewer.lastName} will review it.`);
    refreshTime();
    return true;
  } catch (err) {
    showError("Could not request the correction", errorMessage(err));
    return false;
  }
}

export async function decideCorrection(id, approve, note) {
  try {
    await api.put(`/api/attendance/corrections/${id}/${approve ? "approve" : "reject"}`, note ? { note } : {});
    showSuccess(approve ? "Correction approved" : "Correction rejected", approve ? "The attendance record is updated." : undefined);
    refreshTime();
    return true;
  } catch (err) {
    showError("Could not decide the correction", errorMessage(err));
    return false;
  }
}
