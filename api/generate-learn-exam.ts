import { createClient } from '@supabase/supabase-js';
import { generatePaper, type GeneratedPaper } from '../src/lib/learn-exam/learn-ai.js';
import {
  isLanguageSubject,
  requiresMapExtract,
  specFor,
  type Difficulty,
  type PaperFormat,
  type PaperVariant,
} from '../src/lib/learn-exam/paper-formats.js';
import { geographyTopicAllowed } from '../src/lib/learn-exam/geography-paper.js';
import { alignGeneratedPaper, validateGeneratedPaper } from '../src/lib/learn-exam/paper-validation.js';
import { strandsForSubject } from '../src/lib/learn-exam/subjects.js';
import { KITUI_MAP_GROUND_TRUTH } from '../src/lib/learn-exam/kitui-map.js';
import { completeGeneratedChartUnits } from '../src/lib/learn-exam/paper-presentation.js';
import { validateComputerPracticalConsistency } from '../src/lib/learn-exam/computer-practical-validation.js';
import { validateSeniorCurriculumAlignment } from '../src/lib/learn-exam/senior-curriculum-validation.js';

const VARIANTS = new Set<PaperVariant>(['paper1', 'paper2', 'paper3', 'standard']);
const FORMATS = new Set<PaperFormat | 'standard'>(['kpsea', 'kjsea', 'cbe', 'kcse', 'end_term', 'standard']);
const DIFFICULTIES = new Set<Difficulty>(['easy', 'medium', 'hard', 'extremely_difficult', 'mixed']);
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
  status: (code: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
  end: () => void;
};

function bodyOf(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return null; }
  }
  return raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
}

function allowRate(key: string): boolean {
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
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    response.status(503).json({ error: 'The secure examination generator is not configured.' });
    return;
  }
  const rawAuthorization = request.headers.authorization;
  const authorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    response.status(401).json({ error: 'Sign in to generate an examination paper.' });
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    response.status(401).json({ error: 'Your session could not be verified. Please sign in again.' });
    return;
  }
  const { data: profile } = await supabase.from('profiles').select('id,school_id,role').eq('id', user.id).maybeSingle();
  if (!profile?.school_id || !['teacher', 'school_admin'].includes(profile.role)) {
    response.status(403).json({ error: 'Only school teachers and administrators can generate examination papers.' });
    return;
  }
  if (!allowRate(`${user.id}:${request.socket?.remoteAddress || 'unknown'}`)) {
    response.status(429).json({ error: 'Generation limit reached. Please wait a few minutes before trying again.' });
    return;
  }

  const body = bodyOf(request.body);
  const gradeLevel = String(body?.gradeLevel || '').trim().slice(0, 32);
  const subject = String(body?.subject || '').trim().slice(0, 60);
  const variant = String(body?.paperVariant || 'standard') as PaperVariant;
  const requestedFormat = String(body?.format || 'standard') as PaperFormat | 'standard';
  const difficulty = String(body?.difficulty || 'mixed') as Difficulty;
  if (!gradeLevel || !subject) {
    response.status(400).json({ error: 'Choose a class and one learning area.' });
    return;
  }
  if (!VARIANTS.has(variant) || !FORMATS.has(requestedFormat) || !DIFFICULTIES.has(difficulty)) {
    response.status(400).json({ error: 'That paper configuration is not supported.' });
    return;
  }

  let spec;
  try {
    spec = specFor(gradeLevel, subject, variant, requestedFormat);
  } catch (caught) {
    response.status(400).json({ error: caught instanceof Error ? caught.message : 'That subject and paper combination is not available.' });
    return;
  }

  const term = String(body?.term || 'Term 1').trim().slice(0, 24);
  const topics: string[] = Array.isArray(body?.topics)
    ? body.topics.slice(0, 12).map((topic) => String(topic).trim().slice(0, 160)).filter(Boolean)
    : [];
  try {
    const verifiedTopics = strandsForSubject(subject, gradeLevel).flatMap((strand) => [strand.name, ...strand.subStrands]);
    const invalidTopic = topics.find((topic) => !verifiedTopics.includes(topic));
    if (invalidTopic) {
      response.status(400).json({ error: `“${invalidTopic}” is not a verified ${gradeLevel} ${subject} learning area. Choose from the curriculum list.` });
      return;
    }
    const wrongPaperTopic = topics.find((topic) => !geographyTopicAllowed(topic, spec.code));
    if (wrongPaperTopic) {
      response.status(400).json({ error: `“${wrongPaperTopic}” is not examined in ${spec.code}. Choose only the topics listed for this paper.` });
      return;
    }
  } catch (caught) {
    response.status(400).json({ error: caught instanceof Error ? caught.message : 'Verified curriculum is unavailable for this selection.' });
    return;
  }

  const includeMarking = body?.includeMarkingScheme !== false;
  const requestPayload = { gradeLevel, subject, paperVariant: variant, format: requestedFormat, difficulty, term, topics, includeMarkingScheme: includeMarking };
  let generationJobId: string | null = null;
  let walletReserved = false;
  let paperPersisted = false;
  let walletBalance: number | null = null;
  let storedPaperId: string | null = null;
  let storedQuestionIds: string[] = [];

  try {
    const { data: school, error: schoolError } = await supabase.from('schools').select('name').eq('id', profile.school_id).maybeSingle();
    if (schoolError || !school?.name?.trim()) throw new Error('Your school name could not be loaded. Refresh the page and try again.');

    // Match Learn's optional format-only guidance, isolated to the exact class,
    // subject and resolved paper variant. Reference text never supplies questions.
    const { data: referenceRows, error: referenceError } = await supabase
      .from('learn_exam_reference_papers')
      .select('id,guidance_text')
      .eq('grade_level', gradeLevel)
      .eq('subject', subject)
      .eq('paper_variant', spec.variant)
      .not('guidance_text', 'is', null)
      .order('created_at', { ascending: false })
      .limit(2);
    const references = referenceError ? [] : (referenceRows || []);
    const referenceGuidance = references
      .map((reference, index) => `Sample ${index + 1}:\n${String(reference.guidance_text || '')}`)
      .join('\n\n')
      .slice(0, 14000);

    const { data: job, error: jobError } = await supabase.from('exam_generation_jobs').insert({
      school_id: profile.school_id,
      created_by: user.id,
      status: 'generating',
      request_payload: { ...requestPayload, engine: 'zamifu-learn' },
      provider: 'deepseek',
      model: process.env.AI_EXAM_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    }).select('id').single();
    if (jobError || !job?.id) throw new Error(`Could not start the generation job: ${jobError?.message || 'unknown error'}`);
    generationJobId = job.id;

    const { data: reservation, error: reservationError } = await supabase.rpc('reserve_exam_wallet_paper', {
      p_user_id: user.id,
      p_school_id: profile.school_id,
      p_job_id: generationJobId,
    });
    walletBalance = Number(reservation?.balance ?? 0);
    if (reservationError || reservation?.status === 'insufficient') {
      await supabase.from('exam_generation_jobs').update({ status: 'failed', error_message: 'Insufficient examination wallet balance.', updated_at: new Date().toISOString() }).eq('id', generationJobId);
      response.status(402).json({
        error: `Your examination wallet has KES ${walletBalance}. Top up at least KES ${Math.max(0, 20 - walletBalance)} to generate this KES 20 paper.`,
        wallet: { balanceKes: walletBalance },
      });
      return;
    }
    if (reservation?.status !== 'reserved') {
      await supabase.from('exam_generation_jobs').update({ status: 'failed', error_message: 'Wallet reservation unavailable.', updated_at: new Date().toISOString() }).eq('id', generationJobId);
      response.status(409).json({ error: 'Your wallet charge could not be reserved. Refresh the wallet and try again.', wallet: { balanceKes: walletBalance } });
      return;
    }
    walletReserved = true;

    const blueprint = spec.sections.map((item) => {
      const allocations = item.marks?.length ? item.marks : Array.from({ length: item.count }, () => item.marks_per_question);
      return `SECTION “${item.label}”: generate exactly ${item.count} ${item.question_type} question(s), with marks in this exact order [${allocations.join(', ')}].`
        + (item.answer_count !== undefined ? ` Candidates answer ${item.answer_count} of ${item.count}; only ${item.answer_count} count toward the awarded total. ${item.choice_note || ''}` : '')
        + " Set every question's section field to this exact label.";
    }).join('\n');

    const language = isLanguageSubject(subject);
    const computer = /computer/i.test(subject);
    const visualRule = language
      ? 'This is a language paper: do not include figures.'
      : computer
        ? 'Use figures only when they genuinely help a Computer Studies question, such as a network topology, flowchart or interface diagram. Do not force decorative diagrams into theory or practical tasks. Practical questions must include all starting data, files, tables or field values in question_text.'
        : spec.code === '312/2'
          ? 'Question 6 is the compulsory data-response question and MUST contain a valid bar_chart with complete, internally consistent statistical data. Ask interpretation, calculation and evaluation questions answerable from that chart. Do not substitute a map extract for Paper 2 data response.'
          : requiresMapExtract(subject)
            ? spec.code === '312/1'
              ? 'Question 6 is compulsory map work and MUST contain a valid map_extract. The same traceable OSM-derived Kitui practice extract is rendered automatically; do not supply map coordinates or invent a different place. Use only the verified ground truth below. Include at least ONE other valid bar_chart in another question. Do not move the map to a different question.'
              : 'Include at least TWO questions with valid figure objects. At least one MUST use kind map_extract and use only the supplied Kitui ground truth. Include a second useful map or chart.'
            : 'Include at least TWO questions with valid, sharp figure objects. Use subject-appropriate labelled diagrams, charts, graphs, maps, timelines or shapes. Every value and label must agree with the question and answer.';

    const paperContentRule = spec.code === '312/1'
      ? `PAPER 1 CONTENT: Apart from the map-work question, use only Physical Geography and Field Work. Do not set Population, Settlement, Industry, Trade, Transport, Agriculture, Forestry, Fishing, Mining, Wildlife, Tourism or other Human/Economic Geography questions in this paper. Question 6 must use only features that actually exist in the supplied map. For any additional figure, use only a bar_chart with 2–8 categories and one data series; do not use geometry figures as Geography diagrams.\nKITUI MAP GROUND TRUTH:\n${KITUI_MAP_GROUND_TRUTH}\nQUESTION 6 REQUIRED TASK STRUCTURE: Refer explicitly to the Kitui practice map extract and use exactly these eight sub-parts, totalling 25 marks: (a) identify the four named amenities Muslim Primary School, Kitui Masjid Noor, Kanyangi Sub County Hospital and St.Ursula Girls High School (4); (b) state the UTM coordinates of Muslim Primary School and Kanyangi Sub County Hospital (4); (c) state the direction of Kitui Masjid Noor from Muslim Primary School (2); (d) calculate their straight-line distance (3); (e) state the direction of Kanyangi Sub County Hospital from Muslim Primary School (2); (f) calculate their straight-line distance (3); (g) calculate the straight-line distance from Muslim Primary School to St.Ursula Girls High School (3); (h) name two mapped streams and two mapped dams (4). Do not add or substitute any other map task. The marking scheme must use the verified coordinates, directions and distances above, with one line per sub-part and clear mark allocations.`
      : spec.code === '312/2'
        ? 'PAPER 2 CONTENT: Use Human and Economic Geography plus the compulsory statistical data-response question. Questions 1–5 and 7–10 must all be distinct Human/Economic Geography; never use Physical Geography or Field Work in those questions. Only Question 6 may contain a chart or statistical stimulus: do not repeat its data, chart, categories or sub-questions anywhere else. Question 6 must ask about the displayed bar chart, not a photograph, map or table. Use 2–8 categories and one internally consistent data series. Write the chart unit in full using a complete conventional label such as “tourists”, “people”, “tonnes”, “million tonnes”, “thousand tonnes”, “hectares”, “KES million”, “%” or “million”; never use truncated stems such as “millio”, “thousa” or “touris”. Check every highest, lowest, ranking and comparison statement directly against all displayed bars. Never mention or refer to a map, map extract, photograph, table or field-work stimulus anywhere else in this Paper 2 paper, including the marking schemes. For every extended-response Question 7–10 marking scheme, provide at least eight separately explained marking points, one point per line; every line must name a distinct point and give a specific explanation, example or consequence of at least ten words. Do not compress the marking points into one paragraph or award inflated marks to unexplained phrases.'
        : spec.code === '451/1'
          ? 'PAPER 1 CONTENT: Question 16, the first Section B question, must test programming and be clearly marked compulsory. Section A samples the syllabus broadly; Section B requires the programming question plus any three others.'
          : spec.code === '451/2'
            ? 'PAPER 2 CONTENT: Set two complete, compulsory practical tasks. Include all source text, records, field values, formulas and formatting requirements in question_text so no external file is needed. For spreadsheets, keep the title, column headings, data, formulas and totals in distinct consistent rows and columns. Never merge a title across a row already used for headings; if a title occupies row 1, put headings in row 2 and adjust every cell reference accordingly. Check all requested formulas against the stated layout. A word-processor table must have exactly the columns and rows required by its stated headings and records, plus only any explicitly requested totals. For every selection query, include at least two source records that satisfy the criteria and name every expected returned record in the marking scheme; never create an empty-result practical unintentionally. Include every computed column heading in the stated spreadsheet layout before using its cells, never SUM an average column, recalculate any supplied values such as fines from the stated rule, and size every output table for the actual query results plus its heading and any total row. Do not repeat the overall 50-mark total at the end of question_text because the printable paper adds it automatically. In each marking scheme, allocate marks separately to every labelled sub-part (a), (b), and so on; those sub-part allocations must total exactly 50. Arithmetic-check each question before returning it: suitable patterns are 6+8+8+8+6+6+4+4=50 for eight sub-parts and 8+8+4+8+6+8+8=50 for seven; for any other count, choose clear allocations whose sum is exactly 50.'
            : spec.code === '451/3'
              ? 'PAPER 3 CONTENT: Set one complete database project brief for a two-term assessment, including the problem, users, records, validation, queries, reports, testing and documentation. Do not present it as a timed written examination.'
              : spec.code === '101/1'
                ? 'ENGLISH PAPER 1: Question 1 is functional writing (20); Question 2 contains a complete cloze passage with ten clearly numbered blanks (10); Question 3 contains complete oral-skills stimuli and sub-items totalling 30. Do not split these into extra top-level questions.'
                : spec.code === '101/2'
                  ? 'ENGLISH PAPER 2: Include the full unseen passage, the full practice set-text excerpt, and the full poem or oral-literature stimulus inside the relevant question_text. Clearly identify original practice stimuli rather than presenting invented wording as an actual KNEC extract. Grammar sub-items total 15. If the marking scheme names a rhyme scheme, verify it against the displayed stanza line by line; never call couplets ABAB or alternating rhyme AABB. When uncertain, discuss rhythm and structure without naming a rhyme scheme.'
                  : spec.code === '102/1'
                    ? 'KISWAHILI KARATASI YA 1: Toa mada nne kamili. Ya kwanza ni insha ya kiuamilifu na ni lazima; kandida achague moja nyingine kati ya tatu zilizobaki. Kila mada ni alama 20.'
                    : spec.code === '102/2'
                      ? 'KISWAHILI KARATASI YA 2: Andika kwa Kiswahili sanifu. Jumuisha kifungu kamili cha ufahamu, kifungu kamili cha ufupisho, na maswali yote ndani ya question_text. Matumizi ya Lugha ni alama 40 na Isimu Jamii alama 10.'
                      : spec.code === '102/3'
                        ? 'KISWAHILI KARATASI YA 3: Andika maswali saba kwa Kiswahili sanifu, ukijumuisha Riwaya, Tamthilia, Hadithi Fupi, Ushairi na Fasihi Simulizi. Swali la kwanza ni lazima; kandida ajibu hilo na mengine yoyote matatu.'
                        : '';
    const figureConsistencyRule = 'FIGURE–TEXT CONSISTENCY: Never refer to a photograph, table, passage, diagram or other stimulus that is not actually included. When a bar_chart is supplied, call it a chart (not a table), show 2–8 categories only, and ask only about its displayed labels, values and single unit. Never calculate from an absent month, year or category, and never claim an annual total from a partial-year chart. Independently verify every sum and percentage against the displayed values. Every caption, label, value and marking point must agree with the figure. Do not attach an unrelated decorative figure.';
    const difficultyRule = difficulty === 'extremely_difficult'
      ? 'EXTREMELY DIFFICULT: use challenging synthesis and multi-step reasoning throughout while remaining within the selected class, subject and strands.'
      : `Overall difficulty: ${difficulty}.`;
    const markingRule = 'Every answer is the printable marking scheme. For Mathematics, put numbered steps on separate lines: formula, substitution, simplification, units, then \'Final answer: ...\'. Never jump to a result. For other subjects, give distinct marking points, one idea per line, with marks where appropriate; practical tasks need an ordered procedure and expected output. Geography extended-response questions worth 20–25 marks need at least six separately explained marking points: name each point and add a specific explanation, example or consequence; never inflate a bare list with 4–5 marks per unexplained phrase. Never use markdown tables.';
    const seniorScopeRule = /^Grade\s+(?:11|12)$/i.test(gradeLevel)
      ? `SENIOR CURRICULUM SCOPE: Use only these verified ${gradeLevel} ${subject} strands and exact sub-strands. Every question's topic field must be one exact sub-strand name below, never a broad label such as Algebra, Geometry, Statistics or Calculus. Do not introduce content from another class or pathway.\n${strandsForSubject(subject, gradeLevel)
          .filter((strand) => !topics.length || topics.includes(strand.name) || strand.subStrands.some((topic) => topics.includes(topic)))
          .map((strand) => `${strand.name}: ${strand.subStrands.filter((topic) => !topics.length || topics.includes(strand.name) || topics.includes(topic)).join(' | ')}`)
          .join('\n')}`
      : '';

    const seniorVariantRule = /^Grade\s+(?:10|11|12)$/i.test(gradeLevel) && (spec.format === "cbe" || spec.format === "end_term")
      ? `SENIOR INDEPENDENT PAPER RULE: This is school-based Paper ${spec.variant === "paper2" ? "2" : "1"}. Generate an independent paper, not a relabelled copy. Every top-level question must assess different work. Never repeat or lightly reword a passage, scenario, data set, instruction, question stem or sub-question under another number. Each reading or comprehension question needs its own different stimulus; use no more than one passage-based question in the entire paper. Do not start multiple questions with “Read the following passage” or an equivalent. For a language Paper 2, use varied grammar, writing, listening/speaking and reading tasks within the verified class curriculum, and make every structured task different. Before returning, compare every question with all earlier questions and rewrite any repeated work.`
      : "";
    let paper: GeneratedPaper | null = null;
    let validation: string[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const correction = validation.length ? `\nThe previous response failed server validation. Correct every issue without changing the blueprint:\n${validation.join('\n')}` : '';
      paper = await generatePaper({
        gradeLevel,
        term,
        totalMarks: spec.total_marks,
        duration: spec.duration_minutes,
        topics,
        subject,
        difficulty,
        referenceGuidance,
        extraInstructions: `${spec.note}\n${seniorScopeRule}\n${paperContentRule}\n${requiresMapExtract(subject) && spec.code !== '312/1' ? `KITUI MAP GROUND TRUTH:\n${KITUI_MAP_GROUND_TRUTH}` : ''}\n${blueprint}\n${visualRule}\n${figureConsistencyRule}\n${markingRule}\n${difficultyRule}\n${seniorVariantRule}${correction}`,
      });
      paper = completeGeneratedChartUnits(alignGeneratedPaper(paper, spec));
      validation = [
        ...validateGeneratedPaper(paper, spec, subject),
        ...validateSeniorCurriculumAlignment(paper.questions, gradeLevel, subject, topics),
      ];
      if (computer && spec.code === '451/2') validation = [...validation, ...validateComputerPracticalConsistency(paper)];
      if (!validation.length) break;
    }
    if (!paper || validation.length) {
      throw new Error(`The generated paper did not pass format validation. Please try again. ${validation.slice(0, 3).join(' ')}`);
    }

    await supabase.from('exam_generation_jobs').update({ status: 'validating', updated_at: new Date().toISOString() }).eq('id', generationJobId);
    const variantLabel = spec.variant === 'standard' ? '' : ` Paper ${spec.variant.slice(-1)}`;
    const paperLabel = `${spec.code ? `${spec.code} ` : ''}${subject}${variantLabel}`;
    const instructions = [paper.instructions, ...spec.sections.filter((item) => item.choice_note).map((item) => `${item.label}: ${item.choice_note}`)].filter(Boolean).join('\n');
    const markingScheme = includeMarking
      ? paper.questions.map((question) => `Q${question.question_number} (${question.marks} mark${question.marks === 1 ? '' : 's'})\n${question.answer}`).join('\n\n')
      : null;
    const title = String(body?.title || '').trim().slice(0, 160) || `${paperLabel} — ${gradeLevel} ${term}`;

    const { data: storedQuestions, error: questionError } = await supabase.from('exam_questions').insert(paper.questions.map((question) => ({
      school_id: profile.school_id,
      created_by: user.id,
      source_website: 'Zamifu Learn examination engine',
      source_kind: 'generated',
      grade_level: gradeLevel,
      subject,
      strand: String(question.topic || 'General').slice(0, 100),
      sub_strand: 'General',
      question_type: question.question_type,
      question_text: question.question_text,
      options: question.options?.length ? question.options : null,
      correct_answer: question.answer,
      marking_scheme: question.answer,
      image_url: null,
      difficulty: question.difficulty === 'extremely_difficult' ? 'hard' : question.difficulty === 'mixed' ? 'medium' : question.difficulty,
      marks: question.marks,
      topic: String(question.topic || '').slice(0, 180) || null,
      review_status: 'draft',
      metadata: {
        engine: 'zamifu-learn',
        section: question.section || null,
        figure: question.figure || null,
        original_difficulty: question.difficulty,
      },
    }))).select('id');
    if (questionError) throw new Error(`Could not save generated questions: ${questionError.message}`);
    storedQuestionIds = (storedQuestions || []).map((question: { id: string }) => question.id);
    if (storedQuestionIds.length !== paper.questions.length) throw new Error('Not every generated question could be saved.');

    const { data: storedPaper, error: paperError } = await supabase.from('exam_papers').insert({
      school_id: profile.school_id,
      created_by: user.id,
      title,
      grade_level: gradeLevel,
      subject,
      term,
      year: new Date().getFullYear(),
      questions: storedQuestionIds,
      marking_scheme: markingScheme,
      instructions,
      duration_minutes: spec.duration_minutes,
      total_marks: spec.total_marks,
      format: spec.format,
      source_summary: ['Zamifu Learn verified curriculum and examination blueprint'],
      status: 'draft',
      version_number: 1,
      blueprint: {
        engine: 'zamifu-learn', topics, subject, code: spec.code || '', variant: spec.variant,
        sections: spec.sections, generatedBy: 'deepseek', difficulty, project_window: spec.project_window || null,
        referenceIds: references.map((reference) => reference.id),
      },
      validation_results: [],
    }).select('id').single();
    if (paperError || !storedPaper?.id) {
      await supabase.from('exam_questions').delete().in('id', storedQuestionIds);
      storedQuestionIds = [];
      throw new Error(`Could not save the exam paper: ${paperError?.message || 'unknown error'}`);
    }
    storedPaperId = storedPaper.id;

    const persistedQuestions = paper.questions.map((question, index) => ({ ...question, id: storedQuestionIds[index] }));
    const { error: snapshotError } = await supabase.from('exam_paper_question_snapshots').insert(persistedQuestions.map((question, index) => ({
      paper_id: storedPaperId,
      question_id: storedQuestionIds[index],
      question_order: index + 1,
      payload: question,
    })));
    if (snapshotError) {
      await supabase.from('exam_papers').delete().eq('id', storedPaperId);
      await supabase.from('exam_questions').delete().in('id', storedQuestionIds);
      storedPaperId = null;
      storedQuestionIds = [];
      throw new Error(`Could not save immutable question snapshots: ${snapshotError.message}`);
    }
    paperPersisted = true;

    const { data: consumed, error: consumptionError } = await supabase.rpc('consume_exam_wallet_paper', {
      p_user_id: user.id,
      p_school_id: profile.school_id,
      p_job_id: generationJobId,
      p_paper_id: storedPaperId,
    });
    if (consumptionError || consumed?.status !== 'consumed') {
      throw new Error('The paper was saved, but its wallet charge requires reconciliation. Do not top up or pay again; contact support.');
    }
    walletBalance = Number(consumed.balance ?? walletBalance ?? 0);
    walletReserved = false;
    await supabase.from('exam_generation_jobs').update({ status: 'ready', result_paper_id: storedPaperId, updated_at: new Date().toISOString() }).eq('id', generationJobId);
    await supabase.from('exam_audit_events').insert({
      school_id: profile.school_id,
      actor_id: user.id,
      event_type: 'paper_generated',
      entity_type: 'exam_paper',
      entity_id: storedPaperId,
      payload: { engine: 'zamifu-learn', question_count: paper.questions.length, total_marks: spec.total_marks, format: spec.format, difficulty },
    });

    response.status(200).json({
      paper: {
        id: storedPaperId,
        title,
        school_name: school.name.trim(),
        grade_level: gradeLevel,
        subject,
        term,
        year: new Date().getFullYear(),
        instructions,
        duration_minutes: spec.duration_minutes,
        total_marks: spec.total_marks,
        questions: persistedQuestions,
        marking_scheme: markingScheme,
        format: spec.format,
        paper_variant: spec.variant,
        project_window: spec.project_window || null,
        code: spec.code || null,
        status: 'draft',
        created_at: new Date().toISOString(),
      },
      wallet: { balanceKes: walletBalance },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'The examination could not be generated.';
    if (walletReserved && !paperPersisted && generationJobId) {
      const { data: released } = await supabase.rpc('release_exam_wallet_paper', {
        p_user_id: user.id,
        p_school_id: profile.school_id,
        p_job_id: generationJobId,
      });
      if (released?.status === 'released') {
        walletReserved = false;
        walletBalance = Number(released.balance ?? walletBalance ?? 0);
      }
    }
    if (generationJobId) {
      await supabase.from('exam_generation_jobs').update({
        status: 'failed',
        result_paper_id: storedPaperId,
        error_message: message.slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq('id', generationJobId);
    }
    response.status(message.includes('requires reconciliation') ? 503 : 502).json({
      error: message,
      wallet: walletBalance === null ? undefined : { balanceKes: walletBalance },
      paperId: storedPaperId || undefined,
      chargeReleased: !walletReserved && !paperPersisted,
    });
  }
}
