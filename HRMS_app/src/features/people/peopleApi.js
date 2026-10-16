import { useQuery } from "@tanstack/react-query";
import api, { errorMessage } from "../../lib/api";
import { invalidateShell, queryClient } from "../../lib/queries";
import { showError, showSuccess } from "../../lib/alerts";

export const peopleKeys = {
  all: ["people"],
  list: (archived) => ["people", "list", archived ? "archived" : "active"],
  person: (id) => ["people", "person", id],
  history: (id) => ["people", "history", id],
  departments: ["people", "departments"],
};

const get = (url, params) => async () => (await api.get(url, { params })).data;

// HR and the CEO get everyone (users), managers their team (employees).
export const usePeopleList = ({ archived = false } = {}) =>
  useQuery({
    queryKey: peopleKeys.list(archived),
    queryFn: async () => {
      const { data } = await api.get("/api/users", { params: archived ? { status: "archived" } : undefined });
      return data.users || data.employees || [];
    },
  });

export const useDepartments = (enabled = true) =>
  useQuery({ queryKey: peopleKeys.departments, queryFn: get("/api/departments"), enabled });

export const usePerson = (id) => useQuery({ queryKey: peopleKeys.person(id), queryFn: get(`/api/people/${id}`), enabled: Boolean(id) });

export const usePersonHistory = (id, enabled) =>
  useQuery({ queryKey: peopleKeys.history(id), queryFn: get(`/api/people/${id}/history`), enabled: Boolean(id) && enabled });

export const refreshPeople = () => {
  queryClient.invalidateQueries({ queryKey: peopleKeys.all });
  invalidateShell();
};

// Salary is fetched on request only; the server records every reveal.
export async function revealSalary(id) {
  try {
    const { data } = await api.get(`/api/people/${id}/salary`);
    queryClient.invalidateQueries({ queryKey: peopleKeys.history(id) });
    return data.salary;
  } catch (err) {
    showError("Could not show the salary", errorMessage(err));
    return null;
  }
}

export async function saveSkills(id, skills) {
  try {
    await api.put(`/api/people/${id}/skills`, { skills });
    showSuccess("Skills saved");
    queryClient.invalidateQueries({ queryKey: peopleKeys.person(id) });
    queryClient.invalidateQueries({ queryKey: peopleKeys.history(id) });
    return true;
  } catch (err) {
    showError("Could not save skills", errorMessage(err));
    return false;
  }
}

export async function archivePerson(id, { confirmName, reason }) {
  try {
    const { data } = await api.post(`/api/people/${id}/archive`, { confirmName, reason });
    showSuccess(data.message, data.closedRequests ? `${data.closedRequests} open leave request(s) closed.` : "Their history is kept and they can be restored.");
    refreshPeople();
    return true;
  } catch (err) {
    showError("Could not archive", errorMessage(err));
    return false;
  }
}

export async function restorePerson(id) {
  try {
    const { data } = await api.post(`/api/people/${id}/restore`);
    showSuccess(data.message, "They can sign in again.");
    refreshPeople();
    return true;
  } catch (err) {
    showError("Could not restore", errorMessage(err));
    return false;
  }
}
