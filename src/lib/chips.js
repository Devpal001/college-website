// Shared chip-style maps (design system §4 semantics: success/warning/error/info
// are reserved for status meaning; assessment types are categories, so they get
// neutral chips). Extracted from StudentDashboard/TeacherDashboard so the two
// dashboards cannot drift apart.
export const STATUS_STYLES = {
  present: 'bg-success/10 text-success-dark',
  absent: 'bg-error/10 text-error-dark',
  late: 'bg-warning/10 text-warning-dark',
  excused: 'bg-info/10 text-info-dark',
};

export const TYPE_STYLES = {
  assignment: 'bg-text-muted/10 text-text-muted',
  quiz: 'bg-text-muted/10 text-text-muted',
  midterm: 'bg-text-muted/10 text-text-muted',
  practical: 'bg-text-muted/10 text-text-muted',
  final: 'bg-text-muted/10 text-text-muted',
  other: 'bg-text-muted/10 text-text-muted',
};

export const CHIP_FALLBACK = 'bg-text-muted/10 text-text-muted';
