/* Local reproduction harness: mirrors TimetableGenerate.tsx for one level. */
import fs from 'fs';
import {
  generateSlots, getExactGridAssignmentIssues, resolveLessonTargets,
} from './src/lib/timetable-generator';
import {
  formatCspSolverIssues, formatCspSolverWarnings, solveTimetableCsp,
} from './src/lib/timetable-csp-solver';
import { validateTimetableRules } from './src/lib/timetable-validator';
import {
  activityMatchesLevel, isPostLessonActivity, resolveActivityLessonSlot,
} from './src/lib/timetable-activity';

const DATA = JSON.parse(fs.readFileSync('/home/ubuntu/kenyanavy_data.json', 'utf8'));
const LEVEL_CONFIGS = JSON.parse(fs.readFileSync('/home/ubuntu/kenyanavy_configs.json', 'utf8'));
const ACTIVITIES = JSON.parse(fs.readFileSync('/home/ubuntu/kenyanavy_activities.json', 'utf8'));
const STROKED = JSON.parse(fs.readFileSync('/home/ubuntu/kenyanavy_stroked.json', 'utf8'));

const levelKey = process.argv[2] || 'junior';
const useStroked = process.argv[3] !== 'nostroke';

const LEVEL_GROUP_GRADE_RANGES: Record<string, number[]> = {
  'pre-primary': [-3, -2, -1, 0],
  'lower-primary': [1, 2, 3],
  'upper-primary': [4, 5, 6],
  junior: [7, 8, 9],
  senior: [10, 11, 12],
  'form-3-4': [11, 12],
};
const classMatchesLevel = (cls: any, key: string): boolean => {
  const gradeLevel = Number(cls.grade_level ?? cls.level);
  if ((LEVEL_GROUP_GRADE_RANGES[key] || []).includes(gradeLevel)) return true;
  const name = String(cls.name || '').toLowerCase();
  if (key === 'pre-primary' && /(pp\s*[12]|pre[\s-]?primary|playgroup|baby)/.test(name)) return true;
  if (key === 'lower-primary' && /grade\s*[123]\b/.test(name)) return true;
  if (key === 'upper-primary' && /grade\s*[456]\b/.test(name)) return true;
  if (key === 'junior' && /grade\s*[789]\b/.test(name)) return true;
  if (key === 'senior' && /grade\s*(10|11|12)\b/.test(name)) return true;
  return key === 'form-3-4' && /form\s*[34]\b/.test(name);
};

const toMinutes = (v: any): number => {
  const [h, m] = String(v || '').slice(0, 5).split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : 0;
};

const db = LEVEL_CONFIGS.find((c: any) => c.level_group === levelKey);
const config: any = {
  lesson_duration: db.period_duration || 40,
  school_start: String(db.start_time || '').slice(0, 5),
  school_end: String(db.end_time || db.activities_end || db.lunch_end || '').slice(0, 5),
  first_break_start: String(db.first_break_start || '').slice(0, 5),
  first_break_end: String(db.first_break_end || '').slice(0, 5),
  second_break_start: String(db.second_break_start || '').slice(0, 5),
  second_break_end: String(db.second_break_end || '').slice(0, 5),
  lunch_start: String(db.lunch_start || '').slice(0, 5),
  lunch_end: String(db.lunch_end || '').slice(0, 5),
  activities_start: db.activities_start ? String(db.activities_start).slice(0, 5) : undefined,
  activities_end: db.activities_end ? String(db.activities_end).slice(0, 5) : undefined,
  activities: {},
  lessons_per_day: typeof db.lessons_per_day === 'number' ? db.lessons_per_day : undefined,
  after_lunch_lessons: typeof db.after_lunch_lessons === 'number' ? db.after_lunch_lessons : undefined,
};

const allClasses = DATA.classes.filter((c: any) => c.is_active);
const assignments = DATA.assignments;
const classesToProcess = allClasses.filter((c: any) => classMatchesLevel(c, levelKey));
const classIds = new Set(classesToProcess.map((c: any) => String(c.id)));
const levelAssignments = assignments.filter((a: any) => classIds.has(String(a.class_id)));

const targets = resolveLessonTargets(levelKey, config);
const highestClassTotal = Math.max(0, ...classesToProcess.map((cls: any) => {
  const ca = levelAssignments.filter((a: any) => String(a.class_id) === String(cls.id));
  const total = ca.reduce((s: number, a: any) => s + Math.max(0, Number(a.lessons_per_week) || 0), 0);
  const religious = ca.filter((a: any) => /\b(CRE|IRE|HRE)\b|religious/i.test(String(a.subjects?.name || '')));
  const relTotal = religious.reduce((s: number, a: any) => s + Math.max(0, Number(a.lessons_per_week) || 0), 0);
  const extra = religious.length > 1
    ? relTotal - Math.max(...religious.map((a: any) => Math.max(0, Number(a.lessons_per_week) || 0)))
    : 0;
  return total - extra;
}));
const periodsNeeded = Math.ceil(highestClassTotal / 5);
const lessonCount = Math.max(targets.totalLessons, periodsNeeded);
const generationConfig = {
  ...config,
  activities_start: ACTIVITIES.length ? undefined : config.activities_start,
  activities_end: ACTIVITIES.length ? undefined : config.activities_end,
  lessons_per_day: lessonCount,
  after_lunch_lessons: targets.afterLunch,
};
const baseSlots = generateSlots(generationConfig, lessonCount, levelKey);

const activityCandidates = ACTIVITIES
  .filter((a: any) => activityMatchesLevel(a.target_level_group, levelKey))
  .filter((a: any) => a.activity_name && toMinutes(a.end_time) > toMinutes(a.start_time))
  .filter((a: any) => !(['lower-primary', 'pre-primary'].includes(levelKey)) || toMinutes(a.start_time) < toMinutes(config.lunch_start));
const postLesson = activityCandidates.filter((a: any) => isPostLessonActivity(baseSlots, a));
const inLesson = activityCandidates.filter((a: any) => Boolean(resolveActivityLessonSlot(baseSlots, a)));

const combined = [...baseSlots, ...postLesson.map((a: any) => ({
  slot_order: 0, label: `ACTIVITY: ${a.activity_name}`, slot_type: 'activities' as const,
  start_time: a.start_time, end_time: a.end_time,
}))]
  .sort((a: any, b: any) => toMinutes(a.start_time) - toMinutes(b.start_time) || (a.slot_type === 'activities' ? 1 : -1))
  .map((slot: any, i: number) => ({ ...slot, slot_order: i + 1 }));

let seq = 0;
const createdSlots = combined.map((slot: any) => ({
  ...slot,
  id: `slot-${levelKey}-${++seq}`,
  school_id: 'local',
  level_group: levelKey,
  slot_type: slot.slot_type === 'activities' ? 'activity' : slot.slot_type,
}));
const orderedSlots = createdSlots.slice().sort((a: any, b: any) => a.slot_order - b.slot_order);
const lessonSlots = orderedSlots.filter((s: any) => s.slot_type === 'lesson');

console.log(`LEVEL ${levelKey}: ${classesToProcess.length} classes, ${levelAssignments.length} assignments, ` +
  `${lessonSlots.length} lesson slots/day (target ${targets.totalLessons}, highest class load ${highestClassTotal})`);
console.log('  slots:', lessonSlots.map((s: any) => `${s.label} ${s.start_time}-${s.end_time}`).join(' | '));

const gridIssues = getExactGridAssignmentIssues({
  classes: classesToProcess,
  assignments: levelAssignments,
  totalLessons: lessonSlots.length,
  allowTwoPerDay: levelKey === 'lower-primary' || levelKey === 'upper-primary',
});
if (gridIssues.length) {
  console.log('PRE-FLIGHT ISSUES:', gridIssues.length);
  gridIssues.slice(0, 10).forEach((i) => console.log('  -', i.message));
  process.exit(0);
}

// Activity-blocked cells (in-lesson activities replace a lesson cell).
const blockedClassCells = new Set<string>();
for (const a of inLesson) {
  const slot = resolveActivityLessonSlot(baseSlots, a);
  if (!slot) continue;
  const idx = lessonSlots.findIndex((s: any) => s.start_time === slot.start_time);
  for (const cls of classesToProcess) blockedClassCells.add(`${cls.id}|${Number(a.day_of_week) - 1}|${idx}`);
}

const started = Date.now();
const result = solveTimetableCsp({
  schoolId: 'local',
  levelKey,
  classes: classesToProcess,
  assignments: levelAssignments,
  lessonSlots,
  allowIncompleteClasses: true,
  blockedClassCells,
  strokedSubjects: useStroked ? STROKED.filter((s: any) => s.level_group === levelKey).map((s: any) => ({ subjectId: String(s.subject_id) })) : [],
  onProgress: (m) => console.log('  [progress]', m),
});
console.log(`\nSOLVER: engine=${result.engine} entries=${result.entries.length} nodes=${result.searchNodes} ` +
  `${Date.now() - started}ms failed=${result.failedClasses.length} issues=${result.issues.length} warnings=${result.warnings.length}`);
if (result.issues.length) console.log('ISSUES:\n' + formatCspSolverIssues(result.issues));
if (result.warnings.length) console.log('WARNINGS:\n' + formatCspSolverWarnings(result.warnings));
if (result.failedClasses.length) result.failedClasses.forEach((f) => console.log('  FAILED', f.className, f.reason));
console.log('shortClasses:', result.shortClasses.map((s) => `${s.className} ${s.configuredTotal}/${s.expectedTotal}`).join(', ') || 'none');

const subjectNames = new Map<string, string>();
levelAssignments.forEach((a: any) => subjectNames.set(String(a.subject_id), String(a.subjects?.name || '')));
const requiredLessonCounts = new Map<string, number>();
levelAssignments.forEach((a: any) => requiredLessonCounts.set(`${String(a.class_id)}-${String(a.subject_id)}`, Number(a.lessons_per_week || 0)));

const issues = validateTimetableRules({
  entries: result.entries,
  slots: createdSlots,
  subjectNames,
  classes: classesToProcess,
  levelGroup: levelKey,
  requireComplete: true,
  allowBlankSlotsForClassIds: [
    ...result.shortClasses.filter((s) => s.configuredTotal < s.expectedTotal).map((s) => s.classId),
    ...result.failedClasses.map((f) => f.classId),
  ],
  requiredLessonCounts,
  requireReligiousPairing: true,
  requireCrossStreamReligiousAlignment: true,
});
console.log(`\nVALIDATOR: ${issues.length} issue(s)`);
issues.slice(0, 25).forEach((i) => console.log(`  - [${i.rule}] ${i.message}`));

// Diagnostics: inspect Creative Arts placements on lower primary.
if (issues.some((i) => i.rule === 'subject-double-window')) {
  const ca = result.entries.filter((e: any) => /creative/i.test(String(subjectNames.get(String(e.subject_id)))));
  const byClassDay = new Map<string, any[]>();
  ca.forEach((e: any) => {
    const k = `${e.class_id}|${e.day_of_week}`;
    byClassDay.set(k, [...(byClassDay.get(k) || []), e]);
  });
  console.log('\nCREATIVE ARTS cell detail:');
  for (const [k, list] of byClassDay) {
    if (list.length < 2) continue;
    const detail = list.map((e: any) => {
      const slot = createdSlots.find((s: any) => s.id === e.time_slot_id);
      return `${slot?.label}/${e.entry_type}`;
    });
    console.log(`  ${k}: ${detail.join(', ')}`);
  }
}

fs.writeFileSync(`/home/ubuntu/harness_out_${levelKey}.json`, JSON.stringify({
  levelKey, entries: result.entries, slots: createdSlots, issues,
  blocked: Array.from(blockedClassCells),
  classIds: classesToProcess.map((c: any) => String(c.id)),
  engine: result.engine, warnings: result.warnings,
}, null, 1));
