import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import PortalLayout from '../components/PortalLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import { CalendarRange, Plus, Pencil, Trash2, RefreshCw, ArrowLeft, AlertCircle } from 'lucide-react';

/**
 * Admin Timetable Manager — authorized CRUD over the normalized `timetable`
 * table via the protected /api/timetable API (admin/super_admin only).
 * Lectures reference sections/subjects/teachers/rooms by foreign key;
 * nothing is hardcoded.
 */

const DAY_OPTIONS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
];

const INPUT_CLASS =
  'w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition text-sm';

const EMPTY_FORM = {
  section_id: '',
  semester_id: '',
  subject_id: '',
  teacher_id: '',
  room_id: '',
  day_of_week: 'monday',
  start_time: '',
  end_time: '',
  academic_year: '',
};

function lectureLabel(l) {
  return `${l.subjects?.name || 'Subject'} · ${l.sections?.name || 'Class'} · ${String(l.start_time).slice(0, 5)}–${String(l.end_time).slice(0, 5)} · ${l.teachers?.profiles?.full_name || l.teachers?.employee_id || '—'}`;
}

export default function AdminTimetable() {
  const [lectures, setLectures] = useState([]);
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tt, sec, sub, tch, rm] = await Promise.all([
        api.get('/timetable'),
        api.get('/sections'),
        api.get('/subjects'),
        api.get('/timetable/meta/teachers'),
        api.get('/rooms'),
      ]);
      setLectures(tt || []);
      setSections(sec || []);
      setSubjects(sub || []);
      setTeachers(tch || []);
      setRooms(rm || []);
    } catch (e) {
      setError(e.message || 'Unable to load timetable data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-populate semester_id from the selected section (section → semester is a fixed FK).
      if (key === 'section_id') {
        const sec = sections.find((s) => s.id === value);
        next.semester_id = sec?.semester_id || '';
      }
      return next;
    });
  };

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage('');
    setError('');
  }

  function startEdit(l) {
    setEditingId(l.id);
    setForm({
      section_id: l.section_id || '',
      semester_id: l.semester_id || '',
      subject_id: l.subject_id || '',
      teacher_id: l.teacher_id || '',
      room_id: l.room_id || '',
      day_of_week: l.day_of_week || 'monday',
      start_time: String(l.start_time).slice(0, 5),
      end_time: String(l.end_time).slice(0, 5),
      academic_year: l.academic_year || '',
    });
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function validate() {
    if (!form.section_id) return 'Select a class (section).';
    if (!form.semester_id) return 'Semester is required (select a class first).';
    if (!form.subject_id) return 'Select a subject.';
    if (!form.teacher_id) return 'Select a teacher.';
    if (!form.day_of_week) return 'Select a day.';
    if (!form.start_time || !form.end_time) return 'Provide start and end times.';
    if (form.start_time >= form.end_time) return 'End time must be after start time.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        section_id: form.section_id,
        semester_id: form.semester_id,
        subject_id: form.subject_id,
        teacher_id: form.teacher_id,
        room_id: form.room_id || null,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        academic_year: form.academic_year.trim() || null,
      };
      if (editingId) {
        await api.put(`/timetable/${editingId}`, payload);
        setMessage({ type: 'success', text: 'Lecture updated.' });
      } else {
        await api.post('/timetable', payload);
        setMessage({ type: 'success', text: 'Lecture created.' });
      }
      startCreate();
      await load();
    } catch (e2) {
      setError(e2.message || 'Unable to save the lecture.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(l) {
    if (!window.confirm(`Delete lecture: ${lectureLabel(l)}?`)) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await api.delete(`/timetable/${l.id}`);
      setMessage({ type: 'success', text: 'Lecture deleted.' });
      if (editingId === l.id) startCreate();
      await load();
    } catch (e) {
      setError(e.message || 'Unable to delete the lecture.');
    } finally {
      setBusy(false);
    }
  }

  const sectionSemester = (sectionId) => {
    const s = sections.find((x) => x.id === sectionId);
    return s?.semesters
      ? `${s.semesters.name}${s.semesters.courses ? ` · ${s.semesters.courses.name}` : ''}`
      : '';
  };

  return (
    <PortalLayout>
      <div className="px-6 md:px-8 py-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-surface rounded-soft-lg shadow-soft p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
                <CalendarRange size={14} /> Administration
              </p>
              <h1 className="text-2xl font-bold text-text-main mt-1">Timetable Manager</h1>
              <p className="text-text-muted text-sm mt-1">
                Create, edit and delete weekly lectures. Changes reflect immediately on
                teacher and student dashboards.
              </p>
            </div>
            <Link
              to="/admin-dashboard"
              className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-main transition"
            >
              <ArrowLeft size={14} /> Back to dashboard
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <LoadingSpinner />
            <p className="text-sm text-text-muted mt-3">Loading timetable…</p>
          </div>
        ) : (
          <>
            {/* Lecture form */}
            <form
              onSubmit={handleSubmit}
              className="bg-surface rounded-soft-lg shadow-soft p-6 mt-6"
            >
              <SectionTitle>{editingId ? 'Edit Lecture' : 'Add Lecture'}</SectionTitle>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="tt-section" className="text-sm text-text-muted block mb-1">Class (Section)</label>
                  <select
                    id="tt-section"
                    value={form.section_id}
                    onChange={(e) => updateField('section_id', e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">Select class</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {form.section_id && sectionSemester(form.section_id) && (
                    <p className="text-xs text-text-muted mt-1">{sectionSemester(form.section_id)}</p>
                  )}
                </div>
                <div>
                  <label htmlFor="tt-subject" className="text-sm text-text-muted block mb-1">Subject</label>
                  <select
                    id="tt-subject"
                    value={form.subject_id}
                    onChange={(e) => updateField('subject_id', e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tt-teacher" className="text-sm text-text-muted block mb-1">Teacher</label>
                  <select
                    id="tt-teacher"
                    value={form.teacher_id}
                    onChange={(e) => updateField('teacher_id', e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.profiles?.full_name || t.employee_id}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tt-day" className="text-sm text-text-muted block mb-1">Day</label>
                  <select
                    id="tt-day"
                    value={form.day_of_week}
                    onChange={(e) => updateField('day_of_week', e.target.value)}
                    className={INPUT_CLASS}
                  >
                    {DAY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tt-start" className="text-sm text-text-muted block mb-1">Start Time</label>
                  <input
                    id="tt-start"
                    type="time"
                    value={form.start_time}
                    onChange={(e) => updateField('start_time', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="tt-end" className="text-sm text-text-muted block mb-1">End Time</label>
                  <input
                    id="tt-end"
                    type="time"
                    value={form.end_time}
                    onChange={(e) => updateField('end_time', e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label htmlFor="tt-room" className="text-sm text-text-muted block mb-1">Room (optional)</label>
                  <select
                    id="tt-room"
                    value={form.room_id}
                    onChange={(e) => updateField('room_id', e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">No room</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.room_number}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tt-year" className="text-sm text-text-muted block mb-1">Academic Year (optional)</label>
                  <input
                    id="tt-year"
                    value={form.academic_year}
                    onChange={(e) => updateField('academic_year', e.target.value)}
                    placeholder="e.g. 2026-27"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              {message && (
                <p
                  role="status"
                  className={`mt-4 text-sm ${message.type === 'success' ? 'text-success-dark' : 'text-error'}`}
                >
                  {message.text}
                </p>
              )}
              {error && (
                <p role="alert" className="mt-4 text-sm text-error flex items-center gap-1">
                  <AlertCircle size={14} /> {error}
                </p>
              )}

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium disabled:opacity-50"
                >
                  {busy ? <RefreshCw size={16} className="animate-spin" /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}
                  {editingId ? 'Save Changes' : 'Add Lecture'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={startCreate}
                    className="px-4 py-2 rounded-soft text-sm font-medium text-text-muted hover:text-text-main transition"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            {/* Lectures table */}
            <div className="bg-surface rounded-soft-lg shadow-soft p-6 mt-6">
              <SectionTitle>All Lectures ({lectures.length})</SectionTitle>
              {lectures.length ? (
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="text-left text-text-muted border-b border-text-muted/25">
                        <th className="py-2 pr-4">Day</th>
                        <th className="py-2 pr-4">Time</th>
                        <th className="py-2 pr-4">Subject</th>
                        <th className="py-2 pr-4">Class</th>
                        <th className="py-2 pr-4">Teacher</th>
                        <th className="py-2 pr-4">Room</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DAY_OPTIONS.flatMap(({ value: day }) =>
                        lectures
                          .filter((l) => l.day_of_week === day)
                          .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))
                          .map((l) => (
                            <tr key={l.id} className="border-b border-text-muted/15">
                              <td className="py-2 pr-4 capitalize text-text-main">{day}</td>
                              <td className="py-2 pr-4 text-text-main">
                                {String(l.start_time).slice(0, 5)}–{String(l.end_time).slice(0, 5)}
                              </td>
                              <td className="py-2 pr-4 text-text-main">{l.subjects?.name || '—'}</td>
                              <td className="py-2 pr-4 text-text-main">{l.sections?.name || '—'}</td>
                              <td className="py-2 pr-4 text-text-muted">
                                {l.teachers?.profiles?.full_name || l.teachers?.employee_id || '—'}
                              </td>
                              <td className="py-2 pr-4 text-text-muted">{l.rooms?.room_number || '—'}</td>
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(l)}
                                    disabled={busy}
                                    className="p-1.5 rounded-soft bg-primary/10 text-primary hover:bg-primary/20 transition disabled:opacity-50"
                                    aria-label={`Edit lecture: ${l.subjects?.name || ''}`}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(l)}
                                    disabled={busy}
                                    className="p-1.5 rounded-soft bg-error/10 text-error hover:bg-error/20 transition disabled:opacity-50"
                                    aria-label={`Delete lecture: ${l.subjects?.name || ''}`}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <CalendarRange className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-50" />
                  <p className="text-sm text-text-muted mb-2">No lectures yet</p>
                  <p className="text-xs text-text-muted">
                    Add your first lecture using the form above.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <p className="mt-10 text-center text-xs text-text-muted flex items-center justify-center gap-1">
          <CalendarRange size={14} /> Timetable Manager · MBSCET Academic Portal
        </p>
      </div>
    </PortalLayout>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-lg font-bold text-text-main mb-3">{children}</h2>;
}
