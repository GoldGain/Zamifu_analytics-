import assert from 'node:assert/strict';
import { ensureActiveStudentEmbed } from '../src/lib/activeStudentEmbed';

assert.equal(
  ensureActiveStudentEmbed('student_id, marks, subjects(name)'),
  'student_id, marks, subjects(name), students!inner(is_active)',
  'A narrow previous-assessment projection must still embed students.',
);

assert.equal(
  ensureActiveStudentEmbed('student_id, students(first_name, last_name), subjects(name)'),
  'student_id, students!inner(is_active, first_name, last_name), subjects(name)',
  'Existing student projections must retain the active-only inner join.',
);

assert.equal(
  ensureActiveStudentEmbed('student_id, students!inner(id, is_active)'),
  'student_id, students!inner(id, is_active)',
  'An already-inner student embed must not be duplicated.',
);

assert.equal(
  ensureActiveStudentEmbed('student_id, students!left(id), subjects(name)'),
  'student_id, students!inner(id), subjects(name)',
  'A left embed must be made inner when an active-student filter is applied.',
);

console.log('Active-student PostgREST embed regression tests passed.');
