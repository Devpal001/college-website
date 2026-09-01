import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import PortalLayout from '../components/PortalLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  User, Mail, Phone, GraduationCap, Briefcase, Building2, Hash,
  BookOpen, CalendarDays, ShieldCheck, MapPin, Droplet, Award,
} from 'lucide-react';

/**
 * Role-aware profile page. Reads the authenticated user's profile plus
 * their linked student/teacher record from GET /api/profile/me.
 */
export default function PortalProfile() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await api.get('/profile/me');
      setData(d);
    } catch (e) {
      setError(e.message || 'Unable to load your profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
    const name = profile?.full_name || 'Portal User';
    const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

    const identityRows = student ? [
      { icon: Hash, label: 'Enrollment Number', value: student.enrollment_number },
      { icon: Building2, label: 'Department', value: department?.name || '—' },
      { icon: GraduationCap, label: 'Current Semester', value: student.current_semester ? `Semester ${student.current_semester}` : '—' },
      { icon: BookOpen, label: 'Section', value: student.current_section || '—' },
      { icon: CalendarDays, label: 'Admission Year', value: student.admission_date ? String(student.admission_date).slice(0, 4) : '—' },
      { icon: MapPin, label: 'City', value: student.city || '—' },
      { icon: Droplet, label: 'Blood Group', value: student.blood_group || '—' },
    ] : teacher ? [
      { icon: Hash, label: 'Employee ID', value: teacher.employee_id },
      { icon: Building2, label: 'Department', value: department?.name || '—' },
      { icon: Briefcase, label: 'Designation', value: teacher.designation || '—' },
      { icon: Award, label: 'Qualification', value: teacher.qualification || '—' },
      { icon: BookOpen, label: 'Specialization', value: teacher.specialization || '—' },
      { icon: CalendarDays, label: 'Experience', value: teacher.experience_years ? `${teacher.experience_years} years` : '—' },
      { icon: CalendarDays, label: 'Joined', value: teacher.date_of_joining ? String(teacher.date_of_joining).slice(0, 10) : '—' },
    ] : [];
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
          </div>
        </div>

        {/* Identity details */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-text-main mb-3">
            {student ? 'Student Profile' : teacher ? 'Faculty Profile' : 'Account Profile'}
          </h2>
          <div className="bg-surface rounded-soft-lg shadow-soft p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {identityRows.map((row) => {
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
            })}
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
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-text-muted flex items-center justify-center gap-1">
          <User size={14} /> Profile · MBSCET Academic Portal
        </p>
      </div>
    );
  }

  return <PortalLayout>{content}</PortalLayout>;
}