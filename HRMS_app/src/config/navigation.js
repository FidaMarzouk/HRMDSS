import { lazy } from "react";
import { BarChart3, CalendarDays, Clipboard, Clock, Gauge, Inbox, SlidersHorizontal, Sun, Users } from "lucide-react";

// Pages are loaded on first visit, so each role only downloads what it opens.
const TodayPage = lazy(() => import("../features/today/TodayPage"));
const PeoplePage = lazy(() => import("../features/people/PeoplePage"));
const LeaveRequestsPage = lazy(() => import("../features/leave/LeaveRequestsPage"));
const TimePage = lazy(() => import("../features/time/TimePage"));
const CalendarPage = lazy(() => import("../features/calendar/CalendarPage"));
const AnalyticsPage = lazy(() => import("../features/analytics/AnalyticsPage"));
const MyStatsPage = lazy(() => import("../features/analytics/MyStatsPage"));
const InboxPage = lazy(() => import("../features/inbox/InboxPage"));
const ProfilePage = lazy(() => import("../features/profile/ProfilePage"));

/*
 * Pages live at /app/:key. Each role gets the groups below, filtered by `roles`.
 * `count` names a field of GET /api/me/counts shown as a badge.
 * `keywords` help the command palette match a page.
 */
const PAGES = [
  // WORK
  { group: "WORK", key: "today", label: "Today", icon: Sun, component: TodayPage, count: "today", keywords: "home decisions queue floor" },
  { group: "WORK", key: "people", label: "People", icon: Users, component: PeoplePage, roles: ["admin", "superAdmin"], keywords: "employees departments staff directory archive" },
  { group: "WORK", key: "people", label: "My team", icon: Users, component: PeoplePage, roles: ["manager"], keywords: "employees team directory" },
  { group: "WORK", key: "leave", label: "Leave", icon: Clipboard, component: LeaveRequestsPage, count: "leave", keywords: "leave requests time off vacation" },
  { group: "WORK", key: "time", label: "Time", icon: Clock, component: TimePage, count: "time", keywords: "attendance punch in out break corrections ribbons" },
  { group: "WORK", key: "calendar", label: "Calendar", icon: CalendarDays, component: CalendarPage, count: "calendar", keywords: "events meetings missions bookings resources" },
  // INSIGHT
  { group: "INSIGHT", key: "analytics", label: "Analytics", icon: BarChart3, component: AnalyticsPage, roles: ["admin", "superAdmin"], keywords: "dashboard charts reports signals coverage lateness overtime" },
  { group: "INSIGHT", key: "analytics", label: "Team analytics", icon: BarChart3, component: AnalyticsPage, roles: ["manager"], keywords: "dashboard charts team signals coverage" },
  { group: "INSIGHT", key: "my-stats", label: "My stats", icon: Gauge, component: MyStatsPage, roles: ["admin", "manager", "employee"], keywords: "personal dashboard attendance hours leave balance" },
  // TALK
  { group: "TALK", key: "inbox", label: "Inbox", icon: Inbox, component: InboxPage, count: "inbox", keywords: "notifications alerts messages chat digest" },
  { group: "TALK", key: "profile", label: "Profile", icon: SlidersHorizontal, component: ProfilePage, keywords: "account settings password sessions devices theme quiet hours digest passport" },
];

export const GROUPS = ["WORK", "INSIGHT", "TALK"];

export const DEFAULT_PAGE = "today";

export const pagesFor = (role) => PAGES.filter((p) => !p.roles || p.roles.includes(role));

export const pathFor = (key) => `/app/${key}`;

// Pages that were merged into another one: /app/<old> opens the new page.
export const PAGE_ALIASES = {
  notifications: { key: "inbox", search: "" },
  chat: { key: "inbox", search: "tab=messages" },
};

// Link to a conversation with someone in the inbox.
export const messagePath = (userId) => `${pathFor("inbox")}?tab=messages&with=${userId}`;

// Old dashboard URLs (/admin-dashboard?page=...) map to the new page keys.
const LEGACY_KEYS = { personal: "my-stats", employees: "people", attendance: "time" };
// A bare old dashboard URL means "home", which is now Today.
export const legacyPageKey = (role, oldKey) => {
  if (!oldKey) return DEFAULT_PAGE;
  if (oldKey === "home") return role === "employee" ? "my-stats" : "analytics";
  return LEGACY_KEYS[oldKey] || oldKey;
};
