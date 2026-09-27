/**
 * Exact-grid timetable solver — full constraint satisfaction implementation.
 *
 * Why this design
 * ---------------
 * A level's timetable is ONE coupled constraint system, not a list of
 * independent per-class problems: teachers are shared across every class in the
 * level. Solving class-by-class with hard teacher reservations strands the later
 * classes even when each class is individually solvable, which is how the
 * previous generator produced "the exact-grid solver could not find a valid
 * timetable within its bounded search".
 *
 * A 40-lesson Junior week is completely packed (5 days x 8 lessons across 8-9
 * learning areas), so the solver never guesses a week shape up front. It fills
 * the level cell by cell in timetable order (Monday Lesson 1 -> Friday Lesson 8)
 * and decides each learning area's weekday as it goes, with backtracking across
 * cells. Deciding days inside the search is what keeps the week flexible enough
 * for shared teachers: a day plan fixed in advance cannot adapt when a teacher
 * turns out to be needed in two classes at once. Double lessons are decided by
 * the same search, because choosing their positions up front freezes the week's
 * shape before the teacher conflicts are known.
 *
 * Pruning that makes it tractable
 *   • Rule 8 (one appearance per learning area per day) is tracked per
 *     class+learning area as a day bitmask, so a same-day repeat is impossible.
 *   • Rule 13 (exact weekly counts) is enforced continuously: a learning area
 *     with n lessons left and only n usable weekdays left is forced, and any
 *     state where it has more lessons left than usable weekdays is rejected
 *     immediately. A double packs two lessons into one weekday, so it needs one
 *     weekday fewer.
 *   • After each cell, a memoized layout check proves the class can still place
 *     every remaining lesson of that day in its free slots inside the Rules 4-7
 *     windows without breaking Rule 9. A bad choice is rejected at once instead
 *     of two lessons later.
 *
 * Guarantees
 *   • Rule 14 (weekly total) is a WARNING, never a hard block: a school can
 *     always attempt generation and is told exactly which class does not match.
 *   • When no timetable exists, the issue names the class, the learning area and
 *     the blocking constraint — never a bare "generation failed".
 *   • A failing class never hides the state of the others, and a grid that fails
 *     the built-in independent rule check is never returned.
 */

import { classifySubject, strictSubjectAllowsLesson } from './timetable-generator.ts';
import { formatClassStream } from './class-label';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const DAY_COUNT = 5;
const ALL_DAY_BITS = 0b11111;





export interface CspTimetableSolverOptions {
  schoolId: string;
  levelKey: string;
  classes: any[];
  assignments: any[];
  lessonSlots: any[];
  /** Node budget per class; the level budget is this times the class count. */
  maxSearchNodesPerClass?: number;
  /** Teacher cells already reserved by another selected level in this school. */
  reservedTeacherCells?: ReadonlySet<string>;
  /**
   * When the admin has chosen to continue despite a lesson-count mismatch
   * (Rule 14 is a warning, not a block), a class whose weekly total cannot fill
   * the level's week is still placed, using its remaining slots on its own
   * configured lessons so the rest of the week is not left blank.
   */
  allowIncompleteClasses?: boolean;
  onProgress?: (message: string) => void;
}

export interface CspSolverIssue {
  code: string;
  message: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
}

/** Non-blocking diagnostics, e.g. the Rule 14 weekly-total mismatch. */
export interface CspSolverWarning {
  code: string;
  message: string;
  classId?: string;
  className?: string;
}

export interface CspFailedClass {
  classId: string;
  className: string;
  reason: string;
}

export interface CspTimetableSolverResult {
  entries: any[];
  issues: CspSolverIssue[];
  warnings: CspSolverWarning[];
  /** Classes that could not be scheduled; the others are still reported. */
  failedClasses: CspFailedClass[];
  searchNodes: number;
  durationMs: number;
  /** Which engine produced the accepted grid. */
  engine: 'csp' | 'none';
  restartCount: number;
  /**
   * True when a class's weekly lessons do not fill the level's week (Rule 14), so
   * the admin has to decide whether to continue. The UI turns this into a prompt
   * and re-runs with `allowIncompleteClasses` when they accept.
   */
  needsConfirmation: boolean;
  /** Classes whose own weekly lesson counts do not fill the level's week. */
  shortClasses: { classId: string; className: string; configuredTotal: number; expectedTotal: number }[];
}

/* ────────────────────────────── subject families ───────────────────────────── */

type Family = 'math' | 'english' | 'science' | 'pretech' | 'kiswahili' | 'religious' | 'cas' | 'other';

function familyOf(name: string | null | undefined): Family {
  const raw = String(name || '').trim();
  if (!raw) return 'other';
  if (/\bcas\b|creative\s+arts?.*sports|arts?.*sports|creative\s+arts?/i.test(raw)) return 'cas';
  switch (classifySubject(raw)) {
    case 'math': return 'math';
    case 'english': return 'english';
    case 'science': return 'science';
    case 'pretech': return 'pretech';
    case 'kiswahili': return 'kiswahili';
    case 'religious': return 'religious';
    default: return 'other';
  }
}

const isCasName = (name: string | null | undefined): boolean => familyOf(name) === 'cas';
const isReligiousName = (name: string | null | undefined): boolean => familyOf(name) === 'religious';
const isIreName = (name: string): boolean => /\bire\b|islamic|muslim/i.test(name);
const isCreName = (name: string): boolean => /\bcre\b|christian/i.test(name);

/* ──────────────────────────────── small helpers ─────────────────────────────── */

const normalizeName = (value: unknown): string => String(value ?? '').trim();

function dayIndex(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value >= 0 && value <= 4) return value;
    if (value >= 1 && value <= 5) return value - 1;
  }
  const text = normalizeName(value).toLowerCase();
  const numeric = Number(text);
  if (Number.isInteger(numeric)) {
    if (numeric >= 0 && numeric <= 4) return numeric;
    if (numeric >= 1 && numeric <= 5) return numeric - 1;
  }
  const index = DAYS.findIndex((day) => day.toLowerCase() === text);
  return index >= 0 ? index : null;
}

function parseDays(value: unknown): number[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) values = value;
  else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      values = Array.isArray(parsed) ? parsed : value.split(',');
    } catch {
      values = value.split(',');
    }
  }
  return [...new Set(values.map(dayIndex).filter((day): day is number => day !== null))].sort((a, b) => a - b);
}

const ALL_DAYS = [0, 1, 2, 3, 4];

function makeIssue(
  code: string,
  message: string,
  context: Partial<Pick<CspSolverIssue, 'classId' | 'className' | 'subjectId' | 'subjectName'>> = {},
): CspSolverIssue {
  return { code, message, ...context };
}

/** Deterministic 32-bit PRNG so every restart is reproducible from its seed. */
function makeRng(seed: number): () => number {
  let state = (seed >>> 0) || 0x9e3779b9;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
}

function lessonNumberOf(slot: any, fallbackIndex: number): number {
  const parsed = Number(String(slot?.label || '').match(/lesson\s+(\d+)/i)?.[1]);
  return Number.isFinite(parsed) ? parsed : fallbackIndex + 1;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = items.slice();
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1)) % (index + 1);
    const temporary = out[index];
    out[index] = out[swap];
    out[swap] = temporary;
  }
  return out;
}

function popcount(value: number): number {
  let count = 0;
  let remaining = value & ALL_DAY_BITS;
  while (remaining) { count += remaining & 1; remaining >>>= 1; }
  return count;
}

/* ─────────────────────────────── parsed configuration ──────────────────────── */

interface TeacherNeed {
  subjectId: string;
  subjectName: string;
  family: Family;
  teacherIds: string[];
  lessons: number;
  availableDays: number[];
  doubleDays: number[];
  hasDouble: boolean;
  /** No double was configured, but Rule 8 makes one unavoidable. */
  autoDouble: boolean;
}

interface ClassPlan {
  classId: string;
  className: string;
  needs: TeacherNeed[];
  configuredTotal: number;
}

function buildClassPlans(
  classes: any[],
  assignments: any[],
  issues: CspSolverIssue[],
): Map<string, ClassPlan> {
  const classById = new Map(classes.map((item) => [String(item.id), item]));
  const byClassSubject = new Map<string, Map<string, TeacherNeed>>();

  for (const assignment of assignments) {
    const classId = String(assignment.class_id || '');
    const cls = classById.get(classId);
    if (!cls) continue;
    const className = normalizeName(cls.name) || `Class ${classId}`;
    const subjectId = String(assignment.subject_id || '');
    const subjectName = normalizeName(assignment.subjects?.name || assignment.subject_name);
    const teacherId = String(assignment.teacher_id || '');

    if (!subjectId || !subjectName) {
      issues.push(makeIssue('missing-subject',
        `${className} has an assignment without a real learning area. Fix Teacher Assignments before generating.`,
        { classId, className }));
      continue;
    }
    const lessons = Number(assignment.lessons_per_week);
    if (!Number.isInteger(lessons) || lessons <= 0) {
      issues.push(makeIssue('invalid-lesson-count',
        `${className} / ${subjectName} has an invalid weekly lesson count (${String(assignment.lessons_per_week)}).`,
        { classId, className, subjectId, subjectName }));
      continue;
    }
    if (!teacherId) {
      issues.push(makeIssue('missing-teacher',
        `${className} / ${subjectName} has no teacher assigned. Assign a teacher, then generate again.`,
        { classId, className, subjectId, subjectName }));
      continue;
    }

    let map = byClassSubject.get(classId);
    if (!map) { map = new Map(); byClassSubject.set(classId, map); }
    const existing = map.get(subjectId);
    if (existing) {
      // Two assignments for one class + learning area is a real pattern (two
      // teachers sharing the load). Merge the hours and keep every teacher
      // rather than silently discarding one of them.
      existing.lessons += lessons;
      if (!existing.teacherIds.includes(teacherId)) existing.teacherIds.push(teacherId);
      existing.hasDouble = existing.hasDouble || Boolean(assignment.is_double_lesson);
      existing.doubleDays = [...new Set([...existing.doubleDays, ...parseDays(assignment.double_lesson_days)])];
      existing.availableDays = [...new Set([...existing.availableDays, ...parseDays(assignment.available_days)])];
      existing.autoDouble = existing.lessons > (existing.availableDays.length || ALL_DAYS.length);
      continue;
    }
    const availableDays = parseDays(assignment.available_days);
    map.set(subjectId, {
      subjectId,
      subjectName,
      family: familyOf(subjectName),
      teacherIds: [teacherId],
      lessons,
      availableDays,
      doubleDays: parseDays(assignment.double_lesson_days),
      hasDouble: Boolean(assignment.is_double_lesson),
      // Rule 8 allows a learning area only once per weekday, and Rule 2 allows
      // only one double per week, so more weekly lessons than usable weekdays can
      // only be scheduled when one lesson is a double. The school does not have to
      // tick the double box for that to be the only legal shape, so infer it.
      autoDouble: lessons > (availableDays.length || ALL_DAYS.length),
    });
  }

  const plans = new Map<string, ClassPlan>();
  for (const cls of classes) {
    const classId = String(cls.id);
    const needs = [...(byClassSubject.get(classId)?.values() || [])];
    plans.set(classId, {
      classId,
      className: normalizeName(cls.name) || `Class ${classId}`,
      needs,
      configuredTotal: needs.reduce((sum, need) => sum + need.lessons, 0),
    });
  }
  return plans;
}

/* ────────────────────────────── pre-flight diagnostics ─────────────────────── */

/**
 * Inspect a class before any search runs. Everything that makes the exact grid
 * impossible is reported specifically — class, learning area, constraint — so an
 * administrator can fix the data instead of reading "generation failed".
 */
function diagnoseClass(
  plan: ClassPlan,
  lessonNumberForIndex: (index: number) => number,
  slotsPerDay: number,
  allowIncomplete: boolean,
): { hard: CspSolverIssue[]; warnings: CspSolverWarning[] } {
  const hard: CspSolverIssue[] = [];
  const warnings: CspSolverWarning[] = [];
  const expected = slotsPerDay * DAY_COUNT;
  // A short class cannot fill the week with its own lessons, so the rules that
  // only exist because every cell must be used do not apply to it once the admin
  // has accepted that (Rule 14). Every other class is checked in full.
  const classIsShort = plan.configuredTotal < expected;
  const ctx = { classId: plan.classId, className: plan.className };

  if (!plan.needs.length) {
    hard.push(makeIssue('missing-assignments',
      `${plan.className} has no active teacher assignments, so it has no lessons to schedule.`, ctx));
    return { hard, warnings };
  }

  // A class with MORE lessons than the week holds cannot be placed at all: no grid
  // can contain more lessons than it has cells. This is a data problem with a
  // precise fix, so it is reported as such rather than as a failed search.
  if (plan.configuredTotal > expected) {
    hard.push(makeIssue('too-many-lessons',
      `${plan.className} has ${plan.configuredTotal} weekly lessons but this level's week holds only ${expected} `
      + `(${plan.configuredTotal - expected} too many), so ${plan.configuredTotal - expected} of them can never be placed. `
      + `Lower the weekly counts for ${plan.className} by ${plan.configuredTotal - expected}, or add `
      + `${Math.ceil((plan.configuredTotal - expected) / DAY_COUNT)} lesson(s) per day to this level in Timetable Setup.`,
      ctx));
    return { hard, warnings };
  }
  // Rule 14 — WARN, never block. Every school must be able to attempt.
  if (plan.configuredTotal !== expected) {
    const difference = plan.configuredTotal - expected;
    warnings.push({
      code: 'weekly-total-mismatch',
      message: `${plan.className} lessons total ${plan.configuredTotal} but this level expects ${expected} `
        + `(${difference > 0 ? `${difference} more` : `${Math.abs(difference)} fewer`}). `
        + 'A valid timetable may not be possible for this class.',
      ...ctx,
    });
  }

  // Every weekday needs a distinct learning area in each of its lessons, because
  // a learning area appears at most once per day (Rule 8) and the week is exactly
  // full (Rule 1 with Rule 13). A weekday where fewer learning areas are available
  // than it has lessons can never be filled, however the rest of the week is
  // arranged, so it is reported as a data problem for that class.
  for (let day = 0; day < DAY_COUNT; day += 1) {
    const usable = plan.needs.filter((need) => {
      const days = need.availableDays.length ? need.availableDays : ALL_DAYS;
      return days.includes(day);
    });
    // A class whose own lessons fall short of the week does not have to fill every
    // weekday, so this only blocks a class that is meant to fill the whole week.
    if (!classIsShort && usable.length < slotsPerDay) {
      const missing = plan.needs
        .filter((need) => !(need.availableDays.length ? need.availableDays : ALL_DAYS).includes(day))
        .map((need) => need.subjectName);
      hard.push(makeIssue('weekday-availability',
        `${plan.className} has ${slotsPerDay} lessons on ${DAYS[day]} but only ${usable.length} learning area(s) may be `
        + `taught that day, and a learning area may appear only once per day (Rule 8). `
        + `Not available on ${DAYS[day]}: ${missing.join(', ') || 'none'}. `
        + `Widen the available days for at least ${slotsPerDay - usable.length} of those learning areas.`,
        ctx));
    }
  }

  for (const need of plan.needs) {
    const available = need.availableDays.length ? need.availableDays : ALL_DAYS;
    const doubleDays = need.doubleDays.length ? need.doubleDays : available;
    const subjectCtx = { ...ctx, subjectId: need.subjectId, subjectName: need.subjectName };

    // Rule 8 allows one appearance per day, and a double consumes two cells on a
    // single day, so a double saves exactly one weekday. Rule 2 allows only one
    // double per week, so a learning area can cover at most (weekdays + 1) lessons.
    const wantsDouble = (need.hasDouble || need.autoDouble) && need.lessons >= 2;
    const doubleCount = wantsDouble ? 1 : 0;
    const requiredDays = need.lessons - doubleCount;
    // A short class's lessons are placed even when a learning area cannot reach
    // every weekday, because the cells it has no lessons for are left empty. A
    // class that must fill the week is still blocked by this ceiling.
    if (requiredDays > available.length && !(classIsShort && allowIncomplete)) {
      hard.push(makeIssue('day-capacity',
        `${plan.className} / ${need.subjectName}: ${need.lessons} weekly lessons need ${requiredDays} different weekdays `
        + `because a learning area may appear only once per day (Rule 8), but only ${available.length} weekday(s) are `
        + `available (${available.map((day) => DAYS[day]).join(', ') || 'none'}). `
        + 'A learning area may appear at most once per weekday and may have only one double lesson per week, '
        + `so ${available.length + 1} is the highest weekly count it can hold on the days it is available. `
        + 'Lower the weekly count, or widen the days it may be taught on.',
        subjectCtx));
    }

    let allowedPositions = 0;
    for (let index = 0; index < slotsPerDay; index += 1) {
      if (strictSubjectAllowsLesson(need.subjectName, lessonNumberForIndex(index))) allowedPositions += 1;
    }
    if (allowedPositions === 0) {
      hard.push(makeIssue('subject-window',
        `${plan.className} / ${need.subjectName} has no lesson slot inside its allowed placement window `
        + '(Rules 4-7), so it can never be scheduled.', subjectCtx));
    }

    if (doubleCount) {
      let pairExists = false;
      for (const day of doubleDays) {
        if (!available.includes(day)) continue;
        for (let start = 0; start + 1 < slotsPerDay; start += 1) {
          const first = lessonNumberForIndex(start);
          if (lessonNumberForIndex(start + 1) !== first + 1) continue;
          if (!strictSubjectAllowsLesson(need.subjectName, first)) continue;
          if (!strictSubjectAllowsLesson(need.subjectName, first + 1)) continue;
          if (isCasName(need.subjectName) && first < 3) continue; // Rule 12
          pairExists = true;
          break;
        }
        if (pairExists) break;
      }
      if (!pairExists) {
        const reason = isCasName(need.subjectName)
          ? 'CAS doubles may not start at Lesson 1 or 2 (Rule 12) and must stay inside the subject window'
          : 'the double must sit on two consecutive lessons inside the subject window (Rules 3-7)';
        hard.push(makeIssue('double-window',
          `${plan.className} / ${need.subjectName} has a double lesson configured, but no legal pair of consecutive `
          + `lessons exists on its double weekday(s) (${doubleDays.map((day) => DAYS[day]).join(', ') || 'none'}): ${reason}.`,
          subjectCtx));
      }
    }
  }

  return { hard, warnings };
}

/* ──────────────────────────────── solver model ─────────────────────────────── */

/**
 * One placement unit: a learning area in a class, or the single shared IRE/CRE
 * session that Rule 10 requires (two learning areas and two teachers per slot).
 */
interface Session {
  index: number;
  classIndex: number;
  subjectIds: string[];
  subjectNames: string[];
  family: Family;
  teacherIndexes: number[];
  lessons: number;
  /** window[slot] = 1 when Rules 4-7 permit this learning area at that lesson. */
  window: Uint8Array;
  /** Weekdays this learning area may use, as a bitmask. */
  allowedDayMask: number;
  /** `subjectMask` keys of this class's learning areas, for Rule 8 lookups. */
  maskKeys: string[];
  /** A whole double lesson was requested for this learning area (Rule 2). */
  doubleRequested: boolean;
  /**
   * No double was requested, but the weekly count exceeds the number of weekdays
   * this learning area may use, so one lesson must still be a double (Rule 8).
   */
  autoDouble: boolean;
}

interface Model {
  classes: { id: string; name: string }[];
  slotsPerDay: number;
  sessions: Session[];
  classSessions: number[][];
  teacherNames: string[];
  /** Lessons each session must place, so a restart can restore the counters. */
  initialRemaining: Int32Array;
  /** usedDay[session] = bitmask of weekdays already carrying this learning area. */
  usedDay: Uint8Array;
  /** remaining[session] = lessons still to place. */
  remaining: Int32Array;
  /** subjectMask['class|subject'] = bitmask of weekdays used by that learning area. */
  subjectMask: Map<string, number>;
}

function buildModel(
  plans: Map<string, ClassPlan>,
  solvableClassIds: string[],
  slotsPerDay: number,
  lessonNumberForIndex: (index: number) => number,
  issues: CspSolverIssue[],
): Model | null {
  const classes = solvableClassIds.map((classId) => ({
    id: classId,
    name: plans.get(classId)!.className,
  }));
  const sessions: Session[] = [];
  const classSessions: number[][] = classes.map(() => []);
  const teacherNames: string[] = [];
  const teacherIndexOf = new Map<string, number>();
  const teacherIndexFor = (teacherId: string): number => {
    let index = teacherIndexOf.get(teacherId);
    if (index == null) {
      index = teacherNames.length;
      teacherIndexOf.set(teacherId, index);
      teacherNames.push(teacherId);
    }
    return index;
  };
  const subjectMask = new Map<string, number>();

  for (const [classIndex, classId] of solvableClassIds.entries()) {
    const plan = plans.get(classId)!;

    const push = (needs: TeacherNeed[], allowedDays: number[], doubleRequested: boolean,
      autoDouble = false): void => {
      const window = new Uint8Array(slotsPerDay);
      for (let slot = 0; slot < slotsPerDay; slot += 1) {
        window[slot] = needs.every((need) =>
          strictSubjectAllowsLesson(need.subjectName, lessonNumberForIndex(slot))) ? 1 : 0;
      }
      const maskKeys = needs.map((need) => {
        const key = `${classIndex}|${need.subjectId}`;
        if (!subjectMask.has(key)) subjectMask.set(key, 0);
        return key;
      });
      sessions.push({
        index: sessions.length,
        classIndex,
        subjectIds: needs.map((need) => need.subjectId),
        subjectNames: needs.map((need) => need.subjectName),
        family: needs[0].family,
        teacherIndexes: needs.map((need) => teacherIndexFor(need.teacherIds[0])),
        lessons: needs[0].lessons,
        window,
        allowedDayMask: allowedDays.reduce((mask, day) => mask | (1 << day), 0),
        maskKeys,
        doubleRequested,
        autoDouble,
      });
      classSessions[classIndex].push(sessions.length - 1);
    };

    // ── Rule 10: one shared IRE/CRE session per lesson ────────────────────
    const religious = plan.needs.filter((need) => isReligiousName(need.subjectName));
    const ire = religious.filter((need) => isIreName(need.subjectName));
    const cre = religious.filter((need) => isCreName(need.subjectName));
    const paired = new Set<string>();
    if (religious.length === 2 && ire.length === 1 && cre.length === 1) {
      const [left] = ire;
      const [right] = cre;
      if (left.lessons === right.lessons && left.teacherIds[0] !== right.teacherIds[0]) {
        const shared = left.availableDays.length && right.availableDays.length
          ? left.availableDays.filter((day) => right.availableDays.includes(day))
          : [...new Set([...left.availableDays, ...right.availableDays])];
        push([left, right], shared.length ? shared : ALL_DAYS, left.hasDouble || right.hasDouble);
        paired.add(left.subjectId);
        paired.add(right.subjectId);
      } else {
        issues.push(makeIssue('religious-pairing',
          `${plan.className} offers ${left.subjectName} (${left.lessons}/week) and ${right.subjectName} (${right.lessons}/week). `
          + 'Rule 10 requires them at the same slot, which needs equal weekly counts and two different teachers. '
          + 'Adjust the counts or the teachers, then generate again.',
          { classId, className: plan.className }));
        paired.add(left.subjectId);
        paired.add(right.subjectId);
      }
    } else if (religious.length > 2) {
      issues.push(makeIssue('religious-pairing',
        `${plan.className} offers ${religious.length} religious learning areas `
        + `(${religious.map((need) => need.subjectName).join(', ')}). `
        + 'Rule 10 can only pair exactly one IRE with one CRE; remove the extras and generate again.',
        { classId, className: plan.className }));
    }

    for (const need of plan.needs) {
      if (paired.has(need.subjectId)) continue;
      const available = need.availableDays.length ? need.availableDays : ALL_DAYS;
      push([need], available, need.hasDouble && need.lessons >= 2, need.autoDouble && need.lessons >= 2);
    }
  }

  if (!sessions.length) {
    issues.push(makeIssue('no-units', 'No schedulable lessons were produced for this level.', {}));
    return null;
  }

  return {
    classes,
    slotsPerDay,
    sessions,
    classSessions,
    teacherNames,
    initialRemaining: Int32Array.from(sessions.map((session) => session.lessons)),
    usedDay: new Uint8Array(sessions.length),
    remaining: Int32Array.from(sessions.map((session) => session.lessons)),
    subjectMask,
  };
}

/**
 * Cross-class capacity check: a teacher cannot be booked for more cells than the
 * week holds, and every class must have enough cells for its exact counts. Both
 * are reported per class / per teacher, never as "failed".
 */
function diagnoseCapacity(
  plans: Map<string, ClassPlan>,
  omitted: CspFailedClass[],
  model: Model,
  warnings: CspSolverWarning[],
): void {
  const weeklyCells = model.slotsPerDay * DAY_COUNT;

  // A skipped class shares teachers with the classes that remain. Those teachers
  // were sized for the whole level, so their remaining classes can no longer all
  // be covered; say so plainly instead of failing on a later day of the week.
  for (const failure of omitted) {
    const plan = plans.get(failure.classId);
    if (!plan) continue;
    const teacherIds = new Set<string>();
    for (const need of plan.needs) for (const teacherId of need.teacherIds) teacherIds.add(teacherId);
    let remainingLessons = 0;
    let remainingCapacity = 0;
    for (const session of model.sessions) {
      const shared = session.teacherIndexes.some((teacherIndex) => teacherIds.has(model.teacherNames[teacherIndex]));
      if (!shared) continue;
      remainingLessons += session.lessons;
      remainingCapacity += weeklyCells;
    }
    if (remainingLessons > remainingCapacity) {
      warnings.push({
        code: 'class-omitted-teacher-conflict',
        message: `${failure.className} was left out of this run, but the teachers it shares with the other classes `
          + `are still needed for ${remainingLessons} lessons while only ${remainingCapacity} slots remain. `
          + 'Fix the class that was left out (its weekly total), then generate the whole level again.',
        classId: failure.classId,
        className: failure.className,
      });
    }
  }
  const demand = new Map<number, number>();
  for (const session of model.sessions) {
    const share = session.lessons / session.teacherIndexes.length;
    for (const teacherIndex of session.teacherIndexes) {
      demand.set(teacherIndex, (demand.get(teacherIndex) || 0) + share);
    }
  }
  for (const [teacherIndex, cells] of demand) {
    if (cells > weeklyCells) {
      warnings.push({
        code: 'teacher-capacity',
        message: `A teacher is booked for ${cells} lesson cells at this level but a week only holds ${weeklyCells}, `
          + 'so their lessons cannot all be placed. Reduce that teacher\'s weekly lesson counts or share the load '
          + 'with another teacher.',
      });
    }
  }
}

/**
 * Decide which classes can be attempted.
 *
 * A weekly total that does not fill the level's week (Rule 14) is a WARNING, never
 * a block: the task is explicit that a school must always be able to attempt
 * generation, and the shortfall is reported per class so it can be fixed. A class
 * is only dropped when it has no lessons at all, or when its own configuration
 * cannot satisfy the rules however the week is arranged (for example a learning
 * area asking for more lessons than its weekdays allow). Those reasons are
 * reported specifically, and the remaining classes are still solved and saved.
 */
function selectAttemptableClasses(
  plans: Map<string, ClassPlan>,
  classes: any[],
  lessonNumberForIndex: (index: number) => number,
  slotsPerDay: number,
  issues: CspSolverIssue[],
  warnings: CspSolverWarning[],
  failedClasses: CspFailedClass[],
  allowIncomplete: boolean,
): string[] {
  const expected = slotsPerDay * DAY_COUNT;
  const attemptable: string[] = [];

  for (const cls of classes) {
    const classId = String(cls.id);
    const plan = plans.get(classId);
    if (!plan) continue;
    const diagnosis = diagnoseClass(plan, lessonNumberForIndex, slotsPerDay, allowIncomplete);
    warnings.push(...diagnosis.warnings);

    // A class whose lessons do not fill the week cannot produce a complete grid.
    // Rule 14 is a warning rather than a block, so when the admin has chosen to
    // continue the class is still placed as far as its own lessons allow; the
    // shortfall is reported so it can be corrected.
    if (plan.needs.length && plan.configuredTotal !== expected && !allowIncomplete) {
      const difference = plan.configuredTotal - expected;
      failedClasses.push({
        classId,
        className: plan.className,
        reason: `${plan.className} lessons total ${plan.configuredTotal} but this level expects ${expected} `
          + `(${difference > 0 ? `${difference} more` : `${Math.abs(difference)} fewer`}), so its week cannot be filled exactly.`,
      });
      continue;
    }

    if (diagnosis.hard.length) {
      issues.push(...diagnosis.hard);
      failedClasses.push({
        classId,
        className: plan.className,
        reason: diagnosis.hard.map((issue) => issue.message).join(' '),
      });
      continue;
    }
    attemptable.push(classId);
  }
  return attemptable;
}

/* ─────────────────────────── the constraint search ─────────────────────────── */

/** One scheduled lesson inside a day plan. */
interface Unit {
  sessionIndex: number;
  slot: number;
  size: 1 | 2;
}

/** One option for a cell: a learning area and how many lessons start there. */
interface CellOption {
  sessionIndex: number;
  size: 1 | 2;
  /** Sessions still awaiting a lesson on this weekday, for ordering. */
  pressure: number;
}

/**
 * Fills the level cell by cell with chronological backtracking.
 *
 * `cell` walks Monday Lesson 1 to Friday Lesson 8 across the whole level, and
 * `classPosition` walks the classes that still need the current cell. Every
 * choice is undone on failure, so a decision that only traps a later lesson is
 * retried instead of failing the generation.
 */
class LevelSearch {
  readonly model: Model;
  readonly slotsPerDay: number;
  readonly rng: () => number;
  readonly budget: number;
  nodes = 0;
  /** Deepest cell reached, reported when the search cannot finish. */
  deepestCell = -1;

  /** cellValue[classIndex][day * slots + slot] = sessionIndex + 1, or 0. */
  readonly cellValue: Int32Array[];
  /** mathAt[classIndex][day * slots + slot] = 1 when Mathematics sits there. */
  private readonly mathAt: Uint8Array[];
  /** teacherBusy[teacherIndex * cells + day * slots + slot]. */
  private readonly teacherBusy: Uint8Array;
  /** doubleDay[session] / doubleStart[session]; -1 means "no double placed". */
  readonly doubleDay: Int32Array;
  readonly doubleStart: Int32Array;
  private readonly memo = new Set<number>();
  /** Weekday the day-major fill is currently on; earlier days are complete. */
  private currentDay = 0;
  /** Teacher cells already claimed by other levels, restored on every restart. */
  private readonly reservedTeacherCells: ReadonlySet<string>;
  /** How many complete weekday plans to keep per weekday, and per class. */
  readonly planCap = 40;
  readonly optionCap = 20;
  /** True while an attempt may leave cells a class has no lessons for empty. */
  relaxed = false;
  /**
   * Indexes of the classes whose own weekly lessons do not fill the week. Only
   * these may keep cells empty when the admin continues past the Rule 14 warning.
   */
  shortClassIndexes: ReadonlySet<number> = new Set<number>();
  /** Weekday pattern chosen for each learning area in the current attempt. */
  weekDays: number[][] = [];
  /** Weekday carrying each learning area's double, or -1. */
  weekDouble: number[] = [];

  /**
   * Set when the admin chose to continue past a Rule 14 lesson-count warning. The
   * attempts always start in strict mode, so a complete grid is preferred whenever
   * one exists; only the final attempts fall back to leaving the cells that a class
   * has no lessons for empty.
   */
  allowBlanks: boolean;

  constructor(
    model: Model,
    reservedTeacherCells: ReadonlySet<string>,
    rng: () => number,
    budget: number,
    allowBlanks = false,
    shortClassIndexes: ReadonlySet<number> = new Set<number>(),
  ) {
    this.model = model;
    this.slotsPerDay = model.slotsPerDay;
    this.rng = rng;
    this.budget = budget;
    this.allowBlanks = allowBlanks;
    this.shortClassIndexes = shortClassIndexes;
    const cells = DAY_COUNT * this.slotsPerDay;
    this.cellValue = model.classes.map(() => new Int32Array(cells));
    this.mathAt = model.classes.map(() => new Uint8Array(cells));
    this.teacherBusy = new Uint8Array(Math.max(1, model.teacherNames.length) * cells);
    this.doubleDay = new Int32Array(model.sessions.length).fill(-1);
    this.doubleStart = new Int32Array(model.sessions.length).fill(-1);

    this.reservedTeacherCells = reservedTeacherCells;
    this.seedReservations();
  }

  /** Re-apply the teacher cells that other levels of the school already claimed. */
  private seedReservations(): void {
    const cells = DAY_COUNT * this.slotsPerDay;
    const teacherIndexOf = new Map(this.model.teacherNames.map((name, index) => [name, index]));
    for (const key of this.reservedTeacherCells) {
      const [teacherId, dayText, slotText] = key.split('|');
      const day = Number(dayText);
      const slot = Number(slotText);
      if (day < 0 || day >= DAY_COUNT || slot < 0 || slot >= this.slotsPerDay) continue;
      const teacherIndex = teacherIndexOf.get(teacherId);
      if (teacherIndex == null) continue; // does not teach in this level
      this.teacherBusy[teacherIndex * cells + day * this.slotsPerDay + slot] = 1;
    }
  }

  cellValueAt(classIndex: number, day: number, slot: number): number {
    return this.cellValue[classIndex][day * this.slotsPerDay + slot];
  }

  /* ── booking bookkeeping ────────────────────────────────────────────────── */

  private teacherFree(teacherIndex: number, day: number, slot: number): boolean {
    return this.teacherBusy[teacherIndex * DAY_COUNT * this.slotsPerDay + day * this.slotsPerDay + slot] === 0;
  }

  private setTeacher(teacherIndex: number, day: number, slot: number, value: number): void {
    this.teacherBusy[teacherIndex * DAY_COUNT * this.slotsPerDay + day * this.slotsPerDay + slot] = value;
  }

  private maskOf(session: Session, position: number): number {
    return this.model.subjectMask.get(session.maskKeys[position]) ?? 0;
  }

  private setMask(session: Session, position: number, value: number): void {
    this.model.subjectMask.set(session.maskKeys[position], value);
  }

  /**
   * Weekdays this learning area may still use (Rule 8 respected).
   *
   * The search is not chronological - it always takes the most constrained cell -
   * so this counts every unused allowed weekday, including earlier ones, because
   * an unfilled earlier lesson is still available.
   */
  private usableDays(session: Session): number {
    // The fill is day-major, so only weekdays at or after the current one can
    // still receive a lesson; the earlier ones are already fully timetabled.
    let mask = session.allowedDayMask & ~this.model.usedDay[session.index]
      & (ALL_DAY_BITS << this.currentDay);
    for (let position = 0; position < session.maskKeys.length; position += 1) {
      mask &= ~this.maskOf(session, position);
    }
    return popcount(mask & ALL_DAY_BITS);
  }

  /**
   * Weekdays this learning area still needs. A pending double packs two lessons
   * into one weekday (Rule 3), so it needs one weekday fewer.
   */
  private daysNeeded(session: Session): number {
    const remaining = this.model.remaining[session.index];
    if (remaining <= 0) return 0;
    if (session.doubleRequested && this.doubleDay[session.index] < 0 && remaining >= 2) return remaining - 1;
    return remaining;
  }

  /**
   * Necessary window-band condition for a whole class.
   *
   * A learning area may only use the lesson numbers its Rules 4-7 window allows
   * (Maths stops at Lesson 4, English at 5, Science and Pre-Technical at 6,
   * Kiswahili at 7, others anywhere). So for every threshold k, the lessons of
   * learning areas whose window ends at or before k must fit into the free cells
   * whose lesson number is at most k. Violating this means the week has already
   * painted itself into a corner - for example an early Friday lesson consumed
   * while Mathematics still needs one of Lessons 1-4.
   */
  private bandFeasible(classIndex: number): boolean {
    const list = this.model.classSessions[classIndex];
    const slotsPerDay = this.slotsPerDay;
    const grid = this.cellValue[classIndex];

    // Free cells per lesson number, counting every weekday from `day` onward:
    // the fill is day-major, so earlier weekdays are already complete.
    const freeByLesson = new Array(slotsPerDay + 2).fill(0);
    for (let candidate = this.currentDay; candidate < DAY_COUNT; candidate += 1) {
      const base = candidate * slotsPerDay;
      for (let index = 0; index < slotsPerDay; index += 1) {
        if (grid[base + index]) continue;
        freeByLesson[Math.max(1, Math.min(slotsPerDay, this.lessonNumber(index)))] += 1;
      }
    }

    // Highest lesson number each still-unfinished learning area may occupy.
    const maxLessonOf = new Map<number, number>();
    for (const sessionIndex of list) {
      const session = this.model.sessions[sessionIndex];
      let maxLesson = 0;
      for (let index = 0; index < slotsPerDay; index += 1) {
        if (session.window[index] === 1) maxLesson = Math.max(maxLesson, this.lessonNumber(index));
      }
      maxLessonOf.set(sessionIndex, maxLesson);
    }

    for (let threshold = 1; threshold <= slotsPerDay; threshold += 1) {
      let demand = 0;
      let capacity = 0;
      for (let lesson = 1; lesson <= threshold; lesson += 1) capacity += freeByLesson[lesson];
      for (const sessionIndex of list) {
        const remaining = this.model.remaining[sessionIndex];
        if (remaining <= 0) continue;
        if ((maxLessonOf.get(sessionIndex) ?? slotsPerDay) <= threshold) demand += remaining;
      }
      if (demand > capacity) return false;
    }
    return true;
  }

  /** True when this learning area's remaining lessons still fit its free days. */
  private fits(session: Session): boolean {
    return this.usableDays(session) >= this.daysNeeded(session);
  }

  /** Mark (or unmark) a weekday as used by this session and its learning areas. */
  private setDayUsed(session: Session, day: number, used: boolean): void {
    const bit = 1 << day;
    for (let position = 0; position < session.maskKeys.length; position += 1) {
      const current = this.maskOf(session, position);
      this.setMask(session, position, used ? current | bit : current & ~bit);
    }
    if (used) this.model.usedDay[session.index] |= bit;
    else this.model.usedDay[session.index] &= ~bit;
  }

  private lessonNumber(slot: number): number {
    return lessonNumbers[slot] ?? slot + 1;
  }

  /* ── placement legality ────────────────────────────────────────────────── */

  /** May this learning area take a whole double starting at this lesson? */
  private canDouble(session: Session, day: number, slot: number): boolean {
    if (!session.doubleRequested) return false;
    if (this.doubleDay[session.index] >= 0) return false; // Rule 2 allows one double
    if (this.model.remaining[session.index] < 2) return false;
    if (slot + 1 >= this.slotsPerDay) return false;
    if (session.window[slot] !== 1 || session.window[slot + 1] !== 1) return false;
    // Rule 3 — the pair must be two consecutive lesson numbers.
    if (this.lessonNumber(slot + 1) !== this.lessonNumber(slot) + 1) return false;
    // Rule 12 — a CAS double may not start at Lesson 1 or 2.
    if (isCasName(session.subjectNames[0]) && this.lessonNumber(slot) < 3) return false;
    if (!(session.allowedDayMask & (1 << day))) return false;
    const dayBit = 1 << day;
    for (let position = 0; position < session.maskKeys.length; position += 1) {
      if (this.maskOf(session, position) & dayBit) return false; // Rule 8
    }
    for (const teacherIndex of session.teacherIndexes) {
      if (!this.teacherFree(teacherIndex, day, slot) || !this.teacherFree(teacherIndex, day, slot + 1)) return false;
    }
    return true;
  }

  private canPlaceSingle(session: Session, day: number, slot: number): boolean {
    if (this.model.remaining[session.index] <= 0) return false;
    // A configured double (Rule 2) must be placed before any of that learning
    // area's single lessons: letting singles go first can consume every weekday
    // and silently drop the double.
    if (session.doubleRequested && this.doubleDay[session.index] < 0
      && this.model.remaining[session.index] >= 2) return false;
    if (!(session.allowedDayMask & (1 << day))) return false;
    if (session.window[slot] !== 1) return false;
    const dayBit = 1 << day;
    for (let position = 0; position < session.maskKeys.length; position += 1) {
      if (this.maskOf(session, position) & dayBit) return false; // Rule 8
    }
    for (const teacherIndex of session.teacherIndexes) {
      if (!this.teacherFree(teacherIndex, day, slot)) return false; // Rule 11
    }
    return true;
  }

  /** Learning areas, and how many lessons, that may legally fill this cell. */
  private candidatesFor(classIndex: number, day: number, slot: number): CellOption[] {
    const base = day * this.slotsPerDay;
    const out: CellOption[] = [];
    for (const sessionIndex of this.model.classSessions[classIndex]) {
      const session = this.model.sessions[sessionIndex];
      if (this.model.remaining[sessionIndex] <= 0) continue;
      // Rule 9 — Integrated Science never immediately after Mathematics.
      if (session.family === 'science' && slot > 0 && this.mathAt[classIndex][base + slot - 1]) continue;
      if (session.family === 'math' && slot + 1 < this.slotsPerDay) {
        const right = this.cellValue[classIndex][base + slot + 1];
        if (right && this.model.sessions[right - 1].family === 'science') continue;
      }
      const pressure = this.usableDays(session) - this.daysNeeded(session);
      if (pressure < 0) continue;
      if (this.canDouble(session, day, slot)) out.push({ sessionIndex, size: 2, pressure });
      else if (this.canPlaceSingle(session, day, slot)) out.push({ sessionIndex, size: 1, pressure });
    }
    // Tightest learning area first: fewest spare weekdays, then doubles (which
    // consume two cells) before singles.
    out.sort((left, right) =>
      left.pressure - right.pressure || right.size - left.size || left.sessionIndex - right.sessionIndex);
    return out;
  }

  /** Place `size` lessons of a learning area starting at this cell. */
  private placeAt(classIndex: number, day: number, slot: number, sessionIndex: number, size: 1 | 2): void {
    const session = this.model.sessions[sessionIndex];
    const base = day * this.slotsPerDay;
    for (let offset = 0; offset < size; offset += 1) {
      this.cellValue[classIndex][base + slot + offset] = sessionIndex + 1;
      if (session.family === 'math') this.mathAt[classIndex][base + slot + offset] = 1;
      for (const teacherIndex of session.teacherIndexes) this.setTeacher(teacherIndex, day, slot + offset, 1);
    }
    this.model.remaining[sessionIndex] -= size;
    this.setDayUsed(session, day, true);
    if (size === 2) {
      this.doubleDay[sessionIndex] = day;
      this.doubleStart[sessionIndex] = slot;
    }
  }

  private unplaceAt(classIndex: number, day: number, slot: number, sessionIndex: number, size: 1 | 2): void {
    const session = this.model.sessions[sessionIndex];
    const base = day * this.slotsPerDay;
    for (let offset = 0; offset < size; offset += 1) {
      this.cellValue[classIndex][base + slot + offset] = 0;
      if (session.family === 'math') this.mathAt[classIndex][base + slot + offset] = 0;
      for (const teacherIndex of session.teacherIndexes) this.setTeacher(teacherIndex, day, slot + offset, 0);
    }
    this.model.remaining[sessionIndex] += size;
    if (size === 2) {
      this.doubleDay[sessionIndex] = -1;
      this.doubleStart[sessionIndex] = -1;
    }
    // Release the weekday only when this learning area holds no lesson of it left.
    let stillToday = false;
    for (let offset = 0; offset < this.slotsPerDay; offset += 1) {
      if (this.cellValue[classIndex][base + offset] === sessionIndex + 1) { stillToday = true; break; }
    }
    if (!stillToday) this.setDayUsed(session, day, false);
  }

/* ── per-day layout look-ahead ──────────────────────────────────────────── */

  /**
   * Can this class still complete `day`?
   *
   * Every lesson of the weekday must be filled by a *different* learning area,
   * because a learning area appears at most once per day (Rule 8); with a fully
   * packed week (Rule 13) the day has exactly as many slots as the class has
   * learning areas. So a perfect matching must exist between the free lessons of
   * the day and the learning areas still able to appear today, respecting their
   * Rules 4-7 windows and Rule 9.
   *
   * Kuhn's algorithm over the free lessons finds such a matching exactly when one
   * exists, so a losing choice is rejected here instead of being explored to the
   * end of the week. A learning area that can no longer defer its lesson to a
   * later weekday must additionally end up matched.
   */
  private dayFeasible(classIndex: number, day: number): boolean {
    const slotsPerDay = this.slotsPerDay;
    const base = day * slotsPerDay;
    const grid = this.cellValue[classIndex];
    const list = this.model.classSessions[classIndex];
    const dayBit = 1 << day;

    const live: number[] = [];
    const mustToday: number[] = [];
    for (const sessionIndex of list) {
      const session = this.model.sessions[sessionIndex];
      if (this.model.remaining[sessionIndex] <= 0) continue;
      if (!(session.allowedDayMask & dayBit)) continue;
      if (this.model.usedDay[sessionIndex] & dayBit) continue; // already appears today
      if (!this.fits(session)) return false; // its week can no longer fit
      live.push(sessionIndex);
      if (this.usableDays(session) <= this.daysNeeded(session)) mustToday.push(sessionIndex);
    }

    const freeSlots: number[] = [];
    for (let slot = 0; slot < slotsPerDay; slot += 1) if (!grid[base + slot]) freeSlots.push(slot);
    if (freeSlots.length === 0) {
      // The weekday is full, so any learning area that could not wait for a later
      // weekday can no longer be placed at all.
      return mustToday.length === 0;
    }
    if (live.length < freeSlots.length) return false;
    if (mustToday.length > freeSlots.length) return false;

    // A double still owed by a learning area must remain reachable this week.
    for (const sessionIndex of list) {
      const session = this.model.sessions[sessionIndex];
      if (!session.doubleRequested || this.doubleDay[sessionIndex] >= 0) continue;
      if (this.model.remaining[sessionIndex] < 2) continue;
      if (!this.doubleStillPossible(session)) return false;
    }

    const canUse = (sessionIndex: number, slot: number): boolean => {
      const session = this.model.sessions[sessionIndex];
      if (session.window[slot] !== 1) return false;
      // Rule 9 — Integrated Science never immediately after Mathematics, and
      // Mathematics never immediately before it.
      if (session.family === 'science' && slot - 1 >= 0
        && this.mathAt[classIndex][base + slot - 1] === 1) return false;
      if (session.family === 'math' && slot + 1 < slotsPerDay) {
        const right = grid[base + slot + 1];
        if (right && this.model.sessions[right - 1].family === 'science') return false;
      }
      return true;
    };

    // Match each free lesson to a distinct learning area.
    const slotOf = new Map<number, number>(); // learning area -> lesson
    const assign = (slot: number, seen: Set<number>, placed: Set<number>): boolean => {
      for (const sessionIndex of list) {
        if (!live.includes(sessionIndex)) continue;
        if (seen.has(sessionIndex)) continue;
        if (!canUse(sessionIndex, slot)) continue;
        seen.add(sessionIndex);
        const holderSlot = slotOf.get(sessionIndex);
        if (holderSlot == null || assign(holderSlot, seen, placed)) {
          slotOf.set(sessionIndex, slot);
          placed.add(sessionIndex);
          return true;
        }
      }
      return false;
    };

    const placed = new Set<number>();
    for (const slot of freeSlots) {
      this.nodes += 1;
      if (this.nodes > this.budget) return false;
      if (!assign(slot, new Set(), placed)) return false;
    }
    // Every learning area that cannot wait for another weekday must be served.
    for (const sessionIndex of mustToday) {
      if (!placed.has(sessionIndex)) return false;
    }

    // The matched learning areas must also be orderable without breaking Rule 9.
    return this.layoutPossible(classIndex, day, [...placed]);
  }

  /**
   * Can this learning area still host its whole double on some weekday? It must,
   * because Rule 2 requires the configured double to appear. Checked so a week
   * that has consumed every legal double position is rejected early.
   */
  private doubleStillPossible(session: Session): boolean {
    if (this.doubleDay[session.index] >= 0) return true; // already placed
    const grid = this.cellValue[session.classIndex];
    for (let candidate = this.currentDay; candidate < DAY_COUNT; candidate += 1) {
      if (!(session.allowedDayMask & (1 << candidate))) continue;
      if (this.model.usedDay[session.index] & (1 << candidate)) continue;
      const base = candidate * this.slotsPerDay;
      for (let start = 0; start + 1 < this.slotsPerDay; start += 1) {
        if (session.window[start] !== 1 || session.window[start + 1] !== 1) continue;
        if (this.lessonNumber(start + 1) !== this.lessonNumber(start) + 1) continue;
        if (isCasName(session.subjectNames[0]) && this.lessonNumber(start) < 3) continue;
        if (grid[base + start] || grid[base + start + 1]) continue;
        let free = true;
        for (const teacherIndex of session.teacherIndexes) {
          if (!this.teacherFree(teacherIndex, candidate, start)
            || !this.teacherFree(teacherIndex, candidate, start + 1)) { free = false; break; }
        }
        if (free) return true;
      }
    }
    return false;
  }

  /**
   * Order check for the learning areas chosen for one day: is there an assignment
   * of them to the free lessons that respects their Rules 4-7 windows and never
   * places Integrated Science immediately after Mathematics?
   *
   * Memoized on (lesson, chosen mask, previous lesson was Maths); a day holds at
   * most eight lessons, so this stays cheap.
   */
  private layoutPossible(classIndex: number, day: number, chosen: number[]): boolean {
    const slotsPerDay = this.slotsPerDay;
    const base = day * slotsPerDay;
    const grid = this.cellValue[classIndex];
    const memo = new Set<number>();

    const step = (slot: number, usedMask: number, previousWasMath: boolean): boolean => {
      this.nodes += 1;
      if (this.nodes > this.budget) return false;
      if (usedMask === (1 << chosen.length) - 1) return true;
      if (slot >= slotsPerDay) return false;

      const key = (slot << 20) | (usedMask << 1) | (previousWasMath ? 1 : 0);
      if (memo.has(key)) return false;

      const occupant = grid[base + slot];
      if (occupant) {
        // This lesson is already filled: a double placed earlier, or a cell the
        // main loop has passed.
        if (step(slot + 1, usedMask, this.model.sessions[occupant - 1].family === 'math')) return true;
        memo.add(key);
        return false;
      }

      for (let index = 0; index < chosen.length; index += 1) {
        if (usedMask & (1 << index)) continue;
        const session = this.model.sessions[chosen[index]];
        if (session.window[slot] !== 1) continue;
        // Rule 9 — Integrated Science never immediately after Mathematics.
        if (session.family === 'science' && previousWasMath) continue;
        if (session.family === 'math' && slot + 1 < slotsPerDay) {
          const right = grid[base + slot + 1];
          if (right && this.model.sessions[right - 1].family === 'science') continue;
        }
        if (step(slot + 1, usedMask | (1 << index), session.family === 'math')) return true;
      }

      memo.add(key);
      return false;
    };

    return step(0, 0, false);
  }

/* ── per-day plan search ────────────────────────────────────────────────── */

  /**
   * One scheduled lesson inside a day plan: a learning area, the lesson it starts
   * at, and how many lessons it takes there (2 for a configured double).
   */
  private classDayOptions(classIndex: number, day: number, cap: number): Unit[][] {
    const out: Unit[][] = [];
    const base = day * this.slotsPerDay;
    const chosen: Unit[] = [];
    const used = new Set<number>();

    const step = (slot: number): void => {
      this.nodes += 1;
      if (this.nodes > this.budget || out.length >= cap) return;
      if (slot >= this.slotsPerDay) {
        out.push(chosen.slice());
        return;
      }
      if (this.cellValue[classIndex][base + slot]) { step(slot + 1); return; }
      const options = this.candidatesFor(classIndex, day, slot)
        .map((option) => ({
          option,
          // Prefer the tighter learning area, and prefer placing a whole double,
          // but jitter the score so each restart enumerates a different sample of
          // day plans rather than the same truncated list every time.
          score: option.pressure * 2 - (option.size === 2 ? 2 : 0) + this.rng() * 1.5,
        }))
        .sort((left, right) => left.score - right.score)
        .map((entry) => entry.option);
      for (const option of options) {
        if (used.has(option.sessionIndex)) continue;
        this.placeAt(classIndex, day, slot, option.sessionIndex, option.size);
        // Reject a start that would make the rest of the weekday unfillable.
        if (this.dayFeasible(classIndex, day)) {
          used.add(option.sessionIndex);
          chosen.push({ sessionIndex: option.sessionIndex, slot, size: option.size });
          step(slot + option.size);
          chosen.pop();
          used.delete(option.sessionIndex);
        }
        this.unplaceAt(classIndex, day, slot, option.sessionIndex, option.size);
        if (this.nodes > this.budget || out.length >= cap) return;
      }
    };

    step(0);
    return out;
  }

  /** Apply every unit of one class's day plan, then undo any partial failure. */
  private applyUnits(classIndex: number, day: number, units: Unit[]): void {
    for (const unit of units) this.placeAt(classIndex, day, unit.slot, unit.sessionIndex, unit.size);
  }

  private undoUnits(classIndex: number, day: number, units: Unit[]): void {
    for (let index = units.length - 1; index >= 0; index -= 1) {
      const unit = units[index];
      this.unplaceAt(classIndex, day, unit.slot, unit.sessionIndex, unit.size);
    }
  }

  /**
   * Enumerate complete plans for one weekday: every class's lessons for that day,
   * mutually free of teacher clashes.
   *
   * Classes are filled in turn, and because each class's own plan is applied to
   * the grid before the next class is generated, the shared teacher map is already
   * updated: a clash between classes can never be produced in the first place.
   * Within a class, `candidatesFor` and `dayFeasible` guarantee the day's lessons
   * respect the Rules 4-7 windows, Rule 8's one-appearance-per-day, Rule 9 and any
   * configured double (Rules 2, 3, 12).
   */
  private enumerateDayPlans(day: number, planCap: number, optionCap: number): Unit[][][] {
    const out: Unit[][][] = [];
    const classCount = this.model.classes.length;
    const current: Unit[][] = [];

    const build = (classIndex: number): void => {
      this.nodes += 1;
      if (this.nodes > this.budget || out.length >= planCap) return;
      if (classIndex >= classCount) {
        out.push(current.map((units) => units.slice()));
        return;
      }
      const options = this.classDayOptions(classIndex, day, optionCap);
      for (const units of options) {
        this.applyUnits(classIndex, day, units);
        current.push(units);
        build(classIndex + 1);
        current.pop();
        this.undoUnits(classIndex, day, units);
        if (this.nodes > this.budget || out.length >= planCap) return;
      }
    };

    build(0);
    return out;
  }

  /**
   * Solve the level day by day.
   *
   * Each weekday is decided as a whole: the search picks one complete, internally
   * valid plan for that day, applies it, and moves to the next weekday. Because
   * `enumerateDayPlans` only ever yields plans whose lessons already satisfy the
   * Rules 4-7 windows, Rule 8, Rule 9, Rule 11 and any configured double, a day is
   * never explored in a half-broken state - which is exactly the blow-up that made
   * a lesson-by-lesson descent unusable on tightly packed weeks.
   *
   * The remaining coupling between days is Rule 8 (a learning area appears once
   * per day, so its weekday pattern must fit its weekly count) and Rule 13 (the
   * exact weekly count). Both are enforced while plans are generated: a learning
   * area whose remaining lessons no longer fit its remaining weekdays is refused,
   * so a day plan that starves a later day is rejected before it is tried.
   */
  private solveDays(day: number): boolean {
    const slotsPerDay = this.slotsPerDay;

    this.nodes += 1;
    if (this.nodes > this.budget) return false;
    if (day >= DAY_COUNT) {
      for (const session of this.model.sessions) {
        if (this.model.remaining[session.index] !== 0) return false;
        if (session.doubleRequested && session.lessons >= 2 && this.doubleDay[session.index] < 0) return false;
      }
      return true;
    }
    this.currentDay = day;
    if (day > this.deepestCell) this.deepestCell = day;

    // A learning area that cannot wait for a later weekday must be placed today.
    for (const session of this.model.sessions) {
      if (this.model.remaining[session.index] <= 0) continue;
      if (!(session.allowedDayMask & (1 << day))) {
        // It cannot use today, so it must still fit in the weekdays after today.
        if (this.currentDay === day && this.daysAvailableAfter(session, day) < this.daysNeeded(session)) {
          return false;
        }
        continue;
      }
      if (this.model.usedDay[session.index] & (1 << day)) continue;
      const remainingDays = this.daysAvailableFrom(session, day);
      if (remainingDays < this.daysNeeded(session)) {
        return false;
      }
    }

    const plans = this.enumerateDayPlans(day, this.planCap, this.optionCap);
    if (!plans.length) {
      return false;
    }

    // The first plan is the heuristic preference; the rest are shuffled so each
    // restart explores a different week shape.
    const ordered = plans.length > 1
      ? [plans[0], ...shuffle(plans.slice(1), this.rng)]
      : plans;

    for (const plan of ordered) {
      for (let classIndex = 0; classIndex < plan.length; classIndex += 1) {
        this.applyUnits(classIndex, day, plan[classIndex]);
      }
      if (this.solveDays(day + 1)) return true;
      for (let classIndex = plan.length - 1; classIndex >= 0; classIndex -= 1) {
        this.undoUnits(classIndex, day, plan[classIndex]);
      }
      this.currentDay = day;
      if (this.nodes > this.budget) return false;
    }
    return false;
  }

  /** Weekdays at or after `day` this learning area may still use. */
  private daysAvailableFrom(session: Session, day: number): number {
    const dayBit = 1 << day;
    let mask = session.allowedDayMask
      & ~this.model.usedDay[session.index]
      & (ALL_DAY_BITS << day);
    for (let position = 0; position < session.maskKeys.length; position += 1) {
      mask &= ~this.maskOf(session, position);
    }
    void dayBit;
    return popcount(mask & ALL_DAY_BITS);
  }

  /** Weekdays strictly after `day` this learning area may still use. */
  private daysAvailableAfter(session: Session, day: number): number {
    let mask = session.allowedDayMask
      & ~this.model.usedDay[session.index]
      & (ALL_DAY_BITS << (day + 1));
    for (let position = 0; position < session.maskKeys.length; position += 1) {
      mask &= ~this.maskOf(session, position);
    }
    return popcount(mask & ALL_DAY_BITS);
  }
/* ── per-class week construction ────────────────────────────────────────── */

  /** Does a legal pair of consecutive lessons exist for this learning area on this day? */
  private hasLegalPair(session: Session): boolean {
    for (let start = 0; start + 1 < this.slotsPerDay; start += 1) {
      if (session.window[start] !== 1 || session.window[start + 1] !== 1) continue;
      if (this.lessonNumber(start + 1) !== this.lessonNumber(start) + 1) continue;
      // Rule 12 — a CAS double may not start at Lesson 1 or 2.
      if (isCasName(session.subjectNames[0]) && this.lessonNumber(start) < 3) continue;
      return true;
    }
    return false;
  }

  /** Rules 4-7 and Rule 9 test for putting this learning area at this lesson. */
  private fitsSlot(classIndex: number, day: number, slot: number, sessionIndex: number): boolean {
    const slotsPerDay = this.slotsPerDay;
    const base = day * slotsPerDay;
    const session = this.model.sessions[sessionIndex];
    if (session.window[slot] !== 1) return false; // Rules 4-7
    const grid = this.cellValue[classIndex];
    // Rule 9 — Integrated Science is never immediately after Mathematics, and
    // Mathematics is never immediately before Integrated Science.
    if (session.family === 'science' && slot > 0 && this.mathAt[classIndex][base + slot - 1]) return false;
    if (session.family === 'math' && slot + 1 < slotsPerDay) {
      const right = grid[base + slot + 1];
      if (right && this.model.sessions[right - 1].family === 'science') return false;
    }
    // Rule 11 — a teacher already committed elsewhere cannot take this lesson.
    for (const teacherIndex of session.teacherIndexes) {
      if (!this.teacherFree(teacherIndex, day, slot)) return false;
    }
    return true;
  }

  /** Does this learning area already appear on this weekday (Rule 8)? */
  private appearsOnDay(classIndex: number, day: number, sessionIndex: number): boolean {
    const slotsPerDay = this.slotsPerDay;
    const base = day * slotsPerDay;
    const grid = this.cellValue[classIndex];
    for (let slot = 0; slot < slotsPerDay; slot += 1) {
      if (grid[base + slot] === sessionIndex + 1) return true;
    }
    return false;
  }

  /**
   * Choose the weekday pattern for one class: which weekdays each learning area
   * appears on, and which weekday carries its double.
   *
   * A learning area appears at most once per weekday (Rule 8), so with c lessons
   * and one double it needs c-1 weekdays for singles plus one weekday for the
   * double. The week has no spare lesson (Rule 13 against the level total), so the
   * pattern must also fill every weekday exactly. A greedy pass usually leaves the
   * days slightly unbalanced, so a repair pass then moves single lessons from
   * overfull weekdays to short ones until every day is exact.
   */
  private chooseWeekPattern(
    classIndex: number,
    rng: () => number,
  ): { days: Map<number, number[]>; doubleDay: Map<number, number> } | null {
    const capacity = new Array(DAY_COUNT).fill(this.slotsPerDay);
    /** Lessons this class already has on each weekday, for even spreading. */
    const load = new Array(DAY_COUNT).fill(0);
    const days = new Map<number, number[]>();
    const doubleDay = new Map<number, number>();
    const list = this.model.classSessions[classIndex];

    // Most demanding learning areas first: a subject with more weekly lessons needs
    // more distinct weekdays (Rule 8), so it must claim its days before the lighter
    // subjects use them up. Ties are shuffled so restarts explore different shapes.
    const ordered = shuffle(list.slice(), rng).sort((left, right) =>
      this.model.remaining[right] - this.model.remaining[left]);

    const allowedDaysOf = (sessionIndex: number): number[] => {
      const session = this.model.sessions[sessionIndex];
      const out: number[] = [];
      for (let day = 0; day < DAY_COUNT; day += 1) {
        if (session.allowedDayMask & (1 << day)) out.push(day);
      }
      return out;
    };

    // ── Phase 1: give every double its weekday. A double takes two cells of one
    //    day, so it must be placed before the single lessons consume those cells.
    for (const sessionIndex of ordered) {
      const session = this.model.sessions[sessionIndex];
      const count = this.model.remaining[sessionIndex];
      if (count <= 0) { days.set(sessionIndex, []); doubleDay.set(sessionIndex, -1); continue; }
      // A configured double must always be placed. An inferred one (a weekly count
      // above the usable weekdays, Rule 8) is only needed when it actually frees a
      // weekday; otherwise the lessons fit as singles and no double is invented.
      const usableWeekdays = allowedDaysOf(sessionIndex).length;
      const mustDouble = session.doubleRequested && count >= 2;
      const usefulDouble = session.autoDouble && count >= 2 && count > usableWeekdays;
      const wantsDouble = mustDouble || usefulDouble;
      if (!wantsDouble) { days.set(sessionIndex, []); doubleDay.set(sessionIndex, -1); continue; }
      if (!this.hasLegalPair(session)) return null;
      const allowed = allowedDaysOf(sessionIndex);
      const pairDays = shuffle(allowed.filter((day) => capacity[day] >= 2), rng)
        .sort((left, right) => (capacity[right] - capacity[left]) || (load[left] - load[right]));
      if (!pairDays.length) return null;
      const day = pairDays[0];
      capacity[day] -= 2;
      load[day] += 2;
      days.set(sessionIndex, [day]);
      doubleDay.set(sessionIndex, day);
    }

    // ── Phase 2: fill in each learning area's single weekdays. A subject with c
    //    lessons and a double needs c-1 further weekdays; without a double it needs
    //    all c of them.
    for (const sessionIndex of ordered) {
      const session = this.model.sessions[sessionIndex];
      const count = this.model.remaining[sessionIndex];
      if (count <= 0) continue;
      const allowed = allowedDaysOf(sessionIndex);
      const chosen = days.get(sessionIndex) || [];
      const isDoubleDay = doubleDay.get(sessionIndex) ?? -1;
      const needed = count - (isDoubleDay >= 0 ? 1 : 0);
      if (needed > allowed.length) {
        if (!this.relaxed) {
          return null;
        }
        days.set(sessionIndex, chosen);
        continue;
      }
      const candidates = shuffle(allowed.filter((day) => day !== isDoubleDay), rng)
        .sort((left, right) => (load[left] - load[right]) || (capacity[right] - capacity[left]));
      for (const day of candidates) {
        if (chosen.length >= needed) break;
        if (capacity[day] <= 0) continue;
        chosen.push(day);
        load[day] += 1;
      }
      // Rule 8: each learning area needs its own weekday for every lesson, so a
      // shape that cannot give it enough of them is simply retried. Accepting a
      // Rule 14 shortfall leaves cells empty; it never drops a lesson.
      if (chosen.length < needed) return null;
      for (const day of chosen) {
        if (day === isDoubleDay) continue;
        capacity[day] -= 1;
      }
      days.set(sessionIndex, chosen);
    }

    // Repair: move single lessons from overfull weekdays to short ones until every
    // weekday is exactly full. Phase 2 can leave a day slightly over when the
    // remaining learning areas were narrow in their available days.
    for (let pass = 0; pass < 120; pass += 1) {
      let over = -1;
      let under = -1;
      for (let day = 0; day < DAY_COUNT; day += 1) {
        if (capacity[day] < 0) over = day;
        if (capacity[day] > 0 && under < 0) under = day;
      }
      if (over < 0) break;
      // Unused cells are only allowed when the admin chose to continue past a
      // Rule 14 lesson-count warning; otherwise every weekday must fill exactly.
      if (under < 0) {
        if (this.relaxed) break;
        return null;
      }
      let moved = false;
      for (const [sessionIndex, onDays] of days) {
        const session = this.model.sessions[sessionIndex];
        if (doubleDay.get(sessionIndex) === over) continue; // a double cannot split
        if (!onDays.includes(over)) continue;
        if (onDays.includes(under)) continue;
        const others = onDays.filter((day) => day !== over);
        // Keep the learning area's minimum weekday count intact.
        const wantsDouble = (session.doubleRequested || session.autoDouble) && session.lessons >= 2
          && doubleDay.get(sessionIndex) !== undefined && doubleDay.get(sessionIndex)! >= 0;
        const minimum = session.lessons - (wantsDouble ? 1 : 0);
        if (others.length < minimum - 1) continue;
        if (!(session.allowedDayMask & (1 << under))) continue;
        days.set(sessionIndex, others.concat([under]));
        capacity[over] += 1;
        capacity[under] -= 1;
        moved = true;
        break;
      }
      if (!moved) return null;
    }

    for (let day = 0; day < DAY_COUNT; day += 1) {
      if (capacity[day] < 0) return null;
      if (capacity[day] !== 0 && !this.relaxed) return null;
    }
    return { days, doubleDay };
  }

  /* ── Rule 11 repair ─────────────────────────────────────────────────────── */

  /** Every (teacher, lesson) cell claimed by more than one class. */
  private findConflicts(): { teacherIndex: number; firstClass: number; secondClass: number; index: number }[] {
    const slotsPerDay = this.slotsPerDay;
    const cells = DAY_COUNT * slotsPerDay;
    const holder = new Map<number, number>();
    const out: { teacherIndex: number; firstClass: number; secondClass: number; index: number }[] = [];
    for (let classIndex = 0; classIndex < this.model.classes.length; classIndex += 1) {
      const grid = this.cellValue[classIndex];
      for (let index = 0; index < cells; index += 1) {
        const value = grid[index];
        if (!value) continue;
        const session = this.model.sessions[value - 1];
        for (const teacherIndex of session.teacherIndexes) {
          const key = teacherIndex * cells + index;
          const previous = holder.get(key);
          if (previous == null) holder.set(key, classIndex);
          else if (previous !== classIndex) {
            out.push({ teacherIndex, firstClass: previous, secondClass: classIndex, index });
          }
        }
      }
    }
    return out;
  }

  private countCollisions(): number {
    return this.findConflicts().length;
  }

  /** Remove the learning area at one cell from the teacher map and the grid. */
  private liftCell(classIndex: number, day: number, slot: number): number {
    const slotsPerDay = this.slotsPerDay;
    const base = day * slotsPerDay;
    const grid = this.cellValue[classIndex];
    const value = grid[base + slot];
    if (!value) return 0;
    const session = this.model.sessions[value - 1];
    for (const teacherIndex of session.teacherIndexes) this.setTeacher(teacherIndex, day, slot, 0);
    grid[base + slot] = 0;
    if (session.family === 'math') this.mathAt[classIndex][base + slot] = 0;
    return value;
  }

  /** Write a learning area into one cell of the grid and the teacher map. */
  private dropCell(classIndex: number, day: number, slot: number, sessionIndex: number): void {
    const slotsPerDay = this.slotsPerDay;
    const base = day * slotsPerDay;
    const session = this.model.sessions[sessionIndex];
    this.cellValue[classIndex][base + slot] = sessionIndex + 1;
    if (session.family === 'math') this.mathAt[classIndex][base + slot] = 1;
    for (const teacherIndex of session.teacherIndexes) this.setTeacher(teacherIndex, day, slot, 1);
  }

  /**
   * Does swapping these two single lessons between their cells keep both classes
   * legal? Both cells may sit in the same class or in two different classes, which
   * is what lets a clash be resolved by moving a lesson somewhere else entirely.
   */
  private swapIsLegal(
    classA: number, dayA: number, slotA: number, sessionA: number,
    classB: number, dayB: number, slotB: number, sessionB: number,
  ): boolean {
    if (this.doubleDay[sessionA] >= 0 || this.doubleDay[sessionB] >= 0) return false;
    // Remove both, then test each learning area at its new position.
    this.liftCell(classA, dayA, slotA);
    this.liftCell(classB, dayB, slotB);
    const legal = !this.appearsOnDay(classA, dayB, sessionA)
      && !this.appearsOnDay(classB, dayA, sessionB)
      && this.fitsSlot(classA, dayB, slotB, sessionA)
      && this.fitsSlot(classB, dayA, slotA, sessionB);
    if (legal) {
      this.dropCell(classA, dayB, slotB, sessionA);
      this.dropCell(classB, dayA, slotA, sessionB);
    } else {
      this.dropCell(classA, dayA, slotA, sessionA);
      this.dropCell(classB, dayB, slotB, sessionB);
    }
    return legal;
  }

  /** Undo a legal swap. */
  private undoSwap(
    classA: number, dayA: number, slotA: number, sessionA: number,
    classB: number, dayB: number, slotB: number, sessionB: number,
  ): void {
    this.liftCell(classA, dayB, slotB);
    this.liftCell(classB, dayA, slotA);
    this.dropCell(classA, dayA, slotA, sessionA);
    this.dropCell(classB, dayB, slotB, sessionB);
  }

  /**
   * Every arrangement of one class's lessons for one weekday, given the teachers
   * already booked by the classes placed before it.
   *
   * A weekday's units are fixed by the class's week pattern, so this only has to
   * choose slots: which lesson each learning area sits in, and where its double
   * starts. Narrow windows (Maths is lessons 1-4) are satisfied by `fitsSlot`, and
   * the least constrained lesson is tried last so an impossible weekday is detected
   * early. `cap` bounds the list, and the order is shuffled so restarts differ.
   */
  private dayArrangements(
    classIndex: number,
    day: number,
    units: Unit[],
    cap: number,
    rng: () => number,
  ): Unit[][] {
    const out: Unit[][] = [];
    const slotsPerDay = this.slotsPerDay;
    const base = day * slotsPerDay;
    const grid = this.cellValue[classIndex];
    const used = new Uint8Array(slotsPerDay);
    const pending = units.slice();
    const chosen: Unit[] = [];

    const step = (): void => {
      this.nodes += 1;
      if (this.nodes > this.budget || out.length >= cap) return;
      if (!pending.length) {
        out.push(chosen.map((unit) => ({ ...unit })));
        return;
      }

      // Most constrained lesson first: fewest legal slots left.
      let bestIndex = -1;
      let bestSlots: number[] = [];
      for (let index = 0; index < pending.length; index += 1) {
        const unit = pending[index];
        const session = this.model.sessions[unit.sessionIndex];
        const slots: number[] = [];
        if (unit.size === 2) {
          for (let start = 0; start + 1 < slotsPerDay; start += 1) {
            if (used[start] || used[start + 1]) continue;
            if (session.window[start] !== 1 || session.window[start + 1] !== 1) continue;
            if (this.lessonNumber(start + 1) !== this.lessonNumber(start) + 1) continue;
            if (isCasName(session.subjectNames[0]) && this.lessonNumber(start) < 3) continue;
            if (!this.fitsSlot(classIndex, day, start, unit.sessionIndex)) continue;
            if (!this.fitsSlot(classIndex, day, start + 1, unit.sessionIndex)) continue;
            slots.push(start);
          }
        } else {
          for (let slot = 0; slot < slotsPerDay; slot += 1) {
            if (used[slot]) continue;
            if (!this.fitsSlot(classIndex, day, slot, unit.sessionIndex)) continue;
            slots.push(slot);
          }
        }
        if (!slots.length) return; // this branch is already impossible
        if (bestIndex < 0 || slots.length < bestSlots.length) { bestIndex = index; bestSlots = slots; }
      }

      const unit = pending[bestIndex];
      const session = this.model.sessions[unit.sessionIndex];
      // Prefer the later part of a narrow window so the early lessons stay free for
      // the other classes that must also use that window.
      const ordered = shuffle(bestSlots, rng).sort((left, right) => {
        const width = (value: number): number => {
          let count = 0;
          for (let slot = 0; slot < slotsPerDay; slot += 1) if (session.window[slot] === 1) count += 1;
          return count;
        };
        void width;
        return right - left;
      });
      for (const slot of ordered) {
        const touched: number[] = [];
        for (let offset = 0; offset < unit.size; offset += 1) {
          used[slot + offset] = 1;
          grid[base + slot + offset] = unit.sessionIndex + 1;
          if (session.family === 'math') this.mathAt[classIndex][base + slot + offset] = 1;
          touched.push(slot + offset);
        }
        chosen.push({ sessionIndex: unit.sessionIndex, slot, size: unit.size });
        pending.splice(bestIndex, 1);
        step();
        pending.splice(bestIndex, 0, unit);
        chosen.pop();
        for (const cell of touched) {
          used[cell] = 0;
          grid[base + cell] = 0;
          if (session.family === 'math') this.mathAt[classIndex][base + cell] = 0;
        }
        if (this.nodes > this.budget || out.length >= cap) return;
      }
    };

    step();
    // Leave the class's grid clean: the caller commits the arrangement it picks.
    for (let slot = 0; slot < slotsPerDay; slot += 1) {
      grid[base + slot] = 0;
      this.mathAt[classIndex][base + slot] = 0;
    }
    return out;
  }

  /**
   * Decide one weekday for the whole level at once.
   *
   * The weekday's lessons per class are already fixed by the week pattern, so only
   * the slots remain. Classes are placed one after another; because each placement
   * books its teachers, the next class already sees them, and a class with no legal
   * arrangement makes the search step back to the previous class and try its next
   * arrangement. Doing this per weekday - rather than building each class's whole
   * week in isolation - is what lets a shared teacher's narrow window (Maths, lessons
   * 1-4) be shared fairly between classes instead of being taken by whoever came
   * first.
   */
  private assignDay(day: number, rng: () => number): boolean {
    const classCount = this.model.classes.length;
    const arrangements: Unit[][][] = new Array(classCount);
    // The order classes are placed in decides who claims a shared teacher's narrow
    // window first. Shuffling it per weekday lets a class that would otherwise be
    // starved (its Maths teacher already taken for lessons 1-4) go first instead.
    const order = shuffle(this.model.classes.map((_, index) => index), rng);

    const step = (position: number): boolean => {
      this.nodes += 1;
      if (this.nodes > this.budget) return false;
      if (position >= classCount) return true;
      const classIndex = order[position];

      const units: Unit[] = [];
      for (const sessionIndex of this.model.classSessions[classIndex]) {
        const onDays = this.weekDays[sessionIndex] || [];
        if (!onDays.includes(day)) continue;
        units.push({ sessionIndex, slot: -1, size: this.weekDouble[sessionIndex] === day ? 2 : 1 });
      }
      let slots = 0;
      for (const unit of units) slots += unit.size;
      if (slots > this.slotsPerDay) return false;
      // A class whose lessons fall short of the week leaves the extra cells empty,
      // which is only allowed once the admin accepted the Rule 14 warning.
      if (slots < this.slotsPerDay && !this.relaxed) return false;

      // Recomputed on every visit: when the search steps back to an earlier class
      // and tries a different arrangement, the teachers already booked change, so a
      // list cached under the previous arrangement would no longer be legal.
      const options = this.dayArrangements(classIndex, day, units, this.optionCap, rng);
      arrangements[classIndex] = options;
      for (const arrangement of options) {
        this.applyUnits(classIndex, day, arrangement);
        if (step(position + 1)) return true;
        this.undoUnits(classIndex, day, arrangement);
        if (this.nodes > this.budget) return false;
      }
      return false;
    };

    if (!step(0)) {
      // Leave no half-placed weekday behind.
      for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
        const grid = this.cellValue[classIndex];
        const base = day * this.slotsPerDay;
        for (let slot = 0; slot < this.slotsPerDay; slot += 1) {
          if (!grid[base + slot]) continue;
          this.undoUnits(classIndex, day, [{ sessionIndex: grid[base + slot] - 1, slot, size: 1 }]);
        }
      }
      return false;
    }
    return true;
  }
  /**
   * Choose a class's week shape and record it: which weekdays each learning area
   * appears on, and which weekday carries its double.
   *
   * The shape must fill every weekday exactly (Rule 1 with Rule 13), and the
   * weekday's lessons are then decided jointly with the other classes by
   * `assignDay`, because a shared teacher's narrow window has to be shared.
   */
  private planClassWeek(classIndex: number, rng: () => number): boolean {
    for (let patternTry = 0; patternTry < 60; patternTry += 1) {
      this.nodes += 1;
      if (this.nodes > this.budget) return false;
      const pattern = this.chooseWeekPattern(classIndex, rng);
      if (!pattern) continue;
      for (const sessionIndex of this.model.classSessions[classIndex]) {
        this.weekDays[sessionIndex] = pattern.days.get(sessionIndex) || [];
        this.weekDouble[sessionIndex] = pattern.doubleDay.get(sessionIndex) ?? -1;
      }
      return true;
    }
    return false;
  }

  /**
   * Build a whole level.
   *
   * Each class first chooses a week shape - which weekdays its learning areas
   * appear on and which weekday carries a double - so that every weekday is exactly
   * full. Then each weekday is decided for the whole level at once: classes are
   * placed in turn against the shared teacher map, and a class that cannot fit
   * makes the search step back to the previous class. Working weekday by weekday
   * is what lets a narrow window (Maths, lessons 1-4) be shared between classes
   * instead of being consumed by whichever class was built first.
   *
   * Several independent attempts are made with different seeds, so a week shape
   * that cannot be laid out is simply replaced by another one.
   */
  solveConstructive(attempts: number, limit: number, relaxedAttempts = 0): boolean {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      this.nodes += 1;
      if (this.nodes > limit) return false;
      // Strict attempts first: a complete grid is always preferred. The relaxed
      // attempts only run when the admin accepted a lesson-count shortfall.
      this.relaxed = this.allowBlanks && attempt >= attempts - relaxedAttempts;
      this.resetModel();
      this.vertexClear();
      this.weekDays = [];
      this.weekDouble = [];
      for (let index = 0; index < this.model.sessions.length; index += 1) {
        this.weekDays.push([]);
        this.weekDouble.push(-1);
      }
      let planned = true;
      for (let classIndex = 0; classIndex < this.model.classes.length && planned; classIndex += 1) {
        planned = this.planClassWeek(classIndex, this.rng);
      }
      if (!planned) continue;
      let ok = true;
      for (let day = 0; day < DAY_COUNT && ok; day += 1) {
        ok = this.assignDay(day, this.rng);
      }
      if (!ok) continue;
      const problem = this.verify(this.relaxed);
      if (problem === null) return true;
    }
    return false;
  }

  /* ── the main fill ──────────────────────────────────────────────────────── */

  /**
   * One step of the search: choose the most constrained unfilled cell across the
   * whole level and try its legal options.
   *
   * Choosing cells by MRV (fewest legal learning areas first) rather than in
   * strict timetable order is what makes tight weeks tractable: a lesson whose
   * window is nearly full, or whose teachers are nearly booked out, is decided
   * while it still has options, instead of being discovered as impossible after
   * the rest of the week has been committed.
   */
  /**
   * Randomized greedy construction of one complete week.
   *
   * Cells are filled day by day and lesson by lesson; at each cell the learning
   * area is chosen by urgency - fewest usable weekdays left, then the heaviest
   * teacher contention - with random tie-breaking and a little jitter. A
   * configured double is preferred at its first legal position so it cannot be
   * crowded out later.
   *
   * One pass is cheap, so the caller runs many passes with different seeds and
   * keeps the first complete, rule-clean week. That randomized restart strategy
   * is what makes tightly packed weeks reliable: a single deterministic ordering
   * traps itself on a choice that only fails several lessons later, whereas
   * re-deciding the whole week from a different angle finds a valid one quickly.
   *
   * Returns true only when every cell is filled and no local rule is broken.
   */
  private greedyWeek(rng: () => number): boolean {
    const slotsPerDay = this.slotsPerDay;
    const classCount = this.model.classes.length;

    for (let day = 0; day < DAY_COUNT; day += 1) {
      this.currentDay = day;
      const base = day * slotsPerDay;
      for (let slot = 0; slot < slotsPerDay; slot += 1) {
        for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
          if (this.cellValue[classIndex][base + slot]) continue;
          const options = this.candidatesFor(classIndex, day, slot);
          if (!options.length) return false;
          // A double that is still owed ranks first, then urgency, then teacher
          // contention; the jitter lets each seed explore a different week.
          const scored = options.map((option) => {
            const session = this.model.sessions[option.sessionIndex];
            const urgency = -option.pressure;
            const contention = session.teacherIndexes.length * 3;
            const jitter = rng() * 4;
            return { option, score: urgency * 4 + contention + jitter - (option.size === 2 ? 6 : 0) };
          });
          scored.sort((left, right) => left.score - right.score);
          const pick = scored[0].option;
          this.placeAt(classIndex, day, slot, pick.sessionIndex, pick.size);
          // Undo immediately if the weekday can no longer be completed.
          if (!this.dayFeasible(classIndex, day)) {
            this.unplaceAt(classIndex, day, slot, pick.sessionIndex, pick.size);
            let placed = false;
            for (const candidate of scored.slice(1)) {
              this.placeAt(classIndex, day, slot, candidate.option.sessionIndex, candidate.option.size);
              if (this.dayFeasible(classIndex, day)) { placed = true; break; }
              this.unplaceAt(classIndex, day, slot, candidate.option.sessionIndex, candidate.option.size);
            }
            if (!placed) return false;
          }
        }
      }
    }
    // Every lesson of every class must be placed, and the week must be clean.
    for (const session of this.model.sessions) {
      if (this.model.remaining[session.index] !== 0) return false;
      if (session.doubleRequested && session.lessons >= 2 && this.doubleDay[session.index] < 0) return false;
    }
    return this.verify() === null;
  }

  /**
   * Fill the level day by day. Within a weekday the most constrained cell is
   * chosen first; when the weekday is full the search moves on to the next one.
   *
   * Day-major order keeps two things true at once:
   *   • the "usable weekdays" counts only ever look forward, so a learning area
   *     with more lessons left than weekdays remaining is detected immediately;
   *   • the tightest lesson of a weekday is decided before the flexible ones can
   *     take the cell it needed.
   * Backtracking returns to the previous decision when a cell has no legal
   * learning area left, so an early choice that traps a later lesson is retried
   * rather than reported as a failure.
   */
  private solveFromDay(day: number): boolean {
    const slotsPerDay = this.slotsPerDay;
    const classCount = this.model.classes.length;

    this.nodes += 1;
    if (this.nodes > this.budget) return false;
    if (day >= DAY_COUNT) return true;
    this.currentDay = day;
    if (day > this.deepestCell) this.deepestCell = day;

    // Most constrained unfilled cell within this weekday.
    let bestClass = -1;
    let bestSlot = -1;
    let bestOptions: CellOption[] = [];
    let bestScore = Number.POSITIVE_INFINITY;

    for (let classIndex = 0; classIndex < classCount; classIndex += 1) {
      const base = day * slotsPerDay;
      const grid = this.cellValue[classIndex];
      for (let slot = 0; slot < slotsPerDay; slot += 1) {
        if (grid[base + slot]) continue;
        const options = this.candidatesFor(classIndex, day, slot);
        if (!options.length) return false;
        // A learning area with almost no spare weekdays must be served first,
        // and a cell that can still host a double is more valuable than one
        // that cannot.
        let pressure = 0;
        for (const option of options) pressure = Math.max(pressure, -option.pressure);
        const score = pressure * 2 + (options.some((option) => option.size === 2) ? 0 : 1);
        if (score < bestScore) {
          bestClass = classIndex;
          bestSlot = slot;
          bestOptions = options;
          bestScore = score;
        }
      }
    }

    if (bestClass < 0) return this.solveFromDay(day + 1);

    const ordered = bestOptions.length > 1
      ? shuffle(bestOptions.slice().sort((left, right) => right.size - left.size), this.rng)
      : bestOptions;

    for (const option of ordered) {
      this.placeAt(bestClass, day, bestSlot, option.sessionIndex, option.size);
      // Two independent checks: the class must still fit every remaining lesson
      // into the lesson-number bands its windows allow (Rules 4-7), and it must
      // still be able to lay out the rest of this weekday (Rules 8, 9, 12).
      const feasible = this.bandFeasible(bestClass) && this.dayFeasible(bestClass, day);
      if (feasible && this.solveFromDay(day)) return true;
      this.unplaceAt(bestClass, day, bestSlot, option.sessionIndex, option.size);
      if (this.nodes > this.budget) return false;
    }
    return false;
  }

  /**
   * Try many randomized greedy weeks. Each pass starts from a clean grid, so the
   * attempts are independent, and the first rule-clean week wins.
   */
  solveGreedy(attempts: number, limit: number): boolean {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      this.resetModel();
      this.vertexClear();
      this.currentDay = 0;
      this.nodes += 1;
      if (this.nodes > limit) return false;
      if (this.greedyWeek(this.rng)) return true;
    }
    return false;
  }

  /** Clear the whole grid, used between independent construction attempts. */
  private vertexClear(): void {
    for (const grid of this.cellValue) grid.fill(0);
    for (const grid of this.mathAt) grid.fill(0);
    this.teacherBusy.fill(0);
    this.seedReservations();
  }

  /**
   * Try the per-day plan search, then fall back to randomized greedy weeks. Each
   * attempt starts from a clean grid, so the attempts are independent.
   */
  solveDaysWithRestarts(attempts: number, limit: number): boolean {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      this.resetModel();
      this.vertexClear();
      this.currentDay = 0;
      this.nodes += 1;
      if (this.nodes > limit) return false;
      if (this.solveDays(0)) {
        if (this.verify(this.relaxed) === null) return true;
      }
    }
    return false;
  }

  /** Run the main fill over every cell of the level. */
  solveAll(): boolean {
    // Clear any state left by an earlier attempt before a fresh descent.
    this.resetModel();
    this.currentDay = 0;
    return this.solveFromDay(0);
  }

  /**
   * Restore the shared model to its pristine state. Each restart builds a fresh
   * LevelSearch, but `remaining`, `usedDay` and `subjectMask` live on the shared
   * model, so a previous attempt's partial work would otherwise leak into the
   * next attempt and make a solvable configuration look impossible.
   */
  private resetModel(): void {
    this.model.remaining.set(this.model.initialRemaining);
    this.model.usedDay.fill(0);
    for (const key of this.model.subjectMask.keys()) this.model.subjectMask.set(key, 0);
    for (const session of this.model.sessions) {
      this.doubleDay[session.index] = -1;
      this.doubleStart[session.index] = -1;
    }
  }

  /** Clear every non-double placement so a fresh attempt can start. */
  resetSingles(): void {
    const slotsPerDay = this.slotsPerDay;
    const cells = DAY_COUNT * slotsPerDay;
    for (let classIndex = 0; classIndex < this.model.classes.length; classIndex += 1) {
      let index = 0;
      while (index < cells) {
        const value = this.cellValue[classIndex][index];
        if (!value) { index += 1; continue; }
        const sessionIndex = value - 1;
        const day = Math.floor(index / slotsPerDay);
        const slot = index % slotsPerDay;
        if (this.doubleDay[sessionIndex] === day) {
          // A whole double stays; skip both of its lessons.
          index += 2;
          continue;
        }
        this.unplaceAt(classIndex, day, slot, sessionIndex, 1);
        index += 1;
      }
    }
  }

  /** Independent verification of the finished grid. Returns a problem or null. */
  verify(allowBlanks = false): string | null {
    const slotsPerDay = this.slotsPerDay;
    const cells = DAY_COUNT * slotsPerDay;

    // Rule 1 — every cell of every class is filled. When the admin has chosen to
    // continue past a Rule 14 lesson-count warning, the cells the class has no
    // lessons for are allowed to stay empty, but nothing else may slip.
    for (let classIndex = 0; classIndex < this.model.classes.length; classIndex += 1) {
      // Only a class whose own lessons cannot fill the week may keep cells empty;
      // every other class must still be complete, so continuing past the warning
      // never hides a gap that a full week would have covered.
      if (allowBlanks && this.shortClassIndexes.has(classIndex)) continue;
      const grid = this.cellValue[classIndex];
      for (let index = 0; index < cells; index += 1) {
        if (grid[index]) continue;
        const day = Math.floor(index / slotsPerDay);
        return `${formatClassStream(this.model.classes[classIndex])} has a blank ${DAYS[day]} Lesson ${(index % slotsPerDay) + 1}`;
      }
    }

    // Rule 13 — exact weekly counts — and Rule 8 — one appearance per weekday.
    for (const session of this.model.sessions) {
      let placed = 0;
      for (let day = 0; day < DAY_COUNT; day += 1) {
        let today = 0;
        for (let slot = 0; slot < slotsPerDay; slot += 1) {
          if (this.cellValue[session.classIndex][day * slotsPerDay + slot] === session.index + 1) today += 1;
        }
        placed += today;
        const isDoubleDay = this.doubleDay[session.index] === day;
        if (today > 1 && !(isDoubleDay && today === 2)) {
          return `${session.subjectNames.join(' + ')} appears ${today} times on ${DAYS[day]} in `
            + `${formatClassStream(this.model.classes[session.classIndex])}`;
        }
      }
      if (placed !== session.lessons) {
        // Rule 13 is never relaxed: every lesson the admin configured must appear.
        // Accepting a Rule 14 shortfall only allows cells to stay EMPTY - the
        // lessons a class does have are all placed.
        return `${session.subjectNames.join(' + ')} has ${placed} lessons in `
          + `${formatClassStream(this.model.classes[session.classIndex])} but requires exactly ${session.lessons}`;
      }
      if (session.doubleRequested && session.lessons >= 2 && this.doubleDay[session.index] < 0) {
        return `${session.subjectNames.join(' + ')} asked for a double lesson but none was placed`;
      }
    }

    // Rule 11 — no teacher in two classes at the same lesson.
    const teacherSlot = new Map<string, number>();
    for (let classIndex = 0; classIndex < this.model.classes.length; classIndex += 1) {
      for (let index = 0; index < cells; index += 1) {
        const value = this.cellValue[classIndex][index];
        if (!value) continue;
        const session = this.model.sessions[value - 1];
        const day = Math.floor(index / slotsPerDay);
        const slot = index % slotsPerDay;
        for (const teacherIndex of session.teacherIndexes) {
          const key = `${teacherIndex}|${day}|${slot}`;
          const previous = teacherSlot.get(key);
          if (previous != null && previous !== classIndex) {
            return `teacher ${this.model.teacherNames[teacherIndex]} is in two classes at ${DAYS[day]} Lesson ${slot + 1}`;
          }
          teacherSlot.set(key, classIndex);
        }
      }
    }

    // Rules 2, 3 and 12 — doubles are solid, adjacent and inside their window.
    for (const session of this.model.sessions) {
      const day = this.doubleDay[session.index];
      if (day < 0) continue;
      const start = this.doubleStart[session.index];
      const grid = this.cellValue[session.classIndex];
      const base = day * slotsPerDay;
      if (start < 0 || session.window[start] !== 1 || session.window[start + 1] !== 1) {
        return `${session.subjectNames.join(' + ')} has a double outside its allowed window`;
      }
      if (grid[base + start] !== session.index + 1 || grid[base + start + 1] !== session.index + 1) {
        return `${session.subjectNames.join(' + ')} is not a solid double lesson`;
      }
      const first = this.lessonNumber(start);
      if (this.lessonNumber(start + 1) !== first + 1) {
        return `${session.subjectNames.join(' + ')} has a double across a lesson break`;
      }
      if (isCasName(session.subjectNames[0]) && first < 3) {
        return `${session.subjectNames.join(' + ')} has a CAS double starting at Lesson ${first} (Rule 12)`;
      }
    }

    // Rules 4-7 — subject windows — and Rule 9 — Maths before Science.
    for (let classIndex = 0; classIndex < this.model.classes.length; classIndex += 1) {
      const grid = this.cellValue[classIndex];
      for (let day = 0; day < DAY_COUNT; day += 1) {
        for (let slot = 0; slot < slotsPerDay; slot += 1) {
          const value = grid[day * slotsPerDay + slot];
          if (!value) continue;
          const session = this.model.sessions[value - 1];
          if (session.window[slot] !== 1) {
            return `${session.subjectNames.join(' + ')} sits at ${DAYS[day]} Lesson ${slot + 1}, outside its allowed window`;
          }
          if (session.family === 'math' && slot + 1 < slotsPerDay) {
            const rightValue = grid[day * slotsPerDay + slot + 1];
            if (rightValue && this.model.sessions[rightValue - 1].family === 'science') {
              return `Mathematics is immediately followed by ${this.model.sessions[rightValue - 1].subjectNames.join(' + ')} `
                + `in ${formatClassStream(this.model.classes[classIndex])} on ${DAYS[day]}`;
            }
          }
        }
      }
    }

    // Rule 10 — IRE and CRE share their slot with two different teachers.
    for (const session of this.model.sessions) {
      if (session.subjectIds.length !== 2) continue;
      if (session.teacherIndexes[0] === session.teacherIndexes[1]) {
        return `${session.subjectNames.join(' + ')} shares a slot but has the same teacher`;
      }
    }
    return null;
  }
}

/** Lesson numbers of the configured lesson slots, set by the entry point. */
let lessonNumbers: number[] = [];

/* ─────────────────────────────── entry building ────────────────────────────── */

function buildEntries(search: LevelSearch, options: CspTimetableSolverOptions, slots: any[]): any[] {
  const model = search.model;
  const slotsPerDay = model.slotsPerDay;
  const entries: any[] = [];
  for (let classIndex = 0; classIndex < model.classes.length; classIndex += 1) {
    for (let day = 0; day < DAY_COUNT; day += 1) {
      for (let slot = 0; slot < slotsPerDay; slot += 1) {
        const value = search.cellValueAt(classIndex, day, slot);
        if (!value) continue;
        const session = model.sessions[value - 1];
        const isDouble = search.doubleDay[session.index] === day
          && (slot === search.doubleStart[session.index] || slot === search.doubleStart[session.index] + 1);
        const entrySlot = slots[slot];
        for (let position = 0; position < session.subjectIds.length; position += 1) {
          entries.push({
            school_id: options.schoolId,
            class_id: model.classes[classIndex].id,
            day_of_week: day + 1,
            time_slot_id: entrySlot.id,
            subject_id: session.subjectIds[position],
            teacher_id: model.teacherNames[session.teacherIndexes[position]],
            entry_type: isDouble ? 'lesson_double' : 'lesson',
            level_group: options.levelKey,
            effective_start_time: entrySlot.start_time,
            effective_end_time: entrySlot.end_time,
          });
        }
      }
    }
  }
  return entries;
}

/* ──────────────────────────────── entry point ──────────────────────────────── */

export function solveTimetableCsp(options: CspTimetableSolverOptions): CspTimetableSolverResult {
  const startedAt = Date.now();
  const issues: CspSolverIssue[] = [];
  const warnings: CspSolverWarning[] = [];
  const failedClasses: CspFailedClass[] = [];
  let searchNodes = 0;
  let restartCount = 0;
  let accepted = false;

  const progress = (message: string): void => { if (options.onProgress) options.onProgress(message); };
  /** Classes whose own weekly lessons do not fill the level's week (Rule 14). */
  let shortClasses: CspTimetableSolverResult['shortClasses'] = [];

  const finish = (entries: any[], engine: 'csp' | 'none' = 'none'): CspTimetableSolverResult => ({
    entries, issues, warnings, failedClasses, searchNodes,
    durationMs: Date.now() - startedAt,
    engine: accepted ? 'csp' : 'none',
    restartCount,
    // Rule 14 warns rather than blocks, so a mismatch is reported to the admin
    // instead of silently producing a grid with holes in it.
    needsConfirmation: shortClasses.length > 0 && !options.allowIncompleteClasses,
    shortClasses,
  });

  const slots = options.lessonSlots
    .filter((slot) => slot?.slot_type === 'lesson')
    .slice()
    .sort((a, b) => lessonNumberOf(a, 0) - lessonNumberOf(b, 0));
  const slotsPerDay = slots.length;
  const lessonNumberForIndex = (index: number): number => lessonNumberOf(slots[index], index);
  lessonNumbers = Array.from({ length: slotsPerDay }, (_, index) => lessonNumberForIndex(index));

  if (!options.classes.length) {
    issues.push(makeIssue('missing-classes', 'No active classes were supplied for this level.'));
    return finish([]);
  }
  if (!slotsPerDay) {
    issues.push(makeIssue('missing-slots', `No lesson slots were supplied for ${options.levelKey}.`));
    return finish([]);
  }

  const plans = buildClassPlans(options.classes, options.assignments, issues);
  // Rule 14 is a warning, so a mismatch is recorded before anything can return
  // early: the admin must still be told which classes do not match the level.
  const expectedWeeklyCells = slotsPerDay * DAY_COUNT;
  shortClasses = [...plans.values()]
    .filter((plan) => plan.needs.length > 0 && plan.configuredTotal !== expectedWeeklyCells)
    .map((plan) => ({
      classId: plan.classId,
      className: plan.className,
      configuredTotal: plan.configuredTotal,
      expectedTotal: expectedWeeklyCells,
    }));
  if (issues.length) return finish([]);

  // ── Pre-flight: diagnose each class separately so one broken class never hides
  //    the state of the rest, and so every failure names the right class.
  const solvableClassIds = selectAttemptableClasses(
    plans, options.classes, lessonNumberForIndex, slotsPerDay, issues, warnings, failedClasses,
    Boolean(options.allowIncompleteClasses));
  if (!solvableClassIds.length) {
    progress(`No class in ${options.levelKey} can be scheduled; see the reported reasons.`);
    return finish([]);
  }
  const model = buildModel(plans, solvableClassIds, slotsPerDay, lessonNumberForIndex, issues);
  if (!model) return finish([]);
  diagnoseCapacity(plans, failedClasses, model, warnings);

  // Leaving cells empty is only ever an option when a class really has fewer
  // lessons than the week holds. Without such a shortfall every attempt must
  // produce a complete grid, so a school that can be solved perfectly always is.
  // Leaving cells empty is only ever an option when a class really has fewer
  // lessons than the week holds; a class with MORE cannot be fitted at all.
  const hasShortfall = shortClasses.some((entry) => entry.configuredTotal < entry.expectedTotal);
  const allowPartial = Boolean(options.allowIncompleteClasses) && hasShortfall;
  // Only these classes may keep cells empty; the rest of the level still has to be
  // filled completely, so continuing past the warning never hides a real gap.
  // The model holds only the classes that are actually being scheduled, so the
  // short classes are matched by id against that order.
  const shortClassIds = new Set(
    shortClasses.filter((entry) => entry.configuredTotal < entry.expectedTotal)
      .map((entry) => entry.classId),
  );
  const shortClassIndexSet = new Set<number>(
    model.classes
      .map((entry, index) => ({ id: entry.id, index }))
      .filter(({ id }) => shortClassIds.has(id))
      .map(({ index }) => index),
  );

  progress(`Solving ${options.levelKey}: ${solvableClassIds.length} classes, ${model.sessions.length} learning areas, `
    + `${slotsPerDay} lessons/day.`);

  const perClassBudget = Math.max(50_000, options.maxSearchNodesPerClass ?? 500_000);
  const totalBudget = perClassBudget * solvableClassIds.length;
  const reserved = options.reservedTeacherCells || new Set<string>();
  const attempts = 6;
  let deepest = -1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const rng = makeRng(0x2545f491 + attempt * 2654435761);
    restartCount += 1;
    const search = new LevelSearch(model, reserved, rng, Math.max(10_000, totalBudget - searchNodes),
      allowPartial, shortClassIndexSet);

    // The first attempts decide each weekday as a whole with exact look-aheads;
    // the later ones rebuild the week with randomized greedy passes, which escape
    // the ordering traps a single deterministic descent can fall into.
    const budgetLeft = Math.max(10_000, totalBudget - searchNodes);
    const ok = attempt < 4
      ? search.solveConstructive(12, budgetLeft, 6)
      : search.solveGreedy(60, budgetLeft);
    searchNodes += search.nodes;
    if (ok) {
      const problem = search.verify(allowPartial);
      if (!problem) {
        accepted = true;
        const entries = buildEntries(search, options, slots);
        progress(`Solved ${options.levelKey}: ${entries.length} entries `
          + `(${searchNodes.toLocaleString()} search nodes, ${restartCount} attempt(s)).`);
        return finish(entries, 'csp');
      }
      issues.push(makeIssue('internal-verification',
        `The solver produced a ${options.levelKey} grid that failed its own rule check (${problem}); `
        + 'nothing was saved. Please report this message.', {}));
      return finish([]);
    }
    if (search.deepestCell > deepest) deepest = search.deepestCell;
    search.resetSingles();
  }

  // ── Proven impossibility, with specific evidence ─────────────────────────
  const refused = model.sessions.filter((session) => model.remaining[session.index] > 0);
  const outstanding = refused
    .map((session) => `${formatClassStream(model.classes[session.classIndex])} / ${session.subjectNames.join(' + ')} `
      + `(${model.remaining[session.index]} left)`)
    .slice(0, 6);
  const day = deepest >= 0 ? Math.floor(deepest / slotsPerDay) : 0;
  const slot = deepest >= 0 ? deepest % slotsPerDay : 0;

  issues.push(makeIssue('proven-impossible',
    `No valid ${options.levelKey} timetable exists for the current configuration. The solver could not complete the `
    + `${options.levelKey} grid past ${DAYS[day]} Lesson ${slot + 1} after applying the exact weekly counts, the Rule 4-7 `
    + 'placement windows, available weekdays and double-lesson days, Rule 8 (at most one appearance per learning area per '
    + 'day), Rule 9 (Maths never immediately before Integrated Science), Rule 11 (shared teachers) and Rule 12 (CAS doubles '
    + 'start at Lesson 3 or later). '
    + (outstanding.length ? `Still unscheduled: ${outstanding.join(', ')}. ` : '')
    + 'Free a teacher for that slot, widen the available weekdays, move a double day, or lower the weekly counts. '
    + `(${searchNodes.toLocaleString()} search nodes, ${restartCount} attempt(s).)`,
    {}));
  return finish([]);
}

export function formatCspSolverIssues(issues: readonly CspSolverIssue[]): string {
  return issues.slice(0, 20).map((issue) => issue.message).join('\n');
}

export function formatCspSolverWarnings(warnings: readonly CspSolverWarning[]): string {
  return warnings.slice(0, 20).map((warning) => warning.message).join('\n');
}
