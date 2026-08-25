import assert from 'node:assert/strict';
import { shouldSkipPreferredSlot } from '../src/lib/timetable-generator.ts';

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

console.log('TIMETABLE ALLOCATION FALLBACK REGRESSION PASS');
