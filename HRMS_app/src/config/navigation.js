import { lazy } from "react";
import { BarChart3, Bell, CalendarDays, Clipboard, Clock, Gauge, MessageCircle, SlidersHorizontal, Sun, Users } from "lucide-react";

// Pages are loaded on first visit, so each role only downloads what it opens.
const TodayPage = lazy(() => import("../features/today/TodayPage"));
const PeoplePage = lazy(() => import("../features/people/PeoplePage"));
const LeaveRequestsPage = lazy(() => import("../features/leave/LeaveRequestsPage"));
const TimePage = lazy(() => import("../features/time/TimePage"));
const CalendarManager = lazy(() => import("../pages/CalendarManager"));
const HRDashboardHomepage = lazy(() => import("../pages/dashboards/Admin_Dashboard/HRDashboardHomepage"));
const ManagerDashboardHomepage = lazy(() => import("../pages/dashboards/Manager_Dashboard/ManagerDashboardHomepage"));
const EmployeeDashboardHomepage = lazy(() => import("../pages/dashboards/Employee_Dashboard/EmployeeDashboardHomepage"));
const NotificationPage = lazy(() => import("../pages/NotificationSystem"));
const ChatComponent = lazy(() => import("../pages/TeamChat"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));

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
  { group: "WORK", key: "calendar", label: "Calendar", icon: CalendarDays, component: CalendarManager, count: "calendar", keywords: "events meetings missions bookings resources" },
  // INSIGHT
  { group: "INSIGHT", key: "analytics", label: "HR analytics", icon: BarChart3, component: HRDashboardHomepage, roles: ["admin", "superAdmin"], keywords: "dashboard charts reports" },
  { group: "INSIGHT", key: "analytics", label: "Team analytics", icon: BarChart3, component: ManagerDashboardHomepage, roles: ["manager"], keywords: "dashboard charts team" },
  { group: "INSIGHT", key: "my-stats", label: "My stats", icon: Gauge, component: EmployeeDashboardHomepage, props: { personalView: true }, roles: ["admin", "manager"], keywords: "personal dashboard" },
  { group: "INSIGHT", key: "my-stats", label: "My stats", icon: Gauge, component: EmployeeDashboardHomepage, roles: ["employee"], keywords: "personal dashboard" },
  // TALK
  { group: "TALK", key: "notifications", label: "Notifications", icon: Bell, component: NotificationPage, count: "notifications", keywords: "alerts inbox" },
  { group: "TALK", key: "chat", label: "Chat", icon: MessageCircle, component: ChatComponent, count: "chat", keywords: "messages team chat" },
  { group: "TALK", key: "profile", label: "Profile", icon: SlidersHorizontal, component: ProfilePage, keywords: "account settings password" },
];

export const GROUPS = ["WORK", "INSIGHT", "TALK"];

export const DEFAULT_PAGE = "today";

export const pagesFor = (role) => PAGES.filter((p) => !p.roles || p.roles.includes(role));

export const pathFor = (key) => `/app/${key}`;

// Old dashboard URLs (/admin-dashboard?page=...) map to the new page keys.
const LEGACY_KEYS = { personal: "my-stats", employees: "people", attendance: "time" };
// A bare old dashboard URL means "home", which is now Today.
export const legacyPageKey = (role, oldKey) => {
  if (!oldKey) return DEFAULT_PAGE;
  if (oldKey === "home") return role === "employee" ? "my-stats" : "analytics";
  return LEGACY_KEYS[oldKey] || oldKey;
};
