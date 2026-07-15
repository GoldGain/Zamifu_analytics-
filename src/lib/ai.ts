/**
 * Zamifu System AI — powerful in-app assistant for every portal.
 * - Page-aware guidance
 * - Role-specific live insights from Supabase
 * - DeepSeek when VITE_DEEPSEEK_API_KEY is set
 * - Strong offline/rules engine always available
 */

import { supabaseUntyped } from '@/lib/supabase/client';

export type AiRole =
  | 'school_admin'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'dean_of_studies'
  | 'guest'
  | string;

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
  schoolId?: string | null;
  userId?: string | null;
}

export interface AiInsight {
  id: string;
  severity: 'info' | 'warning' | 'success';
  title: string;
  body: string;
}

const PAGE_GUIDES: Record<string, string> = {
  '/': 'Landing page. Use Pathway Finder, explore interests, then Login or Register your school.',
  '/pathway-finder': 'Pathway Finder: interests → grades → recommended CBE senior pathways.',
  '/auth/login': 'Sign in with school email and password. Use Forgot Password if needed.',
  '/school-admin': 'School Admin hub: learners, teachers, assessments, fees, timetable, results.',
  '/school-admin/students': 'Manage learners. Use Graduated Students for alumni (G9 / G12).',
  '/school-admin/graduated-students': 'Alumni list. Filter by graduation year.',
  '/school-admin/assessments': 'Create CATs, midterms, end-term. Names appear on report cards.',
  '/school-admin/results': 'Review marks. Publish & Notify sends Olympus SMS (PROCALL) to parents.',
  '/school-admin/promote-class':
    'Promote whole classes. Grade 9 and Grade 12 / Form 4 GRADUATE (not promote). Destination must be empty.',
  '/school-admin/timetable/setup':
    'Edit ALL times per level. Set lessons after lunch (0–3). Save before Generate.',
  '/school-admin/timetable/generate':
    'Generate from saved Setup. Each level: Pre-Primary 6/0, Lower/Upper 7/1, Junior 8/2, Senior 9/3, 8-4-4 8/2.',
  '/school-admin/timetable/view':
    'View/download timetable. Click a class to see correct columns for that level only.',
  '/school-admin/stream-dashboard': 'Stream performance. Filter by class, term, assessment.',
  '/school-admin/fees': 'Fee structures, invoices, and payments.',
  '/school-admin/teachers': 'Manage teachers and assignments.',
  '/school-admin/classes': 'Manage grades/streams.',
  '/teacher': 'Teacher home: uploads, subjects, class tools.',
  '/teacher/results/upload': 'Upload only assigned learning areas for the selected class.',
  '/teacher/class-list': 'Name + Adm No, add columns, save cells, download PDF.',
  '/teacher/marklist': 'Flexible marklist columns and PDF export.',
  '/teacher/my-subjects': 'Your assigned learning areas.',
  '/teacher/attendance': 'Mark daily attendance.',
  '/teacher/homework': 'Assign and review homework.',
  '/student/portfolio': 'All historical results across years — including after graduation.',
  '/student/results': 'Published results for terms.',
  '/student/fees': 'Your fee balance and payments.',
  '/parent': 'Parent hub: children, fees, results, conferences.',
  '/parent/chatbot': 'Full parent AI page (fees, results, homework, meetings).',
  '/parent/fees': 'Children fee balances and payments.',
  '/parent/children': 'Linked children profiles.',
  '/dean-of-studies': 'DoS: assessments, class lists, academic progress.',
};

function guideForPath(path: string): string {
  if (PAGE_GUIDES[path]) return PAGE_GUIDES[path];
  const match = Object.keys(PAGE_GUIDES)
    .filter((k) => k !== '/' && path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return (
    match
      ? PAGE_GUIDES[match]
      : 'Zamifu Analytics page. Ask how to complete a task or where a feature lives.'
  );
}

export function explainCurrentPage(ctx: AiContext): string {
  return guideForPath(ctx.pagePath);
}

export function roleQuickActions(role?: AiRole): { label: string; query: string }[] {
  const r = (role || 'guest').replace(/-/g, '_');
  if (r === 'school_admin') {
    return [
      { label: 'Explain page', query: 'Explain this page' },
      { label: 'Who has not uploaded?', query: 'Which teachers have not uploaded results?' },
      { label: 'Publish results', query: 'How do I publish and notify parents?' },
      { label: 'Graduate G9/G12', query: 'How do Grade 9 and Grade 12 graduation work?' },
      { label: 'Timetable times', query: 'How do I edit timetable times and after-lunch lessons?' },
      { label: 'Create assessment', query: 'How do I create an assessment?' },
    ];
  }
  if (r === 'teacher') {
    return [
      { label: 'Explain page', query: 'Explain this page' },
      { label: 'Upload marks', query: 'How do I upload results for my subjects only?' },
      { label: 'Class list PDF', query: 'How do I use Class List and download PDF?' },
      { label: 'My subjects', query: 'What learning areas am I assigned?' },
      { label: 'Pending tasks', query: 'What are my pending tasks?' },
    ];
  }
  if (r === 'parent') {
    return [
      { label: 'Fee balance', query: "What is my child's fee balance?" },
      { label: 'Results', query: "Show my child's recent results" },
      { label: 'Homework', query: "Show my child's homework" },
      { label: 'Book meeting', query: 'How do I book a meeting with a teacher?' },
      { label: 'Performance', query: "Summarize my child's performance" },
    ];
  }
  if (r === 'student') {
    return [
      { label: 'My results', query: 'Show my recent results' },
      { label: 'Portfolio', query: 'How do I use my portfolio?' },
      { label: 'Fees', query: 'What is my fee balance?' },
      { label: 'Timetable', query: 'Where do I see my timetable?' },
      { label: 'Progress', query: 'Summarize my academic progress' },
    ];
  }
  if (r === 'dean_of_studies') {
    return [
      { label: 'Explain page', query: 'Explain this page' },
      { label: 'Create assessment', query: 'How do I create assessments as DoS?' },
      { label: 'Class lists', query: 'How do I review class lists?' },
      { label: 'Marks progress', query: 'How do I track assessment progress?' },
    ];
  }
  return [
    { label: 'Explain page', query: 'Explain this page' },
    { label: 'Pathway Finder', query: 'How does Pathway Finder work?' },
    { label: 'Login help', query: 'How do I log in?' },
  ];
}

function buildSystemPrompt(ctx: AiContext, liveNotes: string): string {
  const role = ctx.role || 'guest';
  return [
    'You are Zamifu Copilot, the powerful in-app AI for Zamifu Analytics (Kenya CBE + 8-4-4 school management).',
    'Be accurate, step-by-step, and concise. Prefer numbered steps with menu paths.',
    `User role: ${role}.`,
    ctx.schoolName ? `School: ${ctx.schoolName}.` : '',
    ctx.userName ? `User: ${ctx.userName}.` : '',
    `Current path: ${ctx.pagePath}.`,
    `Page guide: ${guideForPath(ctx.pagePath)}`,
    liveNotes ? `LIVE SCHOOL DATA (use this, do not invent):\\n${liveNotes}` : '',
    'Rules:',
    '- Never invent credentials or delete production data.',
    '- Graduation: Grade 9 AND Grade 12 / Form 4 graduate; Grades 1–8 and 10–11 promote to empty destination classes.',
    '- Timetable: Pre-Primary 6 lessons (0 after lunch), Lower/Upper Primary 7 (1), Junior 8 (2), Senior 9 (3), 8-4-4 8 (2).',
    '- SMS: Publish & Notify uses Olympus SMS sender PROCALL.',
    '- Teachers may only upload assigned learning areas.',
  ]
    .filter(Boolean)
    .join('\\n');
}

/** Live insights for the notification strip + AI context */
export async function fetchRoleInsights(ctx: AiContext): Promise<AiInsight[]> {
  const insights: AiInsight[] = [];
  const role = (ctx.role || '').replace(/-/g, '_');
  const schoolId = ctx.schoolId;
  const userId = ctx.userId;

  try {
    if (role === 'school_admin' && schoolId) {
      // Teachers with assignments but no recent results
      const { data: teachers } = await supabaseUntyped
        .from('teachers')
        .select('id, first_name, last_name')
        .eq('school_id', schoolId)
        .eq('is_active', true);
      const { data: assignments } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('teacher_id')
        .eq('school_id', schoolId)
        .eq('is_active', true);
      const { data: recentResults } = await supabaseUntyped
        .from('results')
        .select('teacher_id, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(500);

      const teachersWithUpload = new Set(
        (recentResults || []).map((r: any) => r.teacher_id).filter(Boolean)
      );
      const assignedTeacherIds = new Set(
        (assignments || []).map((a: any) => a.teacher_id).filter(Boolean)
      );
      const missing = (teachers || []).filter(
        (t: any) => assignedTeacherIds.has(t.id) && !teachersWithUpload.has(t.id)
      );
      if (missing.length) {
        const names = missing
          .slice(0, 8)
          .map((t: any) => `${t.first_name || ''} ${t.last_name || ''}`.trim())
          .join(', ');
        insights.push({
          id: 'missing-uploads',
          severity: 'warning',
          title: `${missing.length} teacher(s) with no uploaded results yet`,
          body: names + (missing.length > 8 ? '…' : ''),
        });
      } else {
        insights.push({
          id: 'uploads-ok',
          severity: 'success',
          title: 'Results uploads look active',
          body: 'Assigned teachers have recent result activity (or no assignments yet).',
        });
      }

      const { count: graduatedCount } = await supabaseUntyped
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'graduated');
      insights.push({
        id: 'graduated',
        severity: 'info',
        title: `${graduatedCount || 0} graduated learner(s) on record`,
        body: 'View them under Graduated Students. G9 and G12/Form 4 use Promote Grade → Graduate.',
      });
    }

    if (role === 'teacher' && userId && schoolId) {
      const { data: teacher } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();
      if (teacher?.id) {
        const { data: assigns } = await supabaseUntyped
          .from('teacher_subject_assignments')
          .select('id, subjects(name), classes(name)')
          .eq('teacher_id', teacher.id)
          .eq('is_active', true);
        const n = assigns?.length || 0;
        insights.push({
          id: 'assignments',
          severity: n ? 'info' : 'warning',
          title: n ? `${n} learning area assignment(s)` : 'No subject assignments',
          body: n
            ? (assigns || [])
                .slice(0, 6)
                .map(
                  (a: any) =>
                    `${a.subjects?.name || 'Subject'} · ${a.classes?.name || 'Class'}`
                )
                .join('; ')
            : 'Ask school admin to assign learning areas before uploading results.',
        });
        insights.push({
          id: 'upload-tip',
          severity: 'info',
          title: 'Upload only assigned subjects',
          body: 'Results Upload filters to your assignments for the selected class.',
        });
      }
    }

    if (role === 'parent' && userId) {
      const { data: links } = await supabaseUntyped
        .from('parent_student_links')
        .select('student_id, students(id, first_name, last_name, admission_number, class_id)')
        .eq('parent_id', userId);
      const children = (links || []).map((l: any) => l.students).filter(Boolean);
      if (children.length) {
        const child = children[0];
        const name = `${child.first_name || ''} ${child.last_name || ''}`.trim();
        // Fee invoices
        const { data: invoices } = await supabaseUntyped
          .from('fee_invoices')
          .select('amount, amount_paid, balance, status')
          .eq('student_id', child.id)
          .limit(20);
        let bal = 0;
        (invoices || []).forEach((inv: any) => {
          const b =
            inv.balance != null
              ? Number(inv.balance)
              : Number(inv.amount || 0) - Number(inv.amount_paid || 0);
          bal += isNaN(b) ? 0 : b;
        });
        insights.push({
          id: 'child-fee',
          severity: bal > 0 ? 'warning' : 'success',
          title: `${name}: fee balance KES ${bal.toLocaleString()}`,
          body: 'Open Fees for full statement. Ask me “fee balance” anytime.',
        });
        const { data: results } = await supabaseUntyped
          .from('results')
          .select('marks, percentage, subjects(name)')
          .eq('student_id', child.id)
          .order('created_at', { ascending: false })
          .limit(5);
        if (results?.length) {
          const lines = results
            .map(
              (r: any) =>
                `${r.subjects?.name || 'Subject'}: ${r.percentage ?? r.marks ?? '—'}%`
            )
            .join(' · ');
          insights.push({
            id: 'child-results',
            severity: 'info',
            title: `${name}: latest results`,
            body: lines,
          });
        }
      } else {
        insights.push({
          id: 'no-child',
          severity: 'warning',
          title: 'No linked children',
          body: 'Ask the school to link your parent account to a learner.',
        });
      }
    }

    if (role === 'student' && userId) {
      const { data: student } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, status')
        .eq('profile_id', userId)
        .maybeSingle();
      if (student) {
        const { data: results } = await supabaseUntyped
          .from('results')
          .select('percentage, marks, subjects(name)')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })
          .limit(5);
        if (results?.length) {
          const avg =
            results.reduce(
              (s: number, r: any) => s + Number(r.percentage || r.marks || 0),
              0
            ) / results.length;
          insights.push({
            id: 'student-progress',
            severity: avg >= 50 ? 'success' : 'warning',
            title: `Your recent average ≈ ${avg.toFixed(1)}%`,
            body: results
              .map((r: any) => `${r.subjects?.name || 'Subject'}: ${r.percentage ?? r.marks ?? '—'}`)
              .join(' · '),
          });
        } else {
          insights.push({
            id: 'no-results',
            severity: 'info',
            title: 'No published results yet',
            body: 'Check Portfolio after teachers upload and admin publishes.',
          });
        }
        if ((student.status || '').toLowerCase() === 'graduated') {
          insights.push({
            id: 'graduated-student',
            severity: 'info',
            title: 'You are marked graduated',
            body: 'You can still open Portfolio for historical results.',
          });
        }
      }
    }

    if (role === 'dean_of_studies' && schoolId) {
      const { count } = await supabaseUntyped
        .from('school_exams')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true);
      insights.push({
        id: 'exams',
        severity: 'info',
        title: `${count || 0} active assessment(s)`,
        body: 'Create or edit assessments from Manage Assessments / DoS tools.',
      });
    }
  } catch (e) {
    console.warn('[ai insights]', e);
  }

  // Always include page tip
  insights.unshift({
    id: 'page',
    severity: 'info',
    title: `On this page: ${ctx.pageTitle || ctx.pagePath}`,
    body: guideForPath(ctx.pagePath),
  });

  return insights;
}

async function buildLiveNotes(ctx: AiContext): Promise<string> {
  const insights = await fetchRoleInsights(ctx);
  return insights.map((i) => `- [${i.severity}] ${i.title}: ${i.body}`).join('\\n');
}

async function offlineAnswer(question: string, ctx: AiContext): Promise<string> {
  const q = question.toLowerCase();
  const page = guideForPath(ctx.pagePath);
  const role = (ctx.role || '').replace(/-/g, '_');

  // Live data answers for common queries
  if (
    q.includes('not upload') ||
    q.includes("haven't uploaded") ||
    q.includes('have not uploaded') ||
    q.includes('missing results') ||
    q.includes('which teachers')
  ) {
    const insights = await fetchRoleInsights(ctx);
    const m = insights.find((i) => i.id === 'missing-uploads' || i.id === 'uploads-ok');
    if (m) return `**${m.title}**\\n\\n${m.body}\\n\\nTip: assign subjects under Teacher Assignments, then teachers use Upload Results.`;
  }

  if (q.includes('fee') || q.includes('balance') || q.includes('ada') || q.includes('salio')) {
    const insights = await fetchRoleInsights(ctx);
    const fee = insights.find((i) => i.id === 'child-fee');
    if (fee) return `**${fee.title}**\\n\\n${fee.body}`;
    if (role === 'student') return 'Open **Fees** in the sidebar to see your balance and payment history.';
    if (role === 'school_admin') return 'Go to **Fees** to manage structures, invoices, and payments.';
  }

  if (q.includes('result') || q.includes('mark') || q.includes('performance') || q.includes('matokeo')) {
    const insights = await fetchRoleInsights(ctx);
    const r = insights.find((i) => i.id === 'child-results' || i.id === 'student-progress');
    if (r) return `**${r.title}**\\n\\n${r.body}`;
  }

  if (q.includes('pending') || q.includes('task') || q.includes('assignment')) {
    const insights = await fetchRoleInsights(ctx);
    const a = insights.find((i) => i.id === 'assignments' || i.id === 'upload-tip');
    if (a) return `**${a.title}**\\n\\n${a.body}`;
  }

  if (q.includes('this page') || q.includes('explain') || q.includes('what is this') || q.includes('how do i use')) {
    return `**About this page**\\n\\n${page}\\n\\nAsk a specific task (e.g. “publish results”, “graduate grade 12”).`;
  }
  if (q.includes('publish') || q.includes('notify') || q.includes('sms')) {
    return '**Publish & Notify**\\n\\n1. School Admin → **Results**\\n2. Filter class / term / assessment\\n3. Click **Publish & Notify**\\n4. Parents get Olympus SMS from **PROCALL** with a portal link.';
  }
  if (q.includes('graduate') || q.includes('promote') || q.includes('grade 12') || q.includes('grade 9') || q.includes('form 4')) {
    return '**Promotion & Graduation**\\n\\n1. School Admin → **Promote Grade**\\n2. Select source class\\n3. **Grade 9** and **Grade 12 / Form 4** → system switches to **GRADUATE** (status=graduated, year set)\\n4. Other grades → choose an **empty** destination class\\n5. Alumni appear under **Graduated Students** (filter by year).';
  }
  if (q.includes('timetable') || q.includes('after lunch') || q.includes('lesson')) {
    return '**Timetable**\\n\\n1. **Setup** → edit times + lessons after lunch (0–3) → **Save** (toast shows saved times)\\n2. **Generate** → select levels → Generate (reloads Setup from DB)\\n3. **View** → click a class for correct columns:\\n   - Pre-Primary: 6 lessons, 0 after lunch\\n   - Lower/Upper Primary: 7 / 1\\n   - Junior: 8 / 2\\n   - Senior: 9 / 3\\n   - 8-4-4: 8 / 2';
  }
  if (q.includes('class list') || q.includes('add column')) {
    return '**Class List (Teachers)**\\n\\n1. Teacher → **Class List**\\n2. Select class\\n3. **Add Column** → enter values per learner\\n4. **Download PDF**';
  }
  if (q.includes('assessment') || q.includes('exam') || q.includes('cat')) {
    return '**Assessments**\\n\\nSchool Admin or DoS → **Assessments** → Create → name + type + term → Save. Names show on report cards and Results.';
  }
  if (q.includes('pathway') || q.includes('interest')) {
    return 'Open **Pathway Finder** on the landing page or nav. Complete interests → grades → recommended pathways.';
  }
  if (q.includes('portfolio')) {
    return 'Students → **Portfolio** for all historical results (even after graduation). Only your own records.';
  }
  if (q.includes('meeting') || q.includes('conference') || q.includes('mkutano')) {
    return 'Parents: sidebar **Conferences** → Book Meeting → choose teacher/time → submit.';
  }
  if (q.includes('homework') || q.includes('kazi')) {
    return role === 'parent' || role === 'student'
      ? 'Open **Homework** in the sidebar to see assignments and status.'
      : 'Teachers: **Homework & Papers** to assign work. Learners/parents view in their portals.';
  }

  const insights = await fetchRoleInsights(ctx);
  const live = insights
    .slice(0, 3)
    .map((i) => `• **${i.title}** — ${i.body}`)
    .join('\\n');

  return `**Page:** ${page}\\n\\n**Live insights**\\n${live}\\n\\nYou asked: “${question.trim()}”\\n\\nTry: explain this page · publish results · graduate grade 12 · fee balance · who has not uploaded.`;
}

export async function askZamifuAssistant(
  question: string,
  ctx: AiContext,
  history: AiChatMessage[] = []
): Promise<string> {
  const liveNotes = await buildLiveNotes(ctx);
  const system = buildSystemPrompt(ctx, liveNotes);
  const apiKey = (import.meta as any).env?.VITE_DEEPSEEK_API_KEY as string | undefined;

  if (!apiKey) {
    return offlineAnswer(question, ctx);
  }

  try {
    const messages: AiChatMessage[] = [
      { role: 'system', content: system },
      ...history.slice(-10),
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
        temperature: 0.35,
        max_tokens: 900,
      }),
    });

    if (!res.ok) return offlineAnswer(question, ctx);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content || offlineAnswer(question, ctx);
  } catch {
    return offlineAnswer(question, ctx);
  }
}
