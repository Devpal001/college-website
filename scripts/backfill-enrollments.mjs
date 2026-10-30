// ============================================================
// ONE-OFF BACKFILL: give the two student accounts that were
// provisioned before enrollment provisioning existed an ACTIVE
// enrollments row (Student -> Enrollment so teachers can see them).
//
//   node scripts/backfill-enrollments.mjs           # DRY RUN (default)
//   node scripts/backfill-enrollments.mjs --apply   # perform the writes
//
// Targets are keyed by students.id AND enrollment_number — never by
// name (duplicate display names already exist in this database).
//
// APPROVED ASSIGNMENTS (both accounts):
//   semester = Semester 5  (id resolved at runtime, must be number 5)
//   section  = CSE-5A      (id resolved at runtime, must belong to Sem 5)
// plus one reconciliation write:
//   MBSCET-STU-2026-00001  students.current_semester 3 -> 5
//   (it was recorded in semester 3, which has no section row in the
//    system; semester 5 / CSE-5A is its verified placement, and the
//    record must not contradict its own enrollment).
//
// Idempotent: an existing (student, semester) enrollment is reported
// and skipped. Prints every record it will touch; never prints secrets.
// ============================================================

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const sb = createClient(env.VITE_SUPABASE_URL || env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const EXPECTED_SECTION_NAME = 'CSE-5A';
const EXPECTED_SEMESTER_NUMBER = 5;

const TARGETS = [
  {
    studentId: 'b1419930-fa8e-49e5-9c23-41c9462b8b0a',
    enrollmentNumber: 'MBSCET-STU-2026-00001',
    reconcileCurrentSemester: EXPECTED_SEMESTER_NUMBER,
  },
  {
    studentId: '4758a39d-86e1-4ac3-8e82-6e5ac609c1de',
    enrollmentNumber: 'PROBE-001',
    reconcileCurrentSemester: null,
  },
];

const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

console.log(
  `Enrollment backfill — mode: ${APPLY ? 'APPLY (writes will happen)' : 'DRY RUN (no writes)'}\n`
);

// ---- Resolve the approved placement from real rows (never hard-coded ids) ----
const { data: section, error: secErr } = await sb
  .from('sections')
  .select('id, name, semester_id, semesters(id, name, semester_number)')
  .eq('name', EXPECTED_SECTION_NAME)
  .maybeSingle();
if (secErr) die(`cannot read sections: ${secErr.message}`);
if (!section) die(`section ${EXPECTED_SECTION_NAME} not found`);
if (section.semesters?.semester_number !== EXPECTED_SEMESTER_NUMBER) {
  die(
    `section ${EXPECTED_SECTION_NAME} belongs to semester ${section.semesters?.semester_number}, ` +
      `expected ${EXPECTED_SEMESTER_NUMBER} — refusing to guess`
  );
}
console.log(`Placement: semester "${section.semesters.name}" (${section.semesters.id})`);
console.log(`           section  "${section.name}" (${section.id})\n`);

let writes = 0;
let skipped = 0;

for (const target of TARGETS) {
  const { data: student, error: stErr } = await sb
    .from('students')
    .select('id, enrollment_number, current_semester, profile_id, profiles(email)')
    .eq('id', target.studentId)
    .maybeSingle();
  if (stErr) die(`cannot read students: ${stErr.message}`);
  if (!student) die(`students.id ${target.studentId} not found`);
  if (student.enrollment_number !== target.enrollmentNumber) {
    die(
      `students.id ${target.studentId} holds enrollment_number "${student.enrollment_number}", ` +
        `expected "${target.enrollmentNumber}" — refusing to write against the wrong record`
    );
  }

  console.log(`• ${student.enrollment_number}  students.id=${student.id}`);
  console.log(
    `  account: ${student.profiles?.email || '(no profile)'}  current_semester=${student.current_semester ?? 'null'}`
  );

  // (1) Enrollment insert (skip if already present — UNIQUE(student_id, semester_id))
  const { data: existing, error: exErr } = await sb
    .from('enrollments')
    .select('id, status, semester_id, section_id')
    .eq('student_id', student.id)
    .eq('semester_id', section.semesters.id)
    .maybeSingle();
  if (exErr) die(`cannot read enrollments: ${exErr.message}`);

  if (existing) {
    console.log(`  enrollment: already present (${existing.id}, status=${existing.status}) — SKIP`);
    skipped += 1;
  } else {
    console.log(
      `  enrollment: WILL INSERT -> status="active", semester_id=${section.semesters.id}, section_id=${section.id}`
    );
    if (APPLY) {
      const { error: insErr } = await sb.from('enrollments').insert({
        student_id: student.id,
        semester_id: section.semesters.id,
        section_id: section.id,
        status: 'active',
      });
      if (insErr) die(`insert failed for ${student.enrollment_number}: ${insErr.message}`);
      console.log('  enrollment: INSERTED');
    }
    writes += 1;
  }

  // (2) Optional reconciliation of students.current_semester
  const expected = target.reconcileCurrentSemester;
  if (expected != null) {
    if (student.current_semester === expected) {
      console.log(`  students.current_semester: already ${expected} — SKIP`);
      skipped += 1;
    } else {
      console.log(
        `  students.current_semester: WILL UPDATE ${student.current_semester ?? 'null'} -> ${expected}`
      );
      if (APPLY) {
        const { error: upErr } = await sb
          .from('students')
          .update({ current_semester: expected })
          .eq('id', student.id)
          .eq('current_semester', student.current_semester); // guard against races
        if (upErr) die(`update failed for ${student.enrollment_number}: ${upErr.message}`);
        console.log('  students.current_semester: UPDATED');
      }
      writes += 1;
    }
  }
  console.log('');
}

console.log(`${APPLY ? 'Applied' : 'Planned'} ${writes} write(s), ${skipped} already-correct item(s).`);
if (!APPLY) {
  console.log('Dry run only — re-run with --apply to perform the writes.');
}

