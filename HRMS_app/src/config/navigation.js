import { Calendar, CalendarDays, Clipboard, Home, Users } from "lucide-react";
import HRDashboardHomepage from "../pages/dashboards/Admin_Dashboard/HRDashboardHomepage";
import ManagerDashboardHomepage from "../pages/dashboards/Manager_Dashboard/ManagerDashboardHomepage";
import EmployeeDashboardHomepage from "../pages/dashboards/Employee_Dashboard/EmployeeDashboardHomepage";
import AttendanceManager from "../pages/Attendance/AttendanceManager";
import AttendanceReports from "../pages/Attendance/AttendanceReports";
import CalendarManager from "../pages/CalendarManager";
import LeaveRequestsPage from "../features/leave/LeaveRequestsPage";
import AdminEmployeesPage from "../features/employees/AdminEmployeesPage";
import EmployeeDirectoryPage from "../features/employees/EmployeeDirectoryPage";

// Sidebar entries for each role. Keys are used in the URL (?page=key).
// Chat, Notifications and Profile are added for everyone by DashboardLayout.

const personalDashboard = {
  key: "personal",
  label: "Personal Dashboard",
  description: "Your personal stats",
  component: EmployeeDashboardHomepage,
  props: { personalView: true },
};

const leave = { key: "leave", label: "Leave Requests", description: "Time off requests", icon: Clipboard, component: LeaveRequestsPage };
const calendar = { key: "calendar", label: "Calendar", description: "Meetings, missions, bookings", icon: CalendarDays, component: CalendarManager };
const attendance = { key: "attendance", label: "Attendance", description: "Punch in/out and breaks", icon: Calendar, component: AttendanceManager };

export const NAVIGATION = {
  admin: [
    {
      key: "home",
      label: "Home",
      description: "Dashboard overview",
      icon: Home,
      children: [
        { key: "home", label: "HR Dashboard", description: "Company overview", component: HRDashboardHomepage },
        personalDashboard,
      ],
    },
    { key: "employees", label: "Employees", description: "Staff and departments", icon: Users, component: AdminEmployeesPage },
    leave,
    attendance,
    calendar,
  ],
  manager: [
    {
      key: "home",
      label: "Home",
      description: "Dashboard overview",
      icon: Home,
      children: [
        { key: "home", label: "Team Dashboard", description: "Team overview", component: ManagerDashboardHomepage },
        personalDashboard,
      ],
    },
    { key: "employees", label: "My Team", description: "Your team members", icon: Users, component: EmployeeDirectoryPage },
    leave,
    attendance,
    calendar,
  ],
  employee: [
    { key: "home", label: "Home", description: "Your dashboard", icon: Home, component: EmployeeDashboardHomepage },
    leave,
    attendance,
    calendar,
  ],
  superAdmin: [
    { key: "home", label: "Home", description: "Company overview", icon: Home, component: HRDashboardHomepage },
    { key: "employees", label: "Directory", description: "Employees and departments", icon: Users, component: EmployeeDirectoryPage },
    leave,
    { key: "attendance", label: "Attendance", description: "Attendance reports", icon: Calendar, component: AttendanceReports },
    calendar,
  ],
};
