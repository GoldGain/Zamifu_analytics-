import { getKjseaPaperSpec, kjseaFormatInstruction, makeKjseaBlueprint } from '../src/lib/kjsea-paper-formats.ts';
import { outputTokenBudget } from '../src/lib/deepseek-api.ts';
import { readFileSync } from 'node:fs';

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
  const instruction = kjseaFormatInstruction(subject, variant);
  if (!instruction.includes('Format-only skeleton') || !instruction.includes('Generate original questions')) {
    throw new Error(`${subject} ${variant} prompt guidance is missing sanitized format-only instructions.`);
  }
  console.log(`${subject} ${variant}: ${marks} marks, ${duration} minutes, ${blueprint.sections.length} blueprint sections`);
}

const mathematics = getKjseaPaperSpec('Mathematics', 'single');
if (!mathematics || mathematics.code !== '903' || mathematics.marks !== 100 || mathematics.duration_minutes !== 120 || getKjseaPaperSpec('Mathematics', 'paper2') !== null) {
  throw new Error(`Mathematics must be one 903 paper with no Paper 2: ${JSON.stringify(mathematics)}`);
}
const creativeProject = getKjseaPaperSpec('Creative Arts and Sports', 'paper1');
if (!creativeProject || creativeProject.code !== '911/1' || creativeProject.duration_minutes !== 0) {
  throw new Error(`Creative Arts and Sports Paper 1 must be the 911/1 project window: ${JSON.stringify(creativeProject)}`);
}
const sciencePaper2 = makeKjseaBlueprint('Integrated Science', 'paper2', 'mixed');
if (!sciencePaper2 || sciencePaper2.sections.length !== 3 || sciencePaper2.total_marks !== 30 || sciencePaper2.estimated_minutes !== 60) {
  throw new Error(`Integrated Science Paper 2 must have three current practical-skills questions: ${JSON.stringify(sciencePaper2)}`);
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
