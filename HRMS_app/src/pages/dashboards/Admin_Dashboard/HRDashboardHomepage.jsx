import { useState, useEffect } from "react";
import { useChartColors } from "../../../theme/theme";
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
  const colors = useChartColors();
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
      <div className="min-h-screen bg-ground flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-t-teal border-r-teal/70 border-b-line border-l-line rounded-full animate-spin"></div>
          <p className="text-ink">Loading dashboard data...</p>
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
              <Award className="w-8 h-8 mr-3 text-teal" /> HR Analytics Dashboard
            </h2>
            <p className="text-ink-2 mt-1">
              ENOVA ROBOTICS Human Resources Management
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

        {/* Dashboard Content based on active section */}
        {activeSection === "overview" && dashboardData && (
          <div className="space-y-6">
            {/* Key Statistics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Total Employees Card */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-teal/10 flex items-center justify-center mr-4">
                  <Users className="w-7 h-7 text-teal" />
                </div>
                <div>
                  <p className="text-ink-2 text-sm">Total Employees</p>
                  <h4 className="text-xl text-ink font-bold">{dashboardData.overview.totalEmployees}</h4>
                </div>
              </div>
              
              {/* Total Departments Card */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-teal/10 flex items-center justify-center mr-4">
                  <Briefcase className="w-7 h-7 text-teal" />
                </div>
                <div>
                  <p className="text-ink-2 text-sm">Total Departments</p>
                  <h4 className="text-xl text-ink font-bold">{dashboardData.overview.totalDepartments}</h4>
                </div>
              </div>
              
              {/* Pending Leave Requests Card */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-teal/10 flex items-center justify-center mr-4">
                  <Calendar className="w-7 h-7 text-teal" />
                </div>
                <div>
                  <p className="text-ink-2 text-sm">Pending Leave Requests</p>
                  <h4 className="text-xl text-ink font-bold">{dashboardData.overview.pendingLeaveRequests}</h4>
                </div>
              </div>
            </div>
            
            {/* Data Visualizations Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Workforce Distribution Chart */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-lg font-semibold text-ink">Employees by Department</h5>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-teal"></div>
                    <p className="text-ink-2 text-xs">Employee Count</p>
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.workforceAnalytics.employeesByDepartment}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-lg font-semibold text-ink">Leave Status</h5>
                  <div className="text-xs text-ink-2 bg-sunk px-2 py-1 rounded-full">
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
                      <p className="text-ink-2 text-xs mr-1">{entry.status}:</p>
                      <p className="text-ink text-xs font-semibold">{entry.count}</p>
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
          <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Attendance by Department</h5>
              <div className="h-80">
                {dashboardData.attendanceAnalytics?.attendanceByDepartment?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.attendanceAnalytics.attendanceByDepartment}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
                    <p className="text-ink-2">No attendance data available</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Absenteeism Trend */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Absenteeism Trend</h5>
              <div className="h-80">
                {dashboardData.attendanceAnalytics?.absenteeismTrend?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dashboardData.attendanceAnalytics.absenteeismTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
                    <p className="text-ink-2">No absenteeism trend data available</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Late Arrivals by Department */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Late Arrivals by Department</h5>
              <div className="h-80">
                {dashboardData.attendanceAnalytics?.lateArrivalsByDepartment?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.attendanceAnalytics.lateArrivalsByDepartment}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
                    <p className="text-ink-2">No late arrivals data available</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Overtime Distribution */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Overtime by Department</h5>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.attendanceAnalytics.overtimeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Leave Days Usage</h5>
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <div className="relative inline-flex">
                    <div className="w-40 h-40 rounded-full border-8 border-line"></div>
                    <div 
                      className="absolute top-0 left-0 w-40 h-40 rounded-full border-8 border-teal"
                      style={{ 
                        clipPath: `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.cos(Math.PI * 2 * dashboardData.leaveManagement.leaveDaysUsageStats.usagePercentage / 100)}% ${50 - 50 * Math.sin(Math.PI * 2 * dashboardData.leaveManagement.leaveDaysUsageStats.usagePercentage / 100)}%, 50% 50%)`,
                        transform: 'rotate(90deg)'
                      }}
                    ></div>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <h3 className="text-2xl text-ink font-bold">
                        {dashboardData.leaveManagement.leaveDaysUsageStats.usagePercentage.toFixed(1)}%
                      </h3>
                      <p className="text-ink-2 text-sm">Usage</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <div>
                      <p className="text-ink-2 text-sm">Total Allowed</p>
                      <h5 className="text-lg font-semibold text-ink">
                        {dashboardData.leaveManagement.leaveDaysUsageStats.totalAllowed}
                      </h5>
                    </div>
                    <div>
                      <p className="text-ink-2 text-sm">Total Used</p>
                      <h5 className="text-lg font-semibold text-ink">
                        {dashboardData.leaveManagement.leaveDaysUsageStats.totalUsed}
                      </h5>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Leave Type Distribution */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Leave Types</h5>
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
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 col-span-1 lg:col-span-2">
              <h5 className="text-lg font-semibold text-ink mb-4">Leave Seasonal Patterns</h5>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.leaveManagement.leaveSeasonalPatterns}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Salary Distribution</h5>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.workforceAnalytics.salaryDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Manager-Employee Ratio</h5>
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <h2 className="text-3xl text-ink font-bold">
                    1:{dashboardData.workforceAnalytics.managerEmployeeRatio.ratio.toFixed(1)}
                  </h2>
                  <p className="text-ink-2 mt-2">
                    Manager to Employee Ratio
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 mt-8">
                    <div className="bg-raise rounded-lg p-4">
                      <p className="text-ink-2 text-sm">Managers</p>
                      <h5 className="text-lg font-semibold text-ink">
                        {dashboardData.workforceAnalytics.managerEmployeeRatio.managerCount}
                      </h5>
                    </div>
                    <div className="bg-raise rounded-lg p-4">
                      <p className="text-ink-2 text-sm">Employees</p>
                      <h5 className="text-lg font-semibold text-ink">
                        {dashboardData.workforceAnalytics.managerEmployeeRatio.employeeCount}
                      </h5>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Headcount Trend */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 col-span-1 lg:col-span-2">
              <h5 className="text-lg font-semibold text-ink mb-4">Headcount & Growth</h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-raise rounded-lg p-6 md:col-span-1 flex flex-col justify-center items-center">
                  <p className="text-ink-2 text-sm mb-2">Current Headcount</p>
                  <h3 className="text-2xl text-ink font-bold">
                    {dashboardData.workforceAnalytics.headcountTrend.currentHeadcount}
                  </h3>
                  <div className="flex items-center mt-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center mr-2 ${dashboardData.workforceAnalytics.headcountTrend.growth > 0 ? 'bg-teal/10' : 'bg-red/10'}`}>
                      <div className={`h-3 w-3 rounded-full ${dashboardData.workforceAnalytics.headcountTrend.growth > 0 ? 'bg-teal' : 'bg-red'}`}></div>
                    </div>
                    <p className={`text-sm ${dashboardData.workforceAnalytics.headcountTrend.growth > 0 ? 'text-teal' : 'text-red'}`}>
                      {dashboardData.workforceAnalytics.headcountTrend.growth.toFixed(1)}% Growth
                    </p>
                  </div>
                </div>
                
                <div className="bg-raise rounded-lg p-6 md:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-ink-2">New Hires (Last 30 days)</p>
                    <h5 className="text-lg font-semibold text-ink">
                      {dashboardData.workforceAnalytics.headcountTrend.newHires}
                    </h5>
                  </div>
                  <div className="w-full bg-sunk rounded-full h-4">
                    <div 
                      className="bg-teal h-4 rounded-full"
                      style={{ width: `${(dashboardData.workforceAnalytics.headcountTrend.newHires / dashboardData.workforceAnalytics.headcountTrend.currentHeadcount) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-ink-2 text-sm mt-2">
                    {((dashboardData.workforceAnalytics.headcountTrend.newHires / dashboardData.workforceAnalytics.headcountTrend.currentHeadcount) * 100).toFixed(1)}% of total workforce
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "resources" && dashboardData && (
          <div className="grid grid-cols-1 gap-6">
            {/* Top Row: Small Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-teal/10 flex items-center justify-center mr-4">
                  <Database className="w-7 h-7 text-teal" />
                </div>
                <div>
                  <p className="text-ink-2 text-sm">Total Resources</p>
                  <h4 className="text-xl text-ink font-bold">
                    {dashboardData.resourceManagement.resourceUtilization.reduce((sum, item) => sum + item.totalResources, 0)}
                  </h4>
                </div>
              </div>
              
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-teal/10 flex items-center justify-center mr-4">
                  <Briefcase className="w-7 h-7 text-teal" />
                </div>
                <div>
                  <p className="text-ink-2 text-sm">Available Resources</p>
                  <h4 className="text-xl text-ink font-bold">
                    {dashboardData.resourceManagement.resourceUtilization.reduce((sum, item) => sum + item.availableResources, 0)}
                  </h4>
                </div>
              </div>
              
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-teal/10 flex items-center justify-center mr-4">
                  <Calendar className="w-7 h-7 text-teal" />
                </div>
                <div>
                  <p className="text-ink-2 text-sm">Total Reservations</p>
                  <h4 className="text-xl text-ink font-bold">
                    {dashboardData.resourceManagement.resourceUtilization.reduce((sum, item) => sum + item.totalReservations, 0)}
                  </h4>
                </div>
              </div>
            </div>
            
            {/* Middle Row: Two Equal Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Resource Utilization */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <h5 className="text-lg font-semibold text-ink mb-4">Resource Utilization</h5>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={dashboardData.resourceManagement.resourceUtilization}
                      margin={{ top: 5, right: 30, left: 20, bottom: 70 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-lg font-semibold text-ink">Maintenance by Resource Type</h5>
                  <div className="text-xs text-ink-2 bg-sunk px-2 py-1 rounded-full">
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
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
                      <p className="text-ink-2 text-xs mr-1">{entry.resourceType}:</p>
                      <p className="text-ink text-xs font-semibold">{entry.maintenanceCount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Bottom Row: Full Width Chart */}
            <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
              <h5 className="text-lg font-semibold text-ink mb-4">Most Requested Resources</h5>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={dashboardData.resourceManagement.mostRequestedResources}>
                    <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-teal/10 flex items-center justify-center mr-4">
                  <MessageCircle className="w-7 h-7 text-teal" />
                </div>
                <div>
                  <p className="text-ink-2 text-sm">Total Messages</p>
                  <h4 className="text-xl text-ink font-bold">
                    {dashboardData.communicationAnalytics.messagesByDepartment.reduce((sum, dept) => sum + dept.messageCount, 0)}
                  </h4>
                </div>
              </div>
              
              {/* Average Response Time Card */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-teal/10 flex items-center justify-center mr-4">
                  <Clock className="w-7 h-7 text-teal" />
                </div>
                <div>
                  <p className="text-ink-2 text-sm">Avg. Response Time</p>
                  <h4 className="text-xl text-ink font-bold">
                    {dashboardData.communicationAnalytics.averageResponseTime?.averageResponseTime || 0}
                    <span className="text-sm text-ink-2 ml-1">min</span>
                  </h4>
                </div>
              </div>
              
              {/* Notification Read Rate Card */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex items-center">
                <div className="w-14 h-14 rounded-lg bg-teal/10 flex items-center justify-center mr-4">
                  <Bell className="w-7 h-7 text-teal" />
                </div>
                <div>
                  <p className="text-ink-2 text-sm">Avg. Notification Read Rate</p>
                  <h4 className="text-xl text-ink font-bold">
                    {Math.round(dashboardData.communicationAnalytics.notificationRatesByType.reduce(
                      (sum, type) => sum + type.readRate, 0) / 
                      dashboardData.communicationAnalytics.notificationRatesByType.length
                    )}%
                  </h4>
                </div>
              </div>
            </div>
            
            {/* Data Visualizations Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Department Communication Chart */}
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-lg font-semibold text-ink">Messages by Department</h5>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-teal"></div>
                    <p className="text-ink-2 text-xs">Message Count</p>
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.communicationAnalytics.messagesByDepartment}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-lg font-semibold text-ink">Peak Communication Times</h5>
                  <div className="text-xs text-ink-2 bg-sunk px-2 py-1 rounded-full">
                    {dashboardData.communicationAnalytics.peakCommunicationTimes.reduce((sum, hour) => sum + hour.messageCount, 0)} Messages
                  </div>
                </div>
                
                <div className="flex-grow h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dashboardData.communicationAnalytics.peakCommunicationTimes}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-lg font-semibold text-ink">Response Time Distribution</h5>
                  <div className="text-xs text-ink-2 bg-sunk px-2 py-1 rounded-full">
                    {dashboardData.communicationAnalytics.averageResponseTime?.responseCount || 0} Responses
                  </div>
                </div>
                
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboardData.communicationAnalytics.averageResponseTime?.responseTimeDistribution || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
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
              <div className="bg-raise backdrop-blur-xl rounded-2xl border border-line p-6">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-lg font-semibold text-ink">Notification Read Rates</h5>
                </div>
                <div className="space-y-4 mt-4">
                  {dashboardData.communicationAnalytics.notificationRatesByType.map((notif, index) => (
                    <div key={`notif-${index}`} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <p className="text-ink-2 text-sm">{notif.notificationType}</p>
                        <p className="text-ink text-sm font-medium">{Math.round(notif.readRate)}%</p>
                      </div>
                      <div className="w-full h-2 bg-sunk rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${notif.readRate}%`,
                            backgroundColor: notif.readRate > 70 ? colors.chartColors[0] : notif.readRate > 40 ? colors.chartColors[6] : colors.chartColors[2]
                          }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-ink-2">
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