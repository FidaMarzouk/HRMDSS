import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCircle, Trash2, Clock, AlertTriangle, Info, FileText, Calendar } from 'lucide-react';
import Swal from 'sweetalert2';
import api from '../lib/api';
import { useSocketEvent } from '../context/SocketContext';
import { notifyNotificationsChanged } from '../lib/useUnreadNotifications';

const NotificationPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const limit = 10; // Number of notifications per page

  // New notifications pushed over the shared socket
  const handleIncoming = useCallback((newNotification) => {
    setNotifications(prev => [newNotification, ...prev]);
    Swal.fire({
      icon: 'info',
      title: newNotification.title,
      text: newNotification.message,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
      background: '#1E1E1E',
      color: '#fff'
    });
  }, []);
  useSocketEvent('notification', handleIncoming);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
    fetchNotifications(1);
  }, [filter]);

  // Function to fetch notifications with pagination
  const fetchNotifications = async (pageNum = 1) => {
    const isInitialLoad = pageNum === 1;
    
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      // Using axios with withCredentials to send cookies automatically
      const response = await api.get('/api/notifications', {
        params: {
          page: pageNum,
          limit: limit,
          filter: filter !== 'all' ? filter : undefined
        }
      });
      
      // Ensure response data is structured properly
      const responseData = response.data || {};
      const notificationsData = Array.isArray(responseData.notifications) 
        ? responseData.notifications 
        : Array.isArray(response.data) ? response.data : [];
      
      // Check if there are more pages
      const totalCount = responseData.totalCount || notificationsData.length;
      setHasMore(totalCount > pageNum * limit);
      
      // If it's the first page, replace notifications; otherwise, append
      if (isInitialLoad) {
        setNotifications(notificationsData);
      } else {
        setNotifications(prev => [...prev, ...notificationsData]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      // On error for initial load, set empty array
      if (isInitialLoad) {
        setNotifications([]);
      }
      
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to load notifications',
        background: '#1E1E1E',
        color: '#fff',
        confirmButtonColor: '#3baca5'
      });
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  // Function to load more notifications
  const loadMoreNotifications = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage);
  };

  // Function to mark notification as read
const markAsRead = async (id) => {
  try {
    // Using axios with withCredentials to send cookies automatically
    await api.put(`/api/notifications/${id}/read`);
    
    // Update local state
    setNotifications(prev => 
      prev.map(notif => 
        notif._id === id ? { ...notif, isRead: true } : notif
      )
    );

    notifyNotificationsChanged();
  } catch (error) {
    console.error('Error marking notification as read:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to update notification',
      background: '#1E1E1E',
      color: '#fff',
      confirmButtonColor: '#3baca5'
    });
  }
};
  // Function to mark all notifications as read
  const markAllAsRead = async () => {
    try {
      // Using axios with withCredentials to send cookies automatically
      await api.put('/api/notifications/read-all');
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, isRead: true }))
      );
      
      notifyNotificationsChanged();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to update notifications',
        background: '#1E1E1E',
        color: '#fff',
        confirmButtonColor: '#3baca5'
      });
    }
  };

  // Function to delete notification
  const deleteNotification = async (id) => {
    try {
      // Using axios with withCredentials to send cookies automatically
      await api.delete(`/api/notifications/${id}`);
      
      // Update local state
      setNotifications(prev => 
        prev.filter(notif => notif._id !== id)
      );
      
      notifyNotificationsChanged();
    } catch (error) {
      console.error('Error deleting notification:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to delete notification',
        background: '#1E1E1E',
        color: '#fff',
        confirmButtonColor: '#3baca5'
      });
    }
  };
  // Circuit pattern for background - matches your AdminDashboard
  const CircuitPattern = () => (
    <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <pattern id="circuit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <path d="M20 40 L40 40 L40 20 L60 20 L60 40 L80 40" stroke="#3baca5" fill="none" strokeWidth="2"/>
          <path d="M20 60 L40 60 L40 80 L60 80 L60 60 L80 60" stroke="#3baca5" fill="none" strokeWidth="2"/>
          <circle cx="20" cy="40" r="3" fill="#3baca5"/>
          <circle cx="80" cy="40" r="3" fill="#3baca5"/>
          <circle cx="20" cy="60" r="3" fill="#3baca5"/>
          <circle cx="80" cy="60" r="3" fill="#3baca5"/>
        </pattern>
        <rect width="100%" height="100%" fill="url(#circuit)" />
      </svg>
    </div>
  );

  // Get icon based on notification type
const getNotificationIcon = (type) => {
  switch(type) {
    case 'leave_request':
      return <FileText className="w-5 h-5 text-gray-400" />;
    case 'leave_approved':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'leave_rejected':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    case 'event':
      return <Calendar className="w-5 h-5 text-orange-500" />;
    case 'event_invitation':
      return <Clock className="w-5 h-5 text-purple-500" />;
    case 'event_response':
      return <Info className="w-5 h-5 text-blue-500" />;
    default:
      return <Bell className="w-5 h-5 text-[#3baca5]" />;
  }
};
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Ensure notifications is always an array before filtering
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  

  const filteredNotifications = safeNotifications;
  
  const unreadCount = safeNotifications.filter(n => !n.isRead).length;

  return (
    <div className="flex flex-col h-full relative">
      <CircuitPattern />
      
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center relative z-10">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#3baca5]" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                {unreadCount} new
              </span>
            )}
          </h2>
          <p className="text-gray-400 mt-1">Stay updated with system alerts and messages</p>
        </div>
        
        <div className="flex gap-2 mt-4 sm:mt-0">
          <div className="flex bg-[#2A2A2A] rounded-lg p-1">
            <button 
              className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === 'all' ? 'bg-[#3baca5] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === 'unread' ? 'bg-[#3baca5] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === 'read' ? 'bg-[#3baca5] text-white' : 'text-gray-400 hover:text-white'}`}
              onClick={() => setFilter('read')}
            >
              Read
            </button>
          </div>
          
          <button 
            className="px-3 py-1 text-sm bg-[#3baca5]/20 text-[#3baca5] rounded-md hover:bg-[#3baca5]/30 transition-colors flex items-center gap-1"
            onClick={markAllAsRead}
            disabled={safeNotifications.length === 0}
          >
            <CheckCircle className="w-4 h-4" />
            Mark All Read
          </button>
        </div>
      </div>
      
      {/* Notifications List */}
      <div className="relative z-10 flex-grow rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3baca5]"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-[#1A1A1A] rounded-lg border border-gray-800 p-8 text-center">
            <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-300">No notifications</h3>
            <p className="text-gray-500 mt-1">
              {filter === 'all' 
                ? "You don't have any notifications yet" 
                : filter === 'unread' 
                  ? "You don't have any unread notifications" 
                  : "You don't have any read notifications"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map(notification => (
              <div 
                key={notification._id || `notification-${Math.random()}`} 
                className={`bg-[#1A1A1A] border ${notification.isRead ? 'border-gray-800' : 'border-l-4 border-l-[#3baca5] border-t border-r border-b border-gray-800'} rounded-lg p-4 flex items-start gap-3 transition-all hover:bg-[#222] relative group`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#2A2A2A] flex items-center justify-center">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-white">{notification.title}</h4>
                    <span className="text-xs text-gray-500">{notification.createdAt ? formatDate(notification.createdAt) : 'Unknown date'}</span>
                  </div>
                  <p className="text-gray-400 mt-1">{notification.message}</p>
                 
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notification.isRead && (
                    <button 
                      onClick={() => markAsRead(notification._id)} 
                      className="p-1 rounded-full hover:bg-[#3baca5]/10 text-[#3baca5]"
                      title="Mark as read"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteNotification(notification._id)} 
                    className="p-1 rounded-full hover:bg-red-900/10 text-red-500"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Load more button */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button 
            onClick={loadMoreNotifications}
            disabled={loadingMore}
            className="px-4 py-2 bg-[#2A2A2A] rounded-md text-gray-300 hover:bg-[#333] transition-colors flex items-center gap-2"
          >
            {loadingMore ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[#3baca5]"></div>
                Loading...
              </>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationPage;