import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, X, Check } from 'lucide-react';
import { api } from '../lib/api';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications/me?limit=5');
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/me/unread-count');
      setUnreadCount(response.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();

    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCount]);

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/me/read-all');
      setNotifications(notifications.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await api.delete(`/notifications/${notificationId}`);
      setNotifications(notifications.filter(n => n.id !== notificationId));
      if (!notifications.find(n => n.id === notificationId)?.read) {
        setUnreadCount(Math.max(0, unreadCount - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-error';
      case 'high': return 'bg-warning';
      case 'normal': return 'bg-info';
      case 'low': return 'bg-text-muted';
      default: return 'bg-info';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'announcement': return '📢';
      case 'attendance': return '📅';
      case 'marks': return '📊';
      case 'timetable': return '🕐';
      case 'exam': return '📝';
      case 'event': return '🎉';
      case 'ai_news': return '🤖';
      default: return '🔔';
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-bg-soft transition-colors"
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className="w-6 h-6 text-text-main" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-surface rounded-soft-lg shadow-soft border border-text-muted/15 z-50 max-h-[500px] overflow-hidden">
            <div className="p-4 border-b border-text-muted/15 flex items-center justify-between">
              <h3 className="font-semibold text-text-main">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-primary hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="overflow-y-auto max-h-[400px]">
              {loading ? (
                <div className="p-4 text-center text-text-muted">
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-text-muted/15 hover:bg-bg-soft transition-colors ${
                      !notification.read ? 'bg-bg-soft/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <span className="text-2xl">
                          {getTypeIcon(notification.type)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-medium text-text-main text-sm">
                            {notification.title}
                          </h4>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`w-2 h-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-text-muted hover:text-primary transition-colors"
                                title="Mark as read"
                                aria-label="Mark as read"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="text-text-muted hover:text-error transition-colors"
                              title="Delete"
                               aria-label="Delete notification"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-text-muted mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-text-muted mt-2">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-text-muted/15 text-center">
              <Link
                to="/notifications"
                className="text-sm text-primary hover:underline"
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}