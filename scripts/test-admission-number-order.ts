import { sortByAdmissionNumber } from '../src/lib/student-order';

const rows = [
  { id: 'a', admission_number: '10' },
  { id: 'b', admission_number: '2' },
  { id: 'c', admission_number: '001' },
  { id: 'd', admission_number: '2A' },
  { id: 'e', admission_number: '' },
  { id: 'f', admission_number: null },
];

const sorted = sortByAdmissionNumber(rows).map((row) => row.id);
const expected = ['c', 'b', 'd', 'a', 'e', 'f'];
if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected admission order: ${JSON.stringify(sorted)}`);
}

console.log('Admission-number ordering regression test passed.');
