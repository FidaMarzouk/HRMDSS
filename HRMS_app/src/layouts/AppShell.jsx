import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Navigate, useLocation, useParams } from "react-router-dom";
import { getISOWeek } from "date-fns";
import { Bell, Bot, ChevronRight, LogOut, Menu, Search, X } from "lucide-react";
import { AssistantDock } from "../features/assistant/AssistantDock";
import { useAuth } from "../context/AuthContext";
import { Avatar } from "../components/ui/avatar";
import { Kbd } from "../components/ui/kbd";
import { ThemeSwitch } from "../components/ui/theme-switch";
import { cn } from "../lib/utils";
import { useCounts } from "../lib/queries";
import useLiveUpdates from "../lib/useLiveUpdates";
import { DEFAULT_PAGE, GROUPS, PAGE_ALIASES, pagesFor, pathFor } from "../config/navigation";
import { ShiftRuler } from "../features/shell/ShiftRuler";
import { PunchStatus } from "../features/shell/PunchStatus";
import { LogoutDialog } from "../features/shell/LogoutDialog";
import { useThemeSync } from "../features/shell/useThemeSync";
import { CommandPalette } from "../features/command/CommandPalette";
import enovaWordmark from "../assets/logo.png";
import enovaIcon from "../assets/enova_logo.png";

const ROLE_LABELS = { admin: "HR Administrator", manager: "Manager", employee: "Employee", superAdmin: "CEO" };

const getGreeting = (date) => {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

// "THU 15 OCT 2026 · WEEK 42"
const formatDateline = (date) =>
  `${new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date).replace(",", "").toUpperCase()} · WEEK ${getISOWeek(date)}`;

const useViewport = () => {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { isMobile: width < 768, width };
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

const PageFallback = () => (
  <div aria-busy="true" className="space-y-3">
    <div className="h-8 w-56 animate-pulse rounded-md bg-sunk" />
    <div className="h-40 animate-pulse rounded-xl bg-sunk" />
  </div>
);

/**
 * App shell for every role: grouped sidebar with counts, a slim top bar with
 * the shift ruler and punch status, the command palette (Ctrl K) and the page
 * at /app/:page.
 */
export default function AppShell() {
  const { page: pageKey } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const { isMobile, width } = useViewport();
  const counts = useCounts();
  useLiveUpdates();
  useThemeSync();

  const pages = useMemo(() => pagesFor(user?.role), [user?.role]);
  const active = pages.find((p) => p.key === pageKey);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(width >= 1100);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(() => {
    try {
      return localStorage.getItem("enova-assistant") === "open";
    } catch {
      return false;
    }
  });
  const toggleAssistant = useCallback((value) => {
    setAssistantOpen((prev) => {
      const next = typeof value === "boolean" ? value : !prev;
      try {
        localStorage.setItem("enova-assistant", next ? "open" : "closed");
      } catch {
        // per-device convenience only
      }
      return next;
    });
  }, []);

  // "Ask the ENOVA Assistant" (Ctrl K) opens the dock; the dock sends the question.
  useEffect(() => {
    const onAsk = () => toggleAssistant(true);
    window.addEventListener("assistant:ask", onAsk);
    return () => window.removeEventListener("assistant:ask", onAsk);
  }, [toggleAssistant]);
  const [now, setNow] = useState(new Date());
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);

  // Ctrl K / Cmd K anywhere opens the command palette.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (width < 1100) setSidebarOpen(false);
    if (!isMobile) setMobileMenuOpen(false);
  }, [width, isMobile]);

  // New page: close the mobile menu and move focus to the content for screen readers.
  useEffect(() => {
    setMobileMenuOpen(false);
    mainRef.current?.focus({ preventScroll: true });
  }, [pageKey]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const onOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) setMobileMenuOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [mobileMenuOpen]);

  if (!active) {
    const alias = PAGE_ALIASES[pageKey];
    if (alias) {
      const search = [alias.search, location.search.replace(/^\?/, "")].filter(Boolean).join("&");
      return <Navigate to={`${pathFor(alias.key)}${search ? `?${search}` : ""}`} replace />;
    }
    return <Navigate to={`${pathFor(DEFAULT_PAGE)}${location.search}`} replace />;
  }

  const showLabels = sidebarOpen || isMobile;
  const countOf = (page) => (page.count ? counts.data?.[page.count] || 0 : 0);
  const PageComponent = active.component;

  const navLink = (page) => {
    const Icon = page.icon;
    const count = countOf(page);
    return (
      <li key={page.key}>
        <NavLink
          to={pathFor(page.key)}
          title={showLabels ? undefined : page.label}
          aria-label={!showLabels && count ? `${page.label}, ${count} waiting` : undefined}
          className={({ isActive }) =>
            cn(
              "flex min-h-10 w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
              !showLabels && "justify-center",
              isActive ? "bg-teal/10 font-semibold text-ink shadow-[inset_3px_0_0_rgb(var(--teal))]" : "text-ink-2 hover:bg-sunk hover:text-ink"
            )
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative flex-none">
                <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-teal" : "text-ink-3")} aria-hidden="true" />
                {!showLabels && count > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-teal" aria-hidden="true" />}
              </span>
              {showLabels && <span className="truncate">{page.label}</span>}
              {showLabels && count > 0 && (
                <span className="figure ml-auto rounded border border-line-2 px-1.5 text-[10px] leading-4 text-ink-3">{count > 99 ? "99+" : count}</span>
              )}
            </>
          )}
        </NavLink>
      </li>
    );
  };

  return (
    <div className="min-h-screen w-full bg-ground text-ink">
      <a href="#main" className="sr-only z-[70] rounded bg-panel px-3 py-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2">
        Skip to content
      </a>
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onLogout={() => setLogoutOpen(true)} />

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
          <Link to={pathFor(DEFAULT_PAGE)} aria-label="ENOVA, Today">
            {showLabels ? (
              <img src={enovaWordmark} className="logo-on-theme h-8 w-auto max-w-[160px] object-contain" alt="" />
            ) : (
              <img src={enovaIcon} className="logo-on-theme h-8 w-8 object-contain" alt="" />
            )}
          </Link>
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

        <nav className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
          {GROUPS.map((group) => {
            const groupPages = pages.filter((p) => p.group === group);
            if (!groupPages.length) return null;
            return (
              <div key={group} className="mb-2">
                {showLabels ? (
                  <p className="px-2 pb-1 pt-2 font-mono text-[9.5px] tracking-[0.14em] text-ink-3">{group}</p>
                ) : (
                  <div className="mx-3 my-2 h-px bg-line" aria-hidden="true" />
                )}
                <ul className="space-y-0.5">{groupPages.map(navLink)}</ul>
              </div>
            );
          })}
        </nav>

        <div className={cn("mt-2 flex items-center gap-2 border-t border-line px-1 pt-3", !showLabels && "flex-col")}>
          <Avatar user={user} />
          {showLabels && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-3">{ROLE_LABELS[user?.role] || user?.role}</p>
            </div>
          )}
          <button type="button" onClick={() => setLogoutOpen(true)} aria-label="Log out" title="Log out" className="grid h-10 w-10 flex-none place-items-center rounded-md text-ink-3 hover:bg-sunk hover:text-ink">
            <LogOut className="h-[18px] w-[18px]" />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className={cn("flex min-h-screen flex-col transition-[margin] duration-300", isMobile ? "" : sidebarOpen ? "ml-60" : "ml-[72px]")}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-panel/95 px-4 backdrop-blur md:px-6">
          {isMobile && (
            <button type="button" aria-label="Open menu" className="-ml-1 grid h-10 w-10 place-items-center rounded-md text-ink-2 hover:bg-sunk" onClick={() => setMobileMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-none">
            <p className="truncate text-[15px] font-semibold leading-tight">
              {getGreeting(now)}, {user?.firstName}
            </p>
            <p className="figure truncate text-[11px] tracking-[0.08em] text-ink-3">{formatDateline(now)}</p>
          </div>

          <ShiftRuler className="mx-4 hidden min-w-[160px] flex-1 xl:block" />
          <div className="flex-1 xl:hidden" />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-edge bg-panel px-2.5 text-left text-[12.5px] text-ink-3 hover:border-teal md:flex"
          >
            <Search className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
            <span className="flex-1 truncate">Search or run a command</span>
            <Kbd>{isMac ? "⌘ K" : "Ctrl K"}</Kbd>
          </button>
          <button type="button" onClick={() => setPaletteOpen(true)} aria-label="Search or run a command" className="grid h-10 w-10 place-items-center rounded-md text-ink-2 hover:bg-sunk md:hidden">
            <Search className="h-[18px] w-[18px]" />
          </button>

          <ThemeSwitch compact className="hidden sm:inline-flex" />

          <Link
            to={pathFor("inbox")}
            aria-label={counts.data?.notifications ? `Inbox, ${counts.data.notifications} need${counts.data.notifications === 1 ? "s" : ""} your action` : "Inbox, nothing needs your action"}
            className="relative grid h-10 w-10 flex-none place-items-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink"
          >
            <Bell className="h-[18px] w-[18px]" />
            {counts.data?.notifications > 0 && (
              <span className="figure absolute right-1 top-1 min-w-[16px] rounded-full bg-teal px-1 text-center text-[10px] font-semibold leading-4 text-on-accent">
                {counts.data.notifications > 9 ? "9+" : counts.data.notifications}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => toggleAssistant()}
            aria-pressed={assistantOpen}
            aria-label="ENOVA Assistant"
            title="ENOVA Assistant"
            className={cn("grid h-10 w-10 flex-none place-items-center rounded-md hover:bg-sunk", assistantOpen ? "bg-teal/10 text-teal" : "text-ink-2 hover:text-ink")}
          >
            <Bot className="h-[18px] w-[18px]" />
          </button>
          <PunchStatus className="hidden lg:block" />
          <Link to={pathFor("profile")} aria-label="Your profile" className="flex-none rounded-full">
            <Avatar user={user} size="sm" />
          </Link>
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className={cn("relative flex-1 p-3 focus:outline-none md:p-6", assistantOpen && "lg:mr-[420px]")}>
          <h1 className="sr-only">{active.label}</h1>
          <div className={cn(active.key !== "today" && "overflow-x-auto rounded-xl border border-line bg-panel p-3 md:p-6")}>
            <Suspense fallback={<PageFallback />}>
              <PageComponent key={active.key} {...(active.props || {})} />
            </Suspense>
          </div>
          <AssistantDock
            open={assistantOpen}
            onClose={() => toggleAssistant(false)}
            page={active.key}
            selection={location.search.replace(/^\?/, "").slice(0, 200)}
          />
        </main>

        <footer className="border-t border-line px-4 py-3 text-center font-mono text-[11px] tracking-[0.08em] text-ink-3">
          ENOVA · © {now.getFullYear()} ENOVA ROBOTICS
        </footer>
      </div>
    </div>
  );
}
