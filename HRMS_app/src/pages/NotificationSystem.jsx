import { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCircle, Trash2, Clock, AlertTriangle, Info, FileText, Calendar } from 'lucide-react';
import { showError, showInfo } from '../lib/alerts';
import api from '../lib/api';
import { useSocketEvent } from '../context/SocketContext';
import { notifyNotificationsChanged } from '../lib/notifications';

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
    showInfo(newNotification.title, newNotification.message);
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
      
      showError('Error', 'Failed to load notifications');
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
    showError('Error', 'Failed to update notification');
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
      showError('Error', 'Failed to update notifications');
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
      showError('Error', 'Failed to delete notification');
    }
  };

  // Get icon based on notification type
const getNotificationIcon = (type) => {
  switch(type) {
    case 'leave_request':
      return <FileText className="w-5 h-5 text-ink-2" />;
    case 'leave_approved':
      return <CheckCircle className="w-5 h-5 text-teal" />;
    case 'leave_rejected':
      return <AlertTriangle className="w-5 h-5 text-amber" />;
    case 'event':
      return <Calendar className="w-5 h-5 text-amber" />;
    case 'event_invitation':
      return <Clock className="w-5 h-5 text-violet" />;
    case 'event_response':
      return <Info className="w-5 h-5 text-blue" />;
    default:
      return <Bell className="w-5 h-5 text-teal" />;
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
      
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center relative z-10">
        <div>
          <h2 className="text-2xl font-bold text-ink flex items-center gap-2">
            <Bell className="w-6 h-6 text-teal" />
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-1 text-xs bg-red text-on-accent rounded-full">
                {unreadCount} new
              </span>
            )}
          </h2>
          <p className="text-ink-2 mt-1">Stay updated with system alerts and messages</p>
        </div>
        
        <div className="flex gap-2 mt-4 sm:mt-0">
          <div className="flex bg-raise rounded-lg p-1">
            <button 
              className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === 'all' ? 'bg-teal text-on-accent' : 'text-ink-2 hover:text-ink'}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === 'unread' ? 'bg-teal text-on-accent' : 'text-ink-2 hover:text-ink'}`}
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded-md transition-colors ${filter === 'read' ? 'bg-teal text-on-accent' : 'text-ink-2 hover:text-ink'}`}
              onClick={() => setFilter('read')}
            >
              Read
            </button>
          </div>
          
          <button 
            className="px-3 py-1 text-sm bg-teal/10 text-teal rounded-md hover:bg-teal/15 transition-colors flex items-center gap-1"
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
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal"></div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-panel rounded-lg border border-line p-8 text-center">
            <Bell className="w-12 h-12 text-ink-3 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-ink">No notifications</h3>
            <p className="text-ink-3 mt-1">
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
                className={`bg-panel border ${notification.isRead ? 'border-line' : 'border-l-4 border-l-teal border-t border-r border-b border-line'} rounded-lg p-4 flex items-start gap-3 transition-all hover:bg-sunk relative group`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-raise flex items-center justify-center">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-ink">{notification.title}</h4>
                    <span className="text-xs text-ink-3">{notification.createdAt ? formatDate(notification.createdAt) : 'Unknown date'}</span>
                  </div>
                  <p className="text-ink-2 mt-1">{notification.message}</p>
                 
                </div>
                
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!notification.isRead && (
                    <button 
                      onClick={() => markAsRead(notification._id)} 
                      className="p-1 rounded-full hover:bg-teal/10 text-teal"
                      title="Mark as read"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteNotification(notification._id)} 
                    className="p-1 rounded-full hover:bg-red/10 text-red"
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
            className="px-4 py-2 bg-raise rounded-md text-ink hover:bg-sunk transition-colors flex items-center gap-2"
          >
            {loadingMore ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-teal"></div>
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