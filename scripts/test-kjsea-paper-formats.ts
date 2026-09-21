import { getKjseaPaperSpec, makeKjseaBlueprint } from '../src/lib/kjsea-paper-formats.ts';

const expected = [
  ['English', 'paper1', 50, 100],
  ['English', 'paper2', 50, 105],
  ['Kiswahili', 'paper1', 50, 100],
  ['Kiswahili', 'paper2', 50, 105],
  ['Integrated Science', 'paper1', 70, 100],
  ['Integrated Science', 'paper2', 30, 60],
] as const;

for (const [subject, variant, marks, duration] of expected) {
  const spec = getKjseaPaperSpec(subject, variant);
  if (!spec || spec.marks !== marks || spec.duration_minutes !== duration) {
    throw new Error(`${subject} ${variant} spec mismatch: ${JSON.stringify(spec)}`);
  }
  const blueprint = makeKjseaBlueprint(subject, variant, 'mixed');
  const blueprintMarks = blueprint?.sections.reduce((sum, section) => sum + section.count * section.marks_per_question, 0);
  if (!blueprint || blueprintMarks !== marks || blueprint.estimated_minutes !== duration) {
    throw new Error(`${subject} ${variant} blueprint mismatch: ${JSON.stringify(blueprint)}`);
  }
  console.log(`${subject} ${variant}: ${marks} marks, ${duration} minutes, ${blueprint.sections.length} blueprint sections`);
}

console.log('KJSEA paper-format regressions passed.');
