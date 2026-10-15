import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

import { SearchIcon, RefreshCw } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import CustomDatePicker from '../../components/ui/datePicker';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';

const AttendanceReports = ({ onDataRefresh }) => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const userRole = user?.role;
  const [startDate, setStartDate] = useState(() => {
    // Initialize with date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return thirtyDaysAgo;
  });
  const [endDate, setEndDate] = useState(new Date());
 
  // Fetch attendance data whenever user, startDate, or endDate changes
  useEffect(() => {
    if (user) {
      fetchAttendanceData();
    }
  }, [user]); // Only trigger on user change, not on date changes to avoid unwanted refetches
 
  const fetchAttendanceData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const formattedStartDate = formatDate(startDate, 'yyyy-MM-dd');
      const formattedEndDate = formatDate(endDate, 'yyyy-MM-dd');
      
      // Determine endpoint based on user role
      let endpoint = '/api/attendance/date-range';
      if (userRole === 'admin' || userRole === 'superAdmin') {
        endpoint = '/api/attendance/all';
      } else if (userRole === 'manager') {
        endpoint = '/api/attendance/managed';
      }

      const response = await api.get(endpoint, {
        params: { startDate: formattedStartDate, endDate: formattedEndDate }
      });
      
      if (response.data) {
        setAttendanceData(response.data);
      }
      
      afterDataOperation();
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    }
    setLoading(false);
  };
 
  const formatTime = (date) => {
    if (!date) return 'N/A';
    // Create a date object from the stored time
    const dateObj = new Date(date);
    // Format the time in Tunisia timezone (UTC+1)
    return dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Tunis' // Use Tunisia timezone instead of UTC
    });
  };
 
  // Format date
  const formatDate = (date, formatStr) => {
    if (formatStr === 'yyyy-MM-dd') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }
    
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
 
  // Calculate total break duration
  const calculateTotalBreakTime = (breaks) => {
    if (!breaks || !breaks.length) return 0;
    return breaks.reduce((total, breakPeriod) => {
      return total + (breakPeriod.duration || 0);
    }, 0);
  };
 
  const afterDataOperation = () => {
    if (onDataRefresh && typeof onDataRefresh === 'function') {
      onDataRefresh();
    }
  };
  
  return (
<div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6 bg-[#1a1f23]">
      <Card className="bg-[#1e262c] border-0 !bg-[#1e262c]">
        <CardHeader className="px-4 py-4 sm:p-6">
          {/* Centered Title */}
          <div className="w-full flex justify-center mb-4">
            <CardTitle className="text-[#2dd4bf] text-lg sm:text-xl">Attendance Records</CardTitle>
          </div>
          
          {/* Controls layout */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-3">
            {/* Date Range Selectors */}
            <div className="flex flex-row items-center justify-center gap-2 w-full md:w-auto">
            <span className="text-white text-sm sm:text-sm px-1">From</span>
              <CustomDatePicker
                selectedDate={startDate}
                onChange={setStartDate}
                className="w-[120px] md:w-[140px]" 
              />

              <span className="text-white text-sm sm:text-sm px-1">to</span>

              <CustomDatePicker
                selectedDate={endDate}
                onChange={setEndDate}
                 className="w-[120px] md:w-[140px]" 
              />
            </div>
  
            {/* Action buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto justify-center">
              <Button
                onClick={fetchAttendanceData}
                className="bg-[#2dd4bf] hover:bg-[#2dd4bf]/80 text-black 
                  text-xs sm:text-sm 
                  h-8 sm:h-10 
                  px-2 sm:px-4 
                  flex items-center justify-center 
                  w-full md:w-auto"
              >
                <SearchIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span>Search</span>
              </Button>
              <Button
                onClick={fetchAttendanceData}
                variant="secondary"
                className="bg-[#1E1E1E] hover:bg-[#2A2A2A] text-gray-300 
                  text-xs sm:text-sm 
                  h-8 sm:h-10 
                  px-2 sm:px-4 
                  flex items-center justify-center 
                  w-full md:w-auto"
              >
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="px-2 sm:px-6 pb-4 sm:pb-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-t-2 border-b-2 border-[#2dd4bf]"></div>
            </div>
          ) : (
            <div className="rounded-md border border-[#2dd4bf]/10 overflow-hidden">
              <div className="overflow-x-auto w-full" style={{ WebkitOverflowScrolling: 'touch' }}>
                <Table>
                  <TableHeader className="bg-[#1a1f23]">
                    <TableRow>
                      {(userRole === 'admin' || userRole === 'manager' || userRole === 'superAdmin') && (
                        <TableHead className="text-[#2dd4bf] text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">Employee</TableHead>
                      )}
                      <TableHead className="text-[#2dd4bf] text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">Date</TableHead>
                      <TableHead className="text-[#2dd4bf] text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">Status</TableHead>
                      <TableHead className="text-[#2dd4bf] text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">Check In</TableHead>
                      <TableHead className="text-[#2dd4bf] text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">Check Out</TableHead>
                      <TableHead className="text-[#2dd4bf] text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">Late By</TableHead>
                      <TableHead className="text-[#2dd4bf] text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">Overtime</TableHead>
                      <TableHead className="text-[#2dd4bf] text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">Breaks</TableHead>
                      <TableHead className="text-[#2dd4bf] text-xs sm:text-sm whitespace-nowrap p-2 sm:p-4">Production Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceData.length > 0 ? (
                      attendanceData.map((record) => (
                        <TableRow key={record._id} className="border-t border-[#2dd4bf]/10">
                          {(userRole === 'admin' || userRole === 'manager' || userRole === 'superAdmin') && (
                            <TableCell className="text-white text-xs sm:text-sm p-2 sm:p-4 whitespace-nowrap">
                              {record.userId?.firstName || '-'} {record.userId?.lastName || ''}
                            </TableCell>
                          )}
                          <TableCell className="text-white text-xs sm:text-sm p-2 sm:p-4 whitespace-nowrap">
                            {record.date ? formatDate(record.date) : '-'}
                          </TableCell>
                          <TableCell className="p-2 sm:p-4 whitespace-nowrap">
                            <span 
                              className={`px-1 sm:px-2 py-0.5 sm:py-1 rounded-full text-xs font-semibold ${
                                record.status === 'Present' ? 'bg-green-500/20 text-green-400' : 
                                record.status === 'Late' ? 'bg-yellow-500/20 text-yellow-400' : 
                                'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {record.status || '-'}
                            </span>
                          </TableCell>
                          <TableCell className="text-white text-xs sm:text-sm p-2 sm:p-4 whitespace-nowrap">
                            {formatTime(record.checkIn)}
                          </TableCell>
                          <TableCell className="text-white text-xs sm:text-sm p-2 sm:p-4 whitespace-nowrap">
                            {record.checkOut ? formatTime(record.checkOut) : 'Not out'}
                          </TableCell>
                          <TableCell className="text-white text-xs sm:text-sm p-2 sm:p-4 whitespace-nowrap">
                            {record.lateBy && record.lateBy > 0 ? `${record.lateBy} min` : '-'}
                          </TableCell>
                          <TableCell className="text-white text-xs sm:text-sm p-2 sm:p-4 whitespace-nowrap">
                            {record.overtime && record.overtime > 0 ? `${record.overtime} min` : '-'}
                          </TableCell>
                          <TableCell className="text-white text-xs sm:text-sm p-2 sm:p-4 whitespace-nowrap">
                            {record.breaks && record.breaks.length > 0 ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" className="p-1 text-[#2dd4bf] hover:bg-[#2dd4bf]/10 text-xs sm:text-sm h-auto whitespace-nowrap">
                                    {`${record.breaks.length} (${calculateTotalBreakTime(record.breaks)} min)`}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="bg-[#1a1f23] border-[#2dd4bf]/30 w-auto max-w-[90vw] sm:max-w-[300px]">
                                  <div className="space-y-2 p-1 sm:p-2">
                                    <h4 className="font-semibold text-[#2dd4bf] text-xs sm:text-sm">Break Details</h4>
                                    <div className="max-h-[30vh] overflow-y-auto">
                                      {record.breaks.map((breakItem, index) => (
                                        <div key={index} className="text-xs sm:text-sm text-white py-1">
                                          Break {index + 1}: {formatTime(breakItem.startTime)} - {breakItem.endTime ? formatTime(breakItem.endTime) : 'Ongoing'}
                                          {breakItem.duration ? ` (${breakItem.duration} min)` : ' (0 min)'}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-white text-xs sm:text-sm p-2 sm:p-4 whitespace-nowrap">
                            {record.productionHours ? `${record.productionHours} hrs` : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell 
                          colSpan={userRole === 'employee' ? 8 : 9} 
                          className="text-center py-6 sm:py-8 text-gray-400 text-xs sm:text-sm"
                        >
                          No attendance records found for the selected date range
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Mobile scroll indicator */}
              <div className="md:hidden text-center py-2 text-xs text-[#2dd4bf]/60">
                Swipe horizontally to see all data
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceReports;