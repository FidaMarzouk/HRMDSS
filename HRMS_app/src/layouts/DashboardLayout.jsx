import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getISOWeek } from "date-fns";
import { Activity, Bell, CalendarDays, ChevronRight, LogOut, Menu, MessageCircle, SlidersHorizontal, X } from "lucide-react";
import RoboticLogoutModal from "../pages/auth/LogoutModal";
import ProfilePage from "../pages/ProfilePage";
import NotificationPage from "../pages/NotificationSystem";
import ChatComponent from "../pages/TeamChat";
import ChatBot from "../pages/ChatBot";
import { useAuth } from "../context/AuthContext";
import useUnreadNotifications from "../lib/useUnreadNotifications";
import { Avatar } from "../components/ui/avatar";
import { ThemeSwitch } from "../components/ui/theme-switch";
import { cn } from "../lib/utils";
import enovaWordmark from "../assets/logo.png";
import enovaIcon from "../assets/enova_logo.png";

const ROLE_LABELS = {
  admin: "HR Administrator",
  manager: "Manager",
  employee: "Employee",
  superAdmin: "CEO",
};

// Pages every role has, shown in the sidebar footer.
const COMMON_PAGES = [
  { key: "chat", label: "Chat", icon: MessageCircle, component: ChatComponent },
  { key: "notifications", label: "Notifications", icon: Bell, component: NotificationPage },
  { key: "profile", label: "Profile", icon: SlidersHorizontal, component: ProfilePage },
];

// Flattens the navigation tree into { key -> page } for rendering.
const indexPages = (navigation) => {
  const pages = {};
  const visit = (item) => {
    if (item.component) pages[item.key] = item;
    (item.children || []).forEach(visit);
  };
  [...navigation, ...COMMON_PAGES].forEach(visit);
  return pages;
};

const getGreeting = (date) => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// "THU 15 OCT 2026 · WEEK 42"
const formatDateline = (date) => {
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .format(date)
    .replace(",", "")
    .toUpperCase();
  return `${day} · WEEK ${getISOWeek(date)}`;
};

const useViewport = () => {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { isMobile: width < 768, width };
};

const CountBadge = ({ count }) =>
  count > 0 ? (
    <span className="figure ml-auto rounded border border-line-2 px-1.5 text-[10px] leading-4 text-ink-3">{count > 99 ? "99+" : count}</span>
  ) : null;

/**
 * Shared shell for all role dashboards: sidebar, header, notifications count,
 * theme switch, logout, the active page and the ENOVA Assistant.
 *
 * `navigation` items: { key, label, description, icon, component, props, children }.
 * Items with `children` act as expandable groups.
 */
const DashboardLayout = ({ navigation, defaultPage }) => {
  const { user } = useAuth();
  const { isMobile, width } = useViewport();
  const unreadNotifications = useUnreadNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(width >= 900);
  const [expanded, setExpanded] = useState({});
  const [now, setNow] = useState(new Date());
  const sidebarRef = useRef(null);

  const pages = useMemo(() => indexPages(navigation), [navigation]);
  const requestedPage = searchParams.get("page");
  const activeKey = pages[requestedPage] ? requestedPage : defaultPage;
  const activePage = pages[activeKey];

  const setActivePage = (key) => {
    setSearchParams(key === defaultPage ? {} : { page: key });
    if (isMobile) setMobileMenuOpen(false);
  };

  const isActive = (item) => item.key === activeKey || (item.children || []).some((c) => c.key === activeKey);

  // Clock for the greeting and date line
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Collapse the sidebar on narrow screens
  useEffect(() => {
    if (width < 900) setSidebarOpen(false);
    if (!isMobile) setMobileMenuOpen(false);
  }, [width, isMobile]);

  // Close the mobile menu when clicking outside it
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [mobileMenuOpen]);

  const showLabels = sidebarOpen || isMobile;

  const navItemClass = (active, level = 0) =>
    cn(
      "flex w-full items-center gap-2 rounded-md text-left text-sm transition-colors",
      level ? "min-h-9 px-2 py-1.5" : "min-h-10 px-2 py-2",
      !showLabels && "justify-center",
      active ? "bg-teal/10 font-semibold text-ink shadow-[inset_3px_0_0_rgb(var(--teal))]" : "text-ink-2 hover:bg-sunk hover:text-ink"
    );

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const active = isActive(item);
    const hasChildren = Boolean(item.children?.length);
    return (
      <Fragment key={item.key}>
        <li>
          <button
            type="button"
            className={navItemClass(active && !hasChildren)}
            aria-current={active && !hasChildren ? "page" : undefined}
            aria-expanded={hasChildren ? Boolean(expanded[item.key]) : undefined}
            onClick={() => (hasChildren ? setExpanded((prev) => ({ ...prev, [item.key]: !prev[item.key] })) : setActivePage(item.key))}
            title={showLabels ? undefined : item.label}
          >
            <Icon className={cn("h-[18px] w-[18px] flex-none", active ? "text-teal" : "text-ink-3")} aria-hidden="true" />
            {showLabels && <span className="truncate">{item.label}</span>}
            {hasChildren && showLabels && (
              <ChevronRight className={cn("ml-auto h-4 w-4 text-ink-3 transition-transform", expanded[item.key] && "rotate-90")} aria-hidden="true" />
            )}
          </button>
        </li>
        {hasChildren && expanded[item.key] && showLabels && (
          <ul className="mb-1 ml-7 border-l border-line pl-2">
            {item.children.map((child) => (
              <li key={child.key}>
                <button
                  type="button"
                  className={navItemClass(child.key === activeKey, 1)}
                  aria-current={child.key === activeKey ? "page" : undefined}
                  onClick={() => setActivePage(child.key)}
                >
                  <span className="truncate">{child.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Fragment>
    );
  };

  const renderFooterItem = (item) => {
    const Icon = item.icon;
    const active = item.key === activeKey;
    return (
      <li key={item.key}>
        <button
          type="button"
          className={navItemClass(active)}
          aria-current={active ? "page" : undefined}
          onClick={() => setActivePage(item.key)}
          title={showLabels ? undefined : item.label}
        >
          <Icon className={cn("h-[18px] w-[18px] flex-none", active ? "text-teal" : "text-ink-3")} aria-hidden="true" />
          {showLabels && <span className="truncate">{item.label}</span>}
          {showLabels && item.key === "notifications" && <CountBadge count={unreadNotifications} />}
        </button>
      </li>
    );
  };

  const PageComponent = activePage?.component;

  return (
    <div className="min-h-screen w-full bg-ground text-ink">
      <RoboticLogoutModal isOpen={showLogoutModal} onCancel={() => setShowLogoutModal(false)} />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        aria-label="Main navigation"
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-line bg-panel py-4 transition-[width,transform] duration-300",
          isMobile ? cn("w-64 px-3", mobileMenuOpen ? "translate-x-0" : "-translate-x-full") : sidebarOpen ? "w-60 px-3" : "w-[72px] px-2"
        )}
      >
        <div className={cn("relative flex items-center gap-2 px-1", showLabels ? "justify-between" : "justify-center")}>
          {showLabels ? (
            <img src={enovaWordmark} className="logo-on-theme h-8 w-auto max-w-[160px] object-contain" alt="Enova Robotics" />
          ) : (
            <img src={enovaIcon} className="logo-on-theme h-8 w-8 object-contain" alt="Enova Robotics" />
          )}
          {isMobile ? (
            <button type="button" aria-label="Close menu" className="grid h-10 w-10 place-items-center rounded-md text-ink-2 hover:bg-sunk" onClick={() => setMobileMenuOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="absolute -right-[22px] grid h-7 w-7 place-items-center rounded-full border border-line-2 bg-panel text-ink-2 hover:text-ink"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform", sidebarOpen && "rotate-180")} />
            </button>
          )}
        </div>

        {/* Current user */}
        <div className={cn("mb-3 mt-5 flex items-center gap-3 border-b border-line px-1 pb-4", !showLabels && "justify-center")}>
          <Avatar user={user} />
          {showLabels && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
          )}
        </div>

        <nav className="flex min-h-0 flex-1 flex-col">
          <ul className="flex-1 space-y-0.5 overflow-y-auto">{navigation.map(renderNavItem)}</ul>
          <ul className="mt-auto space-y-0.5 border-t border-line pt-3">
            {COMMON_PAGES.map(renderFooterItem)}
            <li>
              <button type="button" className={navItemClass(false)} onClick={() => setShowLogoutModal(true)} title={showLabels ? undefined : "Log out"}>
                <LogOut className="h-[18px] w-[18px] flex-none text-ink-3" aria-hidden="true" />
                {showLabels && <span>Log out</span>}
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main column */}
      <div className={cn("flex min-h-screen flex-col transition-[margin] duration-300", isMobile ? "" : sidebarOpen ? "ml-60" : "ml-[72px]")}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-panel/95 px-4 backdrop-blur md:px-6">
          {isMobile && (
            <button
              type="button"
              aria-label="Open menu"
              className="-ml-1 grid h-10 w-10 place-items-center rounded-md text-ink-2 hover:bg-sunk"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight">
              {getGreeting(now)}, {user?.firstName}
            </p>
            <p className="figure truncate text-[11px] tracking-[0.08em] text-ink-3">{formatDateline(now)}</p>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <ThemeSwitch compact={isMobile} className="mr-1" />
            {!isMobile && pages.calendar && (
              <button type="button" aria-label="Calendar" title="Calendar" className="grid h-10 w-10 place-items-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink" onClick={() => setActivePage("calendar")}>
                <CalendarDays className="h-[18px] w-[18px]" />
              </button>
            )}
            {!isMobile && pages.attendance && (
              <button type="button" aria-label="Attendance" title="Attendance" className="grid h-10 w-10 place-items-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink" onClick={() => setActivePage("attendance")}>
                <Activity className="h-[18px] w-[18px]" />
              </button>
            )}
            <button
              type="button"
              aria-label={unreadNotifications ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
              className="relative grid h-10 w-10 place-items-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink"
              onClick={() => setActivePage("notifications")}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadNotifications > 0 && (
                <span className="figure absolute right-1 top-1 min-w-[16px] rounded-full bg-teal px-1 text-[10px] font-semibold leading-4 text-on-accent">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>
            <button type="button" aria-label="View profile" className="ml-1 rounded-full" onClick={() => setActivePage("profile")}>
              <Avatar user={user} size="sm" />
            </button>
          </div>
        </header>

        {/* Quick navigation on mobile */}
        {isMobile && (
          <nav aria-label="Quick navigation" className="sticky top-16 z-20 overflow-x-auto border-b border-line bg-panel">
            <div className="flex min-w-full justify-center py-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const target = item.children?.length ? item.children[0].key : item.key;
                return (
                  <button
                    type="button"
                    key={item.key}
                    className={cn("mx-1 flex min-w-[64px] flex-col items-center justify-center rounded-md p-2", isActive(item) ? "text-teal" : "text-ink-2")}
                    onClick={() => setActivePage(target)}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="mt-1 whitespace-nowrap text-[11px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

        <main className="relative flex-1 p-3 md:p-6">
          {PageComponent && (
            <div className="relative overflow-x-auto rounded-xl border border-line bg-panel p-3 md:p-6">
              <PageComponent key={activeKey} {...(activePage.props || {})} />
            </div>
          )}
          <ChatBot />
        </main>

        <footer className="border-t border-line px-4 py-3 text-center font-mono text-[11px] tracking-[0.08em] text-ink-3">
          ENOVA PULSE · © {now.getFullYear()} ENOVA ROBOTICS
        </footer>
      </div>
    </div>
  );
};

export default DashboardLayout;
