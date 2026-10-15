const User = require('../Models/User');
const Attendance = require('../Models/Attendance');
const LeaveRequest = require('../Models/LeaveRequest');
const Department = require('../Models/Department');
const CalendarEvent = require('../Models/CalendarEvent');
const mongoose = require('mongoose');
const { FINAL_APPROVED } = require('../constants/leave');

// Main Employee Dashboard controller (kept as is)
exports.getEmployeeDashboardData = async (req, res) => {
    try {
      // Get logged in user ID
      const userId = req.user.id;
      const today = new Date();
      today.setHours(23, 59, 59, 999); 
      let startDate, endDate;
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate);
        startDate.setHours(0, 0, 0, 0); 
        if (isNaN(startDate.getTime())) {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          thirtyDaysAgo.setHours(0, 0, 0, 0); 
          startDate = thirtyDaysAgo;
        }
      } else {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0); 
        startDate = thirtyDaysAgo;
      }
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (isNaN(endDate.getTime())) {
          endDate = today;
        }
      } else {
        endDate = today; 
      }
      // Get employee's personal data
      const userData = await User.findById(userId);
      
      // Check if user data exists
      if (!userData) {
        return res.status(404).json({ message: 'User not found' });
      }
      
     // Get employee's KPIs
     const attendanceRate = await getAttendanceRate(userId, startDate, endDate);
     const punctualityScore = await getPunctualityScore(userId, startDate, endDate);
     const productionHoursTrend = await getProductionHoursTrend(userId, startDate, endDate);
     const overtimeHours = await getOvertimeHours(userId, startDate, endDate);

     const leaveBalanceIndicator = await getLeaveBalanceIndicator(userId);
     const leaveRequestStatus = await getLeaveRequestStatus(userId);
     const leaveUsageByType = await getLeaveUsageByType(userId);
    
     const upcomingEventsCounter = await getUpcomingEventsCounter(userId, startDate, endDate);
     const calendarDensity = await getCalendarDensity(userId, startDate, endDate);
     
     const performanceData = await getEmployeePerformance(userId, startDate, endDate);
     const teamInfo = await getTeamInfo(userId);

      res.status(200).json({
        userData: {
          name: `${userData.firstName} ${userData.lastName}`,
          department: userData.departmentId,
          position: userData.position,
          hireDate: userData.hireDate,
        },
        attendanceMetrics: {
          attendanceRate,
          punctualityScore,
          productionHoursTrend,
          overtimeHours
        },
        leaveMetrics: {
          leaveBalanceIndicator,
          leaveRequestStatus,
          leaveUsageByType
        },
        calendarMetrics: {
          upcomingEventsCounter,
          calendarDensity: {
            dailyDensity: calendarDensity.dailyDensity,
            busyHoursDistribution: calendarDensity.busyHoursDistribution,
            busyDays: calendarDensity.busyDays,
            totalEvents: calendarDensity.totalEvents
          }
        },
        performanceMetrics: performanceData,
        teamInfo: teamInfo,
      });
    } catch (error) {
      console.error('Error fetching employee dashboard data:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
    }
};

// Helper function to count workdays in a date range (excluding weekends)
function countWorkdaysInRange(startDate, endDate) {
  let count = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // 0 = Sunday, 6 = Saturday
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return count;
}

// Helper function to get ISO week number
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Helper function to get end of day from a date
function getEndOfDay(date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

// Helper function to get working days in a month (excludes weekends)
function getWorkingDaysInMonth(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  
  let workingDays = 0;
  for (let day = 1; day <= lastDay; day++) {
    const currentDate = new Date(year, month, day);
    const dayOfWeek = currentDate.getDay();
    // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  
  return workingDays;
}

// Helper function to get used leave days in a period
async function getUsedLeaveDays(userId, startDate, endDate) {
  const approvedLeaves = await LeaveRequest.find({
    employeeId: userId,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
    status: { $in: FINAL_APPROVED }
  });
  
  let totalLeaveDays = 0;
  
  approvedLeaves.forEach(leave => {
    // Calculate overlap between leave period and our target period
    const leaveStart = new Date(Math.max(leave.startDate, startDate));
    const leaveEnd = new Date(Math.min(leave.endDate, endDate));
    
    // Calculate business days between the dates
    totalLeaveDays += countWorkdaysInRange(leaveStart, leaveEnd);
  });
  
  return totalLeaveDays;
}
// Helper function to get team members and manager info
async function getTeamInfo(userId) {
  try {
    // Get user info to find department
    const user = await User.findById(userId);

    // Find user's department and populate both manager and employees
    const department = await Department.findById(user.departmentId)
      .populate('managerId', 'firstName lastName position skills profilePicture')
      .populate('employees', 'firstName lastName position skills profilePicture');

    // Format manager data if found
    const manager = department.managerId ? {
      id: department.managerId._id,
      name: `${department.managerId.firstName} ${department.managerId.lastName}`,
      position: department.managerId.position,
      skills: department.managerId.skills || [],
      profilePicture: department.managerId.profilePicture || null
    } : null;

    // Format team members excluding the current user
    const teamMembers = department.employees
      .filter(employee => employee._id.toString() !== userId.toString())
      .map(member => ({
        id: member._id,
        name: `${member.firstName} ${member.lastName}`,
        position: member.position,
        skills: member.skills || [],
        profilePicture: member.profilePicture || null
      }));

    return {
      department: {
        id: department._id,
        name: department.name
      },
      manager,
      teamMembers,
      totalTeamMembers: teamMembers.length 
    };
  } catch (error) {
    return { 
      manager: null, 
      teamMembers: [],
      department: null,
      totalTeamMembers: 0,
      error: error.message 
    };
  }
}

// ===== ATTENDANCE METRICS FUNCTIONS =====

async function getAttendanceRate(userId, startDate, endDate) {
  // Get all attendance records for the user
  const attendanceRecords = await Attendance.find({
    userId: userId,
    date: { $gte: startDate, $lte: endDate }
  });
  
  // Calculate workdays in range (excluding weekends)
  const workdays = countWorkdaysInRange(startDate, endDate);
  
  // Initialize counters for different attendance statuses
  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  
  // Create a map of dates with attendance records
  const attendanceMap = {};
  
  attendanceRecords.forEach(record => {
    const dateStr = record.date.toISOString().split('T')[0];
    
    // Map status directly from the record
    if (record.status === 'Present') {
      attendanceMap[dateStr] = 'Present';
      presentDays++;
    } else if (record.status === 'Late') {
      attendanceMap[dateStr] = 'Late';
      lateDays++;
    } else {
      attendanceMap[dateStr] = 'Absent';
      absentDays++;
    }
  });
  
  // Fill in all workdays in the range with status data
  const trend = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayOfWeek = currentDate.getDay();
    
    // Only include workdays (skip weekends)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // If we have an attendance record for this date, use it, otherwise mark as absent
      if (!attendanceMap[dateStr]) {
        absentDays++;
      }
      
      trend.push({
        date: dateStr,
        status: attendanceMap[dateStr] || 'Absent'
      });
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Sort by date
  trend.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Create summary data for donut chart
  const statusSummary = [
    { name: 'Present', value: presentDays, color: '#23A49B' },
    { name: 'Late', value: lateDays, color: '#F59E0B' },
    { name: 'Absent', value: absentDays, color: '#EF4444' }
  ];
  
  // Calculate attendance rate (counting late as half present)
  const attendanceRate = workdays > 0 ? ((presentDays + (lateDays * 0.5)) / workdays) * 100 : 0;
  
  return {
    rate: parseFloat(attendanceRate.toFixed(2)),
    presentDays,
    lateDays,
    absentDays,
    totalWorkdays: workdays,
    trend,
    statusSummary
  };
}

async function getPunctualityScore(userId, startDate, endDate) {
  // Get all attendance records for the user
  const attendanceRecords = await Attendance.find({
    userId: userId,
    date: { $gte: startDate, $lte: endDate }
    // Removed status: 'Present' filter to include Late records
  });

  // Count total recorded days
  const totalDays = attendanceRecords.length;
  
  // Count on-time arrivals
  const onTimeArrivals = attendanceRecords.filter(record =>
    !record.lateBy || record.lateBy === 0
  ).length;
  
  // Count late arrivals and prepare trend data
  const lateTrend = [];
  let totalLateMinutes = 0;
  
  attendanceRecords.forEach(record => {
    // If record has late minutes, add to trend data
    if (record.lateBy && record.lateBy > 0) {
      totalLateMinutes += record.lateBy;
      
      // Add to trend data
      lateTrend.push({
        date: record.date.toISOString().split('T')[0],
        lateMinutes: record.lateBy
      });
    }
  });
  
  // Calculate punctuality score
  const punctualityScore = totalDays > 0 ? (onTimeArrivals / totalDays) * 100 : 0;
  
  // Calculate average minutes late
  const lateArrivals = lateTrend.length;
  const avgLateMinutes = lateArrivals > 0 ? totalLateMinutes / lateArrivals : 0;
  
  // Sort trend by date
  lateTrend.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return {
    score: parseFloat(punctualityScore.toFixed(2)),
    onTimeArrivals,
    lateArrivals,
    averageLateMinutes: parseFloat(avgLateMinutes.toFixed(2)),
    lateTrend
  };
}

async function getProductionHoursTrend(userId, startDate, endDate) {
  // Get all attendance records for the user
  const attendanceRecords = await Attendance.find({
    userId: userId,
    date: { $gte: startDate, $lte: endDate },
    status: 'Present'  // Only consider days when present
  });
  
  // Prepare daily trend data
  const dailyTrend = attendanceRecords.map(record => ({
    date: record.date.toISOString().split('T')[0],
    productionHours: record.productionHours || 0
  }));
  
  // Sort by date
  dailyTrend.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate total and average production hours
  let totalHours = 0;
  dailyTrend.forEach(day => {
    totalHours += day.productionHours;
  });
  
  const averageHours = dailyTrend.length > 0 ? totalHours / dailyTrend.length : 0;
  
  // Create weekly trends from daily data
  const weeklyData = {};
  
  dailyTrend.forEach(day => {
    const date = new Date(day.date);
    const year = date.getFullYear();
    // Get ISO week number (1-53)
    const week = getWeekNumber(date);
    const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        totalHours: 0,
        daysWorked: 0
      };
    }
    
    weeklyData[weekKey].totalHours += day.productionHours;
    weeklyData[weekKey].daysWorked += 1;
  });
  
  // Convert weekly data to array
  const weeklyTrend = Object.keys(weeklyData).map(week => ({
    week,
    totalHours: parseFloat(weeklyData[week].totalHours.toFixed(2)),
    averageHoursPerDay: parseFloat((weeklyData[week].totalHours / weeklyData[week].daysWorked).toFixed(2))
  }));
  
  // Sort weekly trend by week
  weeklyTrend.sort((a, b) => a.week.localeCompare(b.week));
  
  return {
    dailyTrend,
    weeklyTrend,
    averageProductionHours: parseFloat(averageHours.toFixed(2)),
    totalProductionHours: parseFloat(totalHours.toFixed(2))
  };
}

async function getOvertimeHours(userId, startDate, endDate) {
  // Get all attendance records for the user
  const attendanceRecords = await Attendance.find({
    userId: userId,
    date: { $gte: startDate, $lte: endDate },
    status: 'Present',
    overtime: { $exists: true, $gt: 0 }  // Only days with overtime
  });
  
  // Prepare daily overtime data
  const dailyOvertime = attendanceRecords.map(record => ({
    date: record.date.toISOString().split('T')[0],
    overtimeHours: record.overtime / 60  // Convert minutes to hours
  }));
  
  // Sort by date
  dailyOvertime.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate total overtime
  let totalOvertimeMinutes = 0;
  attendanceRecords.forEach(record => {
    totalOvertimeMinutes += record.overtime || 0;
  });
  
  const totalOvertimeHours = totalOvertimeMinutes / 60;
  
  // Create weekly overtime data
  const weeklyData = {};
  
  dailyOvertime.forEach(day => {
    const date = new Date(day.date);
    const year = date.getFullYear();
    // Get ISO week number (1-53)
    const week = getWeekNumber(date);
    const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = 0;
    }
    
    weeklyData[weekKey] += day.overtimeHours;
  });
  
  // Convert weekly data to array
  const weeklyOvertime = Object.keys(weeklyData).map(week => ({
    week,
    overtimeHours: parseFloat(weeklyData[week].toFixed(2))
  }));
  
  // Sort weekly overtime by week
  weeklyOvertime.sort((a, b) => a.week.localeCompare(b.week));
  
  return {
    dailyOvertime,
    weeklyOvertime,
    totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
    daysWithOvertime: dailyOvertime.length
  };
}

// ===== LEAVE METRICS FUNCTIONS =====

async function getLeaveBalanceIndicator(userId) {
  // Get user data with leave information
  const userData = await User.findById(userId);
  
  if (!userData || typeof userData.leaveRequestAllowed === 'undefined' || typeof userData.remainingLeaveDays === 'undefined') {
    return {
      totalAllowed: 0,
      remaining: 0,
      used: 0,
      percentageUsed: 0
    };
  }
  
  const totalAllowed = userData.leaveRequestAllowed || 0;
  const remaining = userData.remainingLeaveDays || 0;
  const used = totalAllowed - remaining;
  const percentageUsed = totalAllowed > 0 ? (used / totalAllowed) * 100 : 0;
  
  return {
    totalAllowed,
    remaining,
    used,
    percentageUsed: parseFloat(percentageUsed.toFixed(2))
  };
}

async function getLeaveRequestStatus(userId) {
  // Get all leave requests for the user
  const leaveRequests = await LeaveRequest.find({ employeeId: userId });
  
  // Count requests by status
  const counts = {
    Pending: 0,
    'Manager Approved': 0,
    'Manager Rejected': 0,
    'Admin Approved': 0,
    'Admin Rejected': 0,
  };
  
  leaveRequests.forEach(request => {
    if (counts[request.status] !== undefined) {
      counts[request.status]++;
    }
  });
  
  // Get most recent leave requests
  const recentLeaveRequests = await LeaveRequest.find({ employeeId: userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('managerId', 'firstName lastName')
    .populate('adminId', 'firstName lastName')
    .select('startDate endDate reason status createdAt managerId adminId');
  
  return {
    counts,
    recentLeaveRequests: recentLeaveRequests.map(request => ({
      id: request._id,
      startDate: request.startDate,
      endDate: request.endDate,
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt,
      createdBy: request.createdBy,
      manager: request.managerId ? `${request.managerId.firstName} ${request.managerId.lastName}` : null,
      admin: request.adminId ? `${request.adminId.firstName} ${request.adminId.lastName}` : null
    }))
  };
}

async function getLeaveUsageByType(userId) {
  // Get all approved leave requests for the user (considering multiple approval states)
  const leaveRequests = await LeaveRequest.find({ 
    employeeId: userId, 
    status: { $in: FINAL_APPROVED }
  });
  
  // Count leaves by type (reason)
  const leaveTypeCount = {};
  const leaveTypeDays = {};
  
  leaveRequests.forEach(request => {
    const reason = request.reason || 'Other';
    
    // Count occurrences
    if (!leaveTypeCount[reason]) {
      leaveTypeCount[reason] = 0;
    }
    leaveTypeCount[reason]++;
    
    // Count days
    if (!leaveTypeDays[reason]) {
      leaveTypeDays[reason] = 0;
    }
    
    // Calculate days difference (inclusive of start and end date)
    const startDate = new Date(request.startDate);
    const endDate = new Date(request.endDate);
    const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    leaveTypeDays[reason] += days;
  });
  
  // Convert to array format for charts
  const leaveUsageByType = Object.keys(leaveTypeCount).map(reason => ({
    reason,
    count: leaveTypeCount[reason],
    days: leaveTypeDays[reason]
  }));
  
  return {
    leaveUsageByType,
    totalLeavesTaken: leaveRequests.length,
    totalDaysTaken: Object.values(leaveTypeDays).reduce((sum, days) => sum + days, 0)
  };
}

// ===== CALENDAR METRICS FUNCTIONS =====

async function getUpcomingEventsCounter(userId, startDate, endDate) {

  const nextWeek = new Date(startDate);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const nextMonth = new Date(startDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  // Convert userId to MongoDB ObjectId properly
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  // Count upcoming events by type from the given start date
  const upcomingEventsToday = await countEventsByType(userObjectId, startDate, getEndOfDay(startDate));
  const upcomingEventsThisWeek = await countEventsByType(userObjectId, startDate, nextWeek);
  const upcomingEventsThisMonth = await countEventsByType(userObjectId, startDate, nextMonth);
  
  // Get next 5 upcoming events from the given start date
  const nextEvents = await CalendarEvent.find({
    $or: [
      { 'usersInvolved.userId': userObjectId },
      { 'createdBy': userObjectId }
    ],
    startDateTime: { $gte: startDate },
    status: { $ne: 'declined' }
  })
  .sort({ startDateTime: 1 })
  .limit(5)
  .select('title eventType startDateTime endDateTime location');
  
  // Format nextEvents to match frontend expectations
  const formattedNextEvents = nextEvents.map(event => ({
    id: event._id.toString(),
    title: event.title,
    type: event.eventType, 
    startDate: event.startDateTime,
    endDate: event.endDateTime,
    location: event.location || ""
  }));
  
  return {
    today: upcomingEventsToday,
    thisWeek: upcomingEventsThisWeek,
    thisMonth: upcomingEventsThisMonth,
    nextEvents: formattedNextEvents
  };
}

async function countEventsByType(userObjectId, startDate, endDate) {
  
  try {
    const eventCounts = await CalendarEvent.aggregate([
      {
        $match: {
          $or: [
            { 'usersInvolved.userId': userObjectId },
            { 'createdBy': userObjectId }
          ],
          startDateTime: { $gte: startDate, $lte: endDate },
          status: { $ne: 'declined' } 
        }
      },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Initialize with all required properties
    const result = {
      meeting: 0,
      mission: 0,
      resourceReservation: 0,
      other: 0
    };
    
    // Fill in actual counts
    eventCounts.forEach(item => {
      if (item._id && result.hasOwnProperty(item._id)) {
        result[item._id] = item.count;
      } else if (item._id) {
        result.other += item.count;
      }
    });
    
    // Calculate total after all individual counts are populated
    result.total = result.meeting + result.mission + result.resourceReservation + result.other;
    
    return result;
  } catch (error) {
    // Return the default structure even on error
    return {
      meeting: 0,
      mission: 0,
      resourceReservation: 0,
      other: 0,
      total: 0
    };
  }
}

async function getCalendarDensity(userId, startDate, endDate) {
  // Convert userId to MongoDB ObjectId properly
  const userObjectId = new mongoose.Types.ObjectId(userId);
  
  // Clone the dates to avoid modifying the originals
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Ensure start date is at beginning of day
  start.setHours(0, 0, 0, 0);
  
  // Ensure end date is at end of day
  end.setHours(23, 59, 59, 999);
  
  // Create day buckets for the date range
  const density = [];
  const currentDate = new Date(start);
  
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = getEndOfDay(currentDate); 
    
    // Count events for this day
    const eventCount = await CalendarEvent.countDocuments({
      $or: [
        { 'usersInvolved.userId': userObjectId },
        { 'createdBy': userObjectId }
      ],
      $and: [
        {
          $or: [
            // Events that start on this day
            { startDateTime: { $gte: dayStart, $lte: dayEnd } },
            // Events that end on this day
            { endDateTime: { $gte: dayStart, $lte: dayEnd } },
            // Events that span over this day
            { $and: [
              { startDateTime: { $lte: dayStart } },
              { endDateTime: { $gte: dayEnd } }
            ]}
          ]
        },
        { status: { $ne: 'declined' } }
      ]
    });
    
    density.push({
      date: dateStr,
      count: eventCount
    });
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Get busy hours distribution
  const busyHoursDistribution = await getHourlyDistribution(userObjectId, start, end);
  
  // Count busy days (more than 3 events)
  const busyDays = density.filter(day => day.count > 3).length;
  
  // Calculate total events
  const totalEvents = density.reduce((sum, day) => sum + day.count, 0);
  
  return {
    dailyDensity: density,
    busyHoursDistribution,
    busyDays,
    totalEvents
  };
}

async function getHourlyDistribution(userObjectId, startDate, endDate) {
  // Initialize hours array (0-23)
  const hourCounts = new Array(24).fill(0);
  
  // Get all events in the date range
  const events = await CalendarEvent.find({
    $or: [
      { 'usersInvolved.userId': userObjectId },
      { 'createdBy': userObjectId }
    ],
    startDateTime: { $gte: startDate, $lte: endDate },
    status: { $ne: 'declined' }
  });
  
  // Count events by hour of day
  events.forEach(event => {
    const hour = event.startDateTime.getHours();
    hourCounts[hour]++;
  });
  
  // Format for chart display as expected by frontend
  return hourCounts.map((count, hour) => {
    // Format hours in a way that will display correctly on frontend
    const formattedHour = `${hour}:00`;
    const nextHour = (hour + 1) % 24;
    const formattedNextHour = `${nextHour}:00`;
    
    return {
      hour,
      count,
      timeLabel: `${formattedHour} - ${formattedNextHour}`
    };
  });
}

// ===== PERFORMANCE METRICS FUNCTIONS =====

async function getEmployeePerformance(userId, startDate, endDate) {
  // Clone the dates to avoid modifying the originals
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Create month buckets for the date range
  const performanceTrend = [];
  const currentDate = new Date(start);
  currentDate.setDate(1); // Start from the first day of month
  
  // Track previous year's data for comparison
  const previousYearStart = new Date(start);
  previousYearStart.setFullYear(previousYearStart.getFullYear() - 1);
  const previousYearEnd = new Date(end);
  previousYearEnd.setFullYear(previousYearEnd.getFullYear() - 1);
  const previousYearData = [];
  
  // Process each month in the range
  while (currentDate <= end) {
    const monthStr = currentDate.toLocaleString('en-US', { month: 'short' });
    const monthStart = new Date(currentDate);
    const monthEnd = new Date(currentDate);
    monthEnd.setMonth(monthEnd.getMonth() + 1);
    monthEnd.setDate(0); // Last day of current month
    monthEnd.setHours(23, 59, 59, 999);
    
    // Get attendance data for the month
    const attendanceData = await Attendance.find({
      userId: userId,
      date: { $gte: monthStart, $lte: monthEnd }
    });
    
    // Calculate working days in month (excluding weekends)
    const workingDays = getWorkingDaysInMonth(monthStart);
    
    // Get leave days used in the month
    const leaveDays = await getUsedLeaveDays(userId, monthStart, monthEnd);
    
    // Calculate attendance metrics
    const presentDays = attendanceData.filter(a => a.status === 'Present').length;
    const lateDays = attendanceData.filter(a => a.status === 'Late').length;
    const absentDays = attendanceData.filter(a => a.status === 'Absent').length;
    
    // Calculate expected working days (adjusted for approved leave)
    const expectedWorkDays = workingDays - leaveDays;
    
    // Calculate attendance rate
    const attendanceRate = expectedWorkDays > 0 
      ? ((presentDays + lateDays) / expectedWorkDays) * 100 
      : 100;
    
    // Calculate punctuality rate
    const punctualityRate = (presentDays + lateDays) > 0 
      ? (presentDays / (presentDays + lateDays)) * 100 
      : 100;
    
    // Calculate productivity metrics
    const totalProductionHours = attendanceData.reduce((sum, record) => 
      sum + (record.productionHours || 0), 0);
    
    // Expected production hours (8 hours per working day minus leave days)
    const expectedProductionHours = expectedWorkDays * 8;
    
    // Calculate productivity rate
    const productivityRate = expectedProductionHours > 0 
      ? (totalProductionHours / expectedProductionHours) * 100 
      : 100;
    
    // Get completed calendar events
    const completedEvents = await CalendarEvent.countDocuments({
      $or: [
        { createdBy: userId },
        { 'usersInvolved.userId': userId, 'usersInvolved.status': 'accepted' }
      ],
      startDateTime: { $gte: monthStart, $lte: monthEnd },
      status: 'approved'
    });
    
    // Calculate overall performance score (weighted average)
    const performanceScore = Math.round(
      (attendanceRate * 0.3) +  // 30% weight for attendance
      (punctualityRate * 0.2) + // 20% weight for punctuality
      (productivityRate * 0.4) + // 40% weight for productivity
      (completedEvents > 3 ? 100 : completedEvents * 25) * 0.1 // 10% weight for event completion
    );
    
    // Cap the performance score at 100
    const cappedScore = Math.min(100, performanceScore);
    
    // Push to monthly trend
    performanceTrend.push({
      month: monthStr,
      value: cappedScore,
      productionHours: totalProductionHours,
      expectedHours: expectedProductionHours,
      attendanceRate: Math.round(attendanceRate),
      punctualityRate: Math.round(punctualityRate)
    });
    
    // Calculate performance for the same month last year (for comparison)
    const lastYearMonth = new Date(monthStart);
    lastYearMonth.setFullYear(lastYearMonth.getFullYear() - 1);
    const lastYearMonthEnd = new Date(monthEnd);
    lastYearMonthEnd.setFullYear(lastYearMonthEnd.getFullYear() - 1);
    
    // Get last year's attendance data
    const lastYearAttendance = await Attendance.find({
      userId: userId,
      date: { $gte: lastYearMonth, $lte: lastYearMonthEnd }
    });
    
    if (lastYearAttendance.length > 0) {
      const lastYearPresentDays = lastYearAttendance.filter(a => a.status === 'Present').length;
      const lastYearLateDays = lastYearAttendance.filter(a => a.status === 'Late').length;
      const lastYearWorkingDays = getWorkingDaysInMonth(lastYearMonth);
      const lastYearLeaveDays = await getUsedLeaveDays(userId, lastYearMonth, lastYearMonthEnd);
      const lastYearExpectedDays = lastYearWorkingDays - lastYearLeaveDays;
      
      const lastYearAttendanceRate = lastYearExpectedDays > 0 
        ? ((lastYearPresentDays + lastYearLateDays) / lastYearExpectedDays) * 100 
        : 100;
      
      const lastYearPunctualityRate = (lastYearPresentDays + lastYearLateDays) > 0 
        ? (lastYearPresentDays / (lastYearPresentDays + lastYearLateDays)) * 100 
        : 100;
      
      const lastYearProductionHours = lastYearAttendance.reduce((sum, record) => 
        sum + (record.productionHours || 0), 0);
      
      const lastYearExpectedHours = lastYearExpectedDays * 8;
      
      const lastYearProductivityRate = lastYearExpectedHours > 0 
        ? (lastYearProductionHours / lastYearExpectedHours) * 100 
        : 100;
      
      const lastYearCompletedEvents = await CalendarEvent.countDocuments({
        $or: [
          { createdBy: userId },
          { 'usersInvolved.userId': userId, 'usersInvolved.status': 'accepted' }
        ],
        startDateTime: { $gte: lastYearMonth, $lte: lastYearMonthEnd },
        status: 'approved'
      });

      const lastYearPerformanceScore = Math.round(
        (lastYearAttendanceRate * 0.3) +
        (lastYearPunctualityRate * 0.2) +
        (lastYearProductivityRate * 0.4) +
        (lastYearCompletedEvents > 3 ? 100 : lastYearCompletedEvents * 25) * 0.1
      );
      
      previousYearData.push({
        month: monthStr,
        value: Math.min(100, lastYearPerformanceScore)
      });
    }
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  // Calculate the overall performance score (average of all months)
  const overallScore = performanceTrend.length > 0
    ? Math.round(performanceTrend.reduce((sum, month) => sum + month.value, 0) / performanceTrend.length)
    : 0;
  
  // Calculate previous year's overall score
  const previousYearScore = previousYearData.length > 0
    ? Math.round(previousYearData.reduce((sum, month) => sum + month.value, 0) / previousYearData.length)
    : 0;
  
  // Calculate year-over-year change percentage
  const changePercentage = previousYearScore > 0
    ? Math.round(((overallScore - previousYearScore) / previousYearScore) * 100)
    : 0;
  
  return {
    score: overallScore,
    trend: performanceTrend,
    vsLastYear: changePercentage,
    previousYearData: previousYearData,
    details: {
      totalProductionHours: performanceTrend.reduce((sum, month) => sum + month.productionHours, 0),
      expectedProductionHours: performanceTrend.reduce((sum, month) => sum + month.expectedHours, 0),
      averageAttendanceRate: Math.round(
        performanceTrend.reduce((sum, month) => sum + month.attendanceRate, 0) / performanceTrend.length
      ),
      averagePunctualityRate: Math.round(
        performanceTrend.reduce((sum, month) => sum + month.punctualityRate, 0) / performanceTrend.length
      )
    }
  };
}
module.exports = exports;