import { QueryClient, useQuery } from "@tanstack/react-query";
import api from "./api";

// Shared query client. Data shown in the shell is kept fresh by socket events
// (see useLiveUpdates), so a short stale time is enough.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

export const keys = {
  today: ["today"],
  presence: ["presence"],
  counts: ["counts"],
  attendanceToday: ["attendance", "today"],
  search: (q) => ["search", q],
};

const get = (url, params) => async () => (await api.get(url, { params })).data;

export const useToday = () => useQuery({ queryKey: keys.today, queryFn: get("/api/today") });

export const usePresence = () => useQuery({ queryKey: keys.presence, queryFn: get("/api/presence") });

// Sidebar badges; also polled slowly as a safety net when the socket is down.
export const useCounts = () =>
  useQuery({ queryKey: keys.counts, queryFn: get("/api/me/counts"), refetchInterval: 60_000 });

export const useTodaySessions = () =>
  useQuery({ queryKey: keys.attendanceToday, queryFn: get("/api/attendance/today"), refetchInterval: 60_000 });

export const usePeopleSearch = (q) =>
  useQuery({
    queryKey: keys.search(q),
    queryFn: get("/api/search", { q }),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

// After any decision or punch made from this tab.
export const invalidateShell = () => {
  queryClient.invalidateQueries({ queryKey: keys.today });
  queryClient.invalidateQueries({ queryKey: keys.counts });
  queryClient.invalidateQueries({ queryKey: keys.presence });
  queryClient.invalidateQueries({ queryKey: keys.attendanceToday });
};
