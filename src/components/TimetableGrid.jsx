import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, DoorOpen, AlertCircle, GraduationCap, MapPin, RefreshCw, User } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

/**
 * Shared interactive weekly timetable grid.
 *
 * Used by the Teacher dashboard ("Schedule" tab) and the Student dashboard
 * ("Timetable" tab) so both roles render the same authoritative `timetable`
 * rows with the same interaction model — no duplicated role-specific logic.
 *
 * Expected row shape (Supabase embed of the `timetable` table):
 * { id, day_of_week, start_time, end_time,
 *   subjects: {name}, sections?: {name}, rooms?: {room_number},
 *   semesters?: {name}, academic_year?: string,
 *   teachers?: { employee_id, profiles?: {full_name} } }
 */

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_SHORT = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
};

function formatTime(t) {
  if (!t) return '—';
  return String(t).slice(0, 5);
}

function lectureTeacherName(lecture) {
  const t = lecture.teachers;
  return t?.profiles?.full_name || t?.employee_id || '—';
}

function LectureCard({ lecture, onClick, isToday }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-soft p-2.5 transition border ${
        isToday
          ? 'bg-primary/10 border-primary/30 hover:bg-primary/15'
          : 'bg-bg-soft border-transparent hover:border-primary/30'
      }`}
    >
      <p className="text-xs font-semibold text-primary flex items-center gap-1">
        <Clock size={11} /> {formatTime(lecture.start_time)}–{formatTime(lecture.end_time)}
      </p>
      <p className="text-sm font-medium text-text-main mt-1 leading-snug">
        {lecture.subjects?.name || 'Subject'}
      </p>
      <p className="text-xs text-text-muted mt-0.5 truncate flex items-center gap-1">
        <User size={11} /> {lectureTeacherName(lecture)}
      </p>
      <p className="text-xs text-text-muted truncate flex items-center gap-1">
        <MapPin size={11} /> {lecture.sections?.name || '—'}{lecture.rooms?.room_number ? ` · ${lecture.rooms.room_number}` : ''}
      </p>
    </button>
  );
}

function LectureDetails({ lecture, selfName, onClose }) {
  const tName = lectureTeacherName(lecture);
  const isSelf = selfName && tName !== '—' && tName === selfName;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-label="Lecture details"
    >
      <div
        className="bg-surface rounded-soft-lg shadow-soft p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
              <Clock size={12} /> {formatTime(lecture.start_time)} – {formatTime(lecture.end_time)}
            </p>
            <h3 className="text-lg font-bold text-text-main mt-1">
              {lecture.subjects?.name || 'Subject'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-muted hover:text-text-main text-sm font-medium"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-text-muted" />
            <dt className="text-text-muted w-20">Day</dt>
            <dd className="text-text-main capitalize">{lecture.day_of_week}</dd>
          </div>
          <div className="flex items-center gap-2">
            <User size={14} className="text-text-muted" />
            <dt className="text-text-muted w-20">Teacher</dt>
            <dd className="text-text-main">{isSelf ? 'You' : tName}</dd>
          </div>
          {lecture.sections && (
            <div className="flex items-center gap-2">
              <GraduationCap size={14} className="text-text-muted" />
              <dt className="text-text-muted w-20">Class</dt>
              <dd className="text-text-main">{lecture.sections.name}</dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <DoorOpen size={14} className="text-text-muted" />
            <dt className="text-text-muted w-20">Room</dt>
            <dd className="text-text-main">{lecture.rooms?.room_number || '—'}</dd>
          </div>
          {(lecture.semesters || lecture.academic_year) && (
            <div className="flex items-center gap-2">
              <GraduationCap size={14} className="text-text-muted" />
              <dt className="text-text-muted w-20">Semester</dt>
              <dd className="text-text-main">
                {[lecture.semesters?.name, lecture.academic_year].filter(Boolean).join(' · ') || '—'}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

export default function TimetableGrid({
  lectures = [],
  loading = false,
  error = '',
  onRetry,
  emptyTitle = 'No timetable published yet',
  emptyText = 'Your weekly schedule will appear here once published.',
  selfName = '',
}) {
  const todayName = DAY_ORDER[(new Date().getDay() + 6) % 7];
  const [viewDay, setViewDay] = useState('');
  const [selected, setSelected] = useState(null);

  // Week view shows all six teaching days (empty columns included);
  // single-day view focuses one day.
  const gridDays = useMemo(() => (viewDay ? [viewDay] : DAY_ORDER), [viewDay]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <LoadingSpinner />
        <p className="text-sm text-text-muted mt-3">Loading timetable…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-error opacity-70" />
        <p className="text-sm text-text-main mb-1">Unable to load the timetable</p>
        <p className="text-xs text-text-muted mb-4">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium"
          >
            <RefreshCw size={14} /> Retry
          </button>
        )}
      </div>
    );
  }

  if (!lectures.length) {
    return (
      <div className="text-center py-12">
        <Calendar className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
        <p className="text-sm text-text-muted mb-2">{emptyTitle}</p>
        <p className="text-xs text-text-muted">{emptyText}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Day / week selector — doubles as the mobile-friendly view mode */}
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        <button
          type="button"
          onClick={() => setViewDay('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            viewDay === ''
              ? 'bg-primary text-white'
              : 'bg-bg-soft text-text-muted hover:text-text-main'
          }`}
        >
          Week
        </button>
        {DAY_ORDER.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => setViewDay(day)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              viewDay === day
                ? 'bg-primary text-white'
                : 'bg-bg-soft text-text-muted hover:text-text-main'
            }`}
          >
            {DAY_SHORT[day]}
            {day === todayName && (
              <span className="ml-1 text-[10px] uppercase opacity-80">today</span>
            )}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div
          className={`grid gap-3 ${
            viewDay ? 'grid-cols-1 max-w-md' : 'min-w-[880px] grid-cols-6'
          }`}
        >
          {gridDays.map((day) => {
            const dayLectures = lectures
              .filter((l) => l.day_of_week === day)
              .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
            const isToday = day === todayName;
            return (
              <div
                key={day}
                className={`rounded-soft-lg p-2 ${
                  isToday ? 'bg-primary/5 ring-1 ring-primary/25' : 'bg-text-muted/5'
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center justify-between ${
                    isToday ? 'text-primary' : 'text-text-muted'
                  }`}
                >
                  <span>{DAY_SHORT[day]}</span>
                  {isToday && <span className="text-[10px] normal-case">Today</span>}
                </p>
                {dayLectures.length ? (
                  <div className="space-y-2">
                    {dayLectures.map((l) => (
                      <LectureCard
                        key={l.id}
                        lecture={l}
                        isToday={isToday}
                        onClick={() => setSelected(l)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted py-4 text-center">No lectures</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selected && (
        <LectureDetails
          lecture={selected}
          selfName={selfName}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
