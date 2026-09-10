import { isFillerSubject, strictSubjectAllowsLesson, violatesMathScienceSequence } from './timetable-generator';

export interface TimetableValidationSlot {
  id: string | number;
  slot_order: number;
  slot_type?: string | null;
  label?: string | null;
}

export interface TimetableValidationEntry {
  class_id: string | number;
  day_of_week: number;
  time_slot_id: string | number;
  subject_id?: string | number | null;
  teacher_id?: string | number | null;
  entry_type?: string | null;
  level_group?: string | null;
}

export interface TimetableValidationClass {
  id: string | number;
  name?: string | null;
}

export interface TimetableValidationOptions {
  entries: readonly TimetableValidationEntry[];
  slots: readonly TimetableValidationSlot[];
  subjectNames: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  classes?: readonly TimetableValidationClass[];
  days?: readonly number[];
  levelGroup?: string;
  requireComplete?: boolean;
}

export interface TimetableValidationIssue {
  rule: string;
  message: string;
}

const lessonNumberOf = (slot: TimetableValidationSlot, lessonSlots: readonly TimetableValidationSlot[]): number => {
  const parsed = Number(String(slot.label || '').match(/lesson\s+(\d+)/i)?.[1]);
  return Number.isFinite(parsed) ? parsed : lessonSlots.indexOf(slot) + 1;
};

const nameFor = (
  subjectNames: ReadonlyMap<string, string> | Readonly<Record<string, string>>,
  subjectId: string | number | null | undefined,
): string => {
  if (subjectId == null) return '';
  const key = String(subjectId);
  return subjectNames instanceof Map ? String(subjectNames.get(key) || '') : String(subjectNames[key] || '');
};

const entryKey = (classId: string | number, day: number, slotId: string | number): string =>
  `${String(classId)}-${day}-${String(slotId)}`;

const subjectDayKey = (entry: TimetableValidationEntry): string =>
  `${String(entry.class_id)}-${entry.day_of_week}-${String(entry.subject_id)}`;

interface SubjectDayGroup {
  classId: string;
  day: number;
  subjectId: string;
  entries: TimetableValidationEntry[];
}

const isLessonEntry = (entry: TimetableValidationEntry): boolean =>
  entry.entry_type === 'lesson' || entry.entry_type === 'lesson_double';

/**
 * Validate the generated lesson grid after every repair/reconciliation pass.
 * This is deliberately independent of the placement algorithm so no later
 * balancing step can silently reintroduce a rule violation.
 */
export function validateTimetableRules(options: TimetableValidationOptions): TimetableValidationIssue[] {
  const issues: TimetableValidationIssue[] = [];
  const lessonSlots = options.slots
    .filter((slot) => slot.slot_type === 'lesson')
    .slice()
    .sort((a, b) => a.slot_order - b.slot_order);
  const slotById = new Map(lessonSlots.map((slot) => [String(slot.id), slot]));
  const filteredEntries = options.entries.filter((entry) => {
    if (!isLessonEntry(entry)) return false;
    return options.levelGroup == null || entry.level_group === options.levelGroup;
  });
  const cellEntries = new Map<string, TimetableValidationEntry[]>();
  const subjectDayEntries = new Map<string, SubjectDayGroup>();

  for (const entry of filteredEntries) {
    const slot = slotById.get(String(entry.time_slot_id));
    const subjectName = nameFor(options.subjectNames, entry.subject_id);
    if (!slot) {
      issues.push({
        rule: 'unknown-slot',
        message: `Class ${String(entry.class_id)} has a lesson entry in an unknown timetable slot ${String(entry.time_slot_id)}.`,
      });
      continue;
    }
    if (!entry.subject_id || !subjectName.trim() || isFillerSubject(subjectName)) {
      issues.push({
        rule: 'real-subject',
        message: `Class ${String(entry.class_id)} / day ${entry.day_of_week} / ${slot.label || 'lesson'} is not backed by a real assigned subject.`,
      });
    } else if (!strictSubjectAllowsLesson(subjectName, lessonNumberOf(slot, lessonSlots))) {
      issues.push({
        rule: 'subject-window',
        message: `${subjectName} is outside its allowed window at ${slot.label || 'lesson'} for class ${String(entry.class_id)} on day ${entry.day_of_week}.`,
      });
    }

    const cell = entryKey(entry.class_id, entry.day_of_week, entry.time_slot_id);
    cellEntries.set(cell, [...(cellEntries.get(cell) || []), entry]);
    const dayKey = subjectDayKey(entry);
    const group = subjectDayEntries.get(dayKey) || {
      classId: String(entry.class_id),
      day: Number(entry.day_of_week),
      subjectId: String(entry.subject_id),
      entries: [],
    };
    group.entries.push(entry);
    subjectDayEntries.set(dayKey, group);
  }

  for (const group of subjectDayEntries.values()) {
    const entries = group.entries;
    if (entries.length <= 1) continue;
    const { classId, day, subjectId } = group;
    const subjectName = nameFor(options.subjectNames, subjectId);
    const ordered = entries
      .map((entry) => slotById.get(String(entry.time_slot_id)))
      .filter((slot): slot is TimetableValidationSlot => Boolean(slot))
      .sort((a, b) => a.slot_order - b.slot_order);
    const isLegalDouble = entries.length === 2
      && entries.every((entry) => entry.entry_type === 'lesson_double')
      && ordered.length === 2
      && ordered[1].slot_order === ordered[0].slot_order + 1;
    if (!isLegalDouble) {
      issues.push({
        rule: 'once-per-day',
        message: `${subjectName || `Subject ${subjectId}`} appears more than once on day ${day} for class ${classId}; only one consecutive configured double is allowed.`,
      });
    }
  }

  for (let index = 0; index < lessonSlots.length - 1; index++) {
    const current = lessonSlots[index];
    const next = lessonSlots[index + 1];
    for (const day of options.days || [1, 2, 3, 4, 5]) {
      const classIds = options.classes?.map((item) => String(item.id))
        || [...new Set(filteredEntries.map((entry) => String(entry.class_id)))];
      for (const classId of classIds) {
        const left = cellEntries.get(entryKey(classId, day, current.id)) || [];
        const right = cellEntries.get(entryKey(classId, day, next.id)) || [];
        for (const leftEntry of left) {
          for (const rightEntry of right) {
            const leftName = nameFor(options.subjectNames, leftEntry.subject_id);
            const rightName = nameFor(options.subjectNames, rightEntry.subject_id);
            if (violatesMathScienceSequence(leftName, rightName)) {
              issues.push({
                rule: 'math-science-adjacency',
                message: `${leftName} and ${rightName} are adjacent in class ${classId} on day ${day} (${current.label || 'lesson'} → ${next.label || 'lesson'}).`,
              });
            }
          }
        }
      }
    }
  }

  if (options.requireComplete && options.classes?.length) {
    const days = options.days || [1, 2, 3, 4, 5];
    for (const cls of options.classes) {
      for (const day of days) {
        for (const slot of lessonSlots) {
          if (!(cellEntries.get(entryKey(cls.id, day, slot.id)) || []).length) {
            issues.push({
              rule: 'no-blanks',
              message: `${cls.name || `Class ${String(cls.id)}`} has a blank ${slot.label || 'lesson'} on day ${day}.`,
            });
          }
        }
      }
    }
  }

  return issues;
}

export function assertTimetableRules(options: TimetableValidationOptions): void {
  const issues = validateTimetableRules(options);
  if (issues.length === 0) return;
  const details = issues.slice(0, 12).map((issue) => `- [${issue.rule}] ${issue.message}`).join('\n');
  const suffix = issues.length > 12 ? `\n- and ${issues.length - 12} more timetable rule violations` : '';
  throw new Error(`Timetable hard-rule validation failed:\n${details}${suffix}`);
}
