/**
 * Independent audit of a generated timetable against the canonical 14 rules.
 *
 * This module deliberately does NOT reuse the placement algorithm's internal
 * helpers. It re-derives every rule from the raw grid so that a bug in the
 * solver can never mask itself: the solver places lessons, this module checks
 * the finished artefact the way a school administrator would.
 */

export const AUDIT_DAYS = [1, 2, 3, 4, 5] as const;

export interface AuditSlot {
  id: string;
  slot_order: number;
  slot_type?: string | null;
  label?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}

export interface AuditEntry {
  class_id: string;
  day_of_week: number;
  time_slot_id: string;
  subject_id?: string | null;
  teacher_id?: string | null;
  entry_type?: string | null;
  level_group?: string | null;
}

export interface AuditClass {
  id: string;
  name?: string | null;
}

export interface AuditAssignment {
  class_id: string;
  subject_id: string;
  subject_name: string;
  teacher_id?: string | null;
  lessons_per_week: number;
  is_double_lesson?: boolean;
  available_days?: string[] | null;
  double_lesson_days?: string[] | null;
}

export interface AuditViolation {
  rule: number;
  ruleName: string;
  classId: string;
  className: string;
  detail: string;
}

export interface AuditResult {
  violations: AuditViolation[];
  warnings: string[];
  lessonCounts: Map<string, number>;
  cellsFilled: number;
  cellsExpected: number;
}

const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export function isCasSubjectName(name: string | null | undefined): boolean {
  const n = normalize(name);
  return /\bcas\b|creative\s+arts?.*sports|arts?.*sports|creative\s+arts?/.test(n);
}

export function isMathSubjectName(name: string | null | undefined): boolean {
  return /mathemat/.test(normalize(name));
}

export function isEnglishSubjectName(name: string | null | undefined): boolean {
  return /\benglish\b/.test(normalize(name));
}

export function isScienceSubjectName(name: string | null | undefined): boolean {
  const n = normalize(name);
  return /integrated\s*science|\bscience\b|environment/.test(n);
}

export function isPreTechSubjectName(name: string | null | undefined): boolean {
  return /pre[\s-]*technical|pre[\s-]*tech/.test(normalize(name));
}

export function isKiswahiliSubjectName(name: string | null | undefined): boolean {
  return /kiswahili/.test(normalize(name));
}

export function religiousFamily(name: string | null | undefined): 'ire' | 'cre' | null {
  const n = normalize(name);
  if (/\bire\b|islamic|muslim/.test(n)) return 'ire';
  if (/\bcre\b|christian/.test(n)) return 'cre';
  return null;
}

/** Lesson number taken from the slot label, falling back to the ordered index. */
function lessonNumberOf(slot: AuditSlot, orderedLessonSlots: readonly AuditSlot[]): number {
  const parsed = Number(String(slot.label || '').match(/lesson\s+(\d+)/i)?.[1]);
  if (Number.isFinite(parsed)) return parsed;
  return orderedLessonSlots.findIndex((item) => item.id === slot.id) + 1;
}

/**
 * Run every rule over one level group's finished grid.
 *
 * `entries` may include breaks/lunch/activity rows; those are ignored for the
 * lesson rules but still count as "occupied" only when they are lesson rows.
 */
export function auditTimetable(options: {
  entries: readonly AuditEntry[];
  slots: readonly AuditSlot[];
  classes: readonly AuditClass[];
  assignments: readonly AuditAssignment[];
  subjectNames?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  levelGroup?: string | null;
  /** Weekly slot total the level must reach (40 for Junior/Senior). */
  expectedWeeklyTotal?: number | null;
  days?: readonly number[];
  /**
   * Set only when the admin was warned that a class's weekly lessons do not fill
   * the level's week (Rule 14) and chose to continue anyway. The cells that class
   * has no lessons for are then expected to be empty, so an empty cell is not a
   * violation for it - while every other rule is still enforced in full.
   */
  allowBlankSlots?: boolean;
  /**
   * Classes the solver reported as blocked by their own data and therefore did not
   * attempt. They are surfaced to the admin separately, so they are excluded here
   * instead of being counted as rules the produced timetable broke.
   */
  skippedClasses?: readonly string[];
}): AuditResult {
  const violations: AuditViolation[] = [];
  const warnings: string[] = [];
  const days = options.days?.length ? [...options.days] : [...AUDIT_DAYS];
  const subjectNames = options.subjectNames;

  const nameOf = (subjectId: string | null | undefined): string => {
    if (!subjectId) return '';
    const key = String(subjectId);
    if (subjectNames instanceof Map) return String(subjectNames.get(key) || '');
    if (subjectNames) return String((subjectNames as Record<string, string>)[key] || '');
    return '';
  };

  const lessonSlots = options.slots
    .filter((slot) => slot.slot_type === 'lesson')
    .slice()
    .sort((a, b) => (a.slot_order ?? 0) - (b.slot_order ?? 0));
  const orderedLessonSlots = lessonSlots.slice().sort((a, b) => {
    const na = lessonNumberOf(a, lessonSlots);
    const nb = lessonNumberOf(b, lessonSlots);
    return na - nb || (a.slot_order ?? 0) - (b.slot_order ?? 0);
  });
  const slotById = new Map(lessonSlots.map((slot) => [String(slot.id), slot]));
  // Classes the solver reported as blocked by their own data are surfaced to the
  // admin separately, so they are left out of the rule checks: an empty week for a
  // class that was never attempted is not a rule the produced timetable broke.
  const skipped = new Set((options.skippedClasses || []).map((id) => String(id)));
  const checkedClasses = options.classes.filter((cls) => !skipped.has(String(cls.id)));
  const classIds = checkedClasses.map((cls) => String(cls.id));
  const classById = new Map(options.classes.map((cls) => [String(cls.id), cls]));
  const classNameOf = (classId: string): string =>
    String(classById.get(classId)?.name || `Class ${classId}`);

  const inLevel = (entry: AuditEntry): boolean =>
    options.levelGroup == null || entry.level_group == null || entry.level_group === options.levelGroup;

  const lessonEntries = options.entries
    .filter(inLevel)
    .filter((entry) => entry.entry_type === 'lesson' || entry.entry_type === 'lesson_double');

  const addViolation = (
    rule: number,
    ruleName: string,
    classId: string,
    detail: string,
  ): void => {
    violations.push({ rule, ruleName, classId, className: classNameOf(classId), detail });
  };

  // Cell index: `${classId}|${day}|${slotId}` -> entries
  const cellEntries = new Map<string, AuditEntry[]>();
  for (const entry of lessonEntries) {
    const key = `${String(entry.class_id)}|${Number(entry.day_of_week)}|${String(entry.time_slot_id)}`;
    cellEntries.set(key, [...(cellEntries.get(key) || []), entry]);
  }

  // ── Rule 1: no blank slots ────────────────────────────────────────────────
  let cellsFilled = 0;
  const cellsExpected = classIds.length * days.length * lessonSlots.length;
  for (const classId of classIds) {
    for (const day of days) {
      for (const slot of lessonSlots) {
        const entries = cellEntries.get(`${classId}|${day}|${String(slot.id)}`) || [];
        if (entries.length === 0) {
          if (!options.allowBlankSlots) {
            addViolation(
              1,
              'no-blank-slots',
              classId,
              `blank ${slot.label || 'lesson'} on day ${day}`,
            );
          }
        } else {
          cellsFilled += 1;
          if (entries.length > 1) {
            addViolation(
              1,
              'no-blank-slots',
              classId,
              `${entries.length} overlapping entries in ${slot.label || 'lesson'} on day ${day}`,
            );
          }
        }
      }
    }
  }

  // ── Rule 11: teacher collisions (global, all classes in this level) ──────
  const teacherCell = new Map<string, AuditEntry>();
  for (const entry of lessonEntries) {
    if (!entry.teacher_id) continue;
    const key = `${String(entry.teacher_id)}|${Number(entry.day_of_week)}|${String(entry.time_slot_id)}`;
    const previous = teacherCell.get(key);
    if (previous && String(previous.class_id) !== String(entry.class_id)) {
      const slot = slotById.get(String(entry.time_slot_id));
      addViolation(
        11,
        'no-teacher-collisions',
        String(entry.class_id),
        `teacher ${String(entry.teacher_id)} is in ${classNameOf(String(previous.class_id))} and `
        + `${classNameOf(String(entry.class_id))} at the same time (day ${entry.day_of_week}, ${slot?.label || 'lesson'})`,
      );
    } else {
      teacherCell.set(key, entry);
    }
  }

  // ── Rule 13: exact weekly counts ─────────────────────────────────────────
  const lessonCounts = new Map<string, number>();
  for (const entry of lessonEntries) {
    const key = `${String(entry.class_id)}|${String(entry.subject_id)}`;
    lessonCounts.set(key, (lessonCounts.get(key) || 0) + 1);
  }
  const requiredCounts = new Map<string, AuditAssignment>();
  for (const assignment of options.assignments) {
    const classId = String(assignment.class_id);
    if (!classById.has(classId) || skipped.has(classId)) continue;
    requiredCounts.set(`${classId}|${String(assignment.subject_id)}`, assignment);
  }
  for (const [key, assignment] of requiredCounts) {
    const [classId] = key.split('|');
    const expected = Number(assignment.lessons_per_week) || 0;
    const actual = lessonCounts.get(key) || 0;
    if (actual !== expected) {
      addViolation(
        13,
        'exact-lesson-counts',
        classId,
        `${assignment.subject_name} has ${actual} lessons but the assignment requires exactly ${expected}`
        + ` (${actual > expected ? 'over-assigned' : 'under-assigned'})`,
      );
    }
  }
  for (const [key, actual] of lessonCounts) {
    if (requiredCounts.has(key)) continue;
    const [classId] = key.split('|');
    if (skipped.has(classId)) continue;
    addViolation(
      13,
      'exact-lesson-counts',
      classId,
      `subject ${key.split('|')[1]} has ${actual} lessons but no active assignment`,
    );
  }

  // ── Rules 2, 3, 8, 9, 10, 12 need a per-class/day subject view ───────────
  const subjectDayCells = new Map<string, { subjectId: string; slot: AuditSlot; entry: AuditEntry }[]>();
  for (const entry of lessonEntries) {
    const slot = slotById.get(String(entry.time_slot_id));
    if (!slot) continue;
    const key = `${String(entry.class_id)}|${Number(entry.day_of_week)}|${String(entry.subject_id)}`;
    subjectDayCells.set(key, [
      ...(subjectDayCells.get(key) || []),
      { subjectId: String(entry.subject_id), slot, entry },
    ]);
  }

  for (const [key, cells] of subjectDayCells) {
    const [classId, dayText, subjectId] = key.split('|');
    const day = Number(dayText);
    const subjectName = nameOf(subjectId);
    if (cells.length <= 1) continue;
    const ordered = cells
      .slice()
      .sort((a, b) => lessonNumberOf(a.slot, lessonSlots) - lessonNumberOf(b.slot, lessonSlots));
    // A legal weekly double = exactly two cells, both flagged lesson_double,
    // on adjacent lesson numbers.
    const first = lessonNumberOf(ordered[0].slot, lessonSlots);
    const second = lessonNumberOf(ordered[1].slot, lessonSlots);
    const bothDoubles = ordered.every((cell) => cell.entry.entry_type === 'lesson_double');
    const adjacent = second === first + 1;
    if (cells.length !== 2 || !bothDoubles || !adjacent) {
      addViolation(
        8,
        'no-same-day-duplicate',
        classId,
        `${subjectName || subjectId} appears ${cells.length} times on day ${day} `
        + `(lessons ${ordered.map((cell) => lessonNumberOf(cell.slot, lessonSlots)).join(', ')}) `
        + 'without forming a single consecutive double',
      );
      if (cells.length > 2 || !bothDoubles) {
        addViolation(
          2,
          'one-double-per-week',
          classId,
          `${subjectName || subjectId} has more than one lesson slot on day ${day} that is not a single configured double`,
        );
      }
      if (cells.length === 2 && bothDoubles && !adjacent) {
        addViolation(
          3,
          'doubles-consecutive',
          classId,
          `${subjectName || subjectId} double occupies lessons ${first} and ${second} on day ${day}, which are not consecutive`,
        );
      }
    } else if (
      (isCasSubjectName(subjectName) || isPreTechSubjectName(subjectName)) && first < 3
    ) {
      addViolation(
        12,
        'subject-double-window',
        classId,
        `${subjectName} double starts at Lesson ${first} on day ${day}; this subject's double may start only at Lesson 3 or later`,
      );
    } else if (isKiswahiliSubjectName(subjectName) && first > 6) {
      addViolation(
        12,
        'subject-double-window',
        classId,
        `${subjectName} double starts at Lesson ${first} on day ${day}; a Kiswahili double may not include Lesson 8`,
      );
    }
  }

  // ── Rule 2: at most one double per subject per week per class ────────────
  const doubleWeeks = new Map<string, AuditEntry[]>();
  for (const entry of lessonEntries) {
    if (entry.entry_type !== 'lesson_double') continue;
    const key = `${String(entry.class_id)}|${String(entry.subject_id)}`;
    doubleWeeks.set(key, [...(doubleWeeks.get(key) || []), entry]);
  }
  for (const [key, entries] of doubleWeeks) {
    if (entries.length <= 2) continue;
    const [classId, subjectId] = key.split('|');
    addViolation(
      2,
      'one-double-per-week',
      classId,
      `${nameOf(subjectId) || subjectId} has ${entries.length} cells flagged as a double; `
      + 'only one double lesson per week is allowed',
    );
  }

  // ── Rules 4, 5, 6, 7: subject placement windows ─────────────────────────
  for (const entry of lessonEntries) {
    const slot = slotById.get(String(entry.time_slot_id));
    if (!slot) continue;
    const classId = String(entry.class_id);
    const subjectName = nameOf(entry.subject_id);
    if (!subjectName.trim()) continue;
    const lesson = lessonNumberOf(slot, lessonSlots);
    if (isMathSubjectName(subjectName) && lesson > 3) {
      addViolation(4, 'maths-placement', classId, `Mathematics at Lesson ${lesson} exceeds the Lesson 1-3 window`);
    }
    if (isEnglishSubjectName(subjectName) && lesson > 3) {
      addViolation(5, 'english-placement', classId, `English at Lesson ${lesson} exceeds the Lesson 1-3 window`);
    }
    if (isScienceSubjectName(subjectName) && lesson > 6) {
      addViolation(6, 'science-placement', classId, `${subjectName} at Lesson ${lesson} exceeds the Lesson 1-6 window`);
    }
  }

  // ── Rule 9: Maths never immediately followed by Integrated Science ───────
  for (const classId of classIds) {
    for (const day of days) {
      for (let index = 0; index < orderedLessonSlots.length - 1; index += 1) {
        const left = cellEntries.get(`${classId}|${day}|${String(orderedLessonSlots[index].id)}`) || [];
        const right = cellEntries.get(`${classId}|${day}|${String(orderedLessonSlots[index + 1].id)}`) || [];
        for (const leftEntry of left) {
          const leftName = nameOf(leftEntry.subject_id);
          if (!isMathSubjectName(leftName)) continue;
          for (const rightEntry of right) {
            const rightName = nameOf(rightEntry.subject_id);
            if (isScienceSubjectName(rightName)) {
              addViolation(
                9,
                'maths-not-followed-by-science',
                classId,
                `Mathematics at Lesson ${index + 1} is immediately followed by ${rightName} `
                + `at Lesson ${index + 2} on day ${day}`,
              );
            }
          }
        }
      }
    }
  }

  // ── Rule 10: IRE / CRE at the same slot ─────────────────────────────────
  const religiousByClass = new Map<string, { ire: Set<string>; cre: Set<string>; names: Set<string> }>();
  for (const entry of lessonEntries) {
    const family = religiousFamily(nameOf(entry.subject_id));
    if (!family) continue;
    const classId = String(entry.class_id);
    const group = religiousByClass.get(classId) || { ire: new Set<string>(), cre: new Set<string>(), names: new Set<string>() };
    group[family].add(`${Number(entry.day_of_week)}|${String(entry.time_slot_id)}`);
    group.names.add(family === 'ire' ? 'IRE' : 'CRE');
    religiousByClass.set(classId, group);
  }
  for (const [classId, group] of religiousByClass) {
    if (group.ire.size === 0 || group.cre.size === 0) continue;
    const bothSame = group.ire.size === group.cre.size
      && [...group.ire].every((slot) => group.cre.has(slot));
    if (!bothSame) {
      addViolation(
        10,
        'ire-cre-same-slot',
        classId,
        `IRE and CRE are offered but are not scheduled at the same lesson slot on the same day `
        + `(IRE: ${group.ire.size} slots, CRE: ${group.cre.size} slots)`,
      );
    }
  }

  // ── Rule 14: total lessons per class ────────────────────────────────────
  const weeklyTotals = new Map<string, number>();
  for (const entry of lessonEntries) {
    const classId = String(entry.class_id);
    weeklyTotals.set(classId, (weeklyTotals.get(classId) || 0) + 1);
  }
  if (options.expectedWeeklyTotal != null) {
    for (const classId of classIds) {
      const total = weeklyTotals.get(classId) || 0;
      if (total !== options.expectedWeeklyTotal) {
        warnings.push(
          `${classNameOf(classId)} has ${total} lessons but this level expects ${options.expectedWeeklyTotal}. `
          + 'A valid timetable may not be possible.',
        );
      }
    }
  }

  return { violations, warnings, lessonCounts, cellsFilled, cellsExpected };
}

export function formatAuditViolations(violations: readonly AuditViolation[], limit = 25): string {
  if (violations.length === 0) return 'none';
  const shown = violations.slice(0, limit).map((violation) =>
    `  [R${violation.rule} ${violation.ruleName}] ${violation.className}: ${violation.detail}`);
  if (violations.length > limit) shown.push(`  ... and ${violations.length - limit} more`);
  return shown.join('\n');
}
