// Shared presentation helpers for notification lists.
// The NotificationBell dropdown and the /notifications page must always agree
// on priority colors, type icons, and relative timestamps (design system §24).
// formatTime includes an invalid-date guard so malformed timestamps render
// as empty instead of "Invalid Date".

export function getPriorityColor(priority) {
  switch (priority) {
    case 'critical':
      return 'bg-error';
    case 'high':
      return 'bg-warning';
    case 'normal':
      return 'bg-info';
    case 'low':
      return 'bg-text-muted';
    default:
      return 'bg-info';
  }
}

export function getTypeIcon(type) {
  switch (type) {
    case 'announcement':
      return '📢';
    case 'attendance':
      return '📅';
    case 'marks':
      return '📊';
    case 'timetable':
      return '🕐';
    case 'exam':
      return '📝';
    case 'event':
      return '🎉';
    case 'ai_news':
      return '🤖';
    default:
      return '🔔';
  }
}

export function formatTime(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const diffMs = Date.now() - date.getTime();

  if (diffMs < 0) return date.toLocaleDateString();

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}