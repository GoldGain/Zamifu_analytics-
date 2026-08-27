import assert from 'node:assert/strict';
import { canUseAssignmentDay, orderAssignmentDays } from '../src/lib/timetable-generator';

const weekdays = [1, 2, 3, 4, 5];

const initialOrder = orderAssignmentDays(weekdays, new Map(), 0, false);
assert.deepEqual(initialOrder, weekdays, 'an empty assignment should start with all weekdays');

const partiallyUsed = new Map<number, number>([[1, 1], [3, 1]]);
assert.deepEqual(
  orderAssignmentDays(weekdays, partiallyUsed, 0, false),
  [2, 4, 5],
  'non-double placement must try unused weekdays before any used weekday',
);

const fiveLessonUsage = new Map<number, number>();
for (let lesson = 0; lesson < 5; lesson++) {
  const available = orderAssignmentDays(weekdays, fiveLessonUsage, lesson % weekdays.length, false);
  assert.ok(available.length > 0, `lesson ${lesson + 1} should have an unused weekday`);
  const day = available[0];
  fiveLessonUsage.set(day, (fiveLessonUsage.get(day) || 0) + 1);
}
assert.deepEqual(
  [...fiveLessonUsage.entries()].sort((a, b) => a[0] - b[0]),
  weekdays.map((day) => [day, 1]),
  'a five-lesson non-double assignment must occupy each weekday once',
);
assert.deepEqual(
  orderAssignmentDays(weekdays, fiveLessonUsage, 0, false),
  [],
  'non-double placement must not request a sixth unique weekday after all are used',
);
assert.deepEqual(
  orderAssignmentDays(weekdays, fiveLessonUsage, 0, true),
  weekdays,
  'fallback placement may reuse a weekday only after unique weekdays are exhausted',
);

assert.equal(
  canUseAssignmentDay(new Map([[3, 1]]), 3, false, 4),
  false,
  'a non-double assignment must reject a second single lesson on the same weekday',
);
assert.equal(
  canUseAssignmentDay(new Map([[3, 1]]), 4, false, 4),
  true,
  'a non-double assignment may use an unused weekday',
);
assert.equal(
  canUseAssignmentDay(new Map([[3, 1]]), 3, true, 5, 1),
  false,
  'a double-enabled assignment must not add a single lesson to its configured double day',
);
assert.equal(
  canUseAssignmentDay(new Map(), 3, true, 5, 2),
  true,
  'a configured double assignment may use an unused weekday for its paired unit',
);
assert.equal(
  canUseAssignmentDay(new Map([[3, 1]]), 4, true, 5, 1),
  true,
  'a double-enabled assignment may place a remaining single on another weekday',
);
assert.equal(
  canUseAssignmentDay(new Map([[3, 1]]), 3, false, 6),
  true,
  'assignments above five weekly lessons may reuse weekdays when required',
);

console.log('PASS: non-double assignments exhaust unused weekdays before repeating a day');
