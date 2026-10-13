import { createClient } from '@supabase/supabase-js';
import {
  generateExamWithDeepSeek,
  parseRepairedQuestion,
  rewriteQuestionWithDeepSeek,
  DeepSeekConfigurationError,
  DeepSeekResponseError,
} from '../src/lib/deepseek-api.js';
import {
  generateExamWithGemini,
  rewriteQuestionWithGemini,
  GeminiConfigurationError,
  GeminiResponseError,
} from '../src/lib/gemini-api.js';
import {
  validateExamRequest,
  type ExamGenerationRequest,
  type GeneratedExamQuestion,
  type CurriculumScopeNode,
  type ExamBlueprint,
  type QuestionType,
  makeBalancedBlueprint,
  makeFormatBlueprint,
  makePaperVariantBlueprint,
  ExamBlueprintSection,
} from '../src/lib/exam-schema.js';
import { filterUnnecessaryExamVisual, withRenderedExamVisual } from '../src/lib/exam-visuals.js';
import { getStrandPacks } from '../src/lib/kicd-knowledge.js';
import {
  isMathsLikeSubject,
  normalizePaperVariant,
  normalizeQuestionNotation,
  repairQuestionAnswers,
  supportsTwoPapers,
} from '../src/lib/exam-construction.js';
import { getKjseaPaperSpec, makeKjseaBlueprint } from '../src/lib/kjsea-paper-formats.js';
import { assessmentLevelForGrade, gradeFormatError, getKpseaPaperSpec, makeKpseaBlueprint } from '../src/lib/exam-grade-policy.js';
import { bindLanguagePaperComponents } from '../src/lib/exam-component-scope.js';
import { applyCuratedVisualFallback } from '../src/lib/exam-visual-library.js';
import {
  buildQuestionRewritePrompt,
  buildVisualRewritePrompt,
  repairGeneratedExam,
} from '../src/lib/exam-repair.js';

const allowedQuestionTypes = new Set<QuestionType>([
  'multiple_choice', 'multiple_response', 'modified_true_false', 'completion',
  'matching', 'short_answer', 'numeric_response', 'case_study', 'essay',
]);

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 12;
const rateLedger = new Map<string, number[]>();

type RequestLike = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
};

type ResponseLike = {
  status: (statusCode: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

function jsonError(response: ResponseLike, status: number, message: string): void {
  response.status(status).json({ error: message });
}

function readBearerToken(headers: RequestLike['headers']): string | null {
  const value = headers.authorization;
  const header = Array.isArray(value) ? value[0] : value;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

function parseBody(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function stringArray(value: unknown, limit = 20): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean).slice(0, limit)
    : [];
}

function parseCurriculumScope(value: unknown): CurriculumScopeNode[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const nodes = value.slice(0, 64).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const node = entry as Record<string, unknown>;
    const strand = typeof node.strand === 'string' ? node.strand.trim().slice(0, 180) : '';
    if (!strand) return [];
    return [{
      strand,
      subStrands: stringArray(node.subStrands, 200),
      topics: stringArray(node.topics, 120),
    }];
  });
  return nodes.length ? nodes : undefined;
}

function parseBlueprint(value: unknown): ExamBlueprint | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as { sections?: unknown; total_marks?: unknown; estimated_minutes?: unknown };
  if (!Array.isArray(raw.sections)) return undefined;
  const sections = raw.sections.slice(0, 64).flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const section = entry as Record<string, unknown>;
    const allowedTypes: QuestionType[] = ['multiple_choice', 'multiple_response', 'modified_true_false', 'completion', 'matching', 'short_answer', 'numeric_response', 'case_study', 'essay'];
    const type = allowedTypes.includes(section.question_type as QuestionType) ? section.question_type as QuestionType : null;
    const count = Number(section.count);
    const marks = Number(section.marks_per_question);
    if (!type || !Number.isFinite(count) || !Number.isFinite(marks) || count < 1 || marks < 1) return [];
    const base: ExamBlueprintSection = {
      id: typeof section.id === 'string' ? section.id.slice(0, 80) : `section-${index + 1}`,
      question_type: type,
      count: Math.min(200, Math.round(count)),
      marks_per_question: Math.min(30, Math.round(marks)),
      difficulty: (['easy','medium','hard','mixed'].includes(String(section.difficulty)) ? section.difficulty : 'mixed') as ExamBlueprintSection['difficulty'],
    };
    const optional: Partial<ExamBlueprintSection> = {};
    if (typeof section.title === 'string') optional.title = section.title.slice(0, 160);
    if (typeof section.strand === 'string') optional.strand = section.strand.slice(0, 180);
    if (typeof section.sub_strand === 'string') optional.sub_strand = section.sub_strand.slice(0, 180);
    if (typeof section.topic === 'string') optional.topic = section.topic.slice(0, 180);
    if (typeof section.competency === 'string') optional.competency = section.competency.slice(0, 180);
    return [{ ...base, ...optional }];
  });
  if (!sections.length) return undefined;
  const totalMarks = Number(raw.total_marks);
  const estimatedMinutes = Number(raw.estimated_minutes);
  return {
    sections,
    total_marks: Number.isFinite(totalMarks) ? Math.round(totalMarks) : sections.reduce((sum, section) => sum + section.count * section.marks_per_question, 0),
    estimated_minutes: Number.isFinite(estimatedMinutes) ? Math.round(estimatedMinutes) : undefined,
  };
}

function parseExamRequest(raw: unknown): ExamGenerationRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;
  const questionTypes = stringArray(body.questionTypes, 9).filter((value): value is QuestionType => allowedQuestionTypes.has(value as QuestionType));
  const totalMarks = Number(body.totalMarks);
  const durationMinutes = Number(body.durationMinutes);
  const difficulty = body.difficulty === 'easy' || body.difficulty === 'medium' || body.difficulty === 'hard' || body.difficulty === 'mixed'
    ? body.difficulty : 'mixed';
  const format = body.format === 'standard30' || body.format === 'cbe' || body.format === 'kpsea' || body.format === 'kjsea' || body.format === 'custom'
    ? body.format : 'cbe';
  return {
    title: typeof body.title === 'string' ? body.title.trim().slice(0, 255) : undefined,
    gradeLevel: typeof body.gradeLevel === 'string' ? body.gradeLevel.trim().slice(0, 32) : '',
    subject: typeof body.subject === 'string' ? body.subject.trim().slice(0, 100) : '',
    strands: stringArray(body.strands, 64),
    subStrands: stringArray(body.subStrands, 300),
    topics: stringArray(body.topics, 400),
    curriculumScope: parseCurriculumScope(body.curriculumScope),
    questionTypes,
    totalMarks: Number.isFinite(totalMarks) ? Math.round(totalMarks) : 0,
    durationMinutes: Number.isFinite(durationMinutes) ? Math.round(durationMinutes) : 0,
    difficulty,
    includeImages: Boolean(body.includeImages),
    includeMarkingScheme: body.includeMarkingScheme !== false,
    format,
    term: typeof body.term === 'string' ? body.term.trim().slice(0, 30) : undefined,
    schoolName: typeof body.schoolName === 'string' ? body.schoolName.trim().slice(0, 255) : undefined,
    level: body.level === 'pre_primary' || body.level === 'lower_primary' || body.level === 'upper_primary' || body.level === 'junior_secondary' || body.level === 'senior_secondary' ? body.level : undefined,
    curriculumVersion: typeof body.curriculumVersion === 'string' ? body.curriculumVersion.trim().slice(0, 80) : undefined,
    learningOutcomes: stringArray(body.learningOutcomes, 30),
    competencies: stringArray(body.competencies, 20),
    blueprint: parseBlueprint(body.blueprint),
    paperVariant: normalizePaperVariant(body.paperVariant),
    preset: typeof body.preset === 'string' ? body.preset.trim().slice(0, 80) : undefined,
    variationKey: typeof body.variationKey === 'string' ? body.variationKey.trim().slice(0, 120) : undefined,
    avoidQuestionStems: stringArray(body.avoidQuestionStems, 40),
  };
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (rateLedger.get(key) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    rateLedger.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLedger.set(key, recent);
  return true;
}

function normalizeContextKey(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function embeddedCurriculumContext(request: ExamGenerationRequest): { context: string; sourceSummary: string[] } {
  const packs = getStrandPacks(request.subject);
  const requestedStrands = new Set(request.strands.map(normalizeContextKey));
  const requestedSubStrands = new Set(request.subStrands.map(normalizeContextKey));
  const requestedTopics = new Set(request.topics.map(normalizeContextKey));
  const scopedByStrand = new Map<string, { subStrands: Set<string>; topics: Set<string> }>();
  for (const node of request.curriculumScope || []) {
    const strandKey = normalizeContextKey(node.strand);
    if (!strandKey) continue;
    scopedByStrand.set(strandKey, {
      subStrands: new Set(node.subStrands.map(normalizeContextKey).filter(Boolean)),
      topics: new Set(node.topics.map(normalizeContextKey).filter(Boolean)),
    });
  }
  const lines: string[] = [];
  for (const pack of packs) {
    const strandKey = normalizeContextKey(pack.strand);
    if (requestedStrands.size && !requestedStrands.has(strandKey)) continue;
    const strandScope = scopedByStrand.get(strandKey);
    for (const subStrand of pack.subStrands) {
      const subStrandKey = normalizeContextKey(subStrand.name);
      const allowedSubStrands = strandScope?.subStrands.size ? strandScope.subStrands : requestedSubStrands;
      if (allowedSubStrands.size && !allowedSubStrands.has(subStrandKey)) continue;
      const topics = subStrand.topics.filter((topic) => {
        const topicKey = normalizeContextKey(topic);
        if (requestedTopics.size && !requestedTopics.has(topicKey)) return false;
        if (strandScope?.topics.size && !strandScope.topics.has(topicKey)) return false;
        return true;
      });
      if (!topics.length && (requestedTopics.size || strandScope?.topics.size)) continue;
      const outcomes = subStrand.slos.slice(0, 3).join('; ');
      lines.push([pack.strand, subStrand.name, topics.slice(0, 8).join(', '), outcomes].filter(Boolean).join(': '));
    }
  }
  return {
    context: lines.slice(0, 18).join('\n'),
    sourceSummary: lines.length ? [`Embedded KICD-aligned curriculum pack for ${request.subject}`] : [],
  };
}

async function loadRecentQuestionStems(
  supabase: ReturnType<typeof createClient>,
  profile: ExamProfile,
  request: ExamGenerationRequest,
): Promise<string[]> {
  try {
    const { data: papers, error: paperError } = await supabase
      .from('exam_papers')
      .select('questions')
      .eq('school_id', profile.school_id)
      .eq('grade_level', request.gradeLevel)
      .eq('subject', request.subject)
      .order('created_at', { ascending: false })
      .limit(5);
    if (paperError) return [];
    const questionIds = Array.from(new Set((papers || []).flatMap((paper: any) => (
      Array.isArray(paper.questions) ? paper.questions.filter((id: unknown): id is string => typeof id === 'string') : []
    )))).slice(0, 120);
    if (!questionIds.length) return [];
    const { data: questionRows, error: questionError } = await supabase
      .from('exam_questions')
      .select('question_text')
      .in('id', questionIds)
      .limit(120);
    if (questionError) return [];
    return Array.from(new Set((questionRows || [])
      .map((row: any) => typeof row.question_text === 'string' ? row.question_text.trim() : '')
      .filter(Boolean)));
  } catch {
    return [];
  }
}

function makeVariationKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function loadVettedContext(
  supabase: ReturnType<typeof createClient>,
  request: ExamGenerationRequest,
): Promise<{ context: string; sourceSummary: string[] }> {
  const kpsea = request.format === 'kpsea' ? getKpseaPaperSpec(request.subject) : null;
  if (kpsea && kpsea.components.length > 1) {
    const { data: grades } = await supabase.from('curriculum_grades').select('id').eq('grade_name', request.gradeLevel).limit(1);
    if (!grades?.length) return {context:'',sourceSummary:[]};
    const { data: subjects } = await supabase.from('curriculum_subjects').select('id,subject_name').eq('grade_id', (grades[0] as any).id).eq('is_current',true).limit(60);
    const contexts: string[] = [];
    const sources: string[] = [kpsea.source, kpsea.score_basis];
    const scopedSections: NonNullable<ExamGenerationRequest['blueprint']>['sections'] = [];
    for (const [componentIndex,component] of kpsea.components.entries()) {
      const member = (subjects || []).find((subject: any) => component.subjects.includes(subject.subject_name));
      if (!member) return {context:'',sourceSummary:[]};
      const { data: strandRows } = await supabase.from('curriculum_strands').select('strand_name,strand_description').eq('subject_id',(member as any).id).limit(100);
      const names = new Set((strandRows || []).filter((strand: any) => /(?:official|source-verified)\s+kicd/i.test(strand.strand_description || '')).map((strand: any) => strand.strand_name));
      const scope = (request.curriculumScope || []).filter(node => names.has(node.strand));
      if(!scope.length)return {context:'',sourceSummary:[]};
      const perStrand=Math.floor(component.count/scope.length);
      scope.forEach((node,index)=>{const count=perStrand+(index<component.count%scope.length?1:0);if(count)scopedSections.push({id:`kpsea-component-${componentIndex+1}-strand-${index+1}`,title:`${component.label}: ${node.strand}`,question_type:'multiple_choice',count,marks_per_question:1,difficulty:request.difficulty,strand:node.strand});});
      const memberRequest = {...request, format:'cbe' as const, subject:(member as any).subject_name, curriculumScope:scope, strands:scope.map(node=>node.strand), subStrands:scope.flatMap(node=>node.subStrands)};
      const evidence = await loadVettedContext(supabase,memberRequest);
      if (!evidence.context.trim()) return {context:'',sourceSummary:[]};
      contexts.push(`KPSEA component ${component.label}: exactly ${component.count} MCQs, derived one-point-per-item practice score. Use only this member learning-area curriculum:\n${evidence.context}`);
      sources.push(...evidence.sourceSummary);
    }
    if(request.blueprint)request.blueprint={...request.blueprint,sections:scopedSections};
    return {context:contexts.join('\n\n'),sourceSummary:Array.from(new Set(sources))};
  }
  const { data, error } = await supabase
    .from('exam_knowledge_chunks')
    .select('content_summary, subject, grade_level, strand, sub_strand, source_name')
    .eq('is_approved', true)
    .eq('subject', request.subject)
    .eq('grade_level', request.gradeLevel)
    .limit(1000);

  const requestedGrade = normalizeContextKey(request.gradeLevel);
  const requestedStrands = new Set(request.strands.map(normalizeContextKey));
  const requestedSubStrands = new Set(request.subStrands.map(normalizeContextKey));
  const scopedByStrand = new Map<string, { subStrands: Set<string>; topics: Set<string> }>();
  for (const node of request.curriculumScope || []) {
    const strandKey = normalizeContextKey(node.strand);
    if (!strandKey) continue;
    scopedByStrand.set(strandKey, {
      subStrands: new Set(node.subStrands.map(normalizeContextKey).filter(Boolean)),
      topics: new Set(node.topics.map(normalizeContextKey).filter(Boolean)),
    });
  }
  const filtered = (error ? [] : (data || []))
    .filter((row: any) => !row.grade_level || normalizeContextKey(row.grade_level) === requestedGrade)
    .filter((row: any) => !requestedStrands.size || (row.strand && requestedStrands.has(normalizeContextKey(row.strand))))
    .filter((row: any) => {
      const strandScope = scopedByStrand.get(normalizeContextKey(row.strand));
      const allowedSubStrands = strandScope?.subStrands.size ? strandScope.subStrands : requestedSubStrands;
      return !allowedSubStrands.size || Boolean(row.sub_strand && allowedSubStrands.has(normalizeContextKey(row.sub_strand)));
    });
  // Keep one evidence item for every selected strand before adding deeper
  // sub-strand detail. This prevents a full-paper request from being narrowed
  // to the first few alphabetic records in a large learning area.
  const coverage = new Map<string, any>();
  const remainder: any[] = [];
  for (const row of filtered) {
    const key = normalizeContextKey(row.strand);
    if (key && !coverage.has(key)) coverage.set(key, row);
    else remainder.push(row);
  }
  const matching = [...coverage.values(), ...remainder].slice(0, 24);
  const databaseContext = matching.map((row: any) => [row.strand, row.sub_strand, row.content_summary].filter(Boolean).join(': ')).join('\n');
  const databaseSources = matching.map((row: any) => row.source_name).filter(Boolean);
  const requiresSourceBackedContext = request.level === 'upper_primary' || request.level === 'senior_secondary';
  const officialCurriculum = await loadApprovedCurriculumTreeContext(supabase, request);
  const embedded = requiresSourceBackedContext || officialCurriculum.context
    ? { context: '', sourceSummary: [] }
    : embeddedCurriculumContext(request);
  const context = [officialCurriculum.context || databaseContext, embedded.context].filter(Boolean).join('\n');
  return {
    context,
    sourceSummary: Array.from(new Set([...databaseSources, ...officialCurriculum.sourceSummary, ...embedded.sourceSummary])).slice(0, 12),
  };
}

async function loadApprovedCurriculumTreeContext(
  supabase: ReturnType<typeof createClient>,
  request: ExamGenerationRequest,
): Promise<{ context: string; sourceSummary: string[] }> {
  const empty = { context: '', sourceSummary: [] as string[] };
  if (!request.curriculumScope?.length || !request.strands.length) return empty;

  try {
    const { data: grades, error: gradeError } = await supabase
      .from('curriculum_grades')
      .select('id, grade_name')
      .eq('grade_name', request.gradeLevel)
      .limit(2);
    const grade = (grades || []).find((row: any) => normalizeContextKey(row.grade_name) === normalizeContextKey(request.gradeLevel));
    if (gradeError || !grade) return empty;

    const { data: subjects, error: subjectError } = await supabase
      .from('curriculum_subjects')
      .select('id, subject_name, curriculum_source_id')
      .eq('grade_id', grade.id)
      .eq('subject_name', request.subject)
      .eq('is_current', true)
      .limit(2);
    const subject = (subjects || []).find((row: any) => normalizeContextKey(row.subject_name) === normalizeContextKey(request.subject));
    if (subjectError || !subject?.curriculum_source_id) return empty;

    const { data: sources, error: sourceError } = await supabase
      .from('curriculum_sources')
      .select('source_name, source_url, license_status, retrieval_status')
      .eq('id', subject.curriculum_source_id)
      .limit(2);
    const source = (sources || [])[0];
    if (sourceError || !source
      || source.license_status !== 'official_public'
      || source.retrieval_status !== 'approved'
      || !/^https:\/\//i.test(String(source.source_url || ''))
      || !/kicd/i.test(String(source.source_name || ''))) return empty;

    const { data: strandRows, error: strandError } = await supabase
      .from('curriculum_strands')
      .select('id, strand_name, strand_description, strand_order')
      .eq('subject_id', subject.id)
      .order('strand_order', { ascending: true })
      .limit(500);
    if (strandError) return empty;
    const provenanceLinkedStrands = (strandRows || []).filter((row: any) => /source-verified curriculum.*provenance/i.test(String(row.strand_description || '')));
    const verifiedStrands = provenanceLinkedStrands.length ? provenanceLinkedStrands : (strandRows || []).filter((row: any) => /(?:official|source-verified)\s+kicd/i.test(String(row.strand_description || '')));
    const verifiedByKey = new Map<string, any>(verifiedStrands.map((row: any): [string, any] => [normalizeContextKey(row.strand_name), row]));
    const requestedNodes = request.curriculumScope;
    const selectedStrands = requestedNodes.map((node) => verifiedByKey.get(normalizeContextKey(node.strand)));
    if (selectedStrands.some((row) => !row)) return empty;
    const selectedStrandRows = selectedStrands as any[];
    const selectedKeys = new Set(selectedStrandRows.map((row) => normalizeContextKey(row.strand_name)));
    if (request.strands.some((name) => !selectedKeys.has(normalizeContextKey(name)))) return empty;

    const { data: subStrandRows, error: subStrandError } = await supabase
      .from('curriculum_sub_strands')
      .select('id, strand_id, sub_strand_name, sub_strand_description, sub_strand_order')
      .in('strand_id', selectedStrandRows.map((row) => row.id))
      .order('sub_strand_order', { ascending: true })
      .limit(2000);
    if (subStrandError) return empty;
    const allSubStrands = subStrandRows || [];
    const requestedSubKeys = new Set(request.subStrands.map(normalizeContextKey));
    if ([...requestedSubKeys].some((key) => !allSubStrands.some((row: any) => normalizeContextKey(row.sub_strand_name) === key))) return empty;

    const selectedSubStrands: any[] = [];
    for (const node of requestedNodes) {
      const strand = verifiedByKey.get(normalizeContextKey(node.strand));
      const children = allSubStrands.filter((row: any) => row.strand_id === strand.id);
      const allowedNames = node.subStrands.length
        ? new Set(node.subStrands.map(normalizeContextKey))
        : requestedSubKeys.size
          ? requestedSubKeys
          : new Set(children.map((row: any) => normalizeContextKey(row.sub_strand_name)));
      const selectedChildren = children.filter((row: any) => allowedNames.has(normalizeContextKey(row.sub_strand_name)));
      if (!selectedChildren.length || [...allowedNames].some((key) => !selectedChildren.some((row: any) => normalizeContextKey(row.sub_strand_name) === key))) return empty;
      selectedSubStrands.push(...selectedChildren);
    }
    const selectedSubIds = [...new Set(selectedSubStrands.map((row) => row.id))];
    let topicRows: any[] = [];
    if (selectedSubIds.length) {
      const { data, error } = await supabase
        .from('curriculum_topics')
        .select('id, sub_strand_id, topic_name, topic_description, learning_objectives, topic_order')
        .in('sub_strand_id', selectedSubIds)
        .order('topic_order', { ascending: true })
        .limit(3000);
      if (error && requestedNodes.some((node) => node.topics.length)) return empty;
      topicRows = data || [];
    }

    const contextLines = [
      `Approved official curriculum source: ${source.source_name} (${source.source_url}).`,
      `Verified KICD curriculum scope: ${grade.grade_name} · ${subject.subject_name}.`,
    ];
    for (const node of requestedNodes) {
      const strand = verifiedByKey.get(normalizeContextKey(node.strand));
      const children = selectedSubStrands.filter((row) => row.strand_id === strand.id);
      const requestedTopics = new Set(node.topics.map(normalizeContextKey));
      const allNodeTopics = topicRows.filter((row) => children.some((child) => child.id === row.sub_strand_id));
      if (requestedTopics.size && [...requestedTopics].some((key) => !allNodeTopics.some((row) => normalizeContextKey(row.topic_name) === key))) return empty;
      for (const child of children) {
        const childTopics = allNodeTopics.filter((row) => row.sub_strand_id === child.id
          && (!requestedTopics.size || requestedTopics.has(normalizeContextKey(row.topic_name)))).slice(0, 6);
        const topicText = childTopics.map((row) => {
          const objectives = Array.isArray(row.learning_objectives) ? row.learning_objectives.filter(Boolean).slice(0, 3).join('; ') : '';
          return [row.topic_name, String(row.topic_description || '').slice(0, 400), objectives].filter(Boolean).join(' — ');
        });
        contextLines.push(`${strand.strand_name}: ${child.sub_strand_name}${child.sub_strand_description ? ` — ${String(child.sub_strand_description).slice(0, 500)}` : ''}${topicText.length ? `; topics: ${topicText.join(' | ')}` : ''}`);
      }
    }
    return {
      context: contextLines.join('\n'),
      sourceSummary: [String(source.source_name)],
    };
  } catch {
    return empty;
  }
}

/** KJSEA is a junior-school exit assessment: Novela (Grade 7) and Tamthilia
 * (Grade 8) remain required in the Grade 9 Kiswahili Paper 2 specification. */
async function cumulativeLanguageContext(supabase: ReturnType<typeof createClient>, request: ExamGenerationRequest): Promise<{ request: ExamGenerationRequest; context: string; sources: string[] }> {
  const empty = { request, context: '', sources: [] as string[] };
  if (request.format !== 'kjsea' || request.paperVariant !== 'paper2' || !/^kiswahili$/i.test(request.subject.trim())) return empty;
  const { data: grades } = await supabase.from('curriculum_grades').select('id,grade_number').in('grade_number', [7, 8]).limit(4);
  if (!grades?.length) return empty;
  const { data: subjects } = await supabase.from('curriculum_subjects').select('id,grade_id,curriculum_source_id').in('grade_id', grades.map((grade: any) => grade.id)).eq('subject_name', 'Kiswahili').eq('is_current', true).limit(4);
  if (!subjects?.length) return empty;
  const sourceIds = subjects.map((subject: any) => subject.curriculum_source_id).filter(Boolean);
  const { data: sources } = await supabase.from('curriculum_sources').select('id,source_name,source_url').in('id', sourceIds).eq('license_status', 'official_public').eq('retrieval_status', 'approved').limit(4);
  const approved = new Set((sources || []).filter((source: any) => /^https:\/\//.test(source.source_url || '') && /kicd/i.test(source.source_name || '')).map((source: any) => source.id));
  const subjectIds = subjects.filter((subject: any) => approved.has(subject.curriculum_source_id)).map((subject: any) => subject.id);
  if (!subjectIds.length) return empty;
  const { data: strands } = await supabase.from('curriculum_strands').select('id,strand_name,strand_description').in('subject_id', subjectIds).limit(50);
  const provenanceLinked = (strands || []).filter((strand: any) => /source-verified curriculum.*provenance/i.test(strand.strand_description || ''));
  const verified = provenanceLinked.length ? provenanceLinked : (strands || []).filter((strand: any) => /(?:official|source-verified)\s+kicd/i.test(strand.strand_description || ''));
  if (!verified.length) return empty;
  const { data: children } = await supabase.from('curriculum_sub_strands').select('strand_id,sub_strand_name').in('strand_id', verified.map((strand: any) => strand.id)).limit(300);
  const scope = (request.curriculumScope || []).map(node => ({...node, subStrands: [...node.subStrands], topics: [...node.topics]}));
  const lines: string[] = [];
  for (const child of children || []) {
    if (!/novela|tamthilia|tanzu.*fasihi/i.test(String(child.sub_strand_name))) continue;
    const strand = verified.find((node: any) => node.id === child.strand_id);
    if (!strand) continue;
    let node = scope.find(item => item.strand === strand.strand_name);
    if (!node) { node = {strand: strand.strand_name, subStrands: [], topics: []}; scope.push(node); }
    if (!node.subStrands.includes(child.sub_strand_name)) node.subStrands.push(child.sub_strand_name);
    lines.push(`${strand.strand_name}: ${child.sub_strand_name} (approved cumulative Grade 7/8 curriculum skill; use an original, self-contained literary extract).`);
  }
  return {request: {...request, curriculumScope: scope, strands: scope.map(node => node.strand), subStrands: scope.flatMap(node => node.subStrands)}, context: lines.join('\n'), sources: (sources || []).filter((source: any) => approved.has(source.id)).map((source: any) => `${source.source_name} (${source.source_url})`)};
}

type ExamProfile = {
  id: string;
  school_id: string | null;
  role: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

function assertGenerationAccess(profile: ExamProfile): string | null {
  if (!profile.school_id) return 'Your account is not linked to a school.';
  if (!['teacher', 'school_admin'].includes(profile.role)) {
    return 'Only teachers and school administrators can generate assessment papers.';
  }
  // Exam Generator is an authoring tool for the school, not a marks-entry tool.
  // Keep authentication, school linkage, role checks, rate limits, review, and
  // school-scoped persistence, but do not require the teacher to be assigned the
  // selected learning area before drafting an original assessment paper.
  return null;
}

async function handleExamGeneration(
  response: ResponseLike,
  supabase: ReturnType<typeof createClient>,
  profile: ExamProfile,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
  request: RequestLike,
): Promise<void> {
  const rawParsedRequest = parseExamRequest(parseBody(request.body));
  if (!rawParsedRequest) {
    jsonError(response, 400, 'Invalid exam-generation request.');
    return;
  }
  const formatError = gradeFormatError(rawParsedRequest.gradeLevel, rawParsedRequest.format);
  if (formatError) {
    jsonError(response, 400, formatError);
    return;
  }
  rawParsedRequest.level = assessmentLevelForGrade(rawParsedRequest.gradeLevel) || rawParsedRequest.level;
  const paperVariant = rawParsedRequest.format !== 'kjsea' || supportsTwoPapers(rawParsedRequest.subject)
    ? normalizePaperVariant(rawParsedRequest.paperVariant)
    : 'single';
  const kjseaSpec = rawParsedRequest.format === 'kjsea'
    ? getKjseaPaperSpec(rawParsedRequest.subject, paperVariant)
    : null;
  if (rawParsedRequest.format === 'kjsea' && !kjseaSpec) {
    jsonError(response, 400, 'No verified KJSEA paper format is available for this subject and paper. Choose a school-based CBE assessment.');
    return;
  }
  const kpseaSpec = rawParsedRequest.format === 'kpsea' ? getKpseaPaperSpec(rawParsedRequest.subject) : null;
  if (rawParsedRequest.format === 'kpsea' && (!kpseaSpec || paperVariant !== 'single')) {
    jsonError(response,400,'Choose a supported single KPSEA paper group, or use school-based CBE for an individual learning area. KPSEA does not have Paper 1/Paper 2 variants.');
    return;
  }
  let parsedRequest: ExamGenerationRequest = rawParsedRequest.format === 'kjsea'
    ? {
        ...rawParsedRequest,
        totalMarks: kjseaSpec?.marks ?? rawParsedRequest.totalMarks,
        durationMinutes: kjseaSpec?.duration_minutes ?? rawParsedRequest.durationMinutes,
        blueprint: makeKjseaBlueprint(rawParsedRequest.subject, paperVariant, rawParsedRequest.difficulty)
          || makeFormatBlueprint(rawParsedRequest.format, rawParsedRequest.totalMarks, rawParsedRequest.difficulty),
      }
    : ['standard30', 'kpsea'].includes(rawParsedRequest.format)
    ? { ...rawParsedRequest, totalMarks: kpseaSpec?.marks ?? rawParsedRequest.totalMarks, durationMinutes: kpseaSpec?.duration_minutes ?? rawParsedRequest.durationMinutes, blueprint: kpseaSpec ? makeKpseaBlueprint(rawParsedRequest.subject,rawParsedRequest.difficulty) : makeFormatBlueprint(rawParsedRequest.format, rawParsedRequest.totalMarks, rawParsedRequest.difficulty) }
    : rawParsedRequest.blueprint
    ? rawParsedRequest
    : {
        ...rawParsedRequest,
        blueprint: makeBalancedBlueprint(rawParsedRequest.questionTypes, rawParsedRequest.totalMarks, rawParsedRequest.difficulty),
      };
  if (parsedRequest.format === 'standard30') {
    parsedRequest = { ...parsedRequest, durationMinutes: 45 };
  }
  if (paperVariant !== 'single' && parsedRequest.format !== 'kjsea') {
    parsedRequest = {
      ...parsedRequest,
      paperVariant,
      blueprint: makePaperVariantBlueprint(parsedRequest.blueprint, paperVariant, parsedRequest.format),
    };
  }
  const accessError = assertGenerationAccess(profile);
  if (accessError) {
    jsonError(response, 403, accessError);
    return;
  }
  // Never trust a client-supplied school name for a persisted paper. Resolve it
  // from the authenticated school so PDFs and saved papers cannot fall back to
  // product branding or be renamed by a stale client bundle.
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('name')
    .eq('id', profile.school_id)
    .maybeSingle();
  if (schoolError || !school?.name?.trim()) {
    jsonError(response, 503, 'Your school name could not be loaded. Refresh the page and try again.');
    return;
  }
  parsedRequest = { ...parsedRequest, schoolName: school.name.trim().slice(0, 255) };
  const rateKey = `${user.id}:${request.socket?.remoteAddress || 'unknown'}`;
  if (!checkRateLimit(rateKey)) {
    jsonError(response, 429, 'Generation limit reached. Please wait a few minutes before trying again.');
    return;
  }

  const validationErrors = validateExamRequest(parsedRequest);
  if (validationErrors.length) {
    jsonError(response, 400, validationErrors.join(' '));
    return;
  }

  let generationJobId: string | null = null;
  const configuredProvider = String(process.env.AI_EXAM_PROVIDER || '').trim().toLowerCase();
  const useGemini = configuredProvider === 'gemini' || (!configuredProvider && !process.env.DEEPSEEK_API_KEY && Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY));
  const primaryProvider = useGemini ? 'gemini' : 'deepseek';
  const primaryModel = useGemini ? (process.env.GEMINI_MODEL || 'gemini-3.7-flash') : (process.env.AI_EXAM_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat');
  let actualProvider = primaryProvider;
  let actualModel = primaryModel;
  try {
    const { data: generationJob, error: generationJobError } = await supabase
      .from('exam_generation_jobs')
      .insert({ school_id: profile.school_id, created_by: user.id, status: 'generating', request_payload: parsedRequest, provider: primaryProvider, model: primaryModel })
      .select('id')
      .single();
    if (generationJobError) throw new Error(`Could not start the generation job: ${generationJobError.message}`);
    generationJobId = generationJob?.id || null;
    const recentQuestionStems = await loadRecentQuestionStems(supabase, profile, parsedRequest);
    let generationRequest: ExamGenerationRequest = {
      ...parsedRequest,
      variationKey: makeVariationKey(),
      avoidQuestionStems: Array.from(new Set([...(parsedRequest.avoidQuestionStems || []), ...recentQuestionStems])).slice(0, 40),
    };
    const vetted = await loadVettedContext(supabase, generationRequest);
    if (!vetted.context.trim()) {
      throw new Error('No approved KICD source evidence matches this grade, subject, and selected scope. Refresh the curriculum selection or contact an administrator.');
    }
    const cumulative = await cumulativeLanguageContext(supabase, generationRequest);
    generationRequest = bindLanguagePaperComponents(cumulative.request);
    parsedRequest = {...parsedRequest, blueprint: generationRequest.blueprint};
    vetted.context = [vetted.context, cumulative.context].filter(Boolean).join('\n');
    vetted.sourceSummary = Array.from(new Set([...vetted.sourceSummary, ...cumulative.sources]));
    if (generationJobId) {
      await supabase.from('exam_generation_jobs').update({request_payload:generationRequest,updated_at:new Date().toISOString()}).eq('id',generationJobId);
    }
    const generationDeadline=Date.now()+190000;
    let draftPaper;
    try {
      draftPaper = useGemini
        ? await generateExamWithGemini(generationRequest, vetted.context,generationDeadline)
        : await generateExamWithDeepSeek(generationRequest, vetted.context,generationDeadline);
    } catch (error) {
      // Either provider may fail transiently (quota, timeout, malformed JSON,
      // or a provider-side model error). Try the other configured route before
      // returning a failure to the author.
      const canFallback = useGemini
        ? Boolean(process.env.DEEPSEEK_API_KEY)
        : Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      if (!canFallback || error instanceof GeminiConfigurationError || error instanceof DeepSeekConfigurationError) throw error;
      console.warn(`[exam-gen] ${primaryProvider} primary failed; using fallback provider:`, error instanceof Error ? error.message.slice(0, 240) : 'unknown failure');
      actualProvider = useGemini ? 'deepseek' : 'gemini';
      actualModel = useGemini
        ? (process.env.AI_EXAM_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat')
        : (process.env.GEMINI_MODEL || 'gemini-3.7-flash');
      draftPaper = useGemini
        ? await generateExamWithDeepSeek(generationRequest, vetted.context,generationDeadline)
        : await generateExamWithGemini(generationRequest, vetted.context,generationDeadline);
      if (generationJobId) {
        await supabase.from('exam_generation_jobs').update({ provider: actualProvider, model: actualModel }).eq('id', generationJobId);
      }
    }
    const mathsLike = isMathsLikeSubject(parsedRequest.subject);
    const postProcess = (question: GeneratedExamQuestion): GeneratedExamQuestion => {
      const filtered = filterUnnecessaryExamVisual(question);
      const fallback = applyCuratedVisualFallback(filtered, parsedRequest.subject);
      return repairQuestionAnswers(
        normalizeQuestionNotation(withRenderedExamVisual(fallback), { division: mathsLike }),
      );
    };
    let renderedQuestions = draftPaper.questions.map(postProcess);

    // Preserve all fixed slots. A bounded repair may recover bad questions, but
    // an unrecoverable slot must fail honestly rather than shorten the paper.
    const repairDeadline=Date.now()+70000;
    const repairWithProvider = async (prompt: string): Promise<Record<string, unknown> | null> => {
      if(Date.now()>=repairDeadline)return null;
      try {
        return actualProvider === 'gemini'
          ? await rewriteQuestionWithGemini(prompt,repairDeadline)
          : await rewriteQuestionWithDeepSeek(prompt,repairDeadline);
      } catch {
        return null;
      }
    };
    const repair = await repairGeneratedExam(generationRequest, renderedQuestions, {
      rewriteQuestion: async ({ request: scopedRequest, question, issues, attempt }) => {
        const payload = await repairWithProvider(
          buildQuestionRewritePrompt(scopedRequest, question, issues, attempt),
        );
        const repaired = parseRepairedQuestion(scopedRequest, payload);
        return repaired ? postProcess(repaired) : null;
      },
      rewriteVisual: async ({ request: scopedRequest, question, issues, attempt }) => {
        const payload = await repairWithProvider(
          buildVisualRewritePrompt(scopedRequest, question, issues, attempt),
        );
        const repaired = parseRepairedQuestion(scopedRequest, payload);
        if (!repaired) return null;
        // Adopt only the visual; the question the teacher already has is kept as is.
        return postProcess({ ...question, visual_spec: repaired.visual_spec ?? null });
      },
    }, { previousStems: recentQuestionStems,deadlineAt:repairDeadline });
    if (repair.status === 'failed') {
      throw new DeepSeekResponseError(repair.failureMessage || 'The generated paper could not be repaired.');
    }
    renderedQuestions = repair.questions;
    const validation = repair.validation;
    if (repair.status === 'repaired') {
      console.log('[exam-gen] repair pass:', repair.teacherMessage, JSON.stringify(repair.actions.map((action) => action.kind)));
    }
    const actualMarks = renderedQuestions.reduce((sum, question) => sum + question.marks, 0);
    const expectedCount = parsedRequest.blueprint?.sections.reduce((sum, section) => sum + section.count, 0);
    if (actualMarks !== parsedRequest.totalMarks || (expectedCount !== undefined && renderedQuestions.length !== expectedCount) || validation.issues.some((issue) => issue.severity === 'critical')) {
      throw new DeepSeekResponseError('The paper did not satisfy its complete question, mark and validation contract. It has not been saved as a successful paper.');
    }
    const paper = { ...draftPaper, instructions: kpseaSpec ? [...draftPaper.instructions, kpseaSpec.score_basis] : draftPaper.instructions, paper_variant: parsedRequest.paperVariant || 'single', blueprint: parsedRequest.blueprint, questions: renderedQuestions.map((question, index) => ({ ...question, question_number: index + 1 })), total_marks: actualMarks };
    const { data: storedQuestions, error: questionError } = await supabase
      .from('exam_questions')
      .insert(paper.questions.map((question) => ({
        school_id: profile.school_id,
        created_by: user.id,
        source_website: 'AI-generated from vetted Zamifu curriculum context',
        source_kind: 'generated',
        grade_level: paper.grade_level,
        subject: paper.subject,
        strand: (question.strand || 'General').slice(0, 100),
        sub_strand: (question.sub_strand || 'General').slice(0, 100),
        question_type: question.question_type,
        question_text: question.question_text,
        options: question.options?.length ? question.options : null,
        correct_answer: question.correct_answer,
        marking_scheme: question.marking_scheme,
        image_url: question.image_url && question.image_url.length <= 500 ? question.image_url : null,
        difficulty: question.difficulty,
        marks: question.marks,
        topic: question.topic || null,
        learning_outcome: question.learning_outcome || null,
        competency: question.competency || null,
        cognitive_level: question.cognitive_level || null,
        review_status: 'draft',
        metadata: {
          generated_at: paper.generated_at,
          format: paper.format,
          sub_parts: question.sub_parts || [],
          visual_spec: question.visual_spec
            ? { ...question.visual_spec, rendered_data_url: question.image_url || null }
            : null,
        },
      })))
      .select('id');

    if (questionError) throw new Error(`Could not save generated questions: ${questionError.message}`);

    const questionIds = (storedQuestions || []).map((question: { id: string }) => question.id);
    const persistedQuestions = paper.questions.map((question, index) => ({
      ...question,
      id: questionIds[index] || question.id,
    }));
    const { data: storedPaper, error: paperError } = await supabase
      .from('exam_papers')
      .insert({
        school_id: profile.school_id,
        created_by: user.id,
        title: paper.title,
        grade_level: paper.grade_level,
        subject: paper.subject,
        term: paper.term || null,
        year: paper.year,
        questions: questionIds,
        marking_scheme: paper.questions.map((question, index) => `Q${index + 1}: ${question.sub_parts?.length
          ? question.sub_parts.map((part) => `${part.label} ${part.marking_scheme || part.correct_answer || 'Award for a correct response.'} [${part.marks} mark${part.marks === 1 ? '' : 's'}]`).join(' | ')
          : question.marking_scheme}`).join('\n'),
        instructions: paper.instructions.join('\n'),
        duration_minutes: paper.duration_minutes,
        total_marks: paper.total_marks,
        format: paper.format,
        source_summary: vetted.sourceSummary,
        status: 'draft',
        version_number: 1,
        blueprint: {
          ...(parsedRequest.blueprint || { sections: [], total_marks: parsedRequest.totalMarks }),
          paper_variant: parsedRequest.paperVariant || 'single',
        },
        validation_results: validation.issues,
      })
      .select('id')
      .single();

    if (paperError) throw new Error(`Could not save the exam paper: ${paperError.message}`);
    const paperId = storedPaper?.id;
    const { error: snapshotError } = await supabase.from('exam_paper_question_snapshots').insert(persistedQuestions.map((question, index) => ({
      paper_id: paperId, question_id: question.id, question_order: index + 1, payload: question,
    })));
    if (snapshotError) throw new Error(`Could not save immutable question snapshots: ${snapshotError.message}`);
    const visualQuestions = persistedQuestions.filter((question) => question.image_url && question.visual_spec);
    if (visualQuestions.length && paperId) {
      const { error: visualError } = await supabase.from('exam_visual_assets').insert(visualQuestions.map((question) => ({
        school_id: profile.school_id, question_id: question.id, paper_id: paperId, asset_type: ['diagram', 'map', 'chart', 'graph', 'shape', 'flowchart', 'illustration', 'table', 'number_line'].includes(String(question.visual_spec?.asset_type || '').toLowerCase()) ? String(question.visual_spec?.asset_type || '').toLowerCase() : 'illustration', source_kind: 'generated', visual_spec: question.visual_spec ? { ...question.visual_spec, rendered_data_url: question.image_url || null } : {}, alt_text: `Generated visual for ${paper.subject} question`, caption: typeof question.visual_spec?.caption === 'string' ? question.visual_spec.caption.slice(0, 500) : null, approval_status: 'draft', created_by: user.id,
      })));
      if (visualError) throw new Error(`Could not save generated visual metadata: ${visualError.message}`);
    }
    if (generationJobId) {
      await supabase.from('exam_generation_jobs').update({ status: 'ready', result_paper_id: paperId, updated_at: new Date().toISOString() }).eq('id', generationJobId);
    }
    if (paperId) {
      await supabase.from('exam_audit_events').insert({ school_id: profile.school_id, actor_id: user.id, event_type: 'paper_generated', entity_type: 'exam_paper', entity_id: paperId, payload: { question_count: persistedQuestions.length, total_marks: paper.total_marks, validation: validation.issues } });
    }
    response.status(200).json({
      paper: { ...paper, id: paperId, status: 'draft', version_number: 1, validation_results: validation.issues, questions: persistedQuestions },
      sourceSummary: vetted.sourceSummary,
      // What the repair pass had to do, so the author can be told without a red error.
      repair: {
        status: repair.status,
        message: repair.teacherMessage,
        rewrittenQuestions: repair.rewrittenQuestions,
        repairedVisuals: repair.repairedVisuals,
        droppedVisuals: repair.droppedVisuals,
        droppedQuestions: repair.droppedQuestions,
        blueprintReconciled: repair.blueprintReconciled,
        actions: repair.actions,
      },
    });
  } catch (error) {
    if (generationJobId) {
      await supabase.from('exam_generation_jobs').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown generation failure', updated_at: new Date().toISOString() }).eq('id', generationJobId);
    }
    const message = error instanceof DeepSeekConfigurationError || error instanceof DeepSeekResponseError || error instanceof GeminiConfigurationError || error instanceof GeminiResponseError
      ? error.message
      : error instanceof Error ? error.message : 'The exam could not be generated at this time.';
    jsonError(response, 502, message);
  }
}

export default async function handler(request: RequestLike, response: ResponseLike): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'OPTIONS') {
    response.setHeader('Allow', 'POST, OPTIONS');
    response.status(204).end();
    return;
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS');
    jsonError(response, 405, 'Method not allowed.');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    jsonError(response, 503, 'The secure exam service is not configured.');
    return;
  }

  const accessToken = readBearerToken(request.headers);
  if (!accessToken) {
    jsonError(response, 401, 'Sign in to generate an exam.');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await (supabase.auth as any).getUser(accessToken);
  if (userError || !user) {
    jsonError(response, 401, 'Your session could not be verified. Please sign in again.');
    return;
  }

  // Get the authoritative profile. Do not create or infer a profile in a paid/content-generation path.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, school_id, role, first_name, last_name, email')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError || !profile) {
    jsonError(response, 403, 'Your school profile could not be verified for Exam Generator access.');
    return;
  }
  if (!['teacher', 'school_admin'].includes(profile.role) || !profile.school_id) {
    jsonError(response, 403, 'Only school teachers and school administrators with an active school profile can generate exams.');
    return;
  }
  await handleExamGeneration(response, supabase as any, profile as ExamProfile, user, request);
}
