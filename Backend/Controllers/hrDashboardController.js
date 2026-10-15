const User = require('../Models/User');
const Attendance = require('../Models/Attendance');
const LeaveRequest = require('../Models/LeaveRequest');
const Department = require('../Models/Department');
const Resource = require('../Models/Resource');
const Notification = require('../Models/Notification');
const CalendarEvent = require('../Models/CalendarEvent');
const Chat = require('../Models/TeamChat');
const mongoose = require('mongoose');

// Main HR Dashboard controller
exports.getHRDashboardData = async (req, res) => {
  try {
    // Get current date info for filtering
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0); 
    
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
    // Get basic company stats
    const totalEmployees = await User.countDocuments();
    const totalDepartments = await Department.countDocuments();
    const pendingLeaveRequests = await LeaveRequest.countDocuments({ status: 'Pending' });
    
    // Company-wide Attendance Analytics
    const attendanceByDepartment = await getAttendanceByDepartment(startDate, endDate);
    const absenteeismTrend = await getAbsenteeismTrend(startDate, endDate);
    const lateArrivalsByDepartment = await getLateArrivalsByDepartment(startDate, endDate);
    const overtimeDistribution = await getOvertimeDistribution(startDate, endDate);
    
    // Leave Management Overview
    const leaveStatusDistribution = await getLeaveStatusDistribution();
    const leaveDaysUsageStats = await getLeaveDaysUsageStats();
    const leaveTypeDistribution = await getLeaveTypeDistribution();
    const leaveSeasonalPatterns = await getLeaveSeasonalPatterns(today);
    
    // Workforce Analytics
    const employeesByDepartment = await getEmployeesByDepartment();
    const salaryDistribution = await getSalaryDistribution();
    const headcountTrend = await getHeadcountTrend(thirtyDaysAgo);
    const managerEmployeeRatio = await getManagerEmployeeRatio();
    
    // Resource Management
    const resourceUtilization = await getResourceUtilization();
    const maintenanceByResourceType = await getMaintenanceByResourceType();
    const mostRequestedResources = await getMostRequestedResources();

    // Communication Analytics
    const peakCommunicationTimes = await getPeakCommunicationTimes(startDate, endDate);
    const messagesByDepartment = await getMessagesByDepartment(startDate, endDate);
    const notificationRatesByType = await getNotificationRatesByType(startDate, endDate);
    const averageResponseTime = await getAverageResponseTime(startDate, endDate);

    res.status(200).json({
      overview: {
        totalEmployees,
        totalDepartments,
        pendingLeaveRequests
      },
      attendanceAnalytics: {
        attendanceByDepartment,
        absenteeismTrend,
        lateArrivalsByDepartment,
        overtimeDistribution
      },
      leaveManagement: {
        leaveStatusDistribution,
        leaveDaysUsageStats,
        leaveTypeDistribution,
        leaveSeasonalPatterns
      },
      workforceAnalytics: {
        employeesByDepartment,
        salaryDistribution,
        headcountTrend,
        managerEmployeeRatio
      },
      resourceManagement: {
        resourceUtilization,
        maintenanceByResourceType,
        mostRequestedResources
      },
      communicationAnalytics: {
        peakCommunicationTimes,
        messagesByDepartment,
        notificationRatesByType,
        averageResponseTime
      }
    });
  } catch (error) {
    console.error('Error fetching HR dashboard data:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
};

// Helper functions for attendance analytics
async function getAttendanceByDepartment(startDate, endDate) {
  const attendanceData = await Attendance.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $lookup: {
        from: 'departments',
        localField: 'user.departmentId',
        foreignField: '_id',
        as: 'department'
      }
    },
    {
      $unwind: '$department'
    },
    {
      $group: {
        _id: '$department._id',
        departmentName: { $first: '$department.name' },
        totalAttendances: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'Absent'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } }
      }
    },
    {
      $project: {
        departmentName: 1,
        totalAttendances: 1,
        presentPercentage: { 
          $round: [{ $multiply: [{ $divide: ['$present', '$totalAttendances'] }, 100] }, 3] 
        },
        absentPercentage: { 
          $round: [{ $multiply: [{ $divide: ['$absent', '$totalAttendances'] }, 100] }, 3] 
        },
        latePercentage: { 
          $round: [{ $multiply: [{ $divide: ['$late', '$totalAttendances'] }, 100] }, 3] 
        }
      }
    }
  ]);
  
  return attendanceData;
}


async function getAbsenteeismTrend(startDate, endDate) {
  // Generate series of dates for the x-axis
  const dateRange = getDateRange(startDate, endDate);
  
  const absenteeismData = await Attendance.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        status: 'Absent'
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]);
  
  // Map absences to date range
  const absenteeismTrend = dateRange.map(date => {
    const dateStr = date.toISOString().split('T')[0];
    const found = absenteeismData.find(item => item._id === dateStr);
    return {
      date: dateStr,
      count: found ? found.count : 0
    };
  });
  
  return absenteeismTrend;
}

async function getLateArrivalsByDepartment(startDate, endDate) {
  const lateArrivalsData = await Attendance.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        status: 'Late'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $lookup: {
        from: 'departments',
        localField: 'user.departmentId',
        foreignField: '_id',
        as: 'department'
      }
    },
    {
      $unwind: '$department'
    },
    {
      $group: {
        _id: '$department._id',
        departmentName: { $first: '$department.name' },
        totalLate: { $sum: 1 },
        averageLateMinutes: { $avg: '$lateBy' }
      }
    }
  ]);
  
  return lateArrivalsData;
}

async function getOvertimeDistribution(startDate, endDate) {
  const overtimeData = await Attendance.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        overtime: { $gt: 0 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $lookup: {
        from: 'departments',
        localField: 'user.departmentId',
        foreignField: '_id',
        as: 'department'
      }
    },
    {
      $unwind: '$department'
    },
    {
      $group: {
        _id: '$department._id',
        departmentName: { $first: '$department.name' },
        totalOvertime: { $sum: '$overtime' },
        employeesWithOvertime: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        departmentName: 1,
        totalOvertimeHours: { $round: [{ $divide: ['$totalOvertime', 60] }, 2]},
        employeeCount: { $size: '$employeesWithOvertime' }
      }
    }
  ]);
  
  return overtimeData;
}

// Helper functions for leave management
async function getLeaveStatusDistribution() {
  const leaveStatusData = await LeaveRequest.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return leaveStatusData.map(item => ({
    status: item._id,
    count: item.count
  }));
}

async function getLeaveDaysUsageStats() {
  const users = await User.find({ 
    leaveRequestAllowed: { $exists: true },
    remainingLeaveDays: { $exists: true }
  });
  
  const totalAllowed = users.reduce((sum, user) => sum + (user.leaveRequestAllowed || 0), 0);
  const totalRemaining = users.reduce((sum, user) => sum + (user.remainingLeaveDays || 0), 0);
  const totalUsed = totalAllowed - totalRemaining;
  
  return {
    totalAllowed,
    totalRemaining,
    totalUsed,
    usagePercentage: totalAllowed > 0 ? (totalUsed / totalAllowed) * 100 : 0
  };
}

async function getLeaveTypeDistribution() {
  const leaveTypeData = await LeaveRequest.aggregate([
    {
      $group: {
        _id: '$reason',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return leaveTypeData.map(item => ({
    leaveType: item._id,
    count: item.count
  }));
}

async function getLeaveSeasonalPatterns(currentDate) {
  // Get data for the past 12 months
  const oneYearAgo = new Date(currentDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const seasonalData = await LeaveRequest.aggregate([
    {
      $match: {
        startDate: { $gte: oneYearAgo }
      }
    },
    {
      $project: {
        month: { $month: '$startDate' },
        year: { $year: '$startDate' },
        leaveDays: {
          $dateDiff: {
            startDate: '$startDate',
            endDate: '$endDate',
            unit: 'day'
          }
        }
      }
    },
    {
      $group: {
        _id: { month: '$month', year: '$year' },
        totalRequests: { $sum: 1 },
        totalDays: { $sum: '$leaveDays' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);
  
  // Format for chart display
  return seasonalData.map(item => ({
    period: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
    totalRequests: item.totalRequests,
    totalDays: item.totalDays
  }));
}

// Helper functions for workforce analytics
async function getEmployeesByDepartment() {
  const departmentData = await Department.aggregate([
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: 'departmentId',
        as: 'employees'
      }
    },
    {
      $project: {
        _id: 1,
        name: 1,
        employeeCount: { $size: '$employees' }
      }
    }
  ]);
  
  return departmentData;
}

async function getSalaryDistribution() {
  // Define salary ranges
  const ranges = [
    { min: 1100, max: 2000 },
    { min: 2100, max: 3000 },
    { min: 3100, max: 4000 },
    { min: 4100, max: 5000 },
  ];
  
  const salaryRanges = [];
  
  for (const range of ranges) {
    const count = await User.countDocuments({
      salary: { $gte: range.min, $lte: range.max }
    });
    
    let label;
    if (range.max === Number.MAX_SAFE_INTEGER) {
      label = `$${range.min}+`;
    } else {
      label = `$${range.min} - $${range.max}`;
    }
    
    salaryRanges.push({
      range: label,
      count
    });
  }
  
  return salaryRanges;
}

async function getHeadcountTrend(startDate) {
  // Get current headcount
  const currentHeadcount = await User.countDocuments({ role: { $ne: 'superAdmin' } });
  
  // Get users who joined after the start date
  const newHires = await User.countDocuments({
    hireDate: { $gte: startDate }
  });
  
  return {
    currentHeadcount,
    newHires,
    growth: newHires > 0 ? (newHires / (currentHeadcount - newHires)) * 100 : 0
  };
}

async function getManagerEmployeeRatio() {
  const managerCount = await User.countDocuments({ role: 'manager' });
  const employeeCount = await User.countDocuments({ role: 'employee' });
  
  return {
    managerCount,
    employeeCount,
    ratio: managerCount > 0 ? employeeCount / managerCount : 0
  };
}

// Helper functions for resource management
async function getResourceUtilization() {
  const resourceData = await Resource.aggregate([
    {
      $lookup: {
        from: 'calendarevents',
        let: { resourceId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$resource', '$$resourceId'] },
                ]
              }
            }
          }
        ],
        as: 'reservations'
      }
    },
    {
      $project: {
        _id: 1,
        name: 1,
        type: 1,
        status: 1,
        reservationCount: { $size: '$reservations' }
      }
    }
  ]);
  
  // Group by resource type
  const utilizationByType = {};
  
  resourceData.forEach(resource => {
    if (!utilizationByType[resource.type]) {
      utilizationByType[resource.type] = {
        totalResources: 0,
        totalReservations: 0,
        availableResources: 0
      };
    }
    
    utilizationByType[resource.type].totalResources++;
    utilizationByType[resource.type].totalReservations += resource.reservationCount;
    
    if (resource.status === 'available') {
      utilizationByType[resource.type].availableResources++;
    }
  });
  
  // Convert to array for easier consumption by charts
  return Object.keys(utilizationByType).map(type => ({
    resourceType: type,
    totalResources: utilizationByType[type].totalResources,
    availableResources: utilizationByType[type].availableResources,
    totalReservations: utilizationByType[type].totalReservations,
    utilizationRate: utilizationByType[type].totalResources > 0 
    ? Math.round((utilizationByType[type].totalReservations / utilizationByType[type].totalResources) * 100) / 100
      : 0
  }));
}

async function getMaintenanceByResourceType() {
  const maintenanceData = await Resource.aggregate([
    {
      $match: {
        status: 'maintenance',
      }
    },
    {
      $group: {
        _id: '$type',
        name: { $first: '$name' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return maintenanceData.map(item => ({
    resourceType: item._id,
    resourceName: item.name,
    maintenanceCount: item.count
  }));
}

async function getMostRequestedResources() {
  const resourceRequests = await CalendarEvent.aggregate([
    {
      $match: {
        eventType: 'resourceReservation',
      }
    },
    {
      $lookup: {
        from: 'resources',
        localField: 'resource',
        foreignField: '_id',
        as: 'resourceDetails'
      }
    },
    {
      $unwind: '$resourceDetails'
    },
    {
      $group: {
        _id: '$resource',
        resourceName: { $first: '$resourceDetails.name' },
        resourceType: { $first: '$resourceDetails.type' },
        reservationCount: { $sum: 1 }
      }
    },
    {
      $sort: { reservationCount: -1 }
    },
  ]);
  
  return resourceRequests;
}

// Helper functions for communication analytics
async function getPeakCommunicationTimes(startDate, endDate) {
  
  const teamChatTimes = await Chat.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $project: {
        hour: { $hour: '$createdAt' }
      }
    },
    {
      $group: {
        _id: '$hour',
        count: { $sum: 1 }
      }
    }
  ]);

  // Initialize the hourly counts array
  const hourCounts = new Array(24).fill(0);
  
  // Fill in the data from team chats
  teamChatTimes.forEach(item => {
    hourCounts[item._id] += item.count;
  });

  // Format for chart display
  return hourCounts.map((count, hour) => ({
    hour: hour,
    messageCount: count,
    timeLabel: `${hour}:00 - ${hour + 1}:00`
  }));
}

async function getMessagesByDepartment(startDate, endDate) {
  const messageData = await Chat.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'sender',
        foreignField: '_id',
        as: 'senderDetails'
      }
    },
    {
      $unwind: '$senderDetails'
    },
    {
      $lookup: {
        from: 'departments',
        localField: 'senderDetails.departmentId',
        foreignField: '_id',
        as: 'department'
      }
    },
    {
      $unwind: '$department'
    },
    {
      $group: {
        _id: '$department._id',
        departmentName: { $first: '$department.name' },
        messageCount: { $sum: 1 },
        uniqueSenders: { $addToSet: '$sender' }
      }
    },
    {
      $project: {
        departmentName: 1,
        messageCount: 1,
        uniqueSendersCount: { $size: '$uniqueSenders' }
      }
    },
    {
      $sort: { messageCount: -1 }
    }
  ]);
  
  return messageData;
}

async function getNotificationRatesByType(startDate, endDate) {
  const notificationData = await Notification.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$type',
        total: { $sum: 1 },
        read: { $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] } }
      }
    },
    {
      $project: {
        notificationType: '$_id',
        total: 1,
        read: 1,
        readRate: { $multiply: [{ $divide: ['$read', '$total'] }, 100] }
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);
  
  return notificationData;
}
async function getAverageResponseTime(startDate, endDate) {
  // Query to find all chats within the specified time range
  const chats = await Chat.find({
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: 1 });
  
  // Group messages by conversation (sender-receiver pair)
  const conversations = {};
  
  chats.forEach(chat => {
    // Create unique conversation identifier by combining sender and receiver IDs
    // Sort the IDs to ensure the same conversation is identified regardless of who sent first
    const senderId = chat.sender.toString();
    const receiverId = chat.receiver.toString();
    const participants = [senderId, receiverId].sort();
    const conversationKey = participants.join('-');
    
    if (!conversations[conversationKey]) {
      conversations[conversationKey] = [];
    }
    
    conversations[conversationKey].push({
      sender: senderId, // Store as string instead of ObjectId
      timestamp: chat.createdAt,
      message: chat.message
    });
  });
  
  // Calculate response times within each conversation
  let totalResponseTime = 0;
  let responseCount = 0;
  
  Object.values(conversations).forEach(messages => {
    if (messages.length < 2) return; // Skip conversations with only one message
    
    for (let i = 1; i < messages.length; i++) {
      const currentMessage = messages[i];
      const previousMessage = messages[i-1];
      
      // Only count as response if sender changed (different person responding)
      // Compare string IDs instead of using equals()
      if (currentMessage.sender !== previousMessage.sender) {
        // Calculate time difference in milliseconds
        const responseTime = new Date(currentMessage.timestamp) - new Date(previousMessage.timestamp);
        
        // Only count reasonable response times (greater than 0 and less than 7 days)
        if (responseTime > 0 && responseTime < 7 * 24 * 60 * 60 * 1000) {
          totalResponseTime += responseTime;
          responseCount++;
        }
      }
    }
  });
  
  // Calculate average response time in minutes
  const averageResponseTimeMs = responseCount > 0 ? totalResponseTime / responseCount : 0;
  const averageResponseTimeMinutes = averageResponseTimeMs / (1000 * 60);
  
  // Get response time distribution for chart data
  const responseTimeDistribution = getResponseTimeDistribution(conversations);
  
  return {
    averageResponseTime: parseFloat(averageResponseTimeMinutes.toFixed(2)),
    responseCount: responseCount,
    responseTimeDistribution: responseTimeDistribution,
    timeUnit: 'minutes'
  };
}

// Helper function to categorize response times for distribution chart
function getResponseTimeDistribution(conversations) {
  // Create buckets for response time ranges (in minutes)
  const distribution = {
    'Under 5 min': 0,
    '5-15 min': 0,
    '15-30 min': 0,
    '30-60 min': 0,
    'Over 60 min': 0
  };
  
  Object.values(conversations).forEach(messages => {
    if (messages.length < 2) return;
    
    for (let i = 1; i < messages.length; i++) {
      const currentMessage = messages[i];
      const previousMessage = messages[i-1];
      
      // Only count as response if sender changed (different person responding)
      // Compare string IDs instead of using equals()
      if (currentMessage.sender !== previousMessage.sender) {
        // Calculate time difference in milliseconds
        const responseTimeMs = new Date(currentMessage.timestamp) - new Date(previousMessage.timestamp);
        
        // Only include reasonable response times (greater than 0 and less than 7 days)
        if (responseTimeMs > 0 && responseTimeMs < 7 * 24 * 60 * 60 * 1000) {
          const responseTimeMinutes = responseTimeMs / (1000 * 60);
          
          // Categorize the response time
          if (responseTimeMinutes < 5) {
            distribution['Under 5 min']++;
          } else if (responseTimeMinutes < 15) {
            distribution['5-15 min']++;
          } else if (responseTimeMinutes < 30) {
            distribution['15-30 min']++;
          } else if (responseTimeMinutes < 60) {
            distribution['30-60 min']++;
          } else {
            distribution['Over 60 min']++;
          }
        }
      }
    }
  });
  
  // Convert to array format for charts
  return Object.entries(distribution).map(([range, count]) => ({
    range,
    count
  }));
}

// Utility function to generate a date range
function getDateRange(startDate, endDate) {
  const dates = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}