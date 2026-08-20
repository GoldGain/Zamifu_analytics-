import { shiftSlotsAroundActivities } from '../src/lib/timetable-activity.ts';

const slots = [
  { slot_order: 1, label: 'Lesson 1', slot_type: 'lesson', start_time: '08:00', end_time: '08:40' },
  { slot_order: 2, label: 'Lesson 2', slot_type: 'lesson', start_time: '08:40', end_time: '09:20' },
  { slot_order: 3, label: 'FIRST BREAK', slot_type: 'break', start_time: '09:20', end_time: '09:40' },
  { slot_order: 4, label: 'Lesson 3', slot_type: 'lesson', start_time: '09:40', end_time: '10:20' },
];

const fridayPpi = [{
  day_of_week: 5,
  activity_name: 'PPI',
  start_time: '08:00',
  end_time: '09:00',
  target_classes: 'Primary and Junior School',
}];

const shifted = shiftSlotsAroundActivities(slots, fridayPpi);
if (shifted[0].start_time !== '09:00' || shifted[0].end_time !== '09:40') {
  throw new Error(`Expected Lesson 1 after PPI at 09:00–09:40, got ${shifted[0].start_time}–${shifted[0].end_time}`);
}
if (shifted[1].start_time !== '09:40' || shifted[1].end_time !== '10:20') {
  throw new Error(`Expected Lesson 2 at 09:40–10:20, got ${shifted[1].start_time}–${shifted[1].end_time}`);
}
if (shifted[2].start_time !== '10:20' || shifted[2].end_time !== '10:40') {
  throw new Error(`Expected break at 10:20–10:40, got ${shifted[2].start_time}–${shifted[2].end_time}`);
}

const unchanged = shiftSlotsAroundActivities(slots, []);
if (unchanged[0].start_time !== '08:00' || unchanged[0].end_time !== '08:40') {
  throw new Error('A day without activities must keep the normal first lesson time.');
}

const shortActivity = [{
  day_of_week: 5,
  activity_name: 'Assembly',
  start_time: '08:20',
  end_time: '08:35',
  target_classes: 'All',
}];
const shortShift = shiftSlotsAroundActivities(slots, shortActivity);
if (shortShift[0].start_time !== '08:35' || shortShift[0].end_time !== '09:15') {
  throw new Error(`Expected a 15-minute shift after a variable-length activity, got ${shortShift[0].start_time}–${shortShift[0].end_time}`);
}

const multiple = shiftSlotsAroundActivities(slots, [
  { day_of_week: 5, activity_name: 'PPI', start_time: '08:00', end_time: '09:00', target_classes: 'All' },
  { day_of_week: 5, activity_name: 'Assembly', start_time: '10:00', end_time: '10:20', target_classes: 'All' },
]);
const hasOverlap = multiple.some((slot) =>
  multiple.some((other) => slot !== other && slot.start_time < other.end_time && slot.end_time > other.start_time)
);
if (hasOverlap) throw new Error('Shifted lesson/break slots must not overlap one another.');

console.log('PASS timetable activity interval tests');
