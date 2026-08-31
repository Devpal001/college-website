import { useEffect, useState, useCallback } from 'react';
import { Bell, Check, X, Settings, Filter } from 'lucide-react';
import { api } from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  getPriorityColor,
  getTypeIcon,
  formatTime,
} from '../lib/notificationFormat';

const PREFERENCE_OPTIONS = [
  ['college_announcements', 'College Announcements'],
  ['exam_updates', 'Exam Updates'],
  ['attendance_alerts', 'Attendance Alerts'],
  ['timetable_changes', 'Timetable Changes'],
  ['events', 'Events'],
  ['placement_news', 'Placement News'],
  ['scholarships', 'Scholarships'],
  ['ai_discoveries', 'AI Discoveries'],
];

// Priority colors, type icons, and relative timestamps are shared with the
// NotificationBell dropdown via src/lib/notificationFormat.js (design §24).

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const unreadOnly = filter === 'unread' ? 'true' : 'false';

      const response = await api.get(
        `/notifications/me?unreadOnly=${unreadOnly}&limit=50`
      );

      let data = Array.isArray(response?.data) ? response.data : [];

      // The API supports unreadOnly, but not necessarily a read-only
      // query. Filter locally when the user selects "Read".
      if (filter === 'read') {
        data = data.filter((notification) => notification.read);
      }

      setNotifications(data);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err?.message || 'Failed to load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await api.get('/notifications/me/preferences');
      setPreferences(response || {});
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/me/unread-count');
      setUnreadCount(Number(response?.count) || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchPreferences();
    fetchUnreadCount();
  }, [fetchPreferences, fetchUnreadCount]);

  const markAsRead = async (notificationId) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);

      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );

      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/me/read-all');

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read: true,
        }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId) => {
    const notification = notifications.find(
      (item) => item.id === notificationId
    );

    if (!notification) return;

    try {
      await api.delete(`/notifications/${notificationId}`);

      setNotifications((current) =>
        current.filter((item) => item.id !== notificationId)
      );

      if (!notification.read) {
        setUnreadCount((current) => Math.max(0, current - 1));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const updatePreferences = async () => {
    if (!preferences) return;

    try {
      setSavingPreferences(true);

      const response = await api.put(
        '/notifications/me/preferences',
        preferences
      );

      setPreferences(response || preferences);
      setShowPreferences(false);
    } catch (err) {
      console.error('Error updating preferences:', err);
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-soft py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-main mb-2">
              Notifications
            </h1>

            <p className="text-text-muted">
              {unreadCount > 0
                ? `${unreadCount} unread notifications`
                : 'All caught up!'}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <div className="flex items-center gap-2 bg-surface rounded-soft px-3 py-2">
              <Filter className="w-4 h-4 text-text-muted" />

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="bg-transparent text-sm text-text-main outline-none"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-soft hover:bg-primary-dark transition-colors"
              >
                <Check className="w-4 h-4" />
                Mark all as read
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowPreferences(true)}
              className="p-2 bg-surface rounded-soft hover:bg-bg-soft transition-colors"
              title="Notification settings"
            >
              <Settings className="w-5 h-5 text-text-main" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-error/10 text-error-dark rounded-soft p-4 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-surface rounded-soft-lg shadow-soft p-12 text-center">
            <Bell className="w-16 h-16 mx-auto mb-4 text-text-muted opacity-50" />

            <h3 className="text-xl font-semibold text-text-main mb-2">
              No notifications
            </h3>

            <p className="text-text-muted">
              {filter === 'unread'
                ? "You're all caught up!"
                : filter === 'read'
                  ? 'You have no read notifications.'
                  : "You don't have any notifications yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-surface rounded-soft-lg shadow-soft p-4 hover:shadow-md transition-shadow ${
                  !notification.read
                    ? 'border-l-4 border-primary'
                    : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    <span className="text-3xl">
                      {getTypeIcon(notification.type)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-text-main text-lg mb-1">
                          {notification.title || 'Notification'}
                        </h3>

                        {notification.message && (
                          <p className="text-text-muted mb-2">
                            {notification.message}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-sm text-text-muted flex-wrap">
                          <span>
                            {formatTime(notification.created_at)}
                          </span>

                          <span
                            className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(
                              notification.priority
                            )} text-white`}
                          >
                            {notification.priority || 'normal'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!notification.read && (
                          <button
                            type="button"
                            onClick={() =>
                              markAsRead(notification.id)
                            }
                            className="p-2 hover:bg-bg-soft rounded-soft transition-colors"
                            title="Mark as read"
                            aria-label="Mark as read"
                          >
                            <Check className="w-5 h-5 text-text-muted hover:text-primary" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            deleteNotification(notification.id)
                          }
                          className="p-2 hover:bg-bg-soft rounded-soft transition-colors"
                          title="Delete"
                          aria-label="Delete notification"
                        >
                          <X className="w-5 h-5 text-text-muted hover:text-error" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {showPreferences && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Notification preferences"
              className="bg-surface rounded-soft-lg shadow-soft w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-text-muted/15 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-text-main">
                  Notification Preferences
                </h2>

                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="p-2 hover:bg-bg-soft rounded-soft transition-colors"
                  aria-label="Close preferences"
                >
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {preferences && (
                  <>
                    {PREFERENCE_OPTIONS.map(([key, label]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-text-main">
                          {label}
                        </span>

                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(preferences[key])}
                            onChange={(event) =>
                              setPreferences((current) => ({
                                ...current,
                                [key]: event.target.checked,
                              }))
                            }
                            className="sr-only peer"
                          />

                          <div className="w-11 h-6 bg-text-muted/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-text-muted/30 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                        </label>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="p-6 border-t border-text-muted/15 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreferences(false)}
                  className="px-4 py-2 text-text-main hover:bg-bg-soft rounded-soft transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={updatePreferences}
                  disabled={!preferences || savingPreferences}
                  className="px-4 py-2 bg-primary text-white rounded-soft hover:bg-primary-dark disabled:opacity-60 transition-colors"
                >
                  {savingPreferences
                    ? 'Saving...'
                    : 'Save Preferences'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}