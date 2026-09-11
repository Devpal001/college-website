// One-off smoke test for the new /api/timetable endpoints and the
// profile avatar_url/phone null-clearing fix. Self-cleaning: the lecture
// it creates is deleted at the end. Requires the API running locally.
import 'dotenv/config';

const API = process.env.VITE_API_URL || 'http://localhost:3001';

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${extra ? ` -> ${extra}` : ''}`);
  }
}

async function api(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function login(portalId, role) {
  const r = await api('/api/auth/demo-login', null, {
    method: 'POST',
    body: JSON.stringify({ portalId, role }),
  });
  return r.body?.session?.access_token || null;
}

async function main() {
  const teacher = await login('TCH001', 'teacher');
  const student = await login('STU001', 'student');
  const admin = await login('ADMIN001', 'admin');
  ok('demo logins', Boolean(teacher && student && admin));

  // --- Timetable read scoping ---
  const unauth = await api('/api/timetable');
  ok('unauthenticated timetable 401', unauth.status === 401, `got ${unauth.status}`);

  const tt = await api('/api/timetable', teacher);
  ok('teacher timetable 200', tt.status === 200, `got ${tt.status}`);
  ok('teacher sees own lectures', Array.isArray(tt.body) && tt.body.length > 0, `got ${tt.body?.length}`);

  const ttStudent = await api('/api/timetable', student);
  ok('student timetable 200', ttStudent.status === 200, `got ${ttStudent.status}`);

  const ttAdmin = await api('/api/timetable', admin);
  ok('admin timetable 200', ttAdmin.status === 200, `got ${ttAdmin.status}`);
  const otherSection = (ttAdmin.body || []).find(
    (l) => l.section_id && l.section_id !== (ttStudent.body?.[0]?.section_id || '')
  );
  if (otherSection) {
    const denied = await api(`/api/timetable?sectionId=${otherSection.section_id}`, student);
    ok('student blocked from other section (403)', denied.status === 403, `got ${denied.status}`);
  } else {
    console.log('  SKIP student cross-section test (only one section exists)');
  }

  // --- Timetable mutations ---
  const teacherPost = await api('/api/timetable', teacher, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  ok('teacher mutation blocked (403)', teacherPost.status === 403, `got ${teacherPost.status}`);

  const studentPost = await api('/api/timetable', student, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  ok('student mutation blocked (403)', studentPost.status === 403, `got ${studentPost.status}`);

  const meta = await api('/api/timetable/meta/teachers', admin);
  ok('admin meta/teachers 200', meta.status === 200 && meta.body?.length > 0, `got ${meta.status}`);

  const sections = await api('/api/sections', admin);
  const subjects = await api('/api/subjects', admin);
  const rooms = await api('/api/rooms', admin);
  const semesters = await api('/api/semesters', admin);
  const section = sections.body?.[0];
  const subject = subjects.body?.[0];
  // Assign the new lecture to the LOGGED-IN teacher so we can verify he
  // sees it in his own scoped listing immediately.
  const teacherMe = await api('/api/profile/me', teacher);
  const teacherRow = { id: teacherMe.body?.teacher?.id, profiles: { full_name: teacherMe.body?.profile?.full_name } };
  const semester =
    semesters.body?.find((s) => s.id === section?.semester_id) || semesters.body?.[0];
  const room = rooms.body?.[0] || null;
  ok('reference data loaded', Boolean(section && subject && teacherRow.id && semester));

  const invalid = await api('/api/timetable', admin, {
    method: 'POST',
    body: JSON.stringify({
      section_id: section.id,
      subject_id: subject.id,
      teacher_id: teacherRow.id,
      semester_id: semester.id,
      day_of_week: 'funday',
      start_time: '10:00',
      end_time: '09:00',
    }),
  });
  ok('invalid payload rejected (400)', invalid.status === 400, `got ${invalid.status} ${JSON.stringify(invalid.body)}`);

  const created = await api('/api/timetable', admin, {
    method: 'POST',
    body: JSON.stringify({
      section_id: section.id,
      subject_id: subject.id,
      teacher_id: teacherRow.id,
      semester_id: semester.id,
      room_id: room?.id || null,
      day_of_week: 'friday',
      start_time: '15:00',
      end_time: '16:00',
      academic_year: '2026-27',
    }),
  });
  ok('admin create lecture 201', created.status === 201, `got ${created.status} ${JSON.stringify(created.body)}`);
  const lectureId = created.body?.id;

  if (lectureId) {
    const teacherSeesNew = await api('/api/timetable', teacher);
    ok(
      'teacher timetable reflects the new lecture immediately',
      (teacherSeesNew.body || []).some((l) => l.id === lectureId)
    );

    const updated = await api(`/api/timetable/${lectureId}`, admin, {
      method: 'PUT',
      body: JSON.stringify({ start_time: '16:00', end_time: '17:00', room_id: null }),
    });
    ok('admin update lecture 200', updated.status === 200, `got ${updated.status}`);
    ok('update persisted (time changed)', String(updated.body?.start_time).startsWith('16:00'), `got ${updated.body?.start_time}`);
    ok('room cleared to null', updated.body?.room_id === null, `got ${updated.body?.room_id}`);

    const removed = await api(`/api/timetable/${lectureId}`, admin, { method: 'DELETE' });
    ok('admin delete lecture 200', removed.status === 200, `got ${removed.status}`);
    // Verify deletion through the role-scoped listing (GET /:id is not part
    // of this API; /api/timetable/:uuid falls through to the legacy
    // academics section-timetable route by design).
    const afterDelete = await api('/api/timetable', admin);
    ok(
      'deleted lecture gone from listing',
      !(afterDelete.body || []).some((l) => l.id === lectureId)
    );
  }

  // --- Profile avatar_url/phone null-clearing fix ---
  const me = await api('/api/profile/me', teacher);
  const profileId = me.body?.profile?.id;
  ok('teacher profile/me', Boolean(profileId));

  const saveWithNulls = await api(`/api/profile/${profileId}`, teacher, {
    method: 'PUT',
    body: JSON.stringify({ phone: null, avatar_url: null }),
  });
  ok('PUT profile with null avatar_url/phone 200', saveWithNulls.status === 200, `got ${saveWithNulls.status} ${JSON.stringify(saveWithNulls.body)}`);
  ok('avatar_url cleared', saveWithNulls.body?.avatar_url === null, `got ${saveWithNulls.body?.avatar_url}`);

  const saveWithValue = await api(`/api/profile/${profileId}`, teacher, {
    method: 'PUT',
    body: JSON.stringify({ phone: '9999999999', avatar_url: 'https://example.com/a.png' }),
  });
  ok('PUT profile with values 200', saveWithValue.status === 200, `got ${saveWithValue.status}`);
  ok('avatar_url saved', saveWithValue.body?.avatar_url === 'https://example.com/a.png');
  ok('phone saved', saveWithValue.body?.phone === '9999999999');

  // restore original (null) values so no test data remains
  const restore = await api(`/api/profile/${profileId}`, teacher, {
    method: 'PUT',
    body: JSON.stringify({ phone: null, avatar_url: null }),
  });
  ok('profile restored to nulls', restore.status === 200 && restore.body?.phone === null);

  // Teacher cannot update someone else's profile
  const studentMe = await api('/api/profile/me', student);
  const otherSave = await api(`/api/profile/${studentMe.body?.profile?.id}`, teacher, {
    method: 'PUT',
    body: JSON.stringify({ full_name: 'Hacked Name' }),
  });
  ok('teacher cannot update another user profile (403)', otherSave.status === 403, `got ${otherSave.status}`);

  console.log(`\nSmoke result: ${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
main().catch((e) => {
  console.error('Smoke test failed:', e);
  process.exit(1);
});
