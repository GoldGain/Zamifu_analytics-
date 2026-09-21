import { getKjseaPaperSpec, kjseaFormatInstruction, makeKjseaBlueprint } from '../src/lib/kjsea-paper-formats.ts';
import { outputTokenBudget } from '../src/lib/deepseek-api.ts';
import { readFileSync } from 'node:fs';

const expected = [
  ['English', 'paper1', 50, 100],
  ['English', 'paper2', 50, 105],
  ['Kiswahili', 'paper1', 50, 100],
  ['Kiswahili', 'paper2', 50, 105],
  ['Integrated Science', 'paper1', 70, 100],
  ['Integrated Science', 'paper2', 30, 90],
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
  const instruction = kjseaFormatInstruction(subject, variant);
  if (!instruction.includes('Format-only skeleton') || !instruction.includes('Generate original questions')) {
    throw new Error(`${subject} ${variant} prompt guidance is missing sanitized format-only instructions.`);
  }
  console.log(`${subject} ${variant}: ${marks} marks, ${duration} minutes, ${blueprint.sections.length} blueprint sections`);
}

const largePaperRequest = {
  gradeLevel: 'Grade 7', subject: 'English', strands: [], subStrands: [], topics: [],
  questionTypes: ['multiple_choice'], totalMarks: 50, durationMinutes: 100,
  difficulty: 'mixed', includeImages: true, includeMarkingScheme: true,
  format: 'kjsea', paperVariant: 'paper1',
} as const;
if (outputTokenBudget(largePaperRequest, false) < 12000 || outputTokenBudget(largePaperRequest, true) < 10000) {
  throw new Error('Large KJSEA papers need expanded provider token budgets to avoid truncated JSON.');
}

const validationSource = readFileSync(new URL('../src/lib/exam-validation.ts', import.meta.url), 'utf8');
if (!validationSource.includes("if (!spec)") || !validationSource.includes('Generic KJSEA papers must begin with 20 multiple-choice questions.')) {
  throw new Error('Generic KJSEA fallback guard is missing from exam-validation.ts.');
}

console.log('KJSEA paper-format regressions passed.');
