import { useState, useEffect } from "react";
import { Typography } from "@material-tailwind/react";
import CustomDatePicker from '../../../components/ui/datePicker';
import api, { errorMessage } from '../../../lib/api';
import { BarChart, LineChart, PieChart, Bar, Line, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import {
  Users,
  Calendar,
  Clock,
  Award,
  Database,
  MessageSquare,
  Briefcase,
  AlertCircle,
  MessageCircle,
  Bell
} from "lucide-react";

const HRDashboardHomepage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date()
  });
  
  // Color palette 
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
  // Utility function for consistent department name abbreviation
  const abbreviateDepartmentName = (name) => {
    if (!name) return '';
    
    if (name.length > 5 || name.includes('&')) {
      return name.split(' ').map(word => word[0]).join('');
    }
    return name;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams({
          startDate: dateRange.startDate.toISOString().split('T')[0],
          endDate: dateRange.endDate.toISOString().split('T')[0]
        }).toString();
        
        // Append the query parameters to the URL
        const { data } = await api.get(`/api/hr/dashboard?${queryParams}`);
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
    { id: "leave", label: "Leave Management", icon: <Calendar size={20} /> },
    { id: "workforce", label: "Workforce", icon: <Users size={20} /> },
    { id: "resources", label: "Resources", icon: <Briefcase size={20} /> },
    { id: "communication", label: "Communication", icon: <MessageSquare size={20} /> }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-[#23A49B] border-r-[#23A49B]/70 border-b-[#23A49B]/40 border-l-[#23A49B]/10 rounded-full animate-spin"></div>
          <Typography className="text-white">Loading dashboard data...</Typography>
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
  return (
    <div className="min-h-screen bg-gray-900 relative">
      {/* Dashboard Layout */}
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <div className="mb-4 md:mb-0">
            <Typography variant="h2" className="text-white text-2xl md:text-3xl font-bold flex items-center">
              <Award className="w-8 h-8 mr-3 text-[#23A49B]" /> HR Analytics Dashboard
            </Typography>
            <Typography className="text-gray-400 mt-1">
              ENOVA ROBOTICS Human Resources Management
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

        {/* Dashboard Content based on active section */}
        {activeSection === "overview" && dashboardData && (
          <div className="space-y-6">
            {/* Key Statistics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Employees Card */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-[#23A49B]/20 flex items-center justify-center mr-4">
                  <Users className="w-7 h-7 text-[#23A49B]" />
                </div>
                <div>
                  <Typography className="text-gray-400 text-sm">Total Employees</Typography>
                  <Typography variant="h4" className="text-white font-bold">{dashboardData.overview.totalEmployees}</Typography>
                </div>
              </div>
              
              {/* Total Departments Card */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-[#23A49B]/20 flex items-center justify-center mr-4">
                  <Briefcase className="w-7 h-7 text-[#23A49B]" />
                </div>
                <div>
                  <Typography className="text-gray-400 text-sm">Total Departments</Typography>
                  <Typography variant="h4" className="text-white font-bold">{dashboardData.overview.totalDepartments}</Typography>
                </div>
              </div>
              
              {/* Pending Leave Requests Card */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-[#23A49B]/20 flex items-center justify-center mr-4">
                  <Calendar className="w-7 h-7 text-[#23A49B]" />
                </div>
                <div>
                  <Typography className="text-gray-400 text-sm">Pending Leave Requests</Typography>
                  <Typography variant="h4" className="text-white font-bold">{dashboardData.overview.pendingLeaveRequests}</Typography>
                </div>
              </div>
            </div>
            
            {/* Data Visualizations Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Workforce Distribution Chart */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="h5" className="text-white">Employees by Department</Typography>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#23A49B]"></div>
                    <Typography className="text-gray-400 text-xs">Employee Count</Typography>
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.workforceAnalytics.employeesByDepartment}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="name" 
                        tick={{ fill: colors.textSecondary }}
                        tickFormatter={abbreviateDepartmentName} 
                      />
                      <YAxis tick={{ fill: colors.textSecondary }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                        formatter={(value) => [value, 'Employee Count']}
                        labelFormatter={(label) => label} // This keeps the full department name in the tooltip
                      />
                      <Bar dataKey="employeeCount" fill={colors.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Leave Status Distribution  */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="h5" className="text-white">Leave Status</Typography>
                  <div className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded-full">
                    {dashboardData.leaveManagement.leaveStatusDistribution.reduce((sum, item) => sum + item.count, 0)} Total
                  </div>
                </div>
                
                <div className="flex-grow h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.leaveManagement.leaveStatusDistribution}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                        labelLine={true}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                      >
                        {dashboardData.leaveManagement.leaveStatusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors.chartColors[index % colors.chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                      contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                      itemStyle={{ color: colors.text }}  
                      labelStyle={{ color: colors.text }}
                      formatter={(value, name) => [`${value} Requests`, name]}
                    />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Status Legend with Count */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {dashboardData.leaveManagement.leaveStatusDistribution.map((entry, index) => (
                    <div key={`legend-${index}`} className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: colors.chartColors[index % colors.chartColors.length] }}
                      />
                      <Typography className="text-gray-400 text-xs mr-1">{entry.status}:</Typography>
                      <Typography className="text-white text-xs font-semibold">{entry.count}</Typography>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "attendance" && dashboardData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance by Department */}
          <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Attendance by Department</Typography>
              <div className="h-80">
                {dashboardData.attendanceAnalytics?.attendanceByDepartment?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.attendanceAnalytics.attendanceByDepartment}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey="departmentName" 
                          tick={{ fill: colors.textSecondary }} 
                          tickFormatter={(value) => abbreviateDepartmentName(value)}
                        />
                        <YAxis tick={{ fill: colors.textSecondary }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                          labelStyle={{ color: colors.text }}
                        />
                        <Legend wrapperStyle={{ color: colors.textSecondary }} />
                        <Bar dataKey="presentPercentage" name="Present %" fill={colors.chartColors[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="latePercentage" name="Late %" fill={colors.chartColors[1]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="absentPercentage" name="Absent %" fill={colors.chartColors[2]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Typography className="text-gray-400">No attendance data available</Typography>
                  </div>
                )}
              </div>
            </div>
            
            {/* Absenteeism Trend */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Absenteeism Trend</Typography>
              <div className="h-80">
                {dashboardData.attendanceAnalytics?.absenteeismTrend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboardData.attendanceAnalytics.absenteeismTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis dataKey="date" tick={{ fill: colors.textSecondary }} />
                        <YAxis tick={{ fill: colors.textSecondary }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                          labelStyle={{ color: colors.text }}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          name="Absent Employees"
                          stroke={colors.primary}
                          strokeWidth={2}
                          dot={{ fill: colors.primary }}
                          activeDot={{ r: 6, stroke: colors.primary, strokeWidth: 2, fill: colors.background }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Typography className="text-gray-400">No absenteeism trend data available</Typography>
                  </div>
                )}
              </div>
            </div>
            
            {/* Late Arrivals by Department */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Late Arrivals by Department</Typography>
              <div className="h-80">
                {dashboardData.attendanceAnalytics?.lateArrivalsByDepartment?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.attendanceAnalytics.lateArrivalsByDepartment}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                        <XAxis 
                          dataKey="departmentName" 
                          tick={{ fill: colors.textSecondary }} 
                          tickFormatter={(value) => abbreviateDepartmentName(value)}
                        />
                        <YAxis tick={{ fill: colors.textSecondary }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                          labelStyle={{ color: colors.text }}
                          labelFormatter={(label) => label} // Full department name in tooltip
                        />
                        <Bar dataKey="totalLate" name="Late Arrivals" fill={colors.chartColors[1]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Typography className="text-gray-400">No late arrivals data available</Typography>
                  </div>
                )}
              </div>
            </div>
            
            {/* Overtime Distribution */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Overtime by Department</Typography>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.attendanceAnalytics.overtimeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                          dataKey="departmentName" 
                          tick={{ fill: colors.textSecondary }} 
                          tickFormatter={(value) => abbreviateDepartmentName(value)}
                        />
                    <YAxis tick={{ fill: colors.textSecondary }} />
                    <Tooltip
                          contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                          labelStyle={{ color: colors.text }}
                          labelFormatter={(label) => label} 
                        />
                    <Legend wrapperStyle={{ color: colors.textSecondary }} />
                    <Bar dataKey="totalOvertimeHours" name="Overtime Hours" fill={colors.chartColors[3]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeSection === "leave" && dashboardData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leave Days Usage */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Leave Days Usage</Typography>
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <div className="relative inline-flex">
                    <div className="w-40 h-40 rounded-full border-8 border-gray-700"></div>
                    <div 
                      className="absolute top-0 left-0 w-40 h-40 rounded-full border-8 border-[#23A49B]"
                      style={{ 
                        clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos(Math.PI * 2 * dashboardData.leaveManagement.leaveDaysUsageStats.usagePercentage / 100)}% ${50 - 50 * Math.sin(Math.PI * 2 * dashboardData.leaveManagement.leaveDaysUsageStats.usagePercentage / 100)}%, 50% 50%)`,
                        transform: 'rotate(90deg)'
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <Typography variant="h3" className="text-white font-bold">
                        {dashboardData.leaveManagement.leaveDaysUsageStats.usagePercentage.toFixed(1)}%
                      </Typography>
                      <Typography className="text-gray-400 text-sm">Usage</Typography>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <div>
                      <Typography className="text-gray-400 text-sm">Total Allowed</Typography>
                      <Typography variant="h5" className="text-white">
                        {dashboardData.leaveManagement.leaveDaysUsageStats.totalAllowed}
                      </Typography>
                    </div>
                    <div>
                      <Typography className="text-gray-400 text-sm">Total Used</Typography>
                      <Typography variant="h5" className="text-white">
                        {dashboardData.leaveManagement.leaveDaysUsageStats.totalUsed}
                      </Typography>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Leave Type Distribution */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Leave Types</Typography>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardData.leaveManagement.leaveTypeDistribution}
                      dataKey="count"
                      nameKey="leaveType"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      labelLine={true}
                      label={({ percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {dashboardData.leaveManagement.leaveTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors.chartColors[index % colors.chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                      itemStyle={{ color: colors.text }}  
                      labelStyle={{ color: colors.text }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Leave Seasonal Patterns */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 col-span-1 lg:col-span-2">
              <Typography variant="h5" className="text-white mb-4">Leave Seasonal Patterns</Typography>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.leaveManagement.leaveSeasonalPatterns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="period" tick={{ fill: colors.textSecondary }} />
                    <YAxis tick={{ fill: colors.textSecondary }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                      labelStyle={{ color: colors.text }}
                    />
                    <Legend wrapperStyle={{ color: colors.textSecondary }} />
                    <Line
                      type="monotone"
                      dataKey="totalRequests"
                      name="Leave Requests"
                      stroke={colors.chartColors[0]}
                      strokeWidth={2}
                      dot={{ fill: colors.chartColors[0] }}
                      activeDot={{ r: 6, stroke: colors.chartColors[0], strokeWidth: 2, fill: colors.background }}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalDays"
                      name="Leave Days"
                      stroke={colors.chartColors[1]}
                      strokeWidth={2}
                      dot={{ fill: colors.chartColors[1] }}
                      activeDot={{ r: 6, stroke: colors.chartColors[1], strokeWidth: 2, fill: colors.background }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeSection === "workforce" && dashboardData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Salary Distribution */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Salary Distribution</Typography>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.workforceAnalytics.salaryDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="range" tick={{ fill: colors.textSecondary }} />
                    <YAxis tick={{ fill: colors.textSecondary }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                      labelStyle={{ color: colors.text }}
                    />
                    <Bar dataKey="count" name="Employees" fill={colors.chartColors[4]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Manager-Employee Ratio */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Manager-Employee Ratio</Typography>
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <Typography variant="h2" className="text-white font-bold">
                    1:{dashboardData.workforceAnalytics.managerEmployeeRatio.ratio.toFixed(1)}
                  </Typography>
                  <Typography className="text-gray-400 mt-2">
                    Manager to Employee Ratio
                  </Typography>
                  
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <Typography className="text-gray-400 text-sm">Managers</Typography>
                      <Typography variant="h5" className="text-white">
                        {dashboardData.workforceAnalytics.managerEmployeeRatio.managerCount}
                      </Typography>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <Typography className="text-gray-400 text-sm">Employees</Typography>
                      <Typography variant="h5" className="text-white">
                        {dashboardData.workforceAnalytics.managerEmployeeRatio.employeeCount}
                      </Typography>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Headcount Trend */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 col-span-1 lg:col-span-2">
              <Typography variant="h5" className="text-white mb-4">Headcount & Growth</Typography>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-800 rounded-lg p-6 md:col-span-1 flex flex-col justify-center items-center">
                  <Typography className="text-gray-400 text-sm mb-2">Current Headcount</Typography>
                  <Typography variant="h3" className="text-white font-bold">
                    {dashboardData.workforceAnalytics.headcountTrend.currentHeadcount}
                  </Typography>
                  <div className="flex items-center mt-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center mr-2 ${dashboardData.workforceAnalytics.headcountTrend.growth > 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                      <div className={`h-3 w-3 rounded-full ${dashboardData.workforceAnalytics.headcountTrend.growth > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                    <Typography className={`text-sm ${dashboardData.workforceAnalytics.headcountTrend.growth > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {dashboardData.workforceAnalytics.headcountTrend.growth.toFixed(1)}% Growth
                    </Typography>
                  </div>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6 md:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <Typography className="text-gray-400">New Hires (Last 30 days)</Typography>
                    <Typography variant="h5" className="text-white">
                      {dashboardData.workforceAnalytics.headcountTrend.newHires}
                    </Typography>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-4">
                    <div 
                      className="bg-[#23A49B] h-4 rounded-full"
                      style={{ width: `${(dashboardData.workforceAnalytics.headcountTrend.newHires / dashboardData.workforceAnalytics.headcountTrend.currentHeadcount) * 100}%` }}
                    ></div>
                  </div>
                  <Typography className="text-gray-400 text-sm mt-2">
                    {((dashboardData.workforceAnalytics.headcountTrend.newHires / dashboardData.workforceAnalytics.headcountTrend.currentHeadcount) * 100).toFixed(1)}% of total workforce
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "resources" && dashboardData && (
          <div className="grid grid-cols-1 gap-6">
            {/* Top Row: Small Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-[#23A49B]/20 flex items-center justify-center mr-4">
                  <Database className="w-7 h-7 text-[#23A49B]" />
                </div>
                <div>
                  <Typography className="text-gray-400 text-sm">Total Resources</Typography>
                  <Typography variant="h4" className="text-white font-bold">
                    {dashboardData.resourceManagement.resourceUtilization.reduce((sum, item) => sum + item.totalResources, 0)}
                  </Typography>
                </div>
              </div>
              
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-[#23A49B]/20 flex items-center justify-center mr-4">
                  <Briefcase className="w-7 h-7 text-[#23A49B]" />
                </div>
                <div>
                  <Typography className="text-gray-400 text-sm">Available Resources</Typography>
                  <Typography variant="h4" className="text-white font-bold">
                    {dashboardData.resourceManagement.resourceUtilization.reduce((sum, item) => sum + item.availableResources, 0)}
                  </Typography>
                </div>
              </div>
              
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-[#23A49B]/20 flex items-center justify-center mr-4">
                  <Calendar className="w-7 h-7 text-[#23A49B]" />
                </div>
                <div>
                  <Typography className="text-gray-400 text-sm">Total Reservations</Typography>
                  <Typography variant="h4" className="text-white font-bold">
                    {dashboardData.resourceManagement.resourceUtilization.reduce((sum, item) => sum + item.totalReservations, 0)}
                  </Typography>
                </div>
              </div>
            </div>
            
            {/* Middle Row: Two Equal Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Resource Utilization */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
                <Typography variant="h5" className="text-white mb-4">Resource Utilization</Typography>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={dashboardData.resourceManagement.resourceUtilization}
                      margin={{ top: 5, right: 30, left: 20, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="resourceType" 
                        tick={{ fill: colors.textSecondary }}
                        height={70}
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis tick={{ fill: colors.textSecondary }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                      />
                      <Legend 
                        wrapperStyle={{ color: colors.textSecondary }}
                        verticalAlign="top"
                        height={36}
                      />
                      <Bar 
                        dataKey="utilizationRate" 
                        name="Utilization Rate" 
                        fill={colors.chartColors[0]} 
                        radius={[4, 4, 0, 0]} 
                      />
                      <Bar 
                        dataKey="availableResources" 
                        name="Available" 
                        fill={colors.chartColors[1]} 
                        radius={[4, 4, 0, 0]} 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Maintenance by Resource Type */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="h5" className="text-white">Maintenance by Resource Type</Typography>
                  <div className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded-full">
                    {dashboardData.resourceManagement.maintenanceByResourceType.reduce((sum, item) => sum + item.maintenanceCount, 0)} Total
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dashboardData.resourceManagement.maintenanceByResourceType}
                      margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis type="number" tick={{ fill: colors.textSecondary }} />
                      <YAxis
                        type="category"
                        dataKey="resourceType"
                        tick={false}
                        axisLine={false}
                        width={10}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                        itemStyle={{ color: colors.text }}
                        formatter={(value, name, props) => [
                          `${value} ${value > 1 ? 'units' : 'unit'}`,
                          `${props.payload.resourceName || 'N/A'}`
                        ]}
                      />
                      <Bar dataKey="maintenanceCount" name="Under Maintenance">
                        {dashboardData.resourceManagement.maintenanceByResourceType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={colors.chartColors[index % colors.chartColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Resource Type Legend with Count */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {dashboardData.resourceManagement.maintenanceByResourceType.map((entry, index) => (
                    <div key={`legend-${index}`} className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: colors.chartColors[index % colors.chartColors.length] }}
                      />
                      <Typography className="text-gray-400 text-xs mr-1">{entry.resourceType}:</Typography>
                      <Typography className="text-white text-xs font-semibold">{entry.maintenanceCount}</Typography>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Bottom Row: Full Width Chart */}
            <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
              <Typography variant="h5" className="text-white mb-4">Most Requested Resources</Typography>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={dashboardData.resourceManagement.mostRequestedResources}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" tick={{ fill: colors.textSecondary }} />
                    <YAxis dataKey="resourceName" type="category" tick={{ fill: colors.textSecondary }} width={150} />
                    <Tooltip
                      contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                      labelStyle={{ color: colors.text }}
                      formatter={(value, name, props) => [`${value} reservations`, props.payload.resourceType]}
                    />
                    <Bar dataKey="reservationCount" name="Reservations" fill={colors.chartColors[2]} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeSection === "communication" && dashboardData && (
          <div className="space-y-6">
            {/* Key Statistics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Messages Card */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-[#23A49B]/20 flex items-center justify-center mr-4">
                  <MessageCircle className="w-7 h-7 text-[#23A49B]" />
                </div>
                <div>
                  <Typography className="text-gray-400 text-sm">Total Messages</Typography>
                  <Typography variant="h4" className="text-white font-bold">
                    {dashboardData.communicationAnalytics.messagesByDepartment.reduce((sum, dept) => sum + dept.messageCount, 0)}
                  </Typography>
                </div>
              </div>
              
              {/* Average Response Time Card */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-[#23A49B]/20 flex items-center justify-center mr-4">
                  <Clock className="w-7 h-7 text-[#23A49B]" />
                </div>
                <div>
                  <Typography className="text-gray-400 text-sm">Avg. Response Time</Typography>
                  <Typography variant="h4" className="text-white font-bold">
                    {dashboardData.communicationAnalytics.averageResponseTime?.averageResponseTime || 0}
                    <Typography as="span" className="text-sm text-gray-400 ml-1">min</Typography>
                  </Typography>
                </div>
              </div>
              
              {/* Notification Read Rate Card */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-[#23A49B]/20 flex items-center justify-center mr-4">
                  <Bell className="w-7 h-7 text-[#23A49B]" />
                </div>
                <div>
                  <Typography className="text-gray-400 text-sm">Avg. Notification Read Rate</Typography>
                  <Typography variant="h4" className="text-white font-bold">
                    {Math.round(dashboardData.communicationAnalytics.notificationRatesByType.reduce(
                      (sum, type) => sum + type.readRate, 0) / 
                      dashboardData.communicationAnalytics.notificationRatesByType.length
                    )}%
                  </Typography>
                </div>
              </div>
            </div>
            
            {/* Data Visualizations Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Department Communication Chart */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="h5" className="text-white">Messages by Department</Typography>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-[#23A49B]"></div>
                    <Typography className="text-gray-400 text-xs">Message Count</Typography>
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.communicationAnalytics.messagesByDepartment}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="departmentName" 
                        tick={{ fill: colors.textSecondary }}
                        tickFormatter={abbreviateDepartmentName} 
                      />
                      <YAxis tick={{ fill: colors.textSecondary }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                        formatter={(value) => [value, 'Messages']}
                        labelFormatter={(label) => label} 
                      />
                      <Bar dataKey="messageCount" fill={colors.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Peak Communication Times */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="h5" className="text-white">Peak Communication Times</Typography>
                  <div className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded-full">
                    {dashboardData.communicationAnalytics.peakCommunicationTimes.reduce((sum, hour) => sum + hour.messageCount, 0)} Messages
                  </div>
                </div>
                
                <div className="flex-grow h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.communicationAnalytics.peakCommunicationTimes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="hour" 
                        tick={{ fill: colors.textSecondary }} 
                        tickFormatter={(hour) => `${hour}:00`}
                      />
                      <YAxis tick={{ fill: colors.textSecondary }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                        formatter={(value) => [value, 'Messages']}
                        labelFormatter={(hour) => `${hour}:00 - ${(hour+1)%24}:00`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="messageCount" 
                        stroke={colors.primary} 
                        strokeWidth={2}
                        dot={{ fill: colors.primary, r: 4 }}
                        activeDot={{ fill: colors.primary, r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            {/* Second Row of Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Response Time Distribution Chart */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="h5" className="text-white">Response Time Distribution</Typography>
                  <div className="text-xs text-gray-400 bg-gray-700/50 px-2 py-1 rounded-full">
                    {dashboardData.communicationAnalytics.averageResponseTime?.responseCount || 0} Responses
                  </div>
                </div>
                
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.communicationAnalytics.averageResponseTime?.responseTimeDistribution || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis 
                        dataKey="range" 
                        tick={{ fill: colors.textSecondary }}
                      />
                      <YAxis tick={{ fill: colors.textSecondary }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: colors.background, borderColor: colors.border }}
                        labelStyle={{ color: colors.text }}
                        formatter={(value) => [value, 'Responses']}
                      />
                      <Bar dataKey="count" fill={colors.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Notification Read Rates */}
              <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-[#23A49B]/30 p-6">
                <div className="flex items-center justify-between mb-4">
                  <Typography variant="h5" className="text-white">Notification Read Rates</Typography>
                </div>
                <div className="space-y-4 mt-4">
                  {dashboardData.communicationAnalytics.notificationRatesByType.map((notif, index) => (
                    <div key={`notif-${index}`} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <Typography className="text-gray-300 text-sm">{notif.notificationType}</Typography>
                        <Typography className="text-white text-sm font-medium">{Math.round(notif.readRate)}%</Typography>
                      </div>
                      <div className="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${notif.readRate}%`,
                            backgroundColor: notif.readRate > 70 ? colors.chartColors[0] : notif.readRate > 40 ? colors.chartColors[6] : colors.chartColors[2]
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>{notif.read} read</span>
                        <span>{notif.total} total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default HRDashboardHomepage;