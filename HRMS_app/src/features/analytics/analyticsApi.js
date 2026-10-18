import { keepPreviousData, useQuery } from "@tanstack/react-query";
import api from "../../lib/api";

export const analyticsKeys = {
  all: ["analytics"],
  overview: (params) => ["analytics", "overview", params],
  legacy: (path, params) => ["analytics", path, params],
};

const get = (url, params) => async () => (await api.get(url, { params })).data;

// Tickers, signals and the four marks (HR, CEO, managers).
export const useOverview = ({ from, to, department }, enabled = true) =>
  useQuery({
    queryKey: analyticsKeys.overview({ from, to, department }),
    queryFn: get("/api/analytics/overview", { from, to, department: department || undefined }),
    placeholderData: keepPreviousData,
    enabled,
  });

// The detailed sections carried over from the former dashboards.
const DASHBOARD = { hr: "/api/hr/dashboard", manager: "/api/manager/dashboard", employee: "/api/employee/dashboard" };
export const useDashboard = (kind, { from, to }) =>
  useQuery({
    queryKey: analyticsKeys.legacy(kind, { from, to }),
    queryFn: get(DASHBOARD[kind], { startDate: from, endDate: to }),
    placeholderData: keepPreviousData,
  });
