import {
  classifySubject,
  strictSubjectAllowsLesson,
  violatesMathScienceSequence,
} from './timetable-generator.ts';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const ALL_DAYS = [0, 1, 2, 3, 4];

export interface CspTimetableSolverOptions {
  schoolId: string;
  levelKey: string;
  classes: any[];
  assignments: any[];
  lessonSlots: any[];
  /** The brief requires a deep search; this is a node budget, not a timeout. */
  maxSearchNodesPerClass?: number;
  /** Teacher cells already reserved by another selected level in this school. */
  reservedTeacherCells?: ReadonlySet<string>;
  onProgress?: (message: string) => void;
  /** Internal recursion guard for the sequential class decomposition. */
  __singleClass?: boolean;
}

export interface CspSolverIssue {
  code: string;
  message: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
}

export interface CspTimetableSolverResult {
  entries: any[];
  issues: CspSolverIssue[];
  searchNodes: number;
  durationMs: number;
}

interface SubjectNeed {
  subjectId: string;
  subjectName: string;
  teacherId: string;
  lessons: number;
  availableDays: number[];
  doubleDays: number[];
  isDouble: boolean;
}

interface SolverUnit {
  id: number;
  classId: string;
  className: string;
  subjects: SubjectNeed[];
  size: 1 | 2;
  allowedDays: number[];
  groupKey: string;
  groupOrder: number;
}

interface Placement {
  day: number;
  start: number;
}

type CellUnitMap = Map<string, number>;
type TeacherCellMap = Map<string, number>;
type SubjectDayMap = Map<string, Set<number>>;

function normalizeName(value: unknown): string {
  return String(value ?? '').trim();
}

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
  return [...new Set(values.map(dayIndex).filter((day): day is number => day !== null))];
}

function allDaysIfEmpty(days: number[]): number[] {
  return days.length ? days : [...ALL_DAYS];
}

function isReligious(name: string): boolean {
  return /\bcre\b|\bire\b|\bhre\b|islamic|christian|hindu|muslim/i.test(name);
}

function isCas(name: string): boolean {
  return /\bcas\b|creative\s+arts?.*sports|arts?.*sports|creative\s+arts?/i.test(name);
}

function isScience(name: string): boolean {
  return classifySubject(name) === 'science';
}

function isMath(name: string): boolean {
  return classifySubject(name) === 'math';
}

function classCellKey(classId: string, day: number, lessonIndex: number): string {
  return `${classId}|${day}|${lessonIndex}`;
}

function teacherCellKey(teacherId: string, day: number, lessonIndex: number): string {
  return `${teacherId}|${day}|${lessonIndex}`;
}

function subjectDayKey(classId: string, subjectId: string): string {
  return `${classId}|${subjectId}`;
}

function lessonNumber(slot: any, index: number): number {
  const parsed = Number(String(slot?.label || '').match(/lesson\s+(\d+)/i)?.[1]);
  return Number.isFinite(parsed) ? parsed : index + 1;
}

function subjectNames(unit: SolverUnit): string[] {
  return unit.subjects.map((subject) => subject.subjectName);
}

function classSeed(classId: string): number {
  let hash = 0;
  for (const character of classId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

function unitHasMathScienceViolation(left: SolverUnit | undefined, right: SolverUnit | undefined): boolean {
  if (!left || !right) return false;
  return subjectNames(left).some((leftName) =>
    subjectNames(right).some((rightName) => violatesMathScienceSequence(leftName, rightName)),
  );
}

function intersectDays(left: number[], right: number[]): number[] {
  const r = new Set(right);
  return left.filter((day) => r.has(day));
}

function pairDays(left: SubjectNeed, right: SubjectNeed, double: boolean): number[] {
  const leftDays = allDaysIfEmpty(double ? left.doubleDays : left.availableDays);
  const rightDays = allDaysIfEmpty(double ? right.doubleDays : right.availableDays);
  return intersectDays(leftDays, rightDays);
}

function makeIssue(
  code: string,
  message: string,
  context: Partial<Pick<CspSolverIssue, 'classId' | 'className' | 'subjectId' | 'subjectName'>> = {},
): CspSolverIssue {
  return { code, message, ...context };
}

function preferredSlotScore(unit: SolverUnit, start: number, slots: any[]): number {
  const first = lessonNumber(slots[start], start);
  const names = subjectNames(unit).join(' ').toLowerCase();
  const seed = classSeed(unit.classId);
  const preferredInWindow = (low: number, high: number): number => {
    const desired = low + (seed % Math.max(1, high - low + 1));
    return Math.abs(first - desired) * 10 + first;
  };
  const casDouble = unit.size === 2 && isCas(names);
  if (casDouble) return first >= 5 ? 0 : 100 + first;
  if (/mathemat/.test(names)) return preferredInWindow(1, 4);
  if (/english/.test(names)) return preferredInWindow(2, 5);
  if (/integrated\s*science|\bscience\b|environment|pre[\s-]*technical|pre[\s-]*tech/.test(names)) {
    return first >= 2 && first <= 5 ? preferredInWindow(2, 5) : 30 + first;
  }
  if (/kiswahili/.test(names)) return first <= 7 ? preferredInWindow(1, 7) : 50 + first;
  return ((first - 1 + (seed % Math.max(1, slots.length))) % Math.max(1, slots.length)) + 1;
}

function legalStart(unit: SolverUnit, day: number, start: number, slots: any[]): boolean {
  if (!unit.allowedDays.includes(day)) return false;
  if (start < 0 || start + unit.size > slots.length) return false;
  if (unit.size === 2 && start < 2 && isCas(subjectNames(unit).join(' '))) return false;
  for (let offset = 0; offset < unit.size; offset += 1) {
    const n = lessonNumber(slots[start + offset], start + offset);
    if (!unit.subjects.every((subject) => strictSubjectAllowsLesson(subject.subjectName, n))) return false;
  }
  return true;
}

function buildUnitCandidates(
  unit: SolverUnit,
  slots: any[],
  grid: CellUnitMap,
  teacherAt: TeacherCellMap,
  subjectDays: SubjectDayMap,
  units: SolverUnit[],
  placed: Set<number>,
  placedAt: Map<number, Placement>,
  reservedTeacherCells: ReadonlySet<string>,
): Placement[] {
  const candidates: Placement[] = [];
  const predecessor = unit.groupOrder > 0
    ? units.find((candidate) => candidate.groupKey === unit.groupKey && candidate.groupOrder === unit.groupOrder - 1)
    : undefined;
  const predecessorPlacement = predecessor ? placedAt.get(predecessor.id) : undefined;
  if (predecessor && !predecessorPlacement) return candidates;
  for (const day of unit.allowedDays) {
    const blockedSubjectDay = unit.subjects.some((subject) =>
      subjectDays.get(subjectDayKey(unit.classId, subject.subjectId))?.has(day),
    );
    if (blockedSubjectDay) continue;
    for (let start = 0; start <= slots.length - unit.size; start += 1) {
      if (!legalStart(unit, day, start, slots)) continue;
      if (predecessorPlacement
        && (day < predecessorPlacement.day
          || (day === predecessorPlacement.day && start <= predecessorPlacement.start))) continue;
      let blocked = false;
      for (let offset = 0; offset < unit.size; offset += 1) {
        const cell = classCellKey(unit.classId, day, start + offset);
        if (grid.has(cell)) {
          blocked = true;
          break;
        }
        for (const subject of unit.subjects) {
          const teacherKey = teacherCellKey(subject.teacherId, day, start + offset);
          if (teacherAt.has(teacherKey) || reservedTeacherCells.has(teacherKey)) {
            blocked = true;
            break;
          }
        }
        if (blocked) break;
      }
      if (blocked) continue;

      const leftId = grid.get(classCellKey(unit.classId, day, start - 1));
      const rightId = grid.get(classCellKey(unit.classId, day, start + unit.size));
      const left = leftId == null ? undefined : units[leftId];
      const right = rightId == null ? undefined : units[rightId];
      if (unitHasMathScienceViolation(left, unit) || unitHasMathScienceViolation(unit, right)) continue;

      // `placed` is intentionally consulted to keep the function explicit about
      // search state; it also prevents an accidental self-neighbour check if a
      // future caller reuses a cell map while moving a unit.
      if (leftId != null && !placed.has(leftId)) continue;
      if (rightId != null && !placed.has(rightId)) continue;
      candidates.push({ day, start });
    }
  }
  return candidates.sort((a, b) =>
    preferredSlotScore(unit, a.start, slots) - preferredSlotScore(unit, b.start, slots)
      || a.day - b.day
      || a.start - b.start,
  );
}

function addUnit(
  units: SolverUnit[],
  classItem: any,
  subjects: SubjectNeed[],
  size: 1 | 2,
  allowedDays: number[],
  groupKey: string,
  groupOrder: number,
): void {
  units.push({
    id: units.length,
    classId: String(classItem.id),
    className: normalizeName(classItem.name) || `Class ${String(classItem.id)}`,
    subjects,
    size,
    allowedDays,
    groupKey,
    groupOrder,
  });
}

function normalizeAssignments(
  classes: any[],
  assignments: any[],
  issues: CspSolverIssue[],
): Map<string, SubjectNeed[]> {
  const classIds = new Set(classes.map((item) => String(item.id)));
  const byClass = new Map<string, SubjectNeed[]>();
  for (const cls of classes) byClass.set(String(cls.id), []);

  for (const assignment of assignments) {
    const classId = String(assignment.class_id || '');
    const subjectId = String(assignment.subject_id || '');
    const subjectName = normalizeName(assignment.subjects?.name || assignment.subject_name);
    const teacherId = String(assignment.teacher_id || '');
    const cls = classes.find((item) => String(item.id) === classId);
    if (!classIds.has(classId)) continue;
    if (!subjectId || !subjectName) {
      issues.push(makeIssue('missing-subject', `${cls?.name || classId} has an assignment without a real subject.`, {
        classId,
        className: cls?.name,
      }));
      continue;
    }
    if (!teacherId) {
      issues.push(makeIssue('missing-teacher', `${cls?.name || classId} / ${subjectName} has no teacher assigned.`, {
        classId,
        className: cls?.name,
        subjectId,
        subjectName,
      }));
      continue;
    }
    const lessons = Number(assignment.lessons_per_week);
    if (!Number.isInteger(lessons) || lessons <= 0) {
      issues.push(makeIssue('invalid-lesson-count', `${cls?.name || classId} / ${subjectName} has an invalid weekly lesson count (${String(assignment.lessons_per_week)}).`, {
        classId,
        className: cls?.name,
        subjectId,
        subjectName,
      }));
      continue;
    }
    const records = byClass.get(classId)!;
    if (records.some((record) => record.subjectId === subjectId)) {
      issues.push(makeIssue('duplicate-assignment', `${cls?.name || classId} has more than one active assignment for ${subjectName}; combine it into one exact weekly count.`, {
        classId,
        className: cls?.name,
        subjectId,
        subjectName,
      }));
      continue;
    }
    records.push({
      subjectId,
      subjectName,
      teacherId,
      lessons,
      availableDays: parseDays(assignment.available_days),
      doubleDays: parseDays(assignment.double_lesson_days),
      isDouble: Boolean(assignment.is_double_lesson),
    });
  }
  return byClass;
}

function buildUnits(
  classes: any[],
  byClass: Map<string, SubjectNeed[]>,
  lessonSlots: any[],
  issues: CspSolverIssue[],
): SolverUnit[] {
  const units: SolverUnit[] = [];
  for (const cls of classes) {
    const classId = String(cls.id);
    const records = byClass.get(classId) || [];
    const classIssues = issues.filter((issue) => issue.classId === classId);
    if (classIssues.length > 0) continue;

    const religious = records.filter((record) => isReligious(record.subjectName));
    let pairedIds = new Set<string>();
    if (religious.length >= 2) {
      if (religious.length !== 2) {
        issues.push(makeIssue('religious-pairing', `${cls.name || classId} offers more than two religious options; pair exactly one IRE and one CRE assignment.`, {
          classId,
          className: cls.name,
        }));
      } else {
        const [left, right] = religious;
        if (left.lessons !== right.lessons) {
          issues.push(makeIssue('religious-count-mismatch', `${cls.name || classId} requires ${left.subjectName} ${left.lessons} times and ${right.subjectName} ${right.lessons} times, so Rule 10 cannot pair them exactly.`, {
            classId,
            className: cls.name,
          }));
        } else if (left.teacherId === right.teacherId) {
          issues.push(makeIssue('religious-teacher-collision', `${cls.name || classId} assigns the same teacher to ${left.subjectName} and ${right.subjectName}; Rule 10 would put that teacher in two subjects at one slot.`, {
            classId,
            className: cls.name,
          }));
        } else {
          pairedIds = new Set([left.subjectId, right.subjectId]);
          const pairCount = left.lessons;
          for (let index = 0; index < pairCount; index += 1) {
            const isDouble = index === 0 && (left.isDouble || right.isDouble);
            const days = pairDays(left, right, isDouble);
            addUnit(units, cls, [left, right], isDouble ? 2 : 1, days, `${classId}|religious-pair`, index);
          }
        }
      }
    }

    for (const record of records) {
      if (pairedIds.has(record.subjectId)) continue;
      if (record.isDouble && record.lessons < 2) {
        issues.push(makeIssue('double-count', `${cls.name || classId} / ${record.subjectName} is marked as a double lesson but has only ${record.lessons} weekly lesson. A double needs at least two lessons.`, {
          classId,
          className: cls.name,
          subjectId: record.subjectId,
          subjectName: record.subjectName,
        }));
        continue;
      }
      const availableDays = allDaysIfEmpty(record.availableDays);
      const doubleDays = record.doubleDays.length ? record.doubleDays : availableDays;
      if (record.isDouble) {
        addUnit(units, cls, [record], 2, doubleDays, `${classId}|${record.subjectId}|double`, 0);
        for (let index = 0; index < record.lessons - 2; index += 1) {
          addUnit(units, cls, [record], 1, availableDays, `${classId}|${record.subjectId}|single`, index);
        }
      } else {
        for (let index = 0; index < record.lessons; index += 1) {
          addUnit(units, cls, [record], 1, availableDays, `${classId}|${record.subjectId}|single`, index);
        }
      }
    }

    const rawTotal = records.reduce((sum, record) => sum + record.lessons, 0);
    const expectedCells = lessonSlots.length * DAYS.length;
    if (rawTotal !== expectedCells) {
      const difference = rawTotal - expectedCells;
      issues.push(makeIssue('level-total', `${cls.name || classId} has ${rawTotal} configured subject lessons but the level requires exactly ${expectedCells} lesson slots (${difference > 0 ? `${difference} over` : `${Math.abs(difference)} under`}).`, {
        classId,
        className: cls.name,
      }));
    }

    for (const record of records) {
      const unitCount = record.isDouble ? record.lessons - 1 : record.lessons;
      const dayCapacity = record.isDouble && record.doubleDays.length ? record.doubleDays.length : allDaysIfEmpty(record.availableDays).length;
      if (unitCount > dayCapacity) {
        issues.push(makeIssue('day-capacity', `${cls.name || classId} / ${record.subjectName} needs ${record.lessons} lessons but Rule 8 permits only ${dayCapacity} subject-days under its available-day configuration.`, {
          classId,
          className: cls.name,
          subjectId: record.subjectId,
          subjectName: record.subjectName,
        }));
      }
      if (record.isDouble && record.doubleDays.length && !intersectDays(record.doubleDays, record.availableDays.length ? record.availableDays : ALL_DAYS).length) {
        issues.push(makeIssue('double-day-window', `${cls.name || classId} / ${record.subjectName} has double-lesson days that do not overlap its available weekdays.`, {
          classId,
          className: cls.name,
          subjectId: record.subjectId,
          subjectName: record.subjectName,
        }));
      }
    }
  }
  return units;
}

function preflightUnits(
  classes: any[],
  units: SolverUnit[],
  lessonSlots: any[],
  byClass: Map<string, SubjectNeed[]>,
  issues: CspSolverIssue[],
): void {
  const expectedCells = lessonSlots.length * DAYS.length;
  for (const cls of classes) {
    const classId = String(cls.id);
    const records = byClass.get(classId) || [];
    if (!records.length) {
      issues.push(makeIssue('missing-assignments', `${cls.name || classId} has no active teacher assignments.`, {
        classId,
        className: cls.name,
      }));
    }
    const classUnits = units.filter((unit) => unit.classId === classId);
    const occupiedCells = classUnits.reduce((sum, unit) => sum + unit.size, 0);
    if (occupiedCells !== expectedCells) {
      issues.push(makeIssue('effective-capacity', `${cls.name || classId} can occupy ${occupiedCells} cells after applying exact counts and any IRE/CRE sharing, but ${expectedCells} cells are required.`, {
        classId,
        className: cls.name,
      }));
    }
    for (const unit of classUnits) {
      const domain = [] as Placement[];
      for (const day of unit.allowedDays) {
        for (let start = 0; start <= lessonSlots.length - unit.size; start += 1) {
          if (legalStart(unit, day, start, lessonSlots)) domain.push({ day, start });
        }
      }
      if (!domain.length) {
        const names = subjectNames(unit).join(' + ');
        issues.push(makeIssue(
          unit.size === 2 ? 'double-window' : 'subject-window',
          `${unit.className} / ${names} has no legal ${unit.size === 2 ? 'consecutive double' : 'lesson'} position after applying subject windows, available weekdays, and CAS restrictions.`,
          {
            classId,
            className: unit.className,
            subjectName: names,
          },
        ));
      }
    }
  }

  const teacherDemand = new Map<string, number>();
  const teacherDays = new Map<string, Set<number>>();
  for (const unit of units) {
    for (const subject of unit.subjects) {
      teacherDemand.set(subject.teacherId, (teacherDemand.get(subject.teacherId) || 0) + unit.size);
      const set = teacherDays.get(subject.teacherId) || new Set<number>();
      unit.allowedDays.forEach((day) => set.add(day));
      teacherDays.set(subject.teacherId, set);
    }
  }
  const teacherCapacity = expectedCells;
  for (const [teacherId, demand] of teacherDemand) {
    if (demand > teacherCapacity) {
      issues.push(makeIssue('teacher-capacity', `Teacher ${teacherId} is assigned ${demand} lesson cells, but only ${teacherCapacity} weekly cells exist at this level; teacher collisions are mathematically unavoidable.`, {}));
    }
    if (!teacherDays.get(teacherId)?.size) {
      issues.push(makeIssue('teacher-availability', `Teacher ${teacherId} has no available weekday for the active assignments.`, {}));
    }
  }
}

function formatIssue(issue: CspSolverIssue): string {
  return issue.message;
}

export function solveTimetableCsp(options: CspTimetableSolverOptions): CspTimetableSolverResult {
  const startedAt = Date.now();
  const issues: CspSolverIssue[] = [];
  const slots = options.lessonSlots
    .filter((slot) => slot?.slot_type === 'lesson')
    .slice()
    // Some live schools have stale slot_order values (for example Lesson 6,
    // 7, 8, then 1–5). The label is the authoritative lesson identity for
    // windows and adjacency; using slot_order here makes doubles and core
    // subject placement search the wrong timeline.
    .sort((a, b) => lessonNumber(a, Number(a.slot_order) || 0) - lessonNumber(b, Number(b.slot_order) || 0));
  if (!options.classes.length) issues.push(makeIssue('missing-classes', 'No active classes were supplied for this level.'));
  if (!slots.length) issues.push(makeIssue('missing-slots', `No lesson slots were supplied for ${options.levelKey}.`));
  if (slots.length && slots.length > 9) issues.push(makeIssue('invalid-slot-count', `${options.levelKey} has ${slots.length} lesson slots per day; the solver supports up to 9 explicit lesson slots.`));
  if (issues.length) return { entries: [], issues, searchNodes: 0, durationMs: Date.now() - startedAt };

  const byClass = normalizeAssignments(options.classes, options.assignments, issues);
  const units = buildUnits(options.classes, byClass, slots, issues);
  preflightUnits(options.classes, units, slots, byClass, issues);
  if (issues.length) return { entries: [], issues, searchNodes: 0, durationMs: Date.now() - startedAt };

  // A global search across several classes creates a large symmetry tree even
  // when each class is independently feasible. Solve one class at a time and
  // carry forward the occupied teacher cells; this preserves cross-class
  // collision rules while keeping the search bounded by the hard instance.
  if (!options.__singleClass && options.classes.length > 1) {
    const orderedClasses = [...options.classes].sort((left, right) => {
      const leftUnits = units.filter((unit) => unit.classId === String(left.id));
      const rightUnits = units.filter((unit) => unit.classId === String(right.id));
      return rightUnits.length - leftUnits.length || String(left.name).localeCompare(String(right.name));
    });
    const reserved = new Set(options.reservedTeacherCells || []);
    const allEntries: any[] = [];
    const allIssues: CspSolverIssue[] = [];
    let totalNodes = 0;
    for (const cls of orderedClasses) {
      const result = solveTimetableCsp({
        ...options,
        __singleClass: true,
        classes: [cls],
        assignments: options.assignments.filter((assignment) => String(assignment.class_id) === String(cls.id)),
        reservedTeacherCells: reserved,
      });
      totalNodes += result.searchNodes;
      if (result.issues.length) {
        allIssues.push(...result.issues);
        return { entries: [], issues: allIssues, searchNodes: totalNodes, durationMs: Date.now() - startedAt };
      }
      allEntries.push(...result.entries);
      for (const entry of result.entries) {
        const lessonIndex = slots.findIndex((slot) => String(slot.id) === String(entry.time_slot_id));
        if (lessonIndex < 0) continue;
        reserved.add(teacherCellKey(String(entry.teacher_id), Number(entry.day_of_week) - 1, lessonIndex));
      }
    }
    return { entries: allEntries, issues: [], searchNodes: totalNodes, durationMs: Date.now() - startedAt };
  }

  const maxNodes = options.maxSearchNodesPerClass
    ? Math.max(500_000, options.maxSearchNodesPerClass * Math.max(1, options.classes.length))
    : Number.POSITIVE_INFINITY;
  const grid: CellUnitMap = new Map();
  const teacherAt: TeacherCellMap = new Map();
  const subjectDays: SubjectDayMap = new Map();
  const placedAt = new Map<number, Placement>();
  const reservedTeacherCells = options.reservedTeacherCells || new Set<string>();
  const remaining = new Set(units.map((unit) => unit.id));
  let searchNodes = 0;
  let aborted = false;
  let lastDeadEnd: SolverUnit | undefined;

  const place = (unit: SolverUnit, placement: Placement): void => {
    for (let offset = 0; offset < unit.size; offset += 1) {
      grid.set(classCellKey(unit.classId, placement.day, placement.start + offset), unit.id);
      for (const subject of unit.subjects) {
        teacherAt.set(teacherCellKey(subject.teacherId, placement.day, placement.start + offset), unit.id);
      }
    }
    for (const subject of unit.subjects) {
      const key = subjectDayKey(unit.classId, subject.subjectId);
      const days = subjectDays.get(key) || new Set<number>();
      days.add(placement.day);
      subjectDays.set(key, days);
    }
    placedAt.set(unit.id, placement);
  };

  const unplace = (unit: SolverUnit, placement: Placement): void => {
    for (let offset = 0; offset < unit.size; offset += 1) {
      grid.delete(classCellKey(unit.classId, placement.day, placement.start + offset));
      for (const subject of unit.subjects) {
        teacherAt.delete(teacherCellKey(subject.teacherId, placement.day, placement.start + offset));
      }
    }
    for (const subject of unit.subjects) {
      const key = subjectDayKey(unit.classId, subject.subjectId);
      const days = subjectDays.get(key);
      days?.delete(placement.day);
    }
    placedAt.delete(unit.id);
  };

  const progress = (message: string): void => {
    if (options.onProgress) options.onProgress(message);
  };

  const search = (): boolean => {
    if (remaining.size === 0) return true;
    searchNodes += 1;
    if (searchNodes > maxNodes) {
      aborted = true;
      return false;
    }
    if (searchNodes % 5000 === 0) progress(`Solving ${options.levelKey}: ${searchNodes.toLocaleString()} search nodes, ${remaining.size} units remaining...`);

    let best: SolverUnit | undefined;
    let bestCandidates: Placement[] = [];
    for (const id of remaining) {
      const unit = units[id];
      const predecessor = unit.groupOrder > 0
        ? units.find((candidate) => candidate.groupKey === unit.groupKey && candidate.groupOrder === unit.groupOrder - 1)
        : undefined;
      if (predecessor && !placedAt.has(predecessor.id)) continue;
      const candidates = buildUnitCandidates(
        unit,
        slots,
        grid,
        teacherAt,
        subjectDays,
        units,
        new Set(units.map((candidate) => candidate.id).filter((candidateId) => !remaining.has(candidateId))),
        placedAt,
        reservedTeacherCells,
      );
      if (!candidates.length) {
        lastDeadEnd = unit;
        return false;
      }
      if (!best || candidates.length < bestCandidates.length
        || (candidates.length === bestCandidates.length && unit.size > best.size)
        || (candidates.length === bestCandidates.length && unit.size === best.size && unit.groupKey < best.groupKey)) {
        best = unit;
        bestCandidates = candidates;
      }
    }
    if (!best) return false;
    remaining.delete(best.id);
    for (const candidate of bestCandidates) {
      place(best, candidate);
      if (search()) return true;
      unplace(best, candidate);
      if (aborted) break;
    }
    remaining.add(best.id);
    return false;
  };

  progress(`Solving ${options.levelKey}: ${options.classes.length} classes, ${units.length} atomic lesson units...`);
  const solved = search();
  if (!solved) {
    const unitDescription = lastDeadEnd
      ? `${lastDeadEnd.className} / ${subjectNames(lastDeadEnd).join(' + ')} had no remaining legal position after enforcing exact counts, subject windows, available weekdays, no same-day duplicates, teacher collisions, double adjacency, and Maths→Integrated Science adjacency.`
      : `the solver exhausted ${searchNodes.toLocaleString()} search nodes while enforcing exact counts, subject windows, available weekdays, no same-day duplicates, teacher collisions, double adjacency, and Maths→Integrated Science adjacency.`;
    issues.push(makeIssue(
      aborted ? 'search-budget-exhausted' : 'proven-impossible',
      `No valid timetable exists for ${options.levelKey} under the configured hard rules: ${unitDescription} ${aborted ? `The deep-search budget of ${maxNodes.toLocaleString()} nodes was exhausted; inspect the named class/subject and teacher availability rather than saving a partial grid.` : 'The search fully explored the remaining legal placements.'}`,
      lastDeadEnd ? { classId: lastDeadEnd.classId, className: lastDeadEnd.className, subjectName: subjectNames(lastDeadEnd).join(' + ') } : {},
    ));
    return { entries: [], issues, searchNodes, durationMs: Date.now() - startedAt };
  }

  const entries: any[] = [];
  for (const cls of options.classes) {
    const classId = String(cls.id);
    for (let day = 0; day < DAYS.length; day += 1) {
      for (let lessonIndex = 0; lessonIndex < slots.length; lessonIndex += 1) {
        const unitId = grid.get(classCellKey(classId, day, lessonIndex));
        if (unitId == null) {
          issues.push(makeIssue('blank-cell', `${normalizeName(cls.name) || classId} has an unfilled ${DAYS[day]} Lesson ${lessonNumber(slots[lessonIndex], lessonIndex)} after solving.`, {
            classId,
            className: cls.name,
          }));
          continue;
        }
        const unit = units[unitId];
        for (const subject of unit.subjects) {
          entries.push({
            school_id: options.schoolId,
            class_id: classId,
            day_of_week: day + 1,
            time_slot_id: slots[lessonIndex].id,
            subject_id: subject.subjectId,
            teacher_id: subject.teacherId,
            entry_type: unit.size === 2 ? 'lesson_double' : 'lesson',
            level_group: options.levelKey,
            effective_start_time: slots[lessonIndex].start_time,
            effective_end_time: slots[lessonIndex].end_time,
          });
        }
      }
    }
  }
  if (issues.length) return { entries: [], issues, searchNodes, durationMs: Date.now() - startedAt };
  progress(`Solved ${options.levelKey}: ${entries.length} timetable entries with exact weekly counts.`);
  return { entries, issues: [], searchNodes, durationMs: Date.now() - startedAt };
}

export function formatCspSolverIssues(issues: readonly CspSolverIssue[]): string {
  return issues.slice(0, 20).map(formatIssue).join('\n');
}
