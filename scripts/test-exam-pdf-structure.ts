import assert from 'node:assert/strict';
import { groupExamQuestionsForPdf,shouldShowStudentMarks } from '../src/lib/exam-generator.js';
import { getKjseaPaperSpec, makeKjseaBlueprint } from '../src/lib/kjsea-paper-formats.js';
import type { ExamPaper, GeneratedExamQuestion, PaperVariant } from '../src/lib/exam-schema.js';

function makePaper(subject: string, variant: PaperVariant): ExamPaper {
  const blueprint = makeKjseaBlueprint(subject, variant, 'mixed');
  assert.ok(blueprint, `Expected KJSEA blueprint for ${subject} ${variant}`);
  let questionNumber = 1;
  const questions: GeneratedExamQuestion[] = blueprint.sections.flatMap((section) =>
    Array.from({ length: section.count }, () => ({
      question_number: questionNumber++,
      question_type: section.question_type,
      question_text: `Generated test question ${questionNumber - 1}`,
      correct_answer: 'Test answer',
      marking_scheme: 'Award marks for the correct response.',
      marks: section.marks_per_question,
      difficulty: 'medium',
    })),
  );
  return {
    title: `${subject} Grade 9 — KJSEA ${variant}`,
    grade_level: 'Grade 9',
    subject,
    year: 2026,
    duration_minutes: blueprint.estimated_minutes || 100,
    total_marks: blueprint.total_marks,
    instructions: [],
    questions,
    format: 'kjsea',
    paper_variant: variant,
    blueprint,
  };
}

const science1 = groupExamQuestionsForPdf(makePaper('Integrated Science', 'paper1'));
assert.equal(science1.length, 2, 'Integrated Science Paper 1 should render Section A and Section B.');
assert.equal(science1[0].questions.length, 30);
assert.equal(science1[0].marks, 30);
assert.equal(science1[1].questions.length, 10);
assert.equal(science1[1].marks, 40);
assert.match(science1[1].title || '', /^Section B: Structured and essay questions$/);

const science2 = groupExamQuestionsForPdf(makePaper('Integrated Science', 'paper2'));
assert.equal(science2.length, 3, 'Integrated Science Paper 2 should preserve its three practical-skill questions.');
assert.deepEqual(science2.map((group) => group.questions.length), [1, 1, 1]);
assert.ok(science2[0].title?.includes('Chemistry'));
assert.ok(science2[1].title?.includes('Biology'));
assert.ok(science2[2].title?.includes('Physics'));
assert.equal(science2.reduce((sum, group) => sum + group.marks, 0), 30);

const english1 = groupExamQuestionsForPdf(makePaper('English', 'paper1'));
assert.deepEqual(english1.map((group) => group.questions.length), [20, 5, 10, 15]);
assert.ok(english1[0].title?.includes('Reading comprehension'));
assert.ok(english1[1].title?.includes('Listening and speaking'));
assert.ok(english1[2].title?.includes('Cloze test'));
assert.ok(english1[3].title?.includes('Grammar and language use'));
assert.equal(english1.reduce((sum, group) => sum + group.marks, 0), 50);

const english2 = groupExamQuestionsForPdf(makePaper('English', 'paper2'));
assert.equal(english2.length, 5, 'English Paper 2 should preserve composition and four literary components.');
assert.ok(english2[0].title?.includes('Composition'));
assert.ok(english2[1].title?.includes('Oral literature'));
assert.ok(english2[2].title?.includes('Novella/short story'));
assert.ok(english2[3].title?.includes('Play'));
assert.ok(english2[4].title?.includes('Poetry'));
assert.equal(english2.reduce((sum, group) => sum + group.marks, 0), 50);

const kiswahili1 = groupExamQuestionsForPdf(makePaper('Kiswahili', 'paper1'));
assert.deepEqual(kiswahili1.map((group) => group.questions.length), [20, 5, 25]);
assert.ok(kiswahili1[0].title?.includes('Ufahamu wa Kusoma'));
assert.ok(kiswahili1[1].title?.includes('Kusikiliza na Kuzungumza'));
assert.ok(kiswahili1[2].title?.includes('Sarufi'));
assert.equal(kiswahili1.reduce((sum, group) => sum + group.marks, 0), 50);

const kiswahili2 = groupExamQuestionsForPdf(makePaper('Kiswahili', 'paper2'));
assert.equal(kiswahili2.length, 5, 'Kiswahili Paper 2 should preserve Insha and four Fasihi components.');
assert.ok(kiswahili2[0].title?.includes('Insha'));
assert.ok(kiswahili2[1].title?.includes('Fasihi Simulizi'));
assert.ok(kiswahili2[2].title?.includes('Novela'));
assert.ok(kiswahili2[3].title?.includes('Tamthilia'));
assert.ok(kiswahili2[4].title?.includes('Ushairi'));
assert.equal(kiswahili2.reduce((sum, group) => sum + group.marks, 0), 50);

const socialStudies = groupExamQuestionsForPdf(makePaper('Social Studies', 'single'));
assert.equal(socialStudies.length, 2, 'Social Studies should render Section A and one combined Section B.');
assert.equal(socialStudies[0].questions.length, 20);
assert.equal(socialStudies[0].marks, 20);
assert.equal(socialStudies[1].questions.length, 14);
assert.equal(socialStudies[1].marks, 80);
assert.match(socialStudies[1].title || '', /^Section B: Structured and essay questions$/);

assert.equal(getKjseaPaperSpec('Integrated Science', 'paper1')?.code, '905/1');
assert.equal(getKjseaPaperSpec('Integrated Science', 'paper2')?.code, '905/2');
assert.equal(getKjseaPaperSpec('Kiswahili', 'paper1')?.code, '902/1');
assert.equal(getKjseaPaperSpec('Kiswahili', 'paper2')?.code, '902/2');
assert.equal(getKjseaPaperSpec('English', 'paper1')?.code, '901/1');
assert.equal(getKjseaPaperSpec('English', 'paper2')?.code, '901/2');
assert.equal(getKjseaPaperSpec('Social Studies', 'single')?.code, '907');

console.log('PASS: PDF grouping preserves all seven audited KJSEA layouts, mark totals, and official paper codes.');

for(const format of ['cbe','custom','standard30','kjsea'] as const)assert.equal(shouldShowStudentMarks(format),true,`${format} student questions and subparts must show their allocated marks`);
assert.equal(shouldShowStudentMarks('kpsea'),false,'verified objective KPSEA styling remains unchanged');
