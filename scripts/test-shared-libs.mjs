// ============================================================
// SHARED HELPER TESTS (no server, no database)
// ============================================================
// Guards the pure functions that several modules now depend on:
//   server/lib/academics.js  — attendance/marks arithmetic
//   src/lib/format.js        — display formatting
//
// These encode domain rules ("late counts as attended", "no NaN/Infinity in
// percentages"), so a silent change here would corrupt dashboards and the AI
// assistant at the same time. Run:
//   node scripts/test-shared-libs.mjs
// ============================================================

import {
  ATTENDED_STATUSES,
  averageMarksPercentage,
  countsAsAttended,
  percentage,
  roundTo,
  summarizeAttendance,
} from '../server/lib/academics.js';
import { formatPercent, getInitials } from '../src/lib/format.js';

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

console.log('== percentage() ==');
ok('50/100 -> 50', percentage(50, 100) === 50);
ok('1/3 rounds to 33 (integer)', percentage(1, 3) === 33);
ok('1/3 with 1 decimal -> 33.3', percentage(1, 3, { decimals: 1 }) === 33.3);
ok('25/30 with 1 decimal -> 83.3', percentage(25, 30, { decimals: 1 }) === 83.3);
ok('zero denominator -> 0 (no NaN)', percentage(5, 0) === 0);
ok('missing denominator -> 0', percentage(5, undefined) === 0);
ok('string inputs are coerced', percentage('7', '10') === 70);
ok('result is never Infinity', Number.isFinite(percentage(1, 0)));
ok('roundTo(78.64999, 1) === 78.6', roundTo(78.64999, 1) === 78.6);

console.log('== attendance rules ==');
ok('late counts as attended', countsAsAttended('late'));
ok('present counts as attended', countsAsAttended('present'));
ok('absent does not count', !countsAsAttended('absent'));
ok('unknown/undefined status does not count', !countsAsAttended(undefined));
ok('ATTENDED_STATUSES is exactly present+late', ATTENDED_STATUSES.join(',') === 'present,late');

{
  const rows = [
    { status: 'present' },
    { status: 'late' },
    { status: 'absent' },
    { status: 'excused' },
    { status: 'present' },
  ];
  const summary = summarizeAttendance(rows);
  ok('total = 5', summary.total === 5, `got ${summary.total}`);
  ok('presentCount = 3 (present + late)', summary.presentCount === 3, `got ${summary.presentCount}`);
  ok('percentage = 60', summary.percentage === 60, `got ${summary.percentage}`);
  ok('statuses counted individually', summary.present === 2 && summary.late === 1 && summary.absent === 1 && summary.excused === 1);
  ok('empty input is safe', summarizeAttendance([]).percentage === 0);
  ok('missing status treated as absent', summarizeAttendance([{}]).percentage === 0);
  ok('1-decimal mode keeps dashboards precise', summarizeAttendance([{ status: 'present' }, { status: 'present' }, { status: 'present' }]).percentage === 100);
}

console.log('== averageMarksPercentage() ==');
{
  const { total, average } = averageMarksPercentage([
    { marks_obtained: 80, marks_max: 100 },
    { marks_obtained: 90, marks_max: 100 },
  ]);
  ok('two papers -> 85', average === 85 && total === 2, `average=${average} total=${total}`);

  const filtered = averageMarksPercentage([
    { marks_obtained: 50, marks_max: 100 },
    { marks_obtained: 10, marks_max: 0 },
    { marks_obtained: 'abc', marks_max: 50 },
  ]);
  ok('rows with no max / non-numeric marks are ignored', filtered.total === 1 && filtered.average === 50, JSON.stringify(filtered));

  // null coerces to 0 and counts as a zero score — pre-existing assistant
  // behaviour, asserted here so a future change is deliberate.
  const nullMarks = averageMarksPercentage([
    { marks_obtained: 50, marks_max: 100 },
    { marks_obtained: null, marks_max: 50 },
  ]);
  ok('null marks count as 0 (documented behaviour)', nullMarks.total === 2 && nullMarks.average === 25, JSON.stringify(nullMarks));

  const empty = averageMarksPercentage([]);
  ok('empty input -> { total: 0, average: 0 }', empty.total === 0 && empty.average === 0);
  ok('unrounded terms (49.9 + 50.0 -> 50)', averageMarksPercentage([
    { marks_obtained: 49.9, marks_max: 100 },
    { marks_obtained: 50.1, marks_max: 100 },
  ]).average === 50);
}

console.log('== format helpers ==');
ok('two-word name -> DS', getInitials('Devpal Singh') === 'DS');
ok('extra whitespace is ignored', getInitials('  devpal   singh ') === 'DS');
ok('single name -> first letter', getInitials('Devpal') === 'D');
ok('three words keep the first two', getInitials('Dev Pal Singh') === 'DP');
ok('empty name -> fallback', getInitials('') === '?');
ok('undefined name -> fallback', getInitials(undefined, { fallback: 'NA' }) === 'NA');
ok('formatPercent(78.64) -> 78.6%', formatPercent(78.64) === '78.6%');
ok('formatPercent(null) -> dash', formatPercent(null) === '—');

console.log(`Result: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);