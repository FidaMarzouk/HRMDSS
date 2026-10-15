import { useState, useEffect } from "react";
import { useChartColors } from "../../../theme/theme";
import LeaveStatusBadge from "../../../features/leave/LeaveStatusBadge";
import CustomDatePicker from '../../../components/ui/datePicker';
import api, { errorMessage } from '../../../lib/api';
import { formatDay } from '../../../lib/dates';
import {
  BarChart,
  LineChart,
  PieChart,
  Bar,
  Line,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  Area,
  AreaChart
} from "recharts";
import {
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Timer,
  FileCheck,
  Activity,
  Calendar as CalendarIcon,
  Database,
  MessageSquare,
  Clock3,
  Building,
  Clipboard,
  TrendingDown,
  Loader2,
  MessageCircle,
  MessagesSquare,
  UserCircle
} from "lucide-react";

const ManagerDashboardHomePage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);
  const [departmentLeavesByDay, setDepartmentLeavesByDay] = useState({});
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  });
  
  // Color palette
  const colors = useChartColors();

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          startDate: dateRange.startDate.toISOString().split('T')[0],
          endDate: dateRange.endDate.toISOString().split('T')[0]
        }).toString();
        
        const { data } = await api.get(`/api/manager/dashboard?${queryParams}`);
        setDashboardData(data);
      } catch (err) {
        setError(errorMessage(err, "An error occurred while fetching dashboard data"));
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [dateRange]);

  useEffect(() => {
    // First check if dashboardData exists
    if (!dashboardData) return;
    
    // Process leave data for calendar view when dashboard data changes
    if (dashboardData.leaveManagementMetrics?.departmentLeaveCalendar) {
      // Extract leavesByDay from the data - note the correct property name
      const leavesByDay = dashboardData.leaveManagementMetrics.departmentLeaveCalendar.leavesByDay || {};
      setDepartmentLeavesByDay(leavesByDay);
      
      // Generate calendar days array
      generateCalendarDays(calendarMonth);
    }
  }, [dashboardData, calendarMonth]);
  
  // Function to generate the days array for the calendar
  const generateCalendarDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Get the first day of the month
    const firstDay = new Date(year, month, 1);
    // Get the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Get the day of the week for the first day (0 = Sunday, 6 = Saturday)
    const firstDayOfWeek = firstDay.getDay();
    
    // Calculate total number of days to show (including leading/trailing days from adjacent months)
    const daysInMonth = lastDay.getDate();
    const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
    
    // Create the array of calendar days
    const days = [];
    
    // Add leading empty cells or days from previous month
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevMonthDate = new Date(year, month, -firstDayOfWeek + i + 1);
      days.push(prevMonthDate);
    }
    
    // Add days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Add trailing empty cells or days from next month
    const remainingCells = totalCells - (firstDayOfWeek + daysInMonth);
    for (let i = 1; i <= remainingCells; i++) {
      const nextMonthDate = new Date(year, month + 1, i);
      days.push(nextMonthDate);
    }
    
    setCalendarDays(days);
  };
  
  // Function to handle month navigation
  const handleMonthChange = (increment) => {
    setCalendarMonth(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + increment);
      return newDate;
    });
  };

  // Handle date range changes
  const handleStartDateChange = (newDate) => {
    setDateRange(prev => ({ ...prev, startDate: newDate }));
  };

  const handleEndDateChange = (newDate) => {
    setDateRange(prev => ({ ...prev, endDate: newDate }));
  };

  const getTimeSinceHire = (hireDate) => {
    const months = Math.floor((new Date() - new Date(hireDate)) / (1000 * 60 * 60 * 24 * 30));
    if (months < 1) return 'New';
    if (months === 1) return '1 month';
    return `${months} months`;
  };
  
  const getAgeColor = (hireDate) => {
    const months = Math.floor((new Date() - new Date(hireDate)) / (1000 * 60 * 60 * 24 * 30));
    if (months < 3) return colors.chartColors[0];
    if (months < 6) return colors.chartColors[1];
    if (months < 12) return colors.chartColors[2];
    return colors.chartColors[3];
  };
    // Custom tooltip for charts
    const CustomTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-raise p-3 rounded-lg border border-line shadow-lg">
            <p className="text-ink">{`${label}`}</p>
            {payload.map((entry, index) => (
              <p key={`item-${index}`} style={{ color: entry.color || colors.primary }}>
                {`${entry.name}: ${entry.value}`}
              </p>
            ))}
          </div>
        );
      }
      return null;
    };
    // Custom tooltip for pie charts
  const PieChartTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      // For pie charts, the data structure is different
      const data = payload[0].payload;
      
      return (
        <div className="bg-raise p-3 rounded-lg border border-line shadow-lg">
          <p className="text-ink font-medium">{data.skill}</p>
          <p style={{ color: payload[0].color || colors.primary }}>
            Count: {data.count}
          </p>
        </div>
      );
    }
    return null;
  };

  // Navigation sections
  const sections = [
    { id: "overview", label: "Overview", icon: <Database size={20} /> },
    { id: "attendance", label: "Team Attendance", icon: <Clock size={20} /> },
    { id: "leave", label: "Leave Management", icon: <Calendar size={20} /> },
    { id: "calendar", label: "Calendar", icon: <CalendarIcon size={20} /> },
    { id: "productivity", label: "Team Productivity", icon: <Activity size={20} /> },
    { id: "communication", label: "Communication", icon: <MessageSquare size={20} /> },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-teal border-r-teal/70 border-b-line border-l-line rounded-full animate-spin"></div>
          <p className="text-ink">Loading your dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center p-4">
        <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-8 max-w-md w-full">
          <AlertCircle className="w-16 h-16 text-red mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-ink text-center mb-2">Error Loading Dashboard</h4>
          <p className="text-ink-2 text-center mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-teal text-on-accent py-3 rounded-lg transition-shadow"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-ground flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-teal border-r-teal/70 border-b-line border-l-line rounded-full animate-spin"></div>
          <p className="text-ink">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ground relative">
      {/* Dashboard Layout */}
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="mb-4 md:mb-0">
            <h2 className="text-ink text-2xl md:text-3xl font-bold flex items-center">
              <Building className="w-8 h-8 mr-3 text-teal" /> 
              {dashboardData.managerData?.name || 'Manager'} Dashboard
            </h2>
            <p className="text-ink-2 flex items-center mt-1">
              {dashboardData.managerData?.department} Department 
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
          <div className="flex gap-2">
            <CustomDatePicker
              selectedDate={dateRange.startDate}
              onChange={handleStartDateChange}
              className="bg-raise text-ink"
            />
            <CustomDatePicker
              selectedDate={dateRange.endDate}
              onChange={handleEndDateChange}
              className="bg-raise text-ink"
            />
        </div>
            
            <div className="flex flex-wrap justify-center gap-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm transition-all ${
                    activeSection === section.id
                      ? "bg-teal text-on-accent"
                      : "bg-raise text-ink-2 hover:bg-sunk hover:text-ink"
                  }`}
                >
                  <span className="mr-2">{section.icon}</span> {section.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Team Attendance Rate */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Team Attendance Rate</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.teamAttendanceMetrics?.attendanceRate?.rate.toFixed(1) || 0}%
                  </h3>
                </div>
                <CheckCircle className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                {dashboardData.teamAttendanceMetrics?.attendanceRate?.actualAttendance || 0} of {dashboardData.teamAttendanceMetrics?.attendanceRate?.expectedAttendance || 0} expected attendances
              </p>
            </div>

            {/* Pending Leave Requests */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Pending Leave Requests</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.leaveManagementMetrics?.pendingLeaveRequests?.count || 0}
                  </h3>
                </div>
                <Clipboard className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                {dashboardData.leaveManagementMetrics?.leaveApprovalRate?.approvalRate.toFixed(1) || 0}% approval rate
              </p>
            </div>

            {/* Team Avg Production Hours */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Avg Production Hours</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.teamProductivity?.avgProductionHours?.overallAverage || 0}h
                  </h3>
                </div>
                <Timer className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                Per team member daily average
              </p>
            </div>

            {/* Unread Messages */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
            <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-ink-2">Unread Messages</p>
                    <h3 className="text-ink text-2xl font-bold mt-1">
                      {dashboardData.communicationMetrics?.unreadMessagesCount?.totalUnreadMessages || 0}
                    </h3>
                  </div>
                  <MessagesSquare className="text-teal w-8 h-8" />
                </div>
                <p className="text-ink-2 text-sm">
                  {dashboardData.communicationMetrics?.unreadMessagesCount?.totalUnreadNotifications || 0} pending notifications
                </p>
            </div>

            {/* Skills distribution */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <p className="text-ink text-lg font-bold mb-4">Team Skills Distribution</p>
              
              <div className="flex flex-col md:flex-row gap-5">
                {/* Left side: Stats & Skills Gaps */}
                <div className="flex-1 flex flex-col">
                  {/* Average Skills card */}
                  <div className="bg-raise rounded-xl p-4 border-l-4 border-teal mb-4">
                    <p className="mb-1 text-sm text-ink-2">AVERAGE SKILLS PER EMPLOYEE</p>
                    <div className="flex items-end gap-1">
                      <p className="text-teal text-3xl font-bold">
                        {dashboardData.teamComposition?.skillsDistribution?.averageSkillsPerEmployee?.toFixed(1) || 0}
                      </p>
                      <p className="text-ink-2 text-sm mb-1">skills</p>
                    </div>
                  </div>
                  
                  {/* Skills Gaps */}
                  {dashboardData.teamComposition?.skillsDistribution?.skillsGaps?.length > 0 && (
                    <div className="bg-raise rounded-xl p-4 flex-1">
                      <p className="font-medium mb-3 text-ink-2">Skills Gaps (Single-employee skills)</p>
                      <div className="flex flex-wrap gap-2">
                        {dashboardData.teamComposition?.skillsDistribution?.skillsGaps?.map((item, idx) => (
                          <div 
                            key={idx} 
                            className="px-3 py-1.5 rounded-full text-sm flex items-center"
                            style={{ 
                              backgroundColor: `${colors.chartColors[idx % colors.chartColors.length]}20`, 
                              borderLeft: `3px solid ${colors.chartColors[idx % colors.chartColors.length]}` 
                            }}
                          >
                            <span className="text-ink">{item.skill}</span>
                            <span 
                              className="text-xs ml-2 px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${colors.chartColors[idx % colors.chartColors.length]}40` }}
                            >
                              {item.employee.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Right side: Chart area with legend next to pie chart */}
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row items-center">
                    {/* Legend section */}
                    <div className="flex flex-col justify-center space-y-7 md:w-2/5 lg:w-2/5 px-2">
                      {dashboardData.teamComposition?.skillsDistribution?.topSkills?.map((skill, idx) => (
                        <div key={idx} className="flex items-start">
                          <div 
                            className="w-3 h-3 rounded-full mr-2 mt-1" 
                            style={{ backgroundColor: colors.chartColors[idx % colors.chartColors.length] }}
                          ></div>
                          <div className="flex-1">
                            <p 
                              className="text-ink-2 text-sm break-words" 
                              title={skill.skill}
                            >
                              {skill.skill} ({skill.count})
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Pie Chart */}
                    <div className="md:w-2/3 min-h-[230px] flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={230}>
                        <PieChart>
                          <Pie
                            data={dashboardData.teamComposition?.skillsDistribution?.topSkills || []}
                            cx="50%"
                            cy="50%"
                            outerRadius={85}
                            innerRadius={50}
                            dataKey="count"
                            labelLine={false}
                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          >
                            {dashboardData.teamComposition?.skillsDistribution?.topSkills?.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={colors.chartColors[index % colors.chartColors.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<PieChartTooltip/>} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Tenure Distribution */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <p className="text-ink text-lg font-bold mb-4">Team Tenure</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:h-80 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: "< 6 months", value: dashboardData.teamComposition?.departmentHiringTimeline?.tenureDistribution?.lessThan6Months || 0 },
                        { name: "6-12 months", value: dashboardData.teamComposition?.departmentHiringTimeline?.tenureDistribution?.sixToTwelveMonths || 0 },
                        { name: "1-2 years", value: dashboardData.teamComposition?.departmentHiringTimeline?.tenureDistribution?.oneToTwoYears || 0 },
                        { name: "2-5 years", value: dashboardData.teamComposition?.departmentHiringTimeline?.tenureDistribution?.twoToFiveYears || 0 },
                        { name: "> 5 years", value: dashboardData.teamComposition?.departmentHiringTimeline?.tenureDistribution?.moreThanFiveYears || 0 }
                      ]}
                      margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} opacity={0.3} />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: colors.axis }} 
                        tickLine={{ stroke: colors.grid }}
                        axisLine={{ stroke: colors.grid }}
                      />
                      <YAxis 
                        tick={{ fill: colors.axis }} 
                        tickLine={{ stroke: colors.grid }}
                        axisLine={{ stroke: colors.grid }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <defs>
                        {[0, 1, 2, 3, 4].map((entry, index) => (
                          <linearGradient key={`gradient-${index}`} id={`colorGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={colors.chartColors[index % colors.chartColors.length]} stopOpacity={1} />
                            <stop offset="95%" stopColor={colors.chartColors[index % colors.chartColors.length]} stopOpacity={0.4} />
                          </linearGradient>
                        ))}
                      </defs>
                      <Bar 
                        dataKey="value" 
                        name="Employees" 
                        radius={[8, 8, 0, 0]}
                        label={{ position: 'top', fill: colors.text, fontSize: 12 }}
                      >
                        {[0, 1, 2, 3, 4].map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#colorGradient${index})`}
                            stroke={colors.chartColors[index % colors.chartColors.length]} 
                            strokeWidth={1}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-between h-full">
                  <div className="bg-raise rounded-xl p-4 mb-4 border-l-4 border-teal">
                    <p className="text-ink-2">Average Tenure</p>
                    <div className="flex items-end gap-2">
                      <h3 className="text-ink text-3xl font-bold mt-1">
                        {dashboardData.teamComposition?.departmentHiringTimeline?.averageTenureMonths || 0}
                      </h3>
                      <p className="text-ink-2 mb-1">months</p>
                    </div>
                  </div>
                  <div className="bg-raise rounded-xl p-4 flex-grow">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-ink-2">Recent Hires</p>
                      <div className="bg-teal/10 px-2 py-1 rounded-full">
                        <p className="text-teal text-xs font-medium">
                          {dashboardData.teamComposition?.departmentHiringTimeline?.recentHires?.length || 0} new
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {dashboardData.teamComposition?.departmentHiringTimeline?.recentHires?.map((hire, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center gap-3 pb-3 border-b border-line last:border-0 hover:bg-sunk p-2 rounded-lg transition-colors"
                        >
                          <div className="bg-teal/10 rounded-full p-2">
                            <UserCircle className="text-teal w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <p className="text-ink text-sm font-medium">{hire.name}</p>
                            <p className="text-ink-2 text-xs">
                              {hire.position} • {formatDay(hire.hireDate)}
                            </p>
                          </div>
                          <div className="rounded-full px-2 py-1 text-xs" style={{
                            backgroundColor: getAgeColor(hire.hireDate),
                            color: colors.text
                          }}>
                            {getTimeSinceHire(hire.hireDate)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>


        </div>
        )}

        {/* Team Attendance Section */}
        {activeSection === "attendance" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Attendance Rate */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Team Attendance Rate</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.teamAttendanceMetrics?.attendanceRate?.rate.toFixed(1) || 0}%
                  </h3>
                </div>
                <CheckCircle className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                {dashboardData.teamAttendanceMetrics?.attendanceRate?.actualAttendance || 0} of {dashboardData.teamAttendanceMetrics?.attendanceRate?.expectedAttendance || 0} expected attendances
              </p>
            </div>

            {/* Absenteeism Rate */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Absenteeism Rate</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.teamAttendanceMetrics?.absenteeismRate?.rate.toFixed(1) || 0}%
                  </h3>
                </div>
                <AlertCircle className="text-red w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                {dashboardData.teamAttendanceMetrics?.absenteeismRate?.absentDays || 0} absent days, {dashboardData.teamAttendanceMetrics?.absenteeismRate?.approvedLeaveDays || 0} approved leave days
              </p>
            </div>

            {/* Average Check-In Time */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Avg Check-In Time</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.teamAttendanceMetrics?.avgCheckTimes?.averageCheckIn || "N/A"}
                  </h3>
                </div>
                <Clock3 className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                Check-out: {dashboardData.teamAttendanceMetrics?.avgCheckTimes?.averageCheckOut || "N/A"}
              </p>
            </div>

            {/* Working Days */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Working Days</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.teamAttendanceMetrics?.absenteeismRate?.workDays || 0}
                  </h3>
                </div>
                <Calendar className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                In selected period
              </p>
            </div>

            {/* Late Arrivals Trend Chart */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <p className="text-ink text-lg font-bold mb-4">Late Arrivals Trend</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dashboardData.teamAttendanceMetrics?.lateArrivalsTrend || []}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="lateArrivalsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.danger} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={colors.danger} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: colors.axis, fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: colors.axis, fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="Late Arrivals"
                      stroke={colors.danger}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#lateArrivalsGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Leave Management Section */}
        {activeSection === "leave" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Pending Requests */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Pending Requests</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.leaveManagementMetrics?.pendingLeaveRequests?.count || 0}
                  </h3>
                </div>
                <Clipboard className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                Need your attention
              </p>
            </div>

            {/* Approval Rate */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Approval Rate</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.leaveManagementMetrics?.leaveApprovalRate?.approvalRate.toFixed(1) || 0}%
                  </h3>
                </div>
                <CheckCircle className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                {dashboardData.leaveManagementMetrics?.leaveApprovalRate?.approvedRequests || 0} approved, {dashboardData.leaveManagementMetrics?.leaveApprovalRate?.rejectedRequests || 0} rejected
              </p>
            </div>

            {/* Total Requests */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Total Requests</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.leaveManagementMetrics?.leaveApprovalRate?.totalRequests || 0}
                  </h3>
                </div>
                <Calendar className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                In selected period
              </p>
            </div>

            {/* Leave Types */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Main Leave Type</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.leaveManagementMetrics?.leaveDistribution?.[0]?.type || "N/A"}
                  </h3>
                </div>
                <FileCheck className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                {dashboardData.leaveManagementMetrics?.leaveDistribution?.[0]?.days || 0} days total
              </p>
            </div>

            {/* Leave Distribution Chart */}
            <div className="col-span-1 md:col-span-2 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <p className="text-ink text-lg font-bold mb-4">Leave Distribution by Type</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.leaveManagementMetrics?.leaveDistribution || []}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill={colors.chartColors[4]}
                      dataKey="days"
                      nameKey="type"
                      label={({ type, days }) => `${type}: ${days}`}
                    >
                      {(dashboardData.leaveManagementMetrics?.leaveDistribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors.chartColors[index % colors.chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Leave Summary */}
            <div className="col-span-1 md:col-span-2 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
            <div className="flex justify-between items-center mb-6">
                <p className="text-ink text-lg font-bold">Summary</p>
            </div>
            
            <div className="flex flex-col gap-6">
                {/* Approval Rate Section */}
                <div className="flex flex-col">
                <p className="text-ink-2 mb-3">Approval Rate</p>
                <div className="flex items-center mb-2">
                    <div className="w-full bg-sunk rounded-full h-3 mr-2">
                    <div
                        className="bg-teal h-3 rounded-full"
                        style={{ width: `${dashboardData.leaveManagementMetrics?.leaveApprovalRate?.approvalRate || 0}%` }}
                    ></div>
                    </div>
                    <span className="text-ink ml-2">{(dashboardData.leaveManagementMetrics?.leaveApprovalRate?.approvalRate || 0).toFixed(1)}%</span>
                </div>
                <p className="text-ink-2 text-sm">
                    Team average
                </p>
                </div>
                
                {/* Total Leave Days Section */}
                <div className="flex flex-col mt-2">
                <p className="text-ink-2 mb-3">Total Leave Days</p>
                <p className="text-ink text-2xl font-bold mb-2">
                    {dashboardData.leaveManagementMetrics?.leaveDistribution?.reduce((acc, curr) => acc + curr.days, 0) || 0}
                </p>
                <p className="text-ink-2 text-sm">
                    In selected period
                </p>
                </div>
            </div>
            </div>

            {/* Department Leave Calendar */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
            <p className="text-ink text-lg font-bold mb-4">Department Leave Calendar</p>
            
            <div className="mb-4">
                <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-teal rounded-full mr-2"></span>
                    <span className="text-ink-2 text-sm">Manager Approved</span>
                </div>
                <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-blue rounded-full mr-2"></span>
                    <span className="text-ink-2 text-sm">Admin Approved</span>
                </div>
                <div className="flex items-center">
                    <span className="inline-block w-3 h-3 bg-red rounded-full mr-2"></span>
                    <span className="text-ink-2 text-sm">CEO Approved</span>
                </div>
                </div>
            </div>
            
            {dashboardData?.leaveManagementMetrics?.departmentLeaveCalendar?.leavesList?.length > 0 ? (
                <div className="overflow-x-auto">
                {/* Calendar Header - Month and Navigation */}
                <div className="flex justify-between items-center mb-4">
                    <button 
                    className="p-2 rounded hover:bg-sunk text-ink"
                    onClick={() => handleMonthChange(-1)}
                    >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                    </button>
                    <div className="text-ink font-medium text-lg">
                    {new Date(calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                    <button 
                    className="p-2 rounded hover:bg-sunk text-ink"
                    onClick={() => handleMonthChange(1)}
                    >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                    </button>
                </div>
                
                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                    {/* Days of week header */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-ink-2 font-medium pb-2">
                        {day}
                    </div>
                    ))}
                    
                    {/* Calendar cells */}
                    {calendarDays.map((day, index) => {
                    const dateStr = day ? day.toISOString().split('T')[0] : '';
                    const dayLeaves = day ? departmentLeavesByDay[dateStr] || [] : [];
                    const isWeekend = day && (day.getDay() === 0 || day.getDay() === 6);
                    const isCurrentMonth = day && day.getMonth() === new Date(calendarMonth).getMonth();
                    
                    return (
                        <div 
                        key={index} 
                        className={`
                            min-h-24 border border-line rounded p-1
                            ${!day ? 'bg-transparent' : ''}
                            ${isWeekend ? 'bg-raise' : 'bg-raise'}
                            ${!isCurrentMonth ? 'opacity-40' : ''}
                        `}
                        >
                        {day && (
                            <>
                            <div className="text-right text-sm text-ink-2 mb-1">
                                {day.getDate()}
                            </div>
                            <div className="overflow-y-auto max-h-20">
                                {dayLeaves.map(leave => {
                                let bgColor = "bg-teal/10 border-line text-teal";
                                if (leave.status === "Admin Approved") {
                                    bgColor = "bg-blue/10 border-blue/40 text-blue";
                                } else if (leave.status === "CEO Approved") {
                                    bgColor = "bg-red/10 border-red/40 text-red";
                                }
                                
                                return (
                                    <div 
                                    key={`${leave.id}-${dateStr}`}
                                    className={`text-xs rounded px-1 py-0.5 mb-1 truncate border ${bgColor}`}
                                    title={`${leave.employee}: ${leave.reason}`}
                                    >
                                    {leave.employee}
                                    </div>
                                );
                                })}
                            </div>
                            </>
                        )}
                        </div>
                    );
                    })}
                </div>
                
                {/* Simple Leave List Below Calendar */}
                <div className="mt-6">
                <p className="text-ink text-sm font-semibold mb-2">Approved Leaves This Month</p>
                <div className="overflow-y-auto max-h-40">
                    {dashboardData.leaveManagementMetrics?.departmentLeaveCalendar?.leavesList.map((leave) => {
                    return (
                        <div key={leave.id} className="py-2 border-b border-line text-sm">
                        <div className="flex justify-between">
                            <span className="text-ink font-medium">{leave.employee}</span>
                            <LeaveStatusBadge status={leave.status} />
                        </div>
                        <div className="text-ink-2">
                            {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                            {' • '}{leave.reason}
                        </div>
                        </div>
                    );
                    })}
                </div>
                </div>
                </div>
                ) : (
                    <div className="text-center py-8">
                    <p className="text-ink-2">No approved leaves in the selected period</p>
                    </div>
                )}
            </div>

            {/* Leave Statistics */}
            <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
            <p className="text-ink text-lg font-bold mb-4">Leave Approval Statistics</p>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={[
                    {
                        name: "Approved",
                        value: dashboardData.leaveManagementMetrics?.leaveApprovalRate?.approvedRequests || 0,
                        fill: colors.primary
                    },
                    {
                        name: "Rejected",
                        value: dashboardData.leaveManagementMetrics?.leaveApprovalRate?.rejectedRequests || 0,
                        fill: colors.danger
                    },
                    {
                        name: "Pending",
                        value: dashboardData.leaveManagementMetrics?.leaveApprovalRate?.pendingRequests || 0,
                        fill: colors.chartColors[1]
                    }
                    ]}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis dataKey="name" stroke={colors.axis} />
                    <YAxis stroke={colors.axis} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Requests" radius={[4, 4, 0, 0]}>
                    {[0, 1, 2].map((entry, index) => (
                        <Cell 
                        key={`cell-${index}`} 
                        fill={
                            index === 0 ? colors.primary : 
                            index === 1 ? colors.danger : colors.chartColors[1]
                        } 
                        />
                    ))}
                    </Bar>
                </BarChart>
                </ResponsiveContainer>
            </div>
            </div>

            {/* Monthly Leave Distribution */}
            <div className="col-span-1 md:col-span-2 lg:col-span-2 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
            <p className="text-ink text-lg font-bold mb-4">Top Leave Types</p>
            <div className="overflow-y-auto h-72">
                <table className="w-full table-auto">
                <thead>
                    <tr className="text-left border-b border-line">
                    <th className="pb-3 text-ink-2">Type</th>
                    <th className="pb-3 text-ink-2">Days</th>
                    <th className="pb-3 text-ink-2">Count</th>
                    </tr>
                </thead>
                <tbody>
                    {dashboardData.leaveManagementMetrics?.leaveDistribution?.map((item, index) => (
                    <tr key={index} className="border-b border-line hover:bg-sunk">
                        <td className="py-3 text-ink">{item.type}</td>
                        <td className="py-3 text-ink">{item.days}</td>
                        <td className="py-3 text-ink">{item.count}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
                
                {(!dashboardData.leaveManagementMetrics?.leaveDistribution || 
                dashboardData.leaveManagementMetrics?.leaveDistribution.length === 0) && (
                <div className="text-center py-8">
                    <p className="text-ink-2">No leave data available</p>
                </div>
                )}
            </div>
            </div>


          </div>
        )}

        {/* Calendar Section */}
        {activeSection === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
            {/* Upcoming Events */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
            <div className="flex justify-between items-center mb-4">
                <p className="text-ink text-lg font-bold">Upcoming Events</p>
            </div>
            <div className="overflow-y-auto max-h-80">
                <table className="min-w-full">
                <thead>
                    <tr className="border-b border-line">
                    <th className="py-3 text-left text-sm font-medium text-ink-2">Event</th>
                    <th className="py-3 text-left text-sm font-medium text-ink-2">Date</th>
                    <th className="py-3 text-left text-sm font-medium text-ink-2">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {(dashboardData.calendarMetrics?.upcomingEvents || []).slice(0, 5).map((event, index) => (
                    <tr key={index} className="border-b border-line hover:bg-sunk">
                        <td className="py-3">
                        <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${
                            event.type === 'meeting' ? 'bg-blue' : 
                            event.type === 'event' ? 'bg-violet' : 'bg-amber'
                            }`}></div>
                            <span className="text-ink">{event.title}</span>
                        </div>
                        </td>
                        <td className="py-3 text-ink">
                        {new Date(event.startDateTime).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                            event.status === 'scheduled' ? 'bg-teal/10 text-teal' :
                            event.status === 'cancelled' ? 'bg-red/10 text-red' : 
                            'bg-amber/10 text-amber'
                        }`}>
                            {event.status}
                        </span>
                        </td>
                    </tr>
                    ))}
                    {(dashboardData.calendarMetrics?.upcomingEvents || []).length === 0 && (
                    <tr>
                        <td colSpan="3" className="py-3 text-center text-ink-2">No upcoming events</td>
                    </tr>
                    )}
                </tbody>
                </table>
            </div>
            </div>

{/* Event Participation Rate */}
<div className="col-span-1 md:col-span-2 lg:col-span-4 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
  <p className="text-ink text-lg font-bold mb-4">Event Participation</p>
  
  {/* Overall Participation Rate Bar */}
  <div className="flex items-center mb-6">
    <div className="w-full bg-sunk rounded-full h-3 mr-2">
      <div
        className="bg-teal h-3 rounded-full"
        style={{ width: `${dashboardData.calendarMetrics?.eventParticipationRates?.overallParticipationRate || 0}%` }}
      ></div>
    </div>
    <span className="text-ink ml-2">{dashboardData.calendarMetrics?.eventParticipationRates?.overallParticipationRate || 0}%</span>
  </div>
  <p className="text-ink-2 text-sm mb-4">
    Overall participation rate
  </p>
  
  {/* Event Type Stats */}
  <div className="grid grid-cols-2 gap-4 mb-6">
    {Object.entries(dashboardData.calendarMetrics?.eventParticipationRates?.eventTypes || {}).map(([type, stats], index) => (
      <div key={index} className="bg-sunk rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-ink capitalize">{type}</span>
          <span className="text-ink font-medium">{stats.participationRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between text-xs text-ink-2">
          <span>Accepted: {stats.accepted}</span>
          <span>Total: {stats.total}</span>
        </div>
      </div>
    ))}
  </div>
  </div>
  
  {/* Weekly Trend Chart */}
{/* Event Participation Rate */}
<div className="col-span-1 md:col-span-2 lg:col-span-4 bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
  <p className="text-ink text-lg font-bold mb-4">Weekly Participation Trend</p>
    <div className="w-full h-64 bg-sunk rounded-lg p-4">
      {dashboardData.calendarMetrics?.eventParticipationRates?.trendByWeek?.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={dashboardData.calendarMetrics.eventParticipationRates.trendByWeek}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis 
              dataKey="week" 
              stroke={colors.axis} 
              tick={{ fill: colors.axis, fontSize: 10 }}
              tickFormatter={(value) => value.split('-W')[1]} // Just show week number
            />
            <YAxis 
              stroke={colors.axis} 
              tick={{ fill: colors.axis, fontSize: 10 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: colors.background, border: '1px solid #555' }}
              labelStyle={{ color: colors.text }}
              formatter={(value) => [`${value}%`, 'Participation Rate']}
              labelFormatter={(value) => `Week ${value.split('-W')[1]}`}
            />
            <Line 
              type="monotone" 
              dataKey="participationRate" 
              stroke={colors.primary} 
              strokeWidth={2}
              dot={{ r: 4, fill: colors.primary }}
              activeDot={{ r: 6, fill: colors.secondary }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-ink-2">
          No trend data available
        </div>
      )}
    </div>
    
    {/* Legend */}
    <div className="flex justify-end items-center mt-2">
      <div className="flex items-center">
        <div className="w-3 h-3 rounded-full bg-teal mr-1"></div>
        <span className="text-xs text-ink-2">Participation Rate</span>
      </div>
    </div>
  </div>


        </div>
        )}

        {/* Team Productivity Section */}
        {activeSection === "productivity" && (
        <div className="space-y-6">
            {/* Top Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Average Production Hours Card */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-ink-2">Avg Production Hours</p>
                    <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.teamProductivity?.avgProductionHours?.overallAverage || 0}h
                    </h3>
                </div>
                <Timer className="text-teal w-8 h-8" />
                </div>
                <p className="text-ink-2 text-sm">
                Per team member daily average
                </p>
            </div>

            {/* Overtime Trend Card */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-ink-2">Total Overtime</p>
                    <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.teamProductivity?.overtimeTrends?.reduce((sum, day) => sum + (day.totalHours || 0), 0).toFixed(1) || 0}h
                    </h3>
                </div>
                <Clock3 className="text-teal w-8 h-8" />
                </div>
                <p className="text-ink-2 text-sm">
                {dashboardData.teamProductivity?.overtimeTrends?.length || 0} days with overtime logged
                </p>
            </div>
            </div>

            {/* Overtime Trends Chart */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <p className="text-ink text-lg font-bold mb-4">Overtime Trends</p>
                <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                    data={dashboardData.teamProductivity?.overtimeTrends || []}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: colors.axis, fontSize: 12 }}
                    />
                    <YAxis 
                        axisLine={false}
                        tickLine={false} 
                        tick={{ fill: colors.axis, fontSize: 12 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                        dataKey="totalHours" 
                        name="Total Overtime Hours" 
                        fill={colors.chartColors[0]} 
                        radius={[4, 4, 0, 0]}
                    />
                    <Bar 
                        dataKey="averagePerEmployee" 
                        name="Avg Per Employee" 
                        fill={colors.chartColors[1]} 
                        radius={[4, 4, 0, 0]}
                    />
                    </BarChart>
                </ResponsiveContainer>
                </div>
            </div>

 {/* Team Breakdown Section */}
<div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
  <div className="flex justify-between items-center mb-4">
    <p className="text-ink text-lg font-bold">Team Productivity Breakdown</p>
  </div>
  
  {dashboardData.isLoading ? (
    <div className="flex justify-center py-8">
      <Loader2 className="w-8 h-8 text-teal animate-spin" />
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-ink">
        <thead className="text-xs uppercase text-ink-2 border-b border-line">
          <tr>
            <th scope="col" className="py-3 px-4">Team Member</th>
            <th scope="col" className="py-3 px-4">Position</th>
            <th scope="col" className="py-3 px-4">Avg Hours</th>
            <th scope="col" className="py-3 px-4">Overtime</th>
            <th scope="col" className="py-3 px-4">Productivity Score</th>
            <th scope="col" className="py-3 px-4">Trend</th>
          </tr>
        </thead>
        <tbody>
          {dashboardData.teamProductivity.teamMemberProductivity && dashboardData.teamProductivity.teamMemberProductivity.length > 0 ? (
            dashboardData.teamProductivity.teamMemberProductivity.map((member) => (
              <tr key={member.id} className="border-b border-line hover:bg-sunk transition-colors">
                <td className="py-3 px-4 font-medium text-ink">{member.name}</td>
                <td className="py-3 px-4 text-ink-2">{member.position}</td>
                <td className="py-3 px-4">{member.avgHours}h</td>
                <td className="py-3 px-4">
                  {member.overtime > 0 ? (
                    <span className="text-amber">{member.overtime}h</span>
                  ) : (
                    <span>{member.overtime}h</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center">
                    <div className="w-full bg-sunk rounded-full h-2 mr-2">
                      <div 
                        className={`h-2 rounded-full ${
                          member.productivityScore >= 90 ? 'bg-teal' : 
                          member.productivityScore >= 70 ? 'bg-teal' : 
                          member.productivityScore >= 50 ? 'bg-amber' : 'bg-red'
                        }`} 
                        style={{ width: `${member.productivityScore}%` }}
                      ></div>
                    </div>
                    <span>{member.productivityScore}%</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {member.trend === 'up' ? (
                    <div className="flex items-center">
                      <TrendingUp className="text-teal w-4 h-4 mr-1" />
                      <span className="text-xs text-teal">Improving</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <TrendingDown className="text-red w-4 h-4 mr-1" />
                      <span className="text-xs text-red">Declining</span>
                    </div>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="py-6 px-4 text-center text-ink-2">
                No team productivity data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )}
</div>
        </div>
        )}

        {/* Team Communication Section */}
        {activeSection === "communication" && (
          <div className="space-y-6">
            {/* Top Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Unread Messages Card */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-ink-2">Unread Messages</p>
                    <h3 className="text-ink text-2xl font-bold mt-1">
                      {dashboardData.communicationMetrics?.unreadMessagesCount?.totalUnreadMessages || 0}
                    </h3>
                  </div>
                  <MessagesSquare className="text-teal w-8 h-8" />
                </div>
                <p className="text-ink-2 text-sm">
                  {dashboardData.communicationMetrics?.unreadMessagesCount?.totalUnreadNotifications || 0} pending notifications
                </p>
              </div>

              {/* Average Response Time Card */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-ink-2">Avg Response Time</p>
                    <h3 className="text-ink text-2xl font-bold mt-1">
                      {dashboardData.communicationMetrics?.responseTime?.averageResponseTimeMinutes || 0}m
                    </h3>
                  </div>
                  <Clock3 className="text-teal w-8 h-8" />
                </div>
                <p className="text-ink-2 text-sm">
                  {dashboardData.communicationMetrics?.responseTime?.responsesAnalyzed || 0} messages analyzed
                </p>
              </div>

              {/* Team Participation Card */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-ink-2">Team Participation</p>
                    <h3 className="text-ink text-2xl font-bold mt-1">
                      {dashboardData.communicationMetrics?.teamEngagement?.participationRate || 0}%
                    </h3>
                  </div>
                  <MessageCircle className="text-teal w-8 h-8" />
                </div>
                <p className="text-ink-2 text-sm">
                  {dashboardData.communicationMetrics?.teamEngagement?.activeUsers || 0} active team members
                </p>
              </div>
            </div>

            {/* Response Time Distribution Chart */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <p className="text-ink text-lg font-bold mb-4">Response Time Distribution</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { 
                        name: 'Under 5 min', 
                        percentage: Number(dashboardData.communicationMetrics?.responseTime?.responseTimeDistribution?.under5Minutes?.percentage || 0)
                      },
                      { 
                        name: 'Under 15 min', 
                        percentage: Number(dashboardData.communicationMetrics?.responseTime?.responseTimeDistribution?.under15Minutes?.percentage || 0)
                      },
                      { 
                        name: 'Under 60 min', 
                        percentage: Number(dashboardData.communicationMetrics?.responseTime?.responseTimeDistribution?.under60Minutes?.percentage || 0)
                      },
                      { 
                        name: 'Over 60 min', 
                        percentage: Number(dashboardData.communicationMetrics?.responseTime?.responseTimeDistribution?.over60Minutes?.percentage || 0)
                      }
                    ]}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: colors.axis, fontSize: 12 }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false} 
                      tick={{ fill: colors.axis, fontSize: 12 }}
                      domain={[0, 100]}
                      unit="%"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar 
                      dataKey="percentage" 
                      name="Response Percentage" 
                      fill={colors.chartColors[0]} 
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

              {/* Team Engagement Chart */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <p className="text-ink text-lg font-bold mb-4">Daily Message Activity</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={Array.isArray(dashboardData.communicationMetrics?.dailyMessages) ? 
                        dashboardData.communicationMetrics?.dailyMessages : 
                        [{ date: 'N/A', count: 0 }]
                      }
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: colors.axis, fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false} 
                        tick={{ fill: colors.axis, fontSize: 12 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        name="Messages" 
                        stroke={colors.chartColors[0]} 
                        fill={`url(#colorCount)`} 
                      />
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colors.chartColors[0]} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={colors.chartColors[0]} stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
  
            {/* Most Active Users Table */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-center mb-4">
                <p className="text-ink text-lg font-bold">Most Active Team Members</p>
              </div>
              {dashboardData.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 text-teal animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-ink">
                    <thead className="text-xs uppercase text-ink-2 border-b border-line">
                      <tr>
                        <th scope="col" className="py-3 px-4">Team Member</th>
                        <th scope="col" className="py-3 px-4">Message Count</th>
                        <th scope="col" className="py-3 px-4">Activity Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.communicationMetrics?.teamEngagement?.mostActiveUsers &&
                      dashboardData.communicationMetrics.teamEngagement.mostActiveUsers.length > 0 ? (
                        dashboardData.communicationMetrics.teamEngagement.mostActiveUsers.map((member) => {
                          // Calculate activity level based on message count
                          const maxCount = Math.max(...dashboardData.communicationMetrics.teamEngagement.mostActiveUsers.map(u => u.messageCount));
                          const activityPercentage = maxCount > 0 ? (member.messageCount / maxCount) * 100 : 0;
                          return (
                            <tr key={member.userId} className="border-b border-line hover:bg-sunk transition-colors">
                              <td className="py-3 px-4 font-medium text-ink">
                                {member.fullName || `${member.firstName} ${member.lastName}`.trim() || "Unknown User"}
                              </td>
                              <td className="py-3 px-4">{member.messageCount}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center">
                                  <div className="w-full bg-sunk rounded-full h-2 mr-2">
                                    <div
                                      className="h-2 rounded-full bg-teal"
                                      style={{ width: `${activityPercentage}%` }}
                                    ></div>
                                  </div>
                                  <span>{activityPercentage.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="3" className="py-6 px-4 text-center text-ink-2">
                            No team activity data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
export default ManagerDashboardHomePage;

