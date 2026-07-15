/**
 * Lightweight AI helper for the in-app assistant.
 * Uses DeepSeek when VITE_DEEPSEEK_API_KEY is configured; otherwise returns
 * high-quality contextual guidance for Zamifu Analytics pages.
 */

export type AiRole = 'school_admin' | 'teacher' | 'student' | 'parent' | 'dean_of_studies' | 'guest' | string;

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiContext {
  pagePath: string;
  pageTitle?: string;
  role?: AiRole;
  schoolName?: string;
  userName?: string;
}

const PAGE_GUIDES: Record<string, string> = {
  '/': 'Landing page for Zamifu Analytics. Use Pathway Finder to explore CBE pathways, browse interests, then Login or Register your school.',
  '/pathway-finder': 'Pathway Finder walks learners through interests, grades, and recommended senior-school pathways based on CBE guidance.',
  '/auth/login': 'Sign in with your school-issued email and password. Use Forgot Password if you cannot access your account.',
  '/school-admin': 'School Admin dashboard: overview of learners, teachers, assessments, fees, and timetable health.',
  '/school-admin/students': 'Manage learners: add, edit, filter, and open learner records. Use Graduated Students for alumni.',
  '/school-admin/graduated-students': 'View learners marked as graduated (typically Grade 9 junior exit and Grade 12 / Form 4). Filter by graduation year.',
  '/school-admin/assessments': 'Create and manage assessments (CATs, midterm, end-term). Assessment names appear on report cards and results.',
  '/school-admin/results': 'Review uploaded marks. Use Publish & Notify to release results and SMS parents via Olympus (PROCALL).',
  '/school-admin/promote-class': 'Promote a whole class to the next grade. Grade 9 and Grade 12 / Form 4 use GRADUATE instead of promote.',
  '/school-admin/timetable/setup': 'Configure editable lesson times per level group. All times come from the database — nothing is hard-coded at save.',
  '/school-admin/timetable/generate': 'Generate timetable entries from level config, subjects, and teacher assignments.',
  '/school-admin/stream-dashboard': 'Stream performance dashboard. Filter by class, term, and assessment.',
  '/teacher': 'Teacher home: pending uploads, assigned learning areas, and quick links.',
  '/teacher/results/upload': 'Upload results only for learning areas assigned to you. Select class, assessment, then enter marks.',
  '/teacher/class-list': 'Class List: view Name + Admission Number, add custom columns, record values, and download PDF.',
  '/teacher/marklist': 'Marklist for flexible columns and PDF export for your class records.',
  '/teacher/my-subjects': 'Learning areas assigned to you by the school admin.',
  '/student/portfolio': 'Your lifelong learner portfolio: results across years, classes, and terms — including after graduation.',
  '/student/results': 'Your published results for the current and previous terms.',
  '/parent': 'Parent portal: children, fees, results, and school announcements.',
  '/dean-of-studies': 'Dean of Studies overview: assessments, class lists, and academic progress.',
};

function guideForPath(path: string): string {
  if (PAGE_GUIDES[path]) return PAGE_GUIDES[path];
  const match = Object.keys(PAGE_GUIDES)
    .filter((k) => k !== '/' && path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match
    ? PAGE_GUIDES[match]
    : 'This is a Zamifu Analytics page. Ask how to complete a task, where a feature lives, or what a field means.';
}

function buildSystemPrompt(ctx: AiContext): string {
  const role = ctx.role || 'guest';
  return [
    'You are Zamifu Assistant, the in-app guide for Zamifu Analytics (Kenya school management for CBE and 8-4-4).',
    'Be concise, practical, and accurate. Prefer step-by-step instructions.',
    `User role: ${role}.`,
    ctx.schoolName ? `School: ${ctx.schoolName}.` : '',
    ctx.userName ? `User name: ${ctx.userName}.` : '',
    `Current path: ${ctx.pagePath}.`,
    `Page guide: ${guideForPath(ctx.pagePath)}`,
    'Never invent admin credentials. Never encourage deleting production data.',
    'If asked about SMS: results are sent via Publish & Notify using Olympus SMS with sender ID PROCALL.',
    'If asked about graduation: Grade 9 and Grade 12/Form 4 graduate; other grades promote to the next class.',
  ]
    .filter(Boolean)
    .join('\n');
}

function offlineAnswer(question: string, ctx: AiContext): string {
  const q = question.toLowerCase();
  const page = guideForPath(ctx.pagePath);

  if (q.includes('this page') || q.includes('explain') || q.includes('what is this') || q.includes('how do i use')) {
    return `**About this page**\n\n${page}\n\nTip: use the left sidebar to jump between modules. Ask me a specific task (for example “how do I publish results?”) for step-by-step help.`;
  }
  if (q.includes('publish') || q.includes('notify') || q.includes('sms')) {
    return 'Go to **School Admin → Results**, filter the class/term/assessment, then click **Publish & Notify**. Parents receive an Olympus SMS from sender ID **PROCALL** with a link to view the report.';
  }
  if (q.includes('class list') || q.includes('add column') || q.includes('pdf')) {
    return 'Teachers: open **Class List**, pick a class, click **Add Column**, enter values per learner, then **Download PDF**. Data is saved to your class list tables.';
  }
  if (q.includes('graduate') || q.includes('promote')) {
    return 'Use **Promote Grade**. For Grade 9 or Grade 12/Form 4 the system switches to **GRADUATE** (status=graduated). Other grades move learners into an empty destination class. View alumni under **Graduated Students**.';
  }
  if (q.includes('timetable') || q.includes('lesson')) {
    return 'In **Timetable Setup**, every time field is editable and stored in the database. Expected lesson totals: Pre-Primary 6 (0 after lunch), Lower/Upper Primary 7 (1 after lunch), Junior 8 (2), Senior 9 (3), 8-4-4 8 (2).';
  }
  if (q.includes('assessment') || q.includes('exam') || q.includes('cat')) {
    return 'School Admin and Dean of Studies can create assessments under **Assessments**. After create, the list refreshes immediately. Assessment names show on report cards and in Results.';
  }
  if (q.includes('pathway')) {
    return 'Open **Pathway Finder** from the landing page. Complete interests → grades → review recommended pathways aligned to CBE.';
  }
  if (q.includes('portfolio')) {
    return 'Students open **Portfolio** to see historical results across classes, years, and terms — including after graduation. Access is limited to your own records.';
  }
  return `**Page context:** ${page}\n\nI can help with results upload, assessments, timetable setup, promotions/graduation, class lists, fees, and parent notifications.\n\nYou asked: “${question.trim()}”\n\nTry rephrasing with the page name or the exact button you see (for example “Publish & Notify”).`;
}

export async function askZamifuAssistant(
  question: string,
  ctx: AiContext,
  history: AiChatMessage[] = []
): Promise<string> {
  const system = buildSystemPrompt(ctx);
  const apiKey = (import.meta as any).env?.VITE_DEEPSEEK_API_KEY as string | undefined;

  if (!apiKey) {
    return offlineAnswer(question, ctx);
  }

  try {
    const messages: AiChatMessage[] = [
      { role: 'system', content: system },
      ...history.slice(-8),
      { role: 'user', content: question },
    ];

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.4,
        max_tokens: 700,
      }),
    });

    if (!res.ok) {
      return offlineAnswer(question, ctx);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content || offlineAnswer(question, ctx);
  } catch {
    return offlineAnswer(question, ctx);
  }
}

export function explainCurrentPage(ctx: AiContext): string {
  return guideForPath(ctx.pagePath);
}
