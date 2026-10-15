import { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';

import { Clock, Coffee, LogOut, CheckCircle } from 'lucide-react';
import AttendanceReports from './AttendanceReports';
import Swal from 'sweetalert2';
import api, { errorMessage } from '../../lib/api';

const alertTheme = {
    background: '#1e262c',
    customClass: { popup: 'rounded-lg shadow-xl', htmlContainer: 'text-[#94a3b8]' },
};

const showSuccessAlert = (title, text) => Swal.fire({
    ...alertTheme,
    icon: 'success',
    title,
    text,
    color: '#2dd4bf',
    confirmButtonColor: '#2dd4bf',
    timer: 2000,
    timerProgressBar: true,
});

const showErrorAlert = (title, error) => Swal.fire({
    ...alertTheme,
    icon: 'error',
    title,
    text: errorMessage(error, 'An unexpected error occurred'),
    color: '#ef4444',
    confirmButtonColor: '#ef4444',
    confirmButtonText: 'Got it',
});

const hasOpenBreak = (session) => Boolean(session?.breaks?.some((b) => !b.endTime));

const AttendanceManager = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [attendance, setAttendance] = useState(null);
    const [allSessions, setAllSessions] = useState([]);
    const [loading, setLoading] = useState(false);
    const isOnBreak = hasOpenBreak(attendance);

    // Today's sessions for the signed-in user; the open one (if any) is the active session.
    const refreshToday = useCallback(async () => {
        try {
            const { data } = await api.get('/api/attendance/today');
            const sessions = Array.isArray(data) ? data : [];
            setAllSessions(sessions);
            setAttendance(sessions.find((s) => s.checkIn && !s.checkOut) || null);
        } catch (error) {
            console.error('Error fetching today sessions:', error);
        }
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        refreshToday();
        return () => clearInterval(timer);
    }, [refreshToday]);

    const runAction = async (path, successTitle, successText, errorTitle) => {
        setLoading(true);
        try {
            await api.post(path);
            await refreshToday();
            showSuccessAlert(successTitle, successText);
        } catch (error) {
            showErrorAlert(errorTitle, error);
        } finally {
            setLoading(false);
        }
    };

    const handlePunchIn = () =>
        runAction('/api/attendance/punch-in', 'Punch In Successful', 'You have successfully punched in.', 'Punch In Error');

    const handlePunchOut = () =>
        runAction('/api/attendance/punch-out', 'Punch Out Successful', 'You have successfully punched out.', 'Punch Out Error');

    const handleBreak = () =>
        isOnBreak
            ? runAction('/api/attendance/break/end', 'Break Ended', 'Your break has been ended successfully.', 'End Break Error')
            : runAction('/api/attendance/break/start', 'Break Started', 'Enjoy your lunch break!', 'Start Break Error');
    
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

    const getStatus = () => {
        if (!attendance) {
            // Check if we have any completed sessions today
            const completedSessions = allSessions.filter(session => session.checkIn && session.checkOut);
            if (completedSessions.length > 0) return 'Ready for next session';
            return 'Not Checked In';
        }
        if (isOnBreak) return 'On Break';
        return 'Checked In';
    };

    const getStatusColor = () => {
        const status = getStatus();
        switch (status) {
        case 'Checked In': return 'text-[#2dd4bf]';  
        case 'On Break': return 'text-[#E1B382]'; 
        case 'Ready for next session': return 'text-[#94a3b8]';
        case 'Not Checked In': return 'text-[#B2A29E]'; 
        default: return 'text-[#B2A29E]'; 
        }
    };

    return (
        <div className="p-6 space-y-6 bg-[#1a1f23]">
            {/* Main Time Display Card*/}
            <Card className="relative bg-[#1e262c] text-white overflow-hidden border-0 shadow-xl !bg-[#1e262c] !text-white">
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(45,212,191,0.03)_1px,transparent_1px),linear-gradient(rgba(45,212,191,0.03)_1px,transparent_1px)] bg-[size:24px_24px]"></div>
                    <div className="absolute -left-24 top-1/2 -translate-y-1/2 w-48 h-48 bg-[#2dd4bf]/10 rounded-full blur-3xl"></div>
                </div>
                <CardContent className="relative p-8">
                    <div className="flex items-center justify-between">
                        <div className="space-y-2">
                            <h2 className="text-5xl font-bold tracking-tight font-mono text-white">
                                {currentTime.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true
                                })}
                            </h2>
                            <p className="text-lg text-[#94a3b8]">
                                {currentTime.toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className={`text-xl font-semibold ${getStatusColor()}`}>
                                {getStatus()}
                            </div>
                            {attendance?.status === 'Late' && (
                                <div className="text-red-400 text-sm mt-1">Late by {attendance.lateBy} minutes</div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-4">
                <button
                    onClick={handlePunchIn}
                    disabled={loading || attendance}
                    className={`relative group bg-[#1e262c] rounded-lg p-4 border-0 transition-all duration-300 overflow-hidden ${!attendance ? 'hover:bg-[#2dd4bf]/10' : 'opacity-50 cursor-not-allowed'}`}
                >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(45,212,191,0.03)_1px,transparent_1px),linear-gradient(rgba(45,212,191,0.03)_1px,transparent_1px)] bg-[size:16px_16px]"></div>
                    <div className="relative flex flex-col items-center space-y-2">
                        <Clock className="h-8 w-8 text-[#2dd4bf]" />
                        <span className="font-semibold text-white">Punch In</span>
                    </div>
                </button>

                <button
                    onClick={handleBreak}
                    disabled={loading || !attendance || attendance?.checkOut}
                    className={`relative group bg-[#1e262c] rounded-lg p-4 border-0 transition-all duration-300 overflow-hidden ${attendance && !attendance.checkOut ? 'hover:bg-[#2dd4bf]/10' : 'opacity-50 cursor-not-allowed'}`}
                >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(45,212,191,0.03)_1px,transparent_1px),linear-gradient(rgba(45,212,191,0.03)_1px,transparent_1px)] bg-[size:16px_16px]"></div>
                    <div className="relative flex flex-col items-center space-y-2">
                        <Coffee className="h-8 w-8 text-[#2dd4bf]" />
                        <span className="font-semibold text-white">
                            {isOnBreak ? 'End Break' : 'Start Break'}
                        </span>
                    </div>
                </button>

                <button
                    onClick={handlePunchOut}
                    disabled={loading || !attendance || attendance?.checkOut || isOnBreak}
                    className={`relative group bg-[#1e262c] rounded-lg p-4 border-0 transition-all duration-300 overflow-hidden ${attendance && !attendance.checkOut && !isOnBreak ? 'hover:bg-[#2dd4bf]/10' : 'opacity-50 cursor-not-allowed'}`}
                >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(45,212,191,0.03)_1px,transparent_1px),linear-gradient(rgba(45,212,191,0.03)_1px,transparent_1px)] bg-[size:16px_16px]"></div>
                    <div className="relative flex flex-col items-center space-y-2">
                        <LogOut className="h-8 w-8 text-[#2dd4bf]" />
                        <span className="font-semibold text-white">Punch Out</span>
                    </div>
                </button>
            </div>

            {/* Today&apos;s Activity Timeline */}
            <Card className="bg-[#1e262c] border-0 !bg-[#1e262c]">
                <CardHeader>
                    <CardTitle className="text-[#2dd4bf] text-xl">Today&apos;s Activity Timeline</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {allSessions && allSessions.length > 0 ? (
                        <div className="space-y-6">
                            {allSessions.map((session, sessionIndex) => (
                                <div key={sessionIndex} className="mb-8">
                                    <div className="mb-2">
                                        <h3 className="font-semibold text-[#2dd4bf]">Session {session.sessionNumber}</h3>
                                    </div>
                                    
                                    <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:w-2 before:h-2 before:bg-[#2dd4bf] before:rounded-full before:shadow-[0_0_8px_rgba(45,212,191,0.5)] after:absolute after:left-2.5 after:top-4 after:w-0.5 after:h-full after:bg-[#2dd4bf]/10">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-[#2dd4bf]">Punch In</h3>
                                                <p className="text-sm text-[#94a3b8]">{formatTime(session.checkIn)}</p>
                                            </div>
                                            <CheckCircle className="h-5 w-5 text-[#2dd4bf]" />
                                        </div>
                                    </div>

                                    {session.breaks?.map((break_, index) => (
                                        <div key={index} className="relative pl-6 before:absolute before:left-2 before:top-2 before:w-2 before:h-2 before:bg-[#2dd4bf] before:rounded-full before:shadow-[0_0_8px_rgba(45,212,191,0.5)] after:absolute after:left-2.5 after:top-4 after:w-0.5 after:h-full after:bg-[#2dd4bf]/10">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-[#2dd4bf]">Break {index + 1}</h3>
                                                    <p className="text-sm text-[#94a3b8]">
                                                        {formatTime(break_.startTime)} - {break_.endTime ? formatTime(break_.endTime) : 'Ongoing'}
                                                        {break_.duration && ` (${break_.duration} min)`}
                                                    </p>
                                                </div>
                                                <Coffee className="h-5 w-5 text-[#2dd4bf]" />
                                            </div>
                                        </div>
                                    ))}

                                    {session.checkOut && (
                                        <div className="relative pl-6 before:absolute before:left-2 before:top-2 before:w-2 before:h-2 before:bg-[#2dd4bf] before:rounded-full before:shadow-[0_0_8px_rgba(45,212,191,0.5)]">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-[#2dd4bf]">Punch Out</h3>
                                                    <p className="text-sm text-[#94a3b8]">{formatTime(session.checkOut)}</p>
                                                </div>
                                                <LogOut className="h-5 w-5 text-[#2dd4bf]" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-[#94a3b8]">No activity recorded today</div>
                    )}
                </CardContent>
            </Card>
            <AttendanceReports onDataRefresh={refreshToday} />
        </div>
    );
};

export default AttendanceManager;