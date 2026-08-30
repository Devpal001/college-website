import { useState, useEffect } from 'react';
import { Bell, Check, X, Settings, Filter } from 'lucide-react';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
    fetchUnreadCount();
  }, [filter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const unreadOnly = filter === 'unread' ? 'true' : 'false';
      const response = await api.get(`/notifications/me?unreadOnly=${unreadOnly}&limit=50`);
      setNotifications(response.data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const response = await api.get('/notifications/me/preferences');
      setPreferences(response);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/me/unread-count');
      setUnreadCount(response.count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

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

  const updatePreferences = async (newPreferences) => {
    try {
      const response = await api.put('/notifications/me/preferences', newPreferences);
      setPreferences(response);
      setShowPreferences(false);
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-gray-500';
      default: return 'bg-blue-500';
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
    <div className="min-h-screen bg-bg-soft py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-main mb-2">Notifications</h1>
            <p className="text-text-muted">
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-surface rounded-soft px-3 py-2">
              <Filter className="w-4 h-4 text-text-muted" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-transparent text-sm text-text-main outline-none"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-soft hover:bg-primary-dark transition-colors"
              >
                <Check className="w-4 h-4" />
                Mark all as read
              </button>
            )}
            <button
              onClick={() => setShowPreferences(true)}
              className="p-2 bg-surface rounded-soft hover:bg-bg-soft transition-colors"
              title="Notification settings"
            >
              <Settings className="w-5 h-5 text-text-main" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-surface rounded-soft-lg shadow-soft p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-text-muted opacity-50" />
            <h3 className="text-xl font-semibold text-text-main mb-2">No notifications</h3>
            <p className="text-text-muted">
              {filter === 'unread' 
                ? "You're all caught up!" 
                : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-surface rounded-soft-lg shadow-soft p-4 hover:shadow-md transition-shadow ${
                  !notification.read ? 'border-l-4 border-primary' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <span className="text-3xl">
                      {getTypeIcon(notification.type)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-text-main text-lg mb-1">
                          {notification.title}
                        </h3>
                        <p className="text-text-muted mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-3 text-sm text-text-muted">
                          <span>{formatTime(notification.created_at)}</span>
                          <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(notification.priority)} text-white`}>
                            {notification.priority}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="p-2 hover:bg-bg-soft rounded-soft transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-5 h-5 text-text-muted hover:text-primary" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 hover:bg-bg-soft rounded-soft transition-colors"
                          title="Delete"
                        >
                          <X className="w-5 h-5 text-text-muted hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preferences Modal */}
        {showPreferences && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-soft-lg shadow-soft w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-text-main">Notification Preferences</h2>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="p-2 hover:bg-bg-soft rounded-soft transition-colors"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {preferences && (
                  <>
                    {[
                      { key: 'college_announcements', label: 'College Announcements' },
                      { key: 'exam_updates', label: 'Exam Updates' },
                      { key: 'attendance_alerts', label: 'Attendance Alerts' },
                      { key: 'timetable_changes', label: 'Timetable Changes' },
                      { key: 'events', label: 'Events' },
                      { key: 'placement_news', label: 'Placement News' },
                      { key: 'scholarships', label: 'Scholarships' },
                      { key: 'ai_discoveries', label: 'AI Discoveries' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-text-main">{label}</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={preferences[key]}
                            onChange={(e) => setPreferences({
                              ...preferences,
                              [key]: e.target.checked
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="p-6 border-t border-black/5 flex justify-end gap-3">
                <button
                  onClick={() => setShowPreferences(false)}
                  className="px-4 py-2 text-text-main hover:bg-bg-soft rounded-soft transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updatePreferences(preferences)}
                  className="px-4 py-2 bg-primary text-white rounded-soft hover:bg-primary-dark transition-colors"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}