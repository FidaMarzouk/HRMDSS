import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bell, ChevronRight, Activity, Grid, Menu, MessageCircle, SlidersHorizontal } from "lucide-react";
import { FaSignOutAlt } from "react-icons/fa";
import RoboticLogoutModal from "../pages/auth/LogoutModal";
import ProfilePage from "../pages/ProfilePage";
import NotificationPage from "../pages/NotificationSystem";
import ChatComponent from "../pages/TeamChat";
import ChatBot from "../pages/ChatBot";
import CircuitPattern from "../components/CircuitPattern";
import { useAuth } from "../context/AuthContext";
import useUnreadNotifications from "../lib/useUnreadNotifications";
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

const getHeaderGradient = (date) => {
  const hour = date.getHours();
  if (hour < 6) return "bg-gradient-to-r from-[#0c4a44] to-[#1c5a54]";
  if (hour < 12) return "bg-gradient-to-r from-[#23a49b] to-[#0e766c]";
  if (hour < 18) return "bg-gradient-to-r from-[#2d9d95] to-[#20756e]";
  return "bg-gradient-to-r from-[#1a7870] to-[#0a5a54]";
};

const useViewport = () => {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { isMobile: width < 768, isSmallScreen: width < 1024, width };
};

const Initials = ({ user, className }) => (
  <div className={`rounded-full bg-gradient-to-br from-[#23A49B] to-[#2D8A83] flex justify-center items-center text-white font-bold flex-shrink-0 ${className}`}>
    {user?.firstName?.charAt(0)}
    {user?.lastName?.charAt(0)}
  </div>
);

/**
 * Shared shell for all role dashboards: sidebar, header, notifications badge,
 * logout, the active page and the ENOVA Assistant.
 *
 * `navigation` items: { key, label, description, icon, component, props, children }.
 * Items with `children` act as expandable groups.
 */
const DashboardLayout = ({ navigation, defaultPage }) => {
  const { user } = useAuth();
  const { isMobile, isSmallScreen, width } = useViewport();
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

  // Clock for the greeting and header colour
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
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  }).format(now);

  const navItemClass = (active, level = 0) =>
    `flex items-center space-x-2 ${level ? "p-2" : "p-3"} my-1 rounded-lg transition-all duration-200 cursor-pointer w-full text-left ${
      active
        ? `bg-gradient-to-r from-[#3baca5]/20 to-[#3baca5]/10 ${level ? "border-l-2" : "border-l-4"} border-[#3baca5]`
        : `hover:bg-gray-800 ${level ? "border-l-2" : "border-l-4"} border-transparent`
    }`;

  const NotificationBadge = ({ compact }) =>
    unreadNotifications > 0 ? (
      <span
        className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center ${compact ? "h-3 w-3" : "h-4 min-w-4 px-1"}`}
      >
        {compact ? "" : unreadNotifications > 9 ? "9+" : unreadNotifications}
      </span>
    ) : null;

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const active = isActive(item);
    const hasChildren = Boolean(item.children?.length);
    return (
      <Fragment key={item.key}>
        <li>
          <button
            type="button"
            className={navItemClass(active)}
            onClick={() => (hasChildren ? setExpanded((prev) => ({ ...prev, [item.key]: !prev[item.key] })) : setActivePage(item.key))}
            title={showLabels ? undefined : item.label}
          >
            <div className={`${active ? "text-[#3baca5]" : "text-gray-400"} flex items-center justify-center w-8 h-8 flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            {showLabels && (
              <div className="flex flex-col overflow-hidden">
                <span className={`font-medium text-base ${active ? "text-[#3baca5]" : "text-gray-300"} whitespace-nowrap`}>{item.label}</span>
                {item.description && (
                  <span className="text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[160px]">{item.description}</span>
                )}
              </div>
            )}
            {hasChildren && showLabels && (
              <ChevronRight className={`ml-auto mr-2 w-4 h-4 text-gray-400 transition-transform duration-300 ${expanded[item.key] ? "rotate-90" : ""}`} />
            )}
            {active && !hasChildren && (
              <div className="ml-auto mr-2 w-2 h-2 bg-[#3baca5] rounded-full flex-shrink-0" />
            )}
          </button>
        </li>
        {hasChildren && expanded[item.key] && showLabels && (
          <ul className="ml-8 mb-2">
            {item.children.map((child) => (
              <li key={child.key}>
                <button type="button" className={navItemClass(child.key === activeKey, 1)} onClick={() => setActivePage(child.key)}>
                  <div className="flex flex-col">
                    <span className={`font-medium text-sm ${child.key === activeKey ? "text-[#3baca5]" : "text-gray-300"}`}>{child.label}</span>
                    {child.description && <span className="text-xs text-gray-500">{child.description}</span>}
                  </div>
                  {child.key === activeKey && <div className="ml-auto w-1.5 h-1.5 bg-[#3baca5] rounded-full" />}
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
          onClick={() => setActivePage(item.key)}
          title={showLabels ? undefined : item.label}
        >
          <div className={`${active ? "text-[#3baca5]" : "text-gray-400"} relative flex items-center justify-center w-8 h-8 flex-shrink-0`}>
            <Icon className="w-5 h-5" />
            {item.key === "notifications" && <NotificationBadge compact />}
          </div>
          {showLabels && (
            <span className={`font-medium text-base ${active ? "text-[#3baca5]" : "text-gray-300"} whitespace-nowrap`}>{item.label}</span>
          )}
          {active && <div className="ml-auto mr-2 w-2 h-2 bg-[#3baca5] rounded-full flex-shrink-0" />}
        </button>
      </li>
    );
  };

  const PageComponent = activePage?.component;

  return (
    <div className="min-h-screen bg-[#121212] text-white w-full overflow-hidden">
      <RoboticLogoutModal isOpen={showLogoutModal} onCancel={() => setShowLogoutModal(false)} />

      <div className="w-full flex relative">
        {isMobile && (
          <button
            type="button"
            aria-label="Open menu"
            className="fixed top-4 left-4 z-50 h-10 w-10 flex items-center justify-center bg-[#1E1E1E] rounded-full shadow-lg text-[#3baca5]"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <Menu className="h-6 w-6" />
          </button>
        )}

        {/* Sidebar */}
        <aside
          ref={sidebarRef}
          className={`transition-all duration-500 ease-in-out z-50 bg-[#1E1E1E] border-r border-gray-800 fixed top-0 left-0 flex flex-col gap-2 sm:gap-8 h-screen py-4
            ${isMobile ? (mobileMenuOpen ? "translate-x-0 w-64 px-4" : "-translate-x-full w-64 px-4") : sidebarOpen ? "w-64 px-4" : "w-20 px-2"}`}
        >
          <div className={`flex gap-2 items-center ${sidebarOpen ? "sm:justify-between" : "sm:justify-center"} relative z-30`}>
            {showLabels ? (
              <img src={enovaWordmark} className="h-10 w-auto max-w-[180px] object-contain" alt="Enova Robotics" />
            ) : (
              <img src={enovaIcon} className="h-9 w-9 object-contain" alt="Enova Robotics" />
            )}
            {isMobile ? (
              <button type="button" aria-label="Close menu" className="h-8 w-8 flex justify-center items-center text-gray-400" onClick={() => setMobileMenuOpen(false)}>
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
            ) : (
              <button
                type="button"
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                className="h-8 w-8 hidden sm:flex justify-center items-center rounded-full bg-gray-800 hover:bg-gray-700 text-[#3baca5] transition-all duration-300 absolute -right-4"
                onClick={() => setSidebarOpen((open) => !open)}
              >
                <ChevronRight className={`w-5 h-5 transition-transform duration-300 ${sidebarOpen ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>

          {/* Current user */}
          <div className={`flex items-center gap-3 p-3 mb-6 border-b border-gray-800 pb-4 ${showLabels ? "" : "justify-center"}`}>
            <Initials user={user} className="h-10 w-10" />
            {showLabels && (
              <div className="flex flex-col overflow-hidden">
                <span className="font-medium text-sm text-white whitespace-nowrap text-ellipsis overflow-hidden">
                  {user?.firstName} {user?.lastName}
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap text-ellipsis overflow-hidden">
                  {ROLE_LABELS[user?.role] || user?.role}
                </span>
              </div>
            )}
          </div>

          <nav className="flex flex-col flex-grow overflow-y-auto mt-5 relative z-10">
            <ul className="px-1 flex-grow overflow-y-auto">{navigation.map(renderNavItem)}</ul>
            <ul className="px-1 mt-auto border-t border-gray-700 pt-4">
              {COMMON_PAGES.map(renderFooterItem)}
              <li>
                <button type="button" className={navItemClass(false)} onClick={() => setShowLogoutModal(true)} title={showLabels ? undefined : "Logout"}>
                  <div className="text-gray-400 flex items-center justify-center w-8 h-8 flex-shrink-0">
                    <FaSignOutAlt className="w-5 h-5" />
                  </div>
                  {showLabels && <span className="font-medium text-base text-gray-300 whitespace-nowrap">Logout</span>}
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <div className={`transition-all duration-500 ease-in-out flex-1 flex flex-col min-h-screen bg-[#121212] ${isMobile ? "w-full" : sidebarOpen ? "ml-64" : "ml-20"}`}>
          <header className={`${getHeaderGradient(now)} transition-all duration-1000 shadow-lg p-4 md:p-6 flex justify-between items-center relative overflow-hidden`}>
            <div className="absolute inset-0 opacity-10">
              <CircuitPattern id="circuit-header" />
            </div>

            <div className={`flex justify-between w-full items-center z-10 ${isMobile ? "px-2" : ""}`}>
              <div className={`flex flex-col ${isMobile ? "ml-10" : ""}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-white ${isMobile || isSmallScreen ? "text-xl" : "text-2xl"} break-words max-w-[400px]`}>
                    {getGreeting(now)}, {user?.firstName}!
                  </span>
                  {!isMobile && (
                    <button type="button" aria-label="Notifications" className="relative ml-4" onClick={() => setActivePage("notifications")}>
                      <Bell className="w-5 h-5 text-white hover:text-[#3baca5] transition-colors duration-300" />
                      <NotificationBadge />
                    </button>
                  )}
                </div>
                <span className={`${isMobile ? "text-xs" : "text-sm mt-1"} font-normal text-gray-200 break-words max-w-[400px]`}>{formattedDate}</span>
              </div>

              <div className="flex items-center gap-2 md:gap-4">
                {isMobile && (
                  <button type="button" aria-label="Notifications" className="relative" onClick={() => setActivePage("notifications")}>
                    <Bell className="w-5 h-5 text-white" />
                    <NotificationBadge />
                  </button>
                )}
                {!isMobile && (
                  <div className="flex gap-2">
                    {pages.calendar && (
                      <button type="button" aria-label="Calendar" className="h-10 w-10 flex items-center justify-center rounded-full bg-[#2A2A2A]/80 text-gray-400 hover:text-[#3baca5] transition-colors duration-300" onClick={() => setActivePage("calendar")}>
                        <Grid className="h-5 w-5" />
                      </button>
                    )}
                    {pages.attendance && (
                      <button type="button" aria-label="Attendance" className="h-10 w-10 flex items-center justify-center rounded-full bg-[#2A2A2A]/80 text-gray-400 hover:text-[#3baca5] transition-colors duration-300" onClick={() => setActivePage("attendance")}>
                        <Activity className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}
                <button type="button" aria-label="View profile" className="ml-2 hover:opacity-90 transition-opacity" onClick={() => setActivePage("profile")}>
                  <Initials user={user} className="h-8 w-8 shadow-lg" />
                </button>
              </div>
            </div>
          </header>

          {/* Quick navigation on mobile */}
          {isMobile && (
            <div className="sticky top-14 z-20 bg-[#1A1A1A] border-b border-gray-800 shadow-md overflow-x-auto">
              <div className="flex justify-center py-2 min-w-full">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const target = item.children?.length ? item.children[0].key : item.key;
                  return (
                    <button
                      type="button"
                      key={item.key}
                      className={`flex flex-col items-center justify-center p-2 mx-2 rounded-md ${isActive(item) ? "text-[#3baca5]" : "text-gray-400"}`}
                      onClick={() => setActivePage(target)}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-xs mt-1 whitespace-nowrap">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <main className="flex-1 p-3 md:p-6 relative">
            <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
              <CircuitPattern id="circuit-main" />
            </div>
            {PageComponent && (
              <div className="p-3 md:p-6 mt-3 md:mt-5 bg-[#1E1E1E] rounded-lg shadow-xl border border-gray-800 relative z-10 overflow-x-auto">
                <PageComponent key={activeKey} {...(activePage.props || {})} />
              </div>
            )}
            <ChatBot />
          </main>

          <footer className="bg-[#1A1A1A] border-t border-gray-800 p-3 md:p-4 text-center text-xs text-gray-500">
            <p>© {new Date().getFullYear()} Enova Robotics • All Rights Reserved</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
