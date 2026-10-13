import type {ExamGenerationRequest,GeneratedExamQuestion} from './exam-schema.js';
export const ORIGINAL_LITERARY_EXTRACT_RULE=' Use original, self-contained classroom passages and literary extracts unless the teacher supplied a specific named source. Label original extracts as original practice material. Do not invent an author, publisher, class-reader attribution or claim a text is officially prescribed.';
export function literarySourceIssues(request:ExamGenerationRequest,question:GeneratedExamQuestion):string[]{
 if(!/english|kiswahili|literature|fasihi/i.test(request.subject))return [];
 const attribution=question.question_text.match(/\bfrom\s+['‘“"]([^'’”"]+)['’”"]\s+by\s+([^()\n]+)/i);
 if(!attribution)return [];
 const supplied=[...(request.learningOutcomes||[]),...request.topics,...request.subStrands,...(request.curriculumScope||[]).flatMap(node=>node.topics)].join(' ').toLowerCase();
 if(supplied.includes(attribution[1].toLowerCase()))return [];
 return ['No named source was supplied for this attributed class-reader extract. Use an original, self-contained practice extract and remove any invented author or prescribed-book claim, keeping the literary component, questions and marks.'];
}
