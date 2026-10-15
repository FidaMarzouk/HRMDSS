// Manager Dashboard Controller
const mongoose = require('mongoose');
const User = require('../Models/User');
const Attendance = require('../Models/Attendance');
const LeaveRequest = require('../Models/LeaveRequest');
const CalendarEvent = require('../Models/CalendarEvent');
const Resource = require('../Models/Resource');
const Department = require('../Models/Department');
const Chat = require('../Models/TeamChat');
const Notification = require('../Models/Notification');
const { FINAL_APPROVED } = require('../constants/leave');

// Main Manager Dashboard controller
exports.getManagerDashboardData = async (req, res) => {
    try {
      const managerId = req.user.id;
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
    const managerData = await User.findById(managerId);
    if (!managerData || managerData.role !== 'manager') {
      return res.status(404).json({ message: 'Manager not found or insufficient permissions' });
    }
    // Get department info
    const departmentData = await Department.findOne({ managerId: managerId });
    
    if (!departmentData) {
      return res.status(404).json({ message: 'Department data not found' });
    }
    
    // Get team data - employees under this manager
    const teamData = await User.find({ managerId: managerId });
    const teamIds = teamData.map(employee => employee._id);
    
    // Team attendance metrics
    const attendanceRate = await getTeamAttendanceRate(teamIds, startDate, endDate);
    const lateArrivalsTrend = await getLateArrivalsTrend(teamIds, startDate, endDate);
    const absenteeismRate = await getAbsenteeismRate(teamIds, startDate, endDate);
    const avgCheckTimes = await getAverageCheckTimes(teamIds, startDate, endDate);
    
    // Leave management metrics
    const pendingLeaveRequests = await getPendingLeaveRequests(managerId);
    const leaveApprovalRate = await getLeaveApprovalRate(managerId, startDate, endDate);
    const departmentLeaveCalendar = await getDepartmentLeaveCalendar(departmentData._id, startDate, endDate);
    const leaveDistribution = await getLeaveDistributionByType(teamIds, startDate, endDate);
    
    // Team productivity metrics
    const avgProductionHours = await getAverageProductionHours(teamIds, startDate, endDate);
    const overtimeTrends = await getOvertimeTrends(teamIds, startDate, endDate);
    const teamMemberProductivity = await getTeamMemberProductivityMetrics(teamIds, startDate, endDate);
    
    // Team communication
    const unreadMessagesCount = await getUnreadMessagesCount(managerId);
    const responseTime = await getResponseTimeToMessages(managerId, startDate, endDate);
    const teamEngagement = await getTeamEngagementInChats(teamIds, startDate, endDate);
    const teamDailyActivity = await getTeamDailyMessageActivity(teamIds, startDate, endDate);
    
    // Department calendar
    const upcomingEvents = await getUpcomingEvents(departmentData._id, teamIds, startDate, endDate);
    const eventParticipationRates = await getEventParticipationRates(departmentData._id, teamIds, startDate, endDate);
    
    // Team composition
    const skillsDistribution = await getEmployeeSkillsDistribution(teamIds);
    const departmentHiringTimeline = await getDepartmentHiringTimeline(teamIds);
    
    res.status(200).json({
      managerData: {
        name: `${managerData.firstName} ${managerData.lastName}`,
        department: departmentData.name,
        position: managerData.position,
        teamSize: teamData.length
      },
      teamAttendanceMetrics: {
        attendanceRate,
        lateArrivalsTrend,
        absenteeismRate,
        avgCheckTimes
      },
      leaveManagementMetrics: {
        pendingLeaveRequests,
        leaveApprovalRate,
        departmentLeaveCalendar,
        leaveDistribution
      },
      teamProductivity: {
        avgProductionHours,
        overtimeTrends,
        teamMemberProductivity
      },
      communicationMetrics: {
        unreadMessagesCount,
        responseTime,
        teamEngagement,
        dailyMessages: teamDailyActivity.dailyMessages 
      },
      calendarMetrics: {
        upcomingEvents,
        eventParticipationRates
      },
      teamComposition: {
        skillsDistribution,
        departmentHiringTimeline
      },
    });
  } catch (error) {
    console.error('Error fetching manager dashboard data:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
};

// Helper Functions for Team Attendance Metrics
async function getTeamAttendanceRate(teamIds, startDate, endDate) {
  const workDays = getWorkingDaysBetweenDates(startDate, endDate);
  const expectedAttendance = teamIds.length * workDays;
  
  const attendanceCount = await Attendance.countDocuments({
    userId: { $in: teamIds },
    date: { $gte: startDate, $lte: endDate },
    status: 'Present'
  });
  
  return {
    rate: expectedAttendance > 0 ? (attendanceCount / expectedAttendance) * 100 : 0,
    expectedAttendance,
    actualAttendance: attendanceCount
  };
}

async function getLateArrivalsTrend(teamIds, startDate, endDate) {
  // Clone the dates to avoid modifying the originals
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Ensure proper time bounds
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  // Group late arrivals by date
  const lateArrivals = await Attendance.aggregate([
    {
      $match: {
        userId: { $in: teamIds.map(id => new mongoose.Types.ObjectId(id)) },
        date: { $gte: start, $lte: end },
        status: 'Late'
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  
  // Fill in missing dates with zero counts
  const trend = [];
  const currentDate = new Date(start);
  while (currentDate <= end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const existingData = lateArrivals.find(item => item._id === dateStr);
    
    trend.push({
      date: dateStr,
      count: existingData ? existingData.count : 0
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return trend;
}

async function getAbsenteeismRate(teamIds, startDate, endDate) {
  const workDays = getWorkingDaysBetweenDates(startDate, endDate);
  const expectedAttendance = teamIds.length * workDays;
  
  const absentCount = await Attendance.countDocuments({
    userId: { $in: teamIds },
    date: { $gte: startDate, $lte: endDate },
    status: 'Absent'
  });
  
  // Calculate approved leave days during this period
  const approvedLeaves = await LeaveRequest.aggregate([
    {
      $match: {
        employeeId: { $in: teamIds.map(id => new mongoose.Types.ObjectId(id)) },
        status: { $in: FINAL_APPROVED },
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      }
    },
    {
      $project: {
        days: {
          $ceil: {
            $divide: [
              { $subtract: [
                { $cond: [{ $lt: ['$endDate', endDate] }, '$endDate', endDate] },
                { $cond: [{ $gt: ['$startDate', startDate] }, '$startDate', startDate] }
              ]},
              86400000 // ms in a day
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: null,
        totalLeaveDays: { $sum: '$days' }
      }
    }
  ]);
  
  const approvedLeaveDays = approvedLeaves.length > 0 ? approvedLeaves[0].totalLeaveDays : 0;
  
  // Absenteeism rate excludes approved leaves
  const adjustedAbsentRate = expectedAttendance > 0 ? 
    ((absentCount - approvedLeaveDays) / expectedAttendance) * 100 : 0;
  
  return {
    rate: Math.max(0, adjustedAbsentRate), // Ensure no negative rate
    absentDays: absentCount,
    approvedLeaveDays,
    workDays
  };
}

async function getAverageCheckTimes(teamIds, startDate, endDate) {
  // Get average check-in and check-out times for the team
  const checkTimeAggregation = await Attendance.aggregate([
    {
      $match: {
        userId: { $in: teamIds.map(id => new mongoose.Types.ObjectId(id)) },
        date: { $gte: startDate, $lte: endDate },
        status: { $ne: 'Absent' } // Exclude absent records
      }
    },
    {
      $group: {
        _id: null,
        avgCheckInHour: { 
          $avg: { $hour: "$checkIn" } 
        },
        avgCheckInMinute: { 
          $avg: { $minute: "$checkIn" } 
        },
        avgCheckOutHour: { 
          $avg: { $hour: "$checkOut" } 
        },
        avgCheckOutMinute: { 
          $avg: { $minute: "$checkOut" } 
        }
      }
    }
  ]);
  
  if (checkTimeAggregation.length === 0) {
    return {
      averageCheckIn: 'No data',
      averageCheckOut: 'No data'
    };
  }
  
  const result = checkTimeAggregation[0];
  
  // Format the times
  const checkInHour = Math.floor(result.avgCheckInHour);
  const checkInMinute = Math.floor(result.avgCheckInMinute);
  const checkOutHour = Math.floor(result.avgCheckOutHour);
  const checkOutMinute = Math.floor(result.avgCheckOutMinute);
  
  const formatTime = (hours, minutes) => {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };
  
  return {
    averageCheckIn: formatTime(checkInHour, checkInMinute),
    averageCheckOut: formatTime(checkOutHour, checkOutMinute)
  };
}

// Helper Functions for Leave Management Metrics
async function getPendingLeaveRequests(managerId) {
  const pendingRequests = await LeaveRequest.find({
    managerId: managerId,
    status: 'Pending'
  }).populate('employeeId', 'firstName lastName');
  
  return {
    count: pendingRequests.length,
    requests: pendingRequests.map(req => ({
      id: req._id,
      employee: `${req.employeeId.firstName} ${req.employeeId.lastName}`,
      startDate: req.startDate,
      endDate: req.endDate,
      reason: req.reason,
      createdAt: req.createdAt
    }))
  };
}

async function getLeaveApprovalRate(managerId, startDate, endDate) {
  const totalRequests = await LeaveRequest.countDocuments({
    managerId: managerId,
    createdAt: { $gte: startDate, $lte: endDate }
  });
  
  const approvedRequests = await LeaveRequest.countDocuments({
    managerId: managerId,
    createdAt: { $gte: startDate, $lte: endDate },
    status: { $in: ['Manager Approved', ...FINAL_APPROVED] }
  });
  
  const rejectedRequests = await LeaveRequest.countDocuments({
    managerId: managerId,
    createdAt: { $gte: startDate, $lte: endDate },
    status: { $in: ['Manager Rejected', 'Admin Rejected', 'CEO Rejected'] }
  });
  
  const pendingRequests = await LeaveRequest.countDocuments({
    managerId: managerId,
    createdAt: { $gte: startDate, $lte: endDate },
    status: 'Pending'
  });
  
  // Calculate approval rate only from decided requests
  const decidedRequests = approvedRequests + rejectedRequests;
  const approvalRate = decidedRequests > 0 ? (approvedRequests / decidedRequests) * 100 : 0;
  
  return {
    approvalRate,
    totalRequests,
    approvedRequests,
    rejectedRequests,
    pendingRequests
  };
}

async function getDepartmentLeaveCalendar(departmentId, startDate, endDate) {
    // Find all employees in the department
    const employees = await User.find({ departmentId: departmentId });
    const employeeIds = employees.map(emp => emp._id);
    
    // Find all approved leaves in the date range
    const leaves = await LeaveRequest.find({
      employeeId: { $in: employeeIds },
      status: { $in: FINAL_APPROVED },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    }).populate('employeeId', 'firstName lastName');
    
    // Format the leaves for list display
    const leavesList = leaves.map(leave => ({
      id: leave._id,
      employee: `${leave.employeeId.firstName} ${leave.employeeId.lastName}`,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason,
      status: leave.status
    }));
    
    // Format the leaves for calendar display by creating day-by-day entries
    const leavesByDay = {};
    
    // For each leave, create entries for each day the leave spans
    leaves.forEach(leave => {
      const currentDate = new Date(leave.startDate);
      const lastDate = new Date(leave.endDate);
      
      // Add one day to last date to include it in the range
      lastDate.setDate(lastDate.getDate() + 1);
      
      while (currentDate < lastDate) {
        const dateKey = currentDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        
        if (!leavesByDay[dateKey]) {
          leavesByDay[dateKey] = [];
        }
        
        leavesByDay[dateKey].push({
          id: leave._id,
          employee: `${leave.employeeId.firstName} ${leave.employeeId.lastName}`,
          reason: leave.reason,
          status: leave.status
        });
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return {
      leavesList, // Original list format for backward compatibility
      leavesByDay, // Calendar-friendly format with day-by-day entries
      // Include the date range for the frontend
      calendarRange: {
        startDate,
        endDate
      }
    };
}

async function getLeaveDistributionByType(teamIds, startDate, endDate) {
  const leaveDistribution = await LeaveRequest.aggregate([
    {
      $match: {
        employeeId: { $in: teamIds.map(id => new mongoose.Types.ObjectId(id)) },
        startDate: { $lte: endDate },
        endDate: { $gte: startDate },
        status: { $in: FINAL_APPROVED }
      }
    },
    {
      $group: {
        _id: '$reason',
        count: { $sum: 1 },
        days: {
          $sum: {
            $ceil: {
              $divide: [
                { $subtract: [
                  { $cond: [{ $lt: ['$endDate', endDate] }, '$endDate', endDate] },
                  { $cond: [{ $gt: ['$startDate', startDate] }, '$startDate', startDate] }
                ]},
                86400000 // ms in a day
              ]
            }
          }
        }
      }
    },
    {
      $sort: { days: -1 }
    }
  ]);
  
  // Format the distribution
  return leaveDistribution.map(item => ({
    type: item._id,
    count: item.count,
    days: item.days
  }));
}

// Helper Functions for Team Productivity Metrics
async function getAverageProductionHours(teamIds, startDate, endDate) {
  const productionHours = await Attendance.aggregate([
    {
      $match: {
        userId: { $in: teamIds.map(id => new mongoose.Types.ObjectId(id)) },
        date: { $gte: startDate, $lte: endDate },
        status: { $ne: 'Absent' }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        avgHours: { $avg: "$productionHours" }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  
  // Calculate overall average
  const totalHours = productionHours.reduce((sum, day) => sum + day.avgHours, 0);
  const overallAverage = productionHours.length > 0 ? totalHours / productionHours.length : 0;
  
  return {
    dailyAverage: productionHours,
    overallAverage: parseFloat(overallAverage.toFixed(2))
  };
}

async function getOvertimeTrends(teamIds, startDate, endDate) {
  const overtimeTrends = await Attendance.aggregate([
    {
      $match: {
        userId: { $in: teamIds.map(id => new mongoose.Types.ObjectId(id)) },
        date: { $gte: startDate, $lte: endDate },
        overtime: { $gt: 0 }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
        totalOvertime: { $sum: "$overtime" },
        employeeCount: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  
  // Calculate average overtime per employee
  return overtimeTrends.map(day => ({
    date: day._id,
    totalMinutes: day.totalOvertime,
    totalHours: parseFloat((day.totalOvertime / 60).toFixed(2)),
    employeeCount: day.employeeCount,
    averagePerEmployee: parseFloat((day.totalOvertime / day.employeeCount / 60).toFixed(2))
  }));
}

async function getTeamMemberProductivityMetrics(teamIds, startDate, endDate) {
    // Find all team members
    const teamMembers = await User.find({ _id: { $in: teamIds } })
      .select('_id firstName lastName position');
    
    const teamMemberMetrics = [];
    
    // Helper function to count working days between two dates
    function getWorkingDaysBetweenDates(startDate, endDate) {
      let count = 0;
      const currentDate = new Date(startDate);
      const lastDate = new Date(endDate);
      
      while (currentDate <= lastDate) {
        const dayOfWeek = currentDate.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return count;
    }
    
    // Helper function to count workdays in a date range
    function countWorkdaysInRange(startDate, endDate) {
      let count = 0;
      const currentDate = new Date(startDate);
      const lastDate = new Date(endDate);
      
      while (currentDate <= lastDate) {
        const dayOfWeek = currentDate.getDay();
        // Skip weekends (0 = Sunday, 6 = Saturday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return count;
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
    
    // For each team member, gather their productivity metrics
    for (const member of teamMembers) {
      try {
        // Get attendance data for date range
        const attendanceData = await Attendance.find({
          userId: member._id,
          date: { $gte: startDate, $lte: endDate }
        });
        
        // Calculate working days in period (excluding weekends)
        const workingDays = getWorkingDaysBetweenDates(startDate, endDate);
        
        // Get leave days used in the period
        const leaveDays = await getUsedLeaveDays(member._id, startDate, endDate);
        
        // Calculate attendance metrics
        const presentDays = attendanceData.filter(a => a.status === 'Present').length;
        const lateDays = attendanceData.filter(a => a.status === 'Late').length;
        
        // Calculate expected working days (adjusted for approved leave)
        const expectedWorkDays = workingDays - leaveDays;
        
        // Calculate productivity metrics
        const totalProductionHours = attendanceData.reduce((sum, record) => 
          sum + (record.productionHours || 0), 0);
        
        // Calculate overtime hours
        const overtimeHours = attendanceData.reduce((sum, record) => 
          sum + ((record.overtime || 0) / 60), 0); // Convert minutes to hours
        
        // Expected production hours (8 hours per working day minus leave days)
        const expectedProductionHours = expectedWorkDays * 8;
        
        // Calculate productivity rate
        const productivityRate = expectedProductionHours > 0 
          ? (totalProductionHours / expectedProductionHours) * 100 
          : 100;
        
        // Calculate average production hours per day
        const avgProductionHours = presentDays + lateDays > 0 
          ? totalProductionHours / (presentDays + lateDays)
          : 0;
        
        // Get previous period data for trend comparison
        const previousPeriodLength = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
        const previousPeriodStart = new Date(startDate);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - previousPeriodLength);
        const previousPeriodEnd = new Date(startDate);
        previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
        
        // Get previous period's attendance data
        const previousAttendanceData = await Attendance.find({
          userId: member._id,
          date: { $gte: previousPeriodStart, $lte: previousPeriodEnd }
        });
        
        // Calculate previous period's productivity metrics
        const previousTotalProductionHours = previousAttendanceData.reduce((sum, record) => 
          sum + (record.productionHours || 0), 0);
        
        const previousPresentDays = previousAttendanceData.filter(a => a.status === 'Present').length;
        const previousLateDays = previousAttendanceData.filter(a => a.status === 'Late').length;
        
        const previousAvgProductionHours = previousPresentDays + previousLateDays > 0 
          ? previousTotalProductionHours / (previousPresentDays + previousLateDays)
          : 0;
        
        // Determine trend direction
        const trend = avgProductionHours >= previousAvgProductionHours ? 'up' : 'down';
        
        // Cap the productivity score at 100
        const cappedScore = Math.min(100, Math.round(productivityRate));
        
        teamMemberMetrics.push({
          id: member._id,
          name: `${member.firstName} ${member.lastName}`,
          position: member.position,
          avgHours: parseFloat(avgProductionHours.toFixed(1)),
          overtime: parseFloat(overtimeHours.toFixed(1)),
          productivityScore: cappedScore,
          trend,
          details: {
            totalProductionHours,
            expectedProductionHours,
            presentDays,
            lateDays,
            expectedWorkDays
          }
        });
      } catch (error) {
        console.error(`Error processing metrics for team member ${member._id}:`, error);
        // Still add the member but with default/empty values
        teamMemberMetrics.push({
          id: member._id,
          name: `${member.firstName} ${member.lastName}`,
          position: member.position || 'Unknown',
          avgHours: 0,
          overtime: 0,
          productivityScore: 0,
          trend: 'neutral',
          details: {
            totalProductionHours: 0,
            expectedProductionHours: 0,
            presentDays: 0,
            lateDays: 0,
            expectedWorkDays: 0
          }
        });
      }
    }
    
    // Sort by productivity score (highest first)
    return teamMemberMetrics.sort((a, b) => b.productivityScore - a.productivityScore);
}

{/* Helper Functions for Team Communication*/}

async function getUnreadMessagesCount(managerId) {
  // Count unread direct messages to the manager
  const unreadMessages = await Chat.countDocuments({
    receiver: managerId,
    isRead: false,
    deletedForReceiver: false
  });
  
  // Group by sender to see who has sent unread messages
  const messagesBySender = await Chat.aggregate([
    {
      $match: {
        receiver: new mongoose.Types.ObjectId(managerId),
        isRead: false,
        deletedForReceiver: false
      }
    },
    {
      $group: {
        _id: '$sender',
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'senderInfo'
      }
    },
    {
      $unwind: '$senderInfo'
    },
    {
      $project: {
        senderName: { $concat: ['$senderInfo.firstName', ' ', '$senderInfo.lastName'] },
        count: 1
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
  
  // Also count unread notifications
  const unreadNotifications = await Notification.countDocuments({
    recipient: managerId,
    isRead: false
  });
  
  return {
    totalUnreadMessages: unreadMessages,
    totalUnreadNotifications: unreadNotifications,
    messagesBySender
  };
}

async function getResponseTimeToMessages(managerId, startDate, endDate) {
    // This is a complex metric that requires tracking conversation pairs
    // For simplicity, we'll use a basic approach - avg time between received and sent messages
    // Get all messages received by the manager
    const receivedMessages = await Chat.find({
      receiver: managerId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: 1 });
    
    // Get all messages sent by the manager
    const sentMessages = await Chat.find({
      sender: managerId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).sort({ createdAt: 1 });
    
    // Group conversations by the other party
    const conversations = {};
    let totalResponseTime = 0;
    let responsesCount = 0;
    
    // Track messages received from each user
    receivedMessages.forEach(msg => {
      const senderId = msg.sender.toString();
      if (!conversations[senderId]) {
        conversations[senderId] = {
          receivedMessages: [],
          sentMessages: []
        };
      }
      conversations[senderId].receivedMessages.push({
        id: msg._id,
        timestamp: msg.createdAt
      });
    });
    
    // Track messages sent to each user
    sentMessages.forEach(msg => {
      const receiverId = msg.receiver.toString();
      if (!conversations[receiverId]) {
        conversations[receiverId] = {
          receivedMessages: [],
          sentMessages: []
        };
      }
      conversations[receiverId].sentMessages.push({
        id: msg._id,
        timestamp: msg.createdAt
      });
    });
    
    // Calculate response times
    Object.values(conversations).forEach(convo => {
      if (convo.receivedMessages.length > 0 && convo.sentMessages.length > 0) {
        // Find pairs of messages where received comes before sent
        convo.receivedMessages.forEach(receivedMsg => {
          // Find the first sent message that happened after this received message
          const response = convo.sentMessages.find(sentMsg => 
            sentMsg.timestamp > receivedMsg.timestamp
          );
          
          if (response) {
            // Calculate response time in minutes
            const responseTimeMinutes = (response.timestamp - receivedMsg.timestamp) / (1000 * 60);
            totalResponseTime += responseTimeMinutes;
            responsesCount++;
          }
        });
      }
    });
    
    // Calculate average response time
    const avgResponseTime = responsesCount > 0 ? totalResponseTime / responsesCount : 0;
    
    return {
      averageResponseTimeMinutes: avgResponseTime.toFixed(2),
      responsesAnalyzed: responsesCount,
      responseTimeDistribution: {
        under5Minutes: calculateResponseTimeDistribution(conversations, 0, 5),
        under15Minutes: calculateResponseTimeDistribution(conversations, 0, 15),
        under60Minutes: calculateResponseTimeDistribution(conversations, 0, 60),
        over60Minutes: calculateResponseTimeDistribution(conversations, 60, Infinity)
      }
    };
  }
  
  // Helper function for response time distribution
  function calculateResponseTimeDistribution(conversations, minMinutes, maxMinutes) {
    let count = 0;
    let total = 0;
    
    Object.values(conversations).forEach(convo => {
      if (convo.receivedMessages.length > 0 && convo.sentMessages.length > 0) {
        convo.receivedMessages.forEach(receivedMsg => {
          const response = convo.sentMessages.find(sentMsg => 
            sentMsg.timestamp > receivedMsg.timestamp
          );
          
          if (response) {
            const responseTimeMinutes = (response.timestamp - receivedMsg.timestamp) / (1000 * 60);
            total++;
            if (responseTimeMinutes >= minMinutes && responseTimeMinutes < maxMinutes) {
              count++;
            }
          }
        });
      }
    });
    
    return {
      count,
      percentage: total > 0 ? ((count / total) * 100).toFixed(2) : 0
    };
  }
  
  // Calculate team engagement metrics in chats
  async function getTeamEngagementInChats(teamIds, startDate, endDate) {
    // First, get user information for all team members
    const teamMembers = await User.find({
      _id: { $in: teamIds }
    }, 'firstName lastName');
    
    // Create a map of user IDs to names
    const userNameMap = {};
    teamMembers.forEach(user => {
      userNameMap[user._id.toString()] = {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim()
      };
    });
    
    // Get all messages sent by team members
    const allTeamMessages = await Chat.find({
      sender: { $in: teamIds },
      createdAt: { $gte: startDate, $lte: endDate }
    });
    
    // Get counts of messages by sender
    const messageCountByUser = {};
    teamIds.forEach(id => {
      messageCountByUser[id.toString()] = 0;
    });
    
    // Count messages per team member
    allTeamMessages.forEach(msg => {
      const senderId = msg.sender.toString();
      if (messageCountByUser[senderId] !== undefined) {
        messageCountByUser[senderId]++;
      }
    });
    
    // Calculate number of active users (sent at least one message)
    const activeUsers = Object.values(messageCountByUser).filter(count => count > 0).length;
    
    // Get total number of team members
    const totalTeamMembers = teamIds.length;
    
    // Calculate average messages per day
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const messagesPerDay = allTeamMessages.length / totalDays;
    
    // Calculate participation rate
    const participationRate = totalTeamMembers > 0
      ? (activeUsers / totalTeamMembers) * 100
      : 0;
    
    // Get most active users (top 5) with their names
    const mostActiveUsers = Object.entries(messageCountByUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count]) => ({ 
        userId,
        messageCount: count,
        firstName: userNameMap[userId]?.firstName || '',
        lastName: userNameMap[userId]?.lastName || '',
        fullName: userNameMap[userId]?.fullName || 'Unknown User'
      }));
    
    return {
      totalMessages: allTeamMessages.length,
      activeUsers,
      participationRate: participationRate.toFixed(2),
      messagesPerDay: messagesPerDay.toFixed(2),
      mostActiveUsers
    };
  }
  
  // Get daily message activity for team engagement chart
  async function getTeamDailyMessageActivity(teamIds, startDate, endDate) {
    // Ensure dates are properly formatted
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Create an array to store daily message counts
    const dailyMessages = [];
    
    // Get all messages sent by team members in the date range
    const allTeamMessages = await Chat.find({
      sender: { $in: teamIds },
      createdAt: { $gte: start, $lte: end }
    });
    
    // Create a map to track messages per day
    const messagesByDay = {};
    
    // Initialize the date range with zero counts
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateString = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      messagesByDay[dateString] = 0;
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Count messages for each day
    allTeamMessages.forEach(msg => {
      const msgDate = msg.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (messagesByDay[msgDate] !== undefined) {
        messagesByDay[msgDate]++;
      }
    });
    
    // Convert the map to an array format suitable for the chart
    Object.entries(messagesByDay).forEach(([date, count]) => {
      // Format date to be more readable (e.g., "Jan 15" instead of "2025-01-15")
      const formattedDate = new Date(date);
      const displayDate = formattedDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      
      dailyMessages.push({
        date: displayDate,
        fullDate: date, // Keep the full date for sorting or additional processing
        count: count
      });
    });
    
    // Sort by date ascending
    dailyMessages.sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
    return {
      dailyMessages,
      totalMessages: allTeamMessages.length,
      averageMessagesPerDay: (allTeamMessages.length / Object.keys(messagesByDay).length).toFixed(2)
    };
  }
    
  {/* Get upcoming department and team events*/}
  async function getUpcomingEvents(departmentId, teamIds, startDate, endDate) {

    // Find all upcoming events where:
    // 1. Event is public OR
    // 2. Event is for this department OR
    // 3. A team member is involved
    const upcomingEvents = await CalendarEvent.find({
      $and: [
        { startDateTime: { $gte: startDate, $lte: endDate } },
        { 
          $or: [
            { visibility: 'public' },
            { departmentId: departmentId },
            { 'usersInvolved.userId': { $in: teamIds } }
          ]
        },
        { eventType: { $in: ['meeting', 'event', 'resourceReservation'] } }
      ]
    })
    .populate('createdBy', 'firstName lastName')
    .populate('resource', 'name type')
    .populate('usersInvolved.userId', 'firstName lastName')
    .sort({ startDateTime: 1 })
    .limit(10);
    
    return upcomingEvents.map(event => ({
      id: event._id,
      title: event.title,
      type: event.eventType,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      createdBy: `${event.createdBy.firstName} ${event.createdBy.lastName}`,
      location: event.location,
      status: event.status,
      resource: event.resource ? event.resource.name : null,
      participants: event.usersInvolved.map(user => ({
        name: user.userId ? `${user.userId.firstName} ${user.userId.lastName}` : 'Unknown',
        status: user.status
      }))
    }));
  }
  
  async function getEventParticipationRates(departmentId, teamIds, startDate, endDate) {
    // Find all completed events in the date range where either:
    // 1. The event belongs to the department
    // 2. Department members are involved as participants
    // 3. The event was created by any department member
    const completedEvents = await CalendarEvent.find({
      endDateTime: { $gte: startDate, $lte: endDate },
      $or: [
        { departmentId: departmentId },
        { 'usersInvolved.userId': { $in: teamIds } },
        { createdBy: { $in: teamIds } }  
      ]
    });
  
    if (completedEvents.length === 0) {
      return {
        overallParticipationRate: "0",
        eventTypes: {},
        trendByWeek: []
      };
    }
  
    // Calculate participation metrics
    let acceptedCount = 0;
    let totalInvites = 0;
    const eventTypeStats = {};
    const weeklyTrend = {};
  
    completedEvents.forEach(event => {
      // Get week number for trending
      const weekNumber = getWeekNumber(event.startDateTime);
      const weekKey = `${event.startDateTime.getFullYear()}-W${weekNumber}`;
      
      if (!weeklyTrend[weekKey]) {
        weeklyTrend[weekKey] = {
          accepted: 0,
          total: 0,
          weekStart: getStartOfWeek(event.startDateTime)
        };
      }
      
      // Track by event type
      if (!eventTypeStats[event.eventType]) {
        eventTypeStats[event.eventType] = {
          accepted: 0,
          total: 0
        };
      }
      
      event.usersInvolved.forEach(user => {
        if (teamIds.some(id => id.toString() === user.userId?.toString())) {
          totalInvites++;
          eventTypeStats[event.eventType].total++;
          weeklyTrend[weekKey].total++;
          
          if (user.status === 'accepted') {
            acceptedCount++;
            eventTypeStats[event.eventType].accepted++;
            weeklyTrend[weekKey].accepted++;
          }
        }
      });
    });
    
    // Calculate rates
    const overallRate = totalInvites > 0 ? (acceptedCount / totalInvites) * 100 : 0;
    
    // Format event type stats with percentages
    const eventTypesWithRates = {};
    Object.entries(eventTypeStats).forEach(([type, stats]) => {
      eventTypesWithRates[type] = {
        ...stats,
        participationRate: stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0
      };
    });
    
    // Sort weekly trend by date
    const sortedWeeklyTrend = Object.entries(weeklyTrend)
      .sort(([weekA], [weekB]) => weekA.localeCompare(weekB))
      .map(([week, stats]) => ({
        week,
        weekStart: stats.weekStart,
        participationRate: stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) : 0,
        totalInvites: stats.total,
        accepted: stats.accepted
      }));
      
    return {
      overallParticipationRate: overallRate.toFixed(2),
      eventTypes: eventTypesWithRates,
      trendByWeek: sortedWeeklyTrend
    };
  }
    // Get employee skills distribution for the team
    async function getEmployeeSkillsDistribution(teamIds) {
      // Get all employees with their skills
      const employees = await User.find(
        { _id: { $in: teamIds } },
        { skills: 1, firstName: 1, lastName: 1 }
      );
      
      // Count occurrences of each skill
      const skillsCount = {};
      const employeesBySkill = {};
      
      employees.forEach(employee => {
        employee.skills.forEach(skill => {
          // Initialize if not exists
          if (!skillsCount[skill]) {
            skillsCount[skill] = 0;
            employeesBySkill[skill] = [];
          }
          
          skillsCount[skill]++;
          employeesBySkill[skill].push({
            id: employee._id,
            name: `${employee.firstName} ${employee.lastName}`
          });
        });
      });
      
      // Transform to array format for easier consumption by frontend
      const skillsDistribution = Object.entries(skillsCount)
        .map(([skill, count]) => ({
          skill,
          count,
          percentage: employees.length > 0 ? (count / employees.length) * 100 : 0,
          employees: employeesBySkill[skill]
        }))
        .sort((a, b) => b.count - a.count);
      
      // Find skills gaps (skills that only one person has)
      const skillsGaps = skillsDistribution
        .filter(item => item.count === 1)
        .map(item => ({
          skill: item.skill,
          employee: item.employees[0]
        }));
      
      // Find most common skills (top 5)
      const topSkills = skillsDistribution.slice(0, 5);
      
      // Calculate skill coverage (how many employees have multiple skills)
      const skillCoverageByEmployee = employees.map(employee => ({
        id: employee._id,
        name: `${employee.firstName} ${employee.lastName}`,
        skillsCount: employee.skills.length
      })).sort((a, b) => b.skillsCount - a.skillsCount);
      
      return {
        distribution: skillsDistribution,
        skillsGaps,
        topSkills,
        skillCoverageByEmployee,
        averageSkillsPerEmployee: employees.length > 0 
          ? employees.reduce((acc, emp) => acc + emp.skills.length, 0) / employees.length 
          : 0
      };
    }
    
    // Get department hiring timeline
    async function getDepartmentHiringTimeline(teamIds) {
      // Get all team members with their hire dates
      const employees = await User.find(
        { _id: { $in: teamIds } },
        { firstName: 1, lastName: 1, position: 1, hireDate: 1 }
      ).sort({ hireDate: 1 });
      
      // Group employees by year and month of hire
      const hiresByYearMonth = {};
      const hiringTimeline = [];
      
      employees.forEach(employee => {
        const hireDate = new Date(employee.hireDate);
        const yearMonth = `${hireDate.getFullYear()}-${String(hireDate.getMonth() + 1).padStart(2, '0')}`;
        
        if (!hiresByYearMonth[yearMonth]) {
          hiresByYearMonth[yearMonth] = [];
        }
        
        hiresByYearMonth[yearMonth].push({
          id: employee._id,
          name: `${employee.firstName} ${employee.lastName}`,
          position: employee.position,
          hireDate: employee.hireDate
        });
      });
      
      // Convert to array format
      Object.entries(hiresByYearMonth).forEach(([yearMonth, hires]) => {
        const [year, month] = yearMonth.split('-');
        hiringTimeline.push({
          yearMonth,
          year: parseInt(year),
          month: parseInt(month),
          displayMonth: new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('en-US', { month: 'long' }),
          hiresCount: hires.length,
          employees: hires
        });
      });
      
      // Sort chronologically
      hiringTimeline.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
      
      // Calculate tenure statistics
      const now = new Date();
      const tenureInMonths = employees.map(emp => {
        const hireDate = new Date(emp.hireDate);
        const diffTime = Math.abs(now - hireDate);
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44));
        return diffMonths;
      });
      
      // Calculate average tenure
      const avgTenure = tenureInMonths.length > 0 
        ? tenureInMonths.reduce((sum, tenure) => sum + tenure, 0) / tenureInMonths.length 
        : 0;
      
      // Calculate tenure distribution
      const tenureDistribution = {
        lessThan6Months: tenureInMonths.filter(months => months < 6).length,
        sixToTwelveMonths: tenureInMonths.filter(months => months >= 6 && months < 12).length,
        oneToTwoYears: tenureInMonths.filter(months => months >= 12 && months < 24).length,
        twoToFiveYears: tenureInMonths.filter(months => months >= 24 && months < 60).length,
        moreThanFiveYears: tenureInMonths.filter(months => months >= 60).length
      };
      
      return {
        hiringTimeline,
        averageTenureMonths: avgTenure.toFixed(1),
        tenureDistribution,
        longestTenureEmployee: employees.length > 0 
          ? {
              id: employees[0]._id,
              name: `${employees[0].firstName} ${employees[0].lastName}`,
              position: employees[0].position,
              hireDate: employees[0].hireDate
            }
          : null,
        recentHires: employees.length > 0 
          ? employees.slice(-3).reverse().map(emp => ({
              id: emp._id,
              name: `${emp.firstName} ${emp.lastName}`,
              position: emp.position,
              hireDate: emp.hireDate
            }))
          : []
      };
    }

  // Helper function to get week number
  function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }
  
  // Helper function to get start of week
  function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
  
  // Helper function to count workdays in a date range (excluding weekends)
function getWorkingDaysBetweenDates(startDate, endDate) {
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