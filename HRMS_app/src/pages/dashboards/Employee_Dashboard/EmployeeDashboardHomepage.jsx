import { useState, useEffect } from "react";
import { useChartColors } from "../../../theme/theme";
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
  const colors = useChartColors();

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

  {/* Custom tooltip component for performance chart */}
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-raise p-3 rounded-lg border border-line shadow-lg">
        <p className="text-ink font-semibold">{`${label}`}</p>
        <p className="text-teal font-medium">{`Performance: ${payload[0].value}%`}</p>
        {payload[0].payload.productionHours && (
          <p className="text-ink">{`Production Hours: ${payload[0].payload.productionHours.toFixed(1)}`}</p>
        )}
      </div>
    );
  }
  return null;
};

  return (
    <div className="min-h-screen bg-ground relative">

      {/* Dashboard Layout */}
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="mb-4 md:mb-0">
            <h2 className="text-ink text-2xl md:text-3xl font-bold flex items-center">
              <User className="w-8 h-8 mr-3 text-teal" /> 
              {dashboardData.userData?.name || 'Employee'} Dashboard
            </h2>
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
            {/* Attendance Rate */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Attendance Rate</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.attendanceMetrics?.attendanceRate?.rate || 0}%
                  </h3>
                </div>
                <CheckCircle className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                {dashboardData.attendanceMetrics?.attendanceRate?.presentDays || 0} present days out of {dashboardData.attendanceMetrics?.attendanceRate?.totalWorkdays || 0} workdays
              </p>
            </div>

            {/* Punctuality Score */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Punctuality Score</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.attendanceMetrics?.punctualityScore?.score || 0}%
                  </h3>
                </div>
                <Clock className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                {dashboardData.attendanceMetrics?.punctualityScore?.onTimeArrivals || 0} on-time arrivals, {dashboardData.attendanceMetrics?.punctualityScore?.lateArrivals || 0} late arrivals
              </p>
            </div>

            {/* Production Hours */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Production Hours</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.attendanceMetrics?.productionHoursTrend?.totalProductionHours || 0}h
                  </h3>
                </div>
                <Timer className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                Average: {dashboardData.attendanceMetrics?.productionHoursTrend?.averageProductionHours || 0}h per day
              </p>
            </div>

            {/* Leave Balance */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-ink-2">Leave Balance</p>
                  <h3 className="text-ink text-2xl font-bold mt-1">
                    {dashboardData.leaveMetrics?.leaveBalanceIndicator?.remaining || 0} days
                  </h3>
                </div>
                <Calendar className="text-teal w-8 h-8" />
              </div>
              <p className="text-ink-2 text-sm">
                Used: {dashboardData.leaveMetrics?.leaveBalanceIndicator?.used || 0} of {dashboardData.leaveMetrics?.leaveBalanceIndicator?.totalAllowed || 0} days ({dashboardData.leaveMetrics?.leaveBalanceIndicator?.percentageUsed || 0}%)
              </p>
            </div>

            {/* Performance Chart */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4">
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-ink text-3xl font-bold">
                      {dashboardData.performanceMetrics?.score || 0}%
                    </h3>
                    <div className="flex items-center mt-1">
                      <span className={`flex items-center text-sm px-2 py-1 rounded-full bg-teal/10 ${dashboardData.performanceMetrics?.vsLastYear >= 0 ? "text-teal" : "text-red"}`}>
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
                          <stop offset="5%" stopColor={colors.primary} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={colors.primary} stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
                      <XAxis 
                        dataKey="month" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: colors.axis, fontSize: 12 }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: colors.axis, fontSize: 12 }}
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={colors.primary} 
                        strokeWidth={3}
                        fill="url(#performanceGradient)" 
                        activeDot={{ r: 6, fill: colors.primary, stroke: colors.text }}
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
                  <Users className="text-teal w-6 h-6 mr-3" />
                  <h4 className="text-ink text-xl font-bold">
                    My Team
                  </h4>
                </div>
                <p className="text-teal text-sm bg-sunk px-3 py-1 rounded-full">
                  {dashboardData.teamInfo?.department?.name || 'Department'}
                </p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
                {/* Manager Section */}
                <div className="col-span-1 lg:col-span-2 bg-sunk rounded-xl p-4">
                  <p className="text-ink-2 text-sm mb-3">Manager</p>
                  
                  {dashboardData.teamInfo?.manager ? (
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-full overflow-hidden mr-4 flex-shrink-0 bg-sunk border border-line-2">
                        {dashboardData.teamInfo.manager.profilePicture ? (
                          <img 
                            src={uploadUrl(dashboardData.teamInfo.manager.profilePicture)}
                            alt={dashboardData.teamInfo.manager.name}
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.parentNode.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-teal/10 text-teal"><svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/></svg></div>`;
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-teal/10 text-teal">
                            <UserCircle className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-amber font-medium">
                          {dashboardData.teamInfo.manager.name}
                        </p>
                        <p className="text-blue text-sm">
                          {dashboardData.teamInfo.manager.position}
                        </p>
                        {dashboardData.teamInfo.manager.skills && dashboardData.teamInfo.manager.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {dashboardData.teamInfo.manager.skills.map((skill, index) => (
                              <span key={index} className="text-xs px-2 py-0.5 bg-teal/10 text-teal rounded-full">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center text-ink-3">
                      <UserCircle className="w-6 h-6 mr-2" />
                      <p>No manager assigned</p>
                    </div>
                  )}
                </div>
                
                {/* Team Members Section */}
                <div className="col-span-1 lg:col-span-4 bg-sunk rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-ink-2 text-sm">Team Members</p>
                    <p className="text-teal text-xs">
                      {dashboardData.teamInfo?.totalTeamMembers || 0} members
                    </p>
                  </div>
                  
                  {dashboardData.teamInfo?.teamMembers && dashboardData.teamInfo.teamMembers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {dashboardData.teamInfo.teamMembers.map((member, index) => (
                        <div key={member.id || index} className="flex items-center p-3 rounded-lg hover:bg-sunk">
                          <div className="w-10 h-10 rounded-full overflow-hidden mr-3 flex-shrink-0 bg-sunk">
                            {member.profilePicture ? (
                              <img
                                src={uploadUrl(member.profilePicture)}
                                alt={member.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.parentNode.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-teal/10 text-teal"><svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/></svg></div>`;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-teal/10 text-teal">
                                <UserCircle className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-amber text-sm font-medium">
                              {member.name}
                            </p>
                            <p className="text-blue text-xs">
                              {member.position}
                            </p>
                            {member.skills && member.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                                {member.skills.map((skill, idx) => (
                                  <span key={idx} className="text-xs px-1.5 py-0.5 bg-teal/10 text-teal rounded-full whitespace-nowrap">
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
                    <div className="flex items-center justify-center h-24 text-ink-3">
                      <div className="text-center">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No team members found</p>
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
          <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
            <h5 className="text-lg font-semibold text-ink mb-4">Attendance Trend</h5>
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
                  <p className="text-ink-2">No attendance trend data available</p>
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-raise rounded-lg p-3 text-center">
                <p className="text-ink-2 text-sm">Present</p>
                <p className="text-ink text-lg font-medium">
                  {dashboardData.attendanceMetrics?.attendanceRate?.presentDays || 0} days
                </p>
              </div>
              <div className="bg-raise rounded-lg p-3 text-center">
                <p className="text-ink-2 text-sm">Late</p>
                <p className="text-ink text-lg font-medium">
                  {dashboardData.attendanceMetrics?.attendanceRate?.lateDays || 0} days
                </p>
              </div>
              <div className="bg-raise rounded-lg p-3 text-center">
                <p className="text-ink-2 text-sm">Absent</p>
                <p className="text-ink text-lg font-medium">
                  {dashboardData.attendanceMetrics?.attendanceRate?.absentDays || 0} days
                </p>
              </div>
            </div>
          </div>

            {/* Punctuality Trend */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Late Minutes Trend</h5>
              <div className="h-80">
                {dashboardData.attendanceMetrics?.punctualityScore?.lateTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.attendanceMetrics.punctualityScore.lateTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
                    <p className="text-ink-2">No late arrivals data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Production Hours Trend */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Production Hours Trend</h5>
              <div className="h-80">
                {dashboardData.attendanceMetrics?.productionHoursTrend?.dailyTrend?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.attendanceMetrics.productionHoursTrend.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
                    <p className="text-ink-2">No production hours data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Overtime Trend */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Overtime Hours</h5>
              <div className="h-80">
                {dashboardData.attendanceMetrics?.overtimeHours?.dailyOvertime?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.attendanceMetrics.overtimeHours.dailyOvertime}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
                    <p className="text-ink-2">No overtime data available</p>
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
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Leave Balance</h5>
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
                      fill={colors.chartColors[4]}
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
                  <div className="w-3 h-3 bg-teal rounded-full mr-2"></div>
                  <p className="text-ink-2">Remaining: {dashboardData.leaveMetrics?.leaveBalanceIndicator?.remaining || 0} days</p>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red rounded-full mr-2"></div>
                  <p className="text-ink-2">Used: {dashboardData.leaveMetrics?.leaveBalanceIndicator?.used || 0} days</p>
                </div>
              </div>
            </div>

{/* Leave Requests Status */}
<div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
  <h5 className="text-lg font-semibold text-ink mb-4">Leave Request Status</h5>
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
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Leave Usage By Type</h5>
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
                        fill={colors.chartColors[4]}
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
                    <p className="text-ink-2">No leave usage data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Leave Requests */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Recent Leave Requests</h5>
              {dashboardData.leaveMetrics?.leaveRequestStatus?.recentLeaveRequests?.length > 0 ? (
                <div className="overflow-y-auto max-h-80">
                  {dashboardData.leaveMetrics.leaveRequestStatus.recentLeaveRequests.map((request, index) => (
                    <div 
                      key={request.id || index} 
                      className="border-b border-line last:border-b-0 py-3 flex justify-between items-center"
                    >
                      <div>
                        <p className="text-ink">{new Date(request.startDate).toLocaleDateString()} to {new Date(request.endDate).toLocaleDateString()}</p>
                        <p className="text-ink-2 text-sm">{request.reason}</p>
                      </div>
                      <div>
                        <span 
                          className={`px-3 py-1 rounded-full text-xs ${
                            request.status.includes('Approved') 
                              ? 'bg-teal/10 text-teal' 
                              : request.status.includes('Rejected')
                                ? 'bg-red/10 text-red'
                                : 'bg-blue/10 text-blue'
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
                  <p className="text-ink-2">No recent leave requests</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Calendar Section */}
        {activeSection === "calendar" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Events Counter */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Upcoming Events</h5>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-sunk rounded-lg p-4 text-center">
                  <h4 className="text-xl font-semibold text-teal">
                    {dashboardData.calendarMetrics?.upcomingEventsCounter?.today?.total || 0}
                  </h4>
                  <p className="text-ink-2">Today</p>
                </div>
                <div className="bg-sunk rounded-lg p-4 text-center">
                  <h4 className="text-xl font-semibold text-teal">
                    {dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.total || 0}
                  </h4>
                  <p className="text-ink-2">This Week</p>
                </div>
                <div className="bg-sunk rounded-lg p-4 text-center">
                  <h4 className="text-xl font-semibold text-teal">
                    {dashboardData.calendarMetrics?.upcomingEventsCounter?.thisMonth?.total || 0}
                  </h4>
                  <p className="text-ink-2">This Month</p>
                </div>
              </div>
              <div>
                <p className="text-ink mb-3">Events by Type</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between bg-sunk p-2 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-teal rounded-full mr-2"></div>
                      <p className="text-ink-2">Meetings</p>
                    </div>
                    <p className="text-ink">{dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.meeting || 0}</p>
                  </div>
                  <div className="flex items-center justify-between bg-sunk p-2 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red rounded-full mr-2"></div>
                      <p className="text-ink-2">Missions</p>
                    </div>
                    <p className="text-ink">{dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.mission || 0}</p>
                  </div>
                  <div className="flex items-center justify-between bg-sunk p-2 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-violet rounded-full mr-2"></div>
                      <p className="text-ink-2">Reservations</p>
                    </div>
                    <p className="text-ink">{dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.resourceReservation || 0}</p>
                  </div>
                  <div className="flex items-center justify-between bg-sunk p-2 rounded">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-amber rounded-full mr-2"></div>
                      <p className="text-ink-2">Other</p>
                    </div>
                    <p className="text-ink">{dashboardData.calendarMetrics?.upcomingEventsCounter?.thisWeek?.other || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Calendar Density */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Calendar Density</h5>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.calendarMetrics?.calendarDensity?.dailyDensity || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
                  <p className="text-ink-2">Busy Days:</p>
                  <p className="text-ink">{dashboardData.calendarMetrics?.calendarDensity?.busyDays || 0}</p>
                </div>
                <div>
                  <p className="text-ink-2">Total Events:</p>
                  <p className="text-ink">{dashboardData.calendarMetrics?.calendarDensity?.totalEvents || 0}</p>
                </div>
              </div>
            </div>
            {/* Busy Hours Distribution */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Busy Hours Distribution</h5>
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
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Next Events</h5>
              {dashboardData.calendarMetrics?.upcomingEventsCounter?.nextEvents?.length > 0 ? (
                <div className="overflow-y-auto max-h-80">
                  {dashboardData.calendarMetrics.upcomingEventsCounter.nextEvents.map((event, index) => (
                    <div 
                      key={event.id || index} 
                      className="border-b border-line last:border-b-0 py-3"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-ink font-medium">{event.title}</p>
                        <span 
                          className={`px-3 py-1 rounded-full text-xs ${
                            event.type === 'meeting' 
                              ? 'bg-teal/10 text-teal' 
                              : event.type === 'mission'
                                ? 'bg-red/10 text-red'
                                : event.type === 'resourceReservation'
                                  ? 'bg-violet/10 text-violet'
                                  : 'bg-blue/10 text-blue'
                          }`}
                        >
                          {event.type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-ink-2 text-sm">
                          {new Date(event.startDate).toLocaleString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {event.location && (
                          <p className="text-ink-2 text-sm">{event.location}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center">
                  <p className="text-ink-2">No upcoming events</p>
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