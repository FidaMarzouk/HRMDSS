import { useState, useEffect } from "react";
import { Typography } from "@material-tailwind/react";
import CustomDatePicker from '../../../components/ui/datePicker';
import api, { errorMessage, uploadUrl } from '../../../lib/api';
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
  User,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Timer,
  Calendar as CalendarIcon,
  Database,
  Users,
  UserCircle
} from "lucide-react";

const EmployeeDashboardHomePage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  });
  
  // Pulse animation for background

  // Color palette consistent with the HR dashboard theme
  const colors = {
    primary: "#23A49B",
    secondary: "#2c8f8a",
    accent: "#1a7772",
    background: "#1e293b",
    card: "rgba(30, 41, 59, 0.7)",
    text: "#ffffff",
    textSecondary: "#94a3b8",
    border: "rgba(35, 164, 155, 0.3)",
    chartColors: [
      "#0bbfb3", // Deep teal (primary brand color from overlay)
      "#4682B4", // Muted blue (taken from shadows in the image)
      "#E17372", // Soft coral red (for warnings/errors)
      "#0D5C63", // Dark cyan (strong contrast, matches robotic elements)
      "#B2A29E", // Lighter teal (soft but distinct from deep teal)
      "#D98872", // Warm terracotta (more refined alternative to bright coral)
      "#E1B382"  // Muted sandy beige (to complement the overall palette)
    ]
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          startDate: dateRange.startDate.toISOString().split('T')[0],
          endDate: dateRange.endDate.toISOString().split('T')[0]
        }).toString();
        
        const { data } = await api.get(`/api/employee/dashboard?${queryParams}`);
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

    // Handle date range changes
    const handleStartDateChange = (newDate) => {
      setDateRange(prev => ({ ...prev, startDate: newDate }));
    };
  
    const handleEndDateChange = (newDate) => {
      setDateRange(prev => ({ ...prev, endDate: newDate }));
    };

  // Navigation sections
  const sections = [
    { id: "overview", label: "Overview", icon: <Database size={20} /> },
    { id: "attendance", label: "Attendance", icon: <Clock size={20} /> },
    { id: "leave", label: "Leave", icon: <Calendar size={20} /> },
    { id: "calendar", label: "Calendar", icon: <CalendarIcon size={20} /> }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-[#23A49B] border-r-[#23A49B]/70 border-b-[#23A49B]/40 border-l-[#23A49B]/10 rounded-full animate-spin"></div>
          <Typography className="text-white">Loading your dashboard data...</Typography>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-8 max-w-md w-full">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <Typography variant="h4" className="text-white text-center mb-2">Error Loading Dashboard</Typography>
          <Typography className="text-gray-400 text-center mb-6">{error}</Typography>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-[#23A49B] text-white py-3 rounded-lg hover:shadow-[0_0_15px_rgba(35,164,155,0.5)] transition-shadow"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-[#23A49B] border-r-[#23A49B]/70 border-b-[#23A49B]/40 border-l-[#23A49B]/10 rounded-full animate-spin"></div>
          <Typography className="text-white">Loading dashboard data...</Typography>
        </div>
      </div>
    );
  }

  {/* Custom tooltip component for performance chart */}
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-800 p-3 rounded-lg border border-[#23A49B]/30 shadow-lg">
        <p className="text-white font-semibold">{`${label}`}</p>
        <p className="text-[#23A49B] font-medium">{`Performance: ${payload[0].value}%`}</p>
        {payload[0].payload.productionHours && (
          <p className="text-gray-300">{`Production Hours: ${payload[0].payload.productionHours.toFixed(1)}`}</p>
        )}
      </div>
    );
  }
  return null;
};

  return (
    <div className="min-h-screen bg-gray-900 relative">

      {/* Dashboard Layout */}
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="mb-4 md:mb-0">
            <Typography variant="h2" className="text-white text-2xl md:text-3xl font-bold flex items-center">
              <User className="w-8 h-8 mr-3 text-[#23A49B]" /> 
              {dashboardData.userData?.name || 'Employee'} Dashboard
            </Typography>
          </div>
          
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
          <div className="flex gap-2">
            <CustomDatePicker
              selectedDate={dateRange.startDate}
              onChange={handleStartDateChange}
              className="bg-gray-800 text-white"
            />
            <CustomDatePicker
              selectedDate={dateRange.endDate}
              onChange={handleEndDateChange}
              className="bg-gray-800 text-white"
            />
        </div>
            
            <div className="flex flex-wrap justify-center gap-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm transition-all ${
                    activeSection === section.id
                      ? "bg-[#23A49B] text-white"
                      : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-white"
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
            {/* Attendance Rate */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Typography className="text-gray-400">Attendance Rate</Typography>
                  <Typography variant="h3" className="text-white text-2xl font-bold mt-1">
                    {dashboardData.attendanceMetrics?.attendanceRate?.rate || 0}%
                  </Typography>
                </div>
                <CheckCircle className="text-[#23A49B] w-8 h-8" />
              </div>
              <Typography className="text-gray-400 text-sm">
                {dashboardData.attendanceMetrics?.attendanceRate?.presentDays || 0} present days out of {dashboardData.attendanceMetrics?.attendanceRate?.totalWorkdays || 0} workdays
              </Typography>
            </div>

            {/* Punctuality Score */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Typography className="text-gray-400">Punctuality Score</Typography>
                  <Typography variant="h3" className="text-white text-2xl font-bold mt-1">
                    {dashboardData.attendanceMetrics?.punctualityScore?.score || 0}%
                  </Typography>
                </div>
                <Clock className="text-[#23A49B] w-8 h-8" />
              </div>
              <Typography className="text-gray-400 text-sm">
                {dashboardData.attendanceMetrics?.punctualityScore?.onTimeArrivals || 0} on-time arrivals, {dashboardData.attendanceMetrics?.punctualityScore?.lateArrivals || 0} late arrivals
              </Typography>
            </div>

            {/* Production Hours */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Typography className="text-gray-400">Production Hours</Typography>
                  <Typography variant="h3" className="text-white text-2xl font-bold mt-1">
                    {dashboardData.attendanceMetrics?.productionHoursTrend?.totalProductionHours || 0}h
                  </Typography>
                </div>
                <Timer className="text-[#23A49B] w-8 h-8" />
              </div>
              <Typography className="text-gray-400 text-sm">
                Average: {dashboardData.attendanceMetrics?.productionHoursTrend?.averageProductionHours || 0}h per day
              </Typography>
            </div>

            {/* Leave Balance */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <Typography className="text-gray-400">Leave Balance</Typography>
                  <Typography variant="h3" className="text-white text-2xl font-bold mt-1">
                    {dashboardData.leaveMetrics?.leaveBalanceIndicator?.remaining || 0} days
                  </Typography>
                </div>
                <Calendar className="text-[#23A49B] w-8 h-8" />
              </div>
              <Typography className="text-gray-400 text-sm">
                Used: {dashboardData.leaveMetrics?.leaveBalanceIndicator?.used || 0} of {dashboardData.leaveMetrics?.leaveBalanceIndicator?.totalAllowed || 0} days ({dashboardData.leaveMetrics?.leaveBalanceIndicator?.percentageUsed || 0}%)
              </Typography>
            </div>

            {/* Performance Chart */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4">
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <Typography variant="h3" className="text-white text-3xl font-bold">
                      {dashboardData.performanceMetrics?.score || 0}%
                    </Typography>
                    <div className="flex items-center mt-1">
                      <span className={`flex items-center text-sm px-2 py-1 rounded-full bg-[#23A49B]/20 ${dashboardData.performanceMetrics?.vsLastYear >= 0 ? "text-[#23A49B]" : "text-red-400"}`}>
                        <TrendingUp className={`h-4 w-4 mr-1 ${dashboardData.performanceMetrics?.vsLastYear >= 0 ? "" : "transform rotate-180"}`} />
                        {dashboardData.performanceMetrics?.vsLastYear >= 0 ? "+" : ""}{dashboardData.performanceMetrics?.vsLastYear}% vs last years
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={dashboardData.performanceMetrics?.trend || []}
                      margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#23A49B" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#23A49B" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 12 }}
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#23A49B" 
                        strokeWidth={3}
                        fill="url(#performanceGradient)" 
                        activeDot={{ r: 6, fill: "#23A49B", stroke: "#fff" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Team Section */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4">
              {/* Team Header */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                  <Users className="text-[#0bbfb3] w-6 h-6 mr-3" />
                  <Typography variant="h4" className="text-white text-xl font-bold">
                    My Team
                  </Typography>
                </div>
                <Typography className="text-[#0bbfb3] text-sm bg-gray-700/40 px-3 py-1 rounded-full">
                  {dashboardData.teamInfo?.department?.name || 'Department'}
                </Typography>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                {/* Manager Section */}
                <div className="col-span-1 lg:col-span-2 bg-gray-700/30 rounded-xl p-4">
                  <Typography className="text-gray-400 text-sm mb-3">Manager</Typography>
                  
                  {dashboardData.teamInfo?.manager ? (
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-full overflow-hidden mr-4 flex-shrink-0 bg-gray-600 border border-gray-500/30">
                        {dashboardData.teamInfo.manager.profilePicture ? (
                          <img 
                            src={uploadUrl(dashboardData.teamInfo.manager.profilePicture)}
                            alt={dashboardData.teamInfo.manager.name}
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.parentNode.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-[#0D5C63]/20 text-[#0bbfb3]"><svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/></svg></div>`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#0D5C63]/20 text-[#0bbfb3]">
                            <UserCircle className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div>
                        <Typography className="text-[#E1B382] font-medium">
                          {dashboardData.teamInfo.manager.name}
                        </Typography>
                        <Typography className="text-[#4682B4] text-sm">
                          {dashboardData.teamInfo.manager.position}
                        </Typography>
                        {dashboardData.teamInfo.manager.skills && dashboardData.teamInfo.manager.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {dashboardData.teamInfo.manager.skills.map((skill, index) => (
                              <span key={index} className="text-xs px-2 py-0.5 bg-[#0D5C63]/20 text-[#0bbfb3] rounded-full">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center text-gray-500">
                      <UserCircle className="w-6 h-6 mr-2" />
                      <Typography>No manager assigned</Typography>
                    </div>
                  )}
                </div>
                
                {/* Team Members Section */}
                <div className="col-span-1 lg:col-span-4 bg-gray-700/30 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <Typography className="text-gray-400 text-sm">Team Members</Typography>
                    <Typography className="text-[#0bbfb3] text-xs">
                      {dashboardData.teamInfo?.totalTeamMembers || 0} members
                    </Typography>
                  </div>
                  
                  {dashboardData.teamInfo?.teamMembers && dashboardData.teamInfo.teamMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {dashboardData.teamInfo.teamMembers.map((member, index) => (
                        <div key={member.id || index} className="flex items-center p-3 rounded-lg hover:bg-gray-600/30">
                          <div className="w-10 h-10 rounded-full overflow-hidden mr-3 flex-shrink-0 bg-gray-600">
                            {member.profilePicture ? (
                              <img
                                src={uploadUrl(member.profilePicture)}
                                alt={member.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.parentNode.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-[#0D5C63]/20 text-[#0bbfb3]"><svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/></svg></div>`;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#0D5C63]/20 text-[#0bbfb3]">
                                <UserCircle className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div>
                            <Typography className="text-[#E1B382] text-sm font-medium">
                              {member.name}
                            </Typography>
                            <Typography className="text-[#4682B4] text-xs">
                              {member.position}
                            </Typography>
                            {member.skills && member.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                                {member.skills.map((skill, idx) => (
                                  <span key={idx} className="text-xs px-1.5 py-0.5 bg-[#0D5C63]/20 text-[#0bbfb3] rounded-full whitespace-nowrap">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-24 text-gray-500">
                      <div className="text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <Typography>No team members found</Typography>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
          </div>
        )}

        {/* Attendance Section */}
        {activeSection === "attendance" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Trend */}
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
            <Typography variant="h5" className="text-white mb-4">Attendance Trend</Typography>
            <div className="h-80">
              {dashboardData.attendanceMetrics?.attendanceRate?.statusSummary?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.attendanceMetrics.attendanceRate.statusSummary}
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="80%"
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={false} // Remove direct labels to avoid overlap
                      labelLine={false}
                    >
                      {dashboardData.attendanceMetrics.attendanceRate.statusSummary.map((entry, index) => {
                        const colorMap = {
                          'Present': colors.chartColors[0],
                          'Late': colors.chartColors[1],
                          'Absent': colors.chartColors[2]
                        };
                        const fill = colorMap[entry.name] || colors.chartColors[index % colors.chartColors.length];
                        return <Cell key={`cell-${index}`} fill={fill} />;
                      })}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => {
                        // Calculate total to get percentage
                        const total = dashboardData.attendanceMetrics.attendanceRate.statusSummary.reduce(
                          (sum, item) => sum + item.value, 0
                        );
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(0) : 0;
                        return [`${value} days (${percentage}%)`, name];
                      }}
                      contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                      labelStyle={{ color: colors.text }}
                      itemStyle={{ color: colors.text }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      layout="horizontal"
                      iconSize={10}
                      iconType="circle"
                      wrapperStyle={{ paddingTop: 20 }}
                      formatter={(value) => <span style={{ color: colors.textSecondary }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <Typography className="text-gray-400">No attendance trend data available</Typography>
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-gray-800/70 rounded-lg p-3 text-center">
                <Typography className="text-gray-400 text-sm">Present</Typography>
                <Typography className="text-white text-lg font-medium">
                  {dashboardData.attendanceMetrics?.attendanceRate?.presentDays || 0} days
                </Typography>
              </div>
              <div className="bg-gray-800/70 rounded-lg p-3 text-center">
                <Typography className="text-gray-400 text-sm">Late</Typography>
                <Typography className="text-white text-lg font-medium">
                  {dashboardData.attendanceMetrics?.attendanceRate?.lateDays || 0} days
                </Typography>
              </div>
              <div className="bg-gray-800/70 rounded-lg p-3 text-center">
                <Typography className="text-gray-400 text-sm">Absent</Typography>
                <Typography className="text-white text-lg font-medium">
                  {dashboardData.attendanceMetrics?.attendanceRate?.absentDays || 0} days
                </Typography>
              </div>
            </div>
          </div>

            {/* Punctuality Trend */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Late Minutes Trend</Typography>
              <div className="h-80">
                {dashboardData.attendanceMetrics?.punctualityScore?.lateTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.attendanceMetrics.punctualityScore.lateTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="date" tick={{ fill: colors.textSecondary }} />
                      <YAxis tick={{ fill: colors.textSecondary }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                        itemStyle={{ color: colors.text }}
                      />
                      <Line
                        type="monotone"
                        dataKey="lateMinutes"
                        name="Minutes Late"
                        stroke={colors.chartColors[2]}
                        strokeWidth={2}
                        dot={{ fill: colors.chartColors[2] }}
                        activeDot={{ r: 6, stroke: colors.chartColors[2], strokeWidth: 2, fill: colors.background }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Typography className="text-gray-400">No late arrivals data available</Typography>
                  </div>
                )}
              </div>
            </div>

            {/* Production Hours Trend */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Production Hours Trend</Typography>
              <div className="h-80">
                {dashboardData.attendanceMetrics?.productionHoursTrend?.dailyTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.attendanceMetrics.productionHoursTrend.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="date" tick={{ fill: colors.textSecondary }} />
                      <YAxis tick={{ fill: colors.textSecondary }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                        itemStyle={{ color: colors.text }}
                      />
                      <Line
                        type="monotone"
                        dataKey="productionHours"
                        name="Production Hours"
                        stroke={colors.chartColors[0]}
                        strokeWidth={2}
                        dot={{ fill: colors.chartColors[0] }}
                        activeDot={{ r: 6, stroke: colors.chartColors[0], strokeWidth: 2, fill: colors.background }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Typography className="text-gray-400">No production hours data available</Typography>
                  </div>
                )}
              </div>
            </div>

            {/* Overtime Trend */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Overtime Hours</Typography>
              <div className="h-80">
                {dashboardData.attendanceMetrics?.overtimeHours?.dailyOvertime?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.attendanceMetrics.overtimeHours.dailyOvertime}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis dataKey="date" tick={{ fill: colors.textSecondary }} />
                      <YAxis tick={{ fill: colors.textSecondary }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                        itemStyle={{ color: colors.text }}
                      />
                      <Bar 
                        dataKey="overtimeHours" 
                        name="Overtime Hours" 
                        fill={colors.chartColors[3]} 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Typography className="text-gray-400">No overtime data available</Typography>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Leave Section */}
        {activeSection === "leave" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leave Balance */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Leave Balance</Typography>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Used', value: dashboardData.leaveMetrics?.leaveBalanceIndicator?.used || 0 },
                        { name: 'Remaining', value: dashboardData.leaveMetrics?.leaveBalanceIndicator?.remaining || 0 }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell key="cell-0" fill={colors.chartColors[2]} />
                      <Cell key="cell-1" fill={colors.chartColors[0]} />
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                      labelStyle={{ color: colors.text }}
                      itemStyle={{ color: colors.text }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between mt-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-[#0bbfb3] rounded-full mr-2"></div>
                  <Typography className="text-gray-400">Remaining: {dashboardData.leaveMetrics?.leaveBalanceIndicator?.remaining || 0} days</Typography>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-[#E17372] rounded-full mr-2"></div>
                  <Typography className="text-gray-400">Used: {dashboardData.leaveMetrics?.leaveBalanceIndicator?.used || 0} days</Typography>
                </div>
              </div>
            </div>

{/* Leave Requests Status */}
<div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
  <Typography variant="h5" className="text-white mb-4">Leave Request Status</Typography>
  <div className="h-64 flex">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ right: 0 }}>
        <Pie
          data={Object.entries(dashboardData.leaveMetrics?.leaveRequestStatus?.counts || {}).map(([key, value]) => ({ status: key, count: value }))}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="count"
          nameKey="status"
          stroke={colors.background}
          strokeWidth={2}
        >
          {Object.entries(dashboardData.leaveMetrics?.leaveRequestStatus?.counts || {}).map(([key], index) => {
            const statusColorMap = {
              'Pending': 1,
              'Manager Approved': 0,
              'Manager Rejected': 2,
              'Admin Approved': 4,
              'Admin Rejected': 5
            };
            const colorIndex = statusColorMap[key] !== undefined ? statusColorMap[key] : index % colors.chartColors.length;
            return <Cell key={`cell-${index}`} fill={colors.chartColors[colorIndex]} />;
          })}
        </Pie>
        <Tooltip
          contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
          labelStyle={{ color: colors.text }}
          itemStyle={{ color: colors.text }}
        />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          iconType="circle"
          wrapperStyle={{
            paddingLeft: 0,
            paddingRight: 0,
            right: -5
          }}
          formatter={(value) => <span style={{ color: colors.textSecondary }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
</div>

            {/* Leave Usage By Type */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Leave Usage By Type</Typography>
              <div className="h-80">
                {dashboardData.leaveMetrics?.leaveUsageByType?.leaveUsageByType?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.leaveMetrics.leaveUsageByType.leaveUsageByType}
                        cx="50%"
                        cy="50%"
                        labelLine={true}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="days"
                        nameKey="reason"
                        label={({ reason, days }) => `${reason}: ${days} days`}
                      >
                        {dashboardData.leaveMetrics.leaveUsageByType.leaveUsageByType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors.chartColors[index % colors.chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                        formatter={(value, name, props) => [`${value} days`, props.payload.reason]}
                        itemStyle={{ color: colors.text }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Typography className="text-gray-400">No leave usage data available</Typography>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Leave Requests */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Recent Leave Requests</Typography>
              {dashboardData.leaveMetrics?.leaveRequestStatus?.recentLeaveRequests?.length > 0 ? (
                <div className="overflow-y-auto max-h-80">
                  {dashboardData.leaveMetrics.leaveRequestStatus.recentLeaveRequests.map((request, index) => (
                    <div 
                      key={request.id || index} 
                      className="border-b border-gray-700 last:border-b-0 py-3 flex justify-between items-center"
                    >
                      <div>
                        <Typography className="text-white">{new Date(request.startDate).toLocaleDateString()} to {new Date(request.endDate).toLocaleDateString()}</Typography>
                        <Typography className="text-gray-400 text-sm">{request.reason}</Typography>
                      </div>
                      <div>
                        <span 
                          className={`px-3 py-1 rounded-full text-xs ${
                            request.status.includes('Approved') 
                              ? 'bg-green-900/50 text-green-400' 
                              : request.status.includes('Rejected')
                                ? 'bg-red-900/50 text-red-400'
                                : 'bg-blue-900/50 text-blue-400'
                          }`}
                        >
                          {request.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <Typography className="text-gray-400">No recent leave requests</Typography>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar Section */}
        {activeSection === "calendar" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Events Counter */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Upcoming Events</Typography>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <Typography variant="h4" className="text-[#0bbfb3]">
                    {dashboardData.calendarMetrics?.upcomingEventsCounter?.today?.total || 0}
                  </Typography>
                  <Typography className="text-gray-400">Today</Typography>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <Typography variant="h4" className="text-[#0bbfb3]">
                    {dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.total || 0}
                  </Typography>
                  <Typography className="text-gray-400">This Week</Typography>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                  <Typography variant="h4" className="text-[#0bbfb3]">
                    {dashboardData.calendarMetrics?.upcomingEventsCounter?.thisMonth?.total || 0}
                  </Typography>
                  <Typography className="text-gray-400">This Month</Typography>
                </div>
              </div>
              <div>
                <Typography className="text-white mb-3">Events by Type</Typography>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between bg-gray-700/30 p-2 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-[#0bbfb3] rounded-full mr-2"></div>
                      <Typography className="text-gray-300">Meetings</Typography>
                    </div>
                    <Typography className="text-white">{dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.meeting || 0}</Typography>
                  </div>
                  <div className="flex items-center justify-between bg-gray-700/30 p-2 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-[#E17372] rounded-full mr-2"></div>
                      <Typography className="text-gray-300">Missions</Typography>
                    </div>
                    <Typography className="text-white">{dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.mission || 0}</Typography>
                  </div>
                  <div className="flex items-center justify-between bg-gray-700/30 p-2 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-[#6E62B6] rounded-full mr-2"></div>
                      <Typography className="text-gray-300">Reservations</Typography>
                    </div>
                    <Typography className="text-white">{dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.resourceReservation || 0}</Typography>
                  </div>
                  <div className="flex items-center justify-between bg-gray-700/30 p-2 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-[#F0B94D] rounded-full mr-2"></div>
                      <Typography className="text-gray-300">Other</Typography>
                    </div>
                    <Typography className="text-white">{dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.other || 0}</Typography>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Density */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Calendar Density</Typography>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.calendarMetrics?.calendarDensity?.dailyDensity || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: colors.textSecondary }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    />
                    <YAxis tick={{ fill: colors.textSecondary }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                      labelStyle={{ color: colors.text }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                      itemStyle={{ color: colors.text }}
                    />
                  
                    <Bar 
                      dataKey="count" 
                      name="Events" 
                      fill={colors.primary} 
                      fillOpacity={0.8}
                      stroke={colors.primary}
                      strokeWidth={1}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between mt-4">
                <div>
                  <Typography className="text-gray-400">Busy Days:</Typography>
                  <Typography className="text-white">{dashboardData.calendarMetrics?.calendarDensity?.busyDays || 0}</Typography>
                </div>
                <div>
                  <Typography className="text-gray-400">Total Events:</Typography>
                  <Typography className="text-white">{dashboardData.calendarMetrics?.calendarDensity?.totalEvents || 0}</Typography>
                </div>
              </div>
            </div>
            {/* Busy Hours Distribution */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Busy Hours Distribution</Typography>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.calendarMetrics?.calendarDensity?.busyHoursDistribution || []}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={colors.chartColors[3]} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={colors.chartColors[3]} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis
                      dataKey="timeLabel"
                      tick={{ fill: colors.textSecondary }}
                      tickFormatter={(value) => value.split(' - ')[0]}
                    />
                    <YAxis 
                      tick={{ fill: colors.textSecondary }}
                      label={{ 
                        value: 'Event Count', 
                        angle: -90, 
                        position: 'insideLeft', 
                        style: { fill: colors.textSecondary }
                      }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                      labelStyle={{ color: colors.text }}
                      itemStyle={{ color: colors.text }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      name="Events" 
                      stroke={colors.chartColors[3]} 
                      fillOpacity={1} 
                      fill="url(#colorEvents)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Next Events */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Next Events</Typography>
              {dashboardData.calendarMetrics?.upcomingEventsCounter?.nextEvents?.length > 0 ? (
                <div className="overflow-y-auto max-h-80">
                  {dashboardData.calendarMetrics.upcomingEventsCounter.nextEvents.map((event, index) => (
                    <div 
                      key={event.id || index} 
                      className="border-b border-gray-700 last:border-b-0 py-3"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <Typography className="text-white font-medium">{event.title}</Typography>
                        <span 
                          className={`px-3 py-1 rounded-full text-xs ${
                            event.type === 'meeting' 
                              ? 'bg-green-900/50 text-green-400' 
                              : event.type === 'mission'
                                ? 'bg-red-900/50 text-red-400'
                                : event.type === 'resourceReservation'
                                  ? 'bg-purple-900/50 text-purple-400'
                                  : 'bg-blue-900/50 text-blue-400'
                          }`}
                        >
                          {event.type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <Typography className="text-gray-400 text-sm">
                          {new Date(event.startDate).toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Typography>
                        {event.location && (
                          <Typography className="text-gray-400 text-sm">{event.location}</Typography>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <Typography className="text-gray-400">No upcoming events</Typography>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboardHomePage;