import assert from 'node:assert/strict';
import { isValidDoubleLessonPair, shouldSkipPreferredSlot } from '../src/lib/timetable-generator.ts';

const allJuniorSlots = new Set(['lesson-1', 'lesson-2', 'lesson-3', 'lesson-4', 'lesson-5', 'lesson-6', 'lesson-7', 'lesson-8']);
const morningSlots = new Set(['lesson-1', 'lesson-2', 'lesson-3']);

// An unprioritized assignment uses the complete lesson-slot set as its preferred set.
// Its fallback pass must not skip every slot, otherwise any first-pass conflict becomes
// a permanent blank even when another valid slot exists.
assert.equal(shouldSkipPreferredSlot(true, allJuniorSlots, 8, 'lesson-1'), false);
assert.equal(shouldSkipPreferredSlot(true, allJuniorSlots, 8, 'lesson-8'), false);

// A priority assignment should skip only its already-tried preferred band when the
// fallback pass redistributes the remaining lessons to other periods.
assert.equal(shouldSkipPreferredSlot(true, morningSlots, 8, 'lesson-2'), true);
assert.equal(shouldSkipPreferredSlot(true, morningSlots, 8, 'lesson-6'), false);

// A normal first pass never skips preferred slots.
assert.equal(shouldSkipPreferredSlot(false, morningSlots, 8, 'lesson-2'), false);

const lesson3 = { slot_order: 3, slot_type: 'lesson' as const, label: 'Lesson 3' };
const lesson4 = { slot_order: 4, slot_type: 'lesson' as const, label: 'Lesson 4' };
const lesson5 = { slot_order: 5, slot_type: 'lesson' as const, label: 'Lesson 5' };
const breakSlot = { slot_order: 4, slot_type: 'break' as const, label: 'SECOND BREAK' };

assert.equal(isValidDoubleLessonPair('Integrated Science', lesson3, lesson4), true);
assert.equal(isValidDoubleLessonPair('Pre-Technical Studies', lesson3, lesson4), true);
assert.equal(isValidDoubleLessonPair('Integrated Science', lesson4, lesson5), false);
assert.equal(isValidDoubleLessonPair('Integrated Science', lesson3, breakSlot), false);
assert.equal(isValidDoubleLessonPair('Integrated Science', lesson3, null), false);

console.log('TIMETABLE ALLOCATION FALLBACK REGRESSION PASS');
