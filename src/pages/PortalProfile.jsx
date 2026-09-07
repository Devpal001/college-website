import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import PortalLayout from '../components/PortalLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  User, Mail, Phone, GraduationCap, Briefcase, Building2, Hash,
  BookOpen, CalendarDays, ShieldCheck, MapPin, Droplet, Award, Pencil,
} from 'lucide-react';

const INPUT_CLASS =
  'w-full px-4 py-2 rounded-soft bg-bg-soft shadow-inset border border-transparent focus:border-primary outline-none transition text-sm';

/**
 * Role-aware profile page with edit mode.
 * Reads the authenticated user's profile plus
 * their linked student/teacher record from GET /api/profile/me.
 */
export default function PortalProfile() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    avatar_url: '',
    designation: '',
    qualification: '',
    specialization: '',
    experience_years: '',
    address: '',
    city: '',
    state: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const d = await api.get('/profile/me');
      setData(d);
      setForm({
        full_name: d?.profile?.full_name || '',
        phone: d?.profile?.phone || '',
        avatar_url: d?.profile?.avatar_url || '',
        designation: d?.teacher?.designation || '',
        qualification: d?.teacher?.qualification || '',
        specialization: d?.teacher?.specialization || '',
        experience_years: d?.teacher?.experience_years ?? '',
        address: d?.student?.address || '',
        city: d?.student?.city || '',
        state: d?.student?.state || '',
        emergency_contact_name: d?.student?.emergency_contact_name || '',
        emergency_contact_phone: d?.student?.emergency_contact_phone || '',
      });
    } catch (e) {
      setError(e.message || 'Unable to load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      const { profile, student, teacher } = data || {};
      const role = profile?.role;

      // Always update common profile fields
      const profileUpdates = {
        full_name: form.full_name.trim() || profile.full_name,
        phone: form.phone.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
      };
      await api.put(`/profile/${profile.id}`, profileUpdates);

      // Role-specific updates
      if (role === 'teacher' && teacher) {
        await api.put('/teachers/me/profile', {
          designation: form.designation,
          qualification: form.qualification,
          specialization: form.specialization,
          experience_years: form.experience_years,
        });
      } else if (role === 'student' && student) {
        await api.put('/students/me/profile', {
          address: form.address,
          city: form.city,
          state: form.state,
          emergency_contact_name: form.emergency_contact_name,
          emergency_contact_phone: form.emergency_contact_phone,
        });
      }

      setMessage({ type: 'success', text: 'Profile updated successfully.' });
      setEditing(false);
      await load();
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Failed to update profile.' });
    } finally {
      setSaving(false);
    }
  }

  let content;
  if (loading) {
    content = (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  } else if (error || !data) {
    content = (
      <div className="min-h-[50vh] flex items-center justify-center px-6">
        <div className="bg-surface rounded-soft-lg shadow-soft p-8 text-center max-w-md">
          <p className="text-error font-medium mb-2">Unable to load your profile</p>
          <p className="text-sm text-text-muted mb-4">{error}</p>
          <button type="button" onClick={load} className="btn-primary px-5 py-2 rounded-soft text-sm font-medium">
            Try Again
          </button>
        </div>
      </div>
    );
  } else {
    const { profile, student, teacher, department } = data;
    const isTeacher = Boolean(teacher);
    const isStudent = Boolean(student);
    const name = profile?.full_name || 'Portal User';
    const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

    const identityRows = student
      ? [
          { icon: Hash, label: 'Enrollment Number', value: student.enrollment_number, editable: false },
          { icon: Building2, label: 'Department', value: department?.name || '—', editable: false },
          { icon: GraduationCap, label: 'Current Semester', value: student.current_semester ? `Semester ${student.current_semester}` : '—', editable: false },
          { icon: BookOpen, label: 'Section', value: student.current_section || '—', editable: false },
          { icon: CalendarDays, label: 'Admission Year', value: student.admission_date ? String(student.admission_date).slice(0, 4) : '—', editable: false },
          { icon: MapPin, label: 'City', value: form.city, editable: true, key: 'city' },
          { icon: Droplet, label: 'Blood Group', value: student.blood_group || '—', editable: false },
        ]
      : teacher
        ? [
            { icon: Hash, label: 'Employee ID', value: teacher.employee_id, editable: false },
            { icon: Building2, label: 'Department', value: department?.name || '—', editable: false },
            { icon: Briefcase, label: 'Designation', value: form.designation, editable: true, key: 'designation' },
            { icon: Award, label: 'Qualification', value: form.qualification, editable: true, key: 'qualification' },
            { icon: BookOpen, label: 'Specialization', value: form.specialization, editable: true, key: 'specialization' },
            { icon: CalendarDays, label: 'Experience', value: teacher.experience_years ? `${teacher.experience_years} years` : '—', editable: true, key: 'experience_years' },
            { icon: CalendarDays, label: 'Joined', value: teacher.date_of_joining ? String(teacher.date_of_joining).slice(0, 10) : '—', editable: false },
          ]
        : [];

    content = (
      <div className="px-6 md:px-8 py-10 max-w-3xl mx-auto">
        {/* Header card */}
        <div className="bg-surface rounded-soft-lg shadow-soft p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-primary text-white flex items-center justify-center text-2xl font-bold shrink-0">
              {initials}
            </div>
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl font-bold text-text-main">{name}</h1>
              <p className="text-text-muted text-sm">{profile?.email || '—'}</p>
              <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold capitalize">
                <ShieldCheck size={12} /> {profile?.role || 'user'}
              </span>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="btn-primary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium"
              >
                <Pencil size={16} /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Identity details */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-text-main mb-3">
            {student ? 'Student Profile' : teacher ? 'Faculty Profile' : 'Account Profile'}
          </h2>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {editing ? (
              <>
                <div className="sm:col-span-2">
                  <label className="text-sm text-text-muted block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => updateField('full_name', e.target.value)}
                    className={INPUT_CLASS}
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="text-sm text-text-muted block mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className={INPUT_CLASS}
                    maxLength={20}
                  />
                </div>
                {isTeacher && (
                  <>
                    <div>
                      <label className="text-sm text-text-muted block mb-1">Designation</label>
                      <input
                        type="text"
                        value={form.designation}
                        onChange={(e) => updateField('designation', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-muted block mb-1">Qualification</label>
                      <input
                        type="text"
                        value={form.qualification}
                        onChange={(e) => updateField('qualification', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-muted block mb-1">Specialization</label>
                      <input
                        type="text"
                        value={form.specialization}
                        onChange={(e) => updateField('specialization', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-muted block mb-1">Experience (years)</label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={form.experience_years}
                        onChange={(e) => updateField('experience_years', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </>
                )}
                {isStudent && (
                  <>
                    <div className="sm:col-span-2">
                      <label className="text-sm text-text-muted block mb-1">Address</label>
                      <input
                        type="text"
                        value={form.address}
                        onChange={(e) => updateField('address', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-muted block mb-1">City</label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => updateField('city', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-muted block mb-1">State</label>
                      <input
                        type="text"
                        value={form.state}
                        onChange={(e) => updateField('state', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-muted block mb-1">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={form.emergency_contact_name}
                        onChange={(e) => updateField('emergency_contact_name', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-text-muted block mb-1">Emergency Contact Phone</label>
                      <input
                        type="tel"
                        value={form.emergency_contact_phone}
                        onChange={(e) => updateField('emergency_contact_phone', e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2 px-4 py-2 rounded-soft text-sm font-medium disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setMessage('');
                    }}
                    className="px-4 py-2 rounded-soft text-sm font-medium text-text-muted hover:text-text-main transition"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              identityRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-start gap-3">
                    <div className="rounded-full p-2 bg-primary/10 text-primary shrink-0">
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-text-muted">{row.label}</p>
                      <p className="text-sm font-medium text-text-main break-words">{row.value}</p>
                    </div>
                  </div>
                );
              })
            )}
            {!editing && (
              <>
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-2 bg-primary/10 text-primary shrink-0">
                    <Mail size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Email</p>
                    <p className="text-sm font-medium text-text-main break-words">{profile?.email || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full p-2 bg-primary/10 text-primary shrink-0">
                    <Phone size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted">Phone</p>
                    <p className="text-sm font-medium text-text-main">{student?.emergency_contact_phone || teacher?.phone || '—'}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {message && (
          <p
            role="status"
            className={`mt-4 text-sm ${
              message.type === 'success' ? 'text-success-dark' : 'text-error'
            }`}
          >
            {message.text}
          </p>
        )}

        <p className="mt-8 text-center text-xs text-text-muted flex items-center justify-center gap-1">
          <User size={14} /> Profile · MBSCET Academic Portal
        </p>
      </div>
    );
  }

  return <PortalLayout>{content}</PortalLayout>;
}
