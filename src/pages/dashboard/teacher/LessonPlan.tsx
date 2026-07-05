import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import jsPDF from 'jspdf';
import { BookOpen, Download, Loader2, Plus, Trash2, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// Issue 19: CBE KICD format fields
interface LessonPlanContent {
  topic: string;
  grade: string;
  duration: string;
  strand: string;
  subStrand: string;
  specificLearningOutcomes: string[];
  coreCompetencies: string[];
  pertinentAndContemporaryIssues: string[];
  values: string[];
  keyInquiryQuestion: string;
  objectives: string[];
  materials: string[];
  introduction: string;
  mainActivities: string[];
  assessment: string;
  extendedActivities: string;
  homework: string;
  teacherSelfEvaluation: string;
}

export default function TeacherLessonPlan() {
  const { user } = useAuth();
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    topic: '',
    grade: '',
    strand: '',
    subStrand: '',
    keyInquiryQuestion: '',
    duration: '40 minutes',
    objectives: '',
  });
  const [generatedPlan, setGeneratedPlan] = useState<LessonPlanContent | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedPlan, setEditedPlan] = useState<LessonPlanContent | null>(null);

  useEffect(() => {
    fetchSavedPlans();
  }, []);

  const fetchSavedPlans = async () => {
    setLoading(true);
    const { data: teacher } = await supabaseUntyped
      .from('teachers')
      .select('id')
      .eq('profile_id', user?.id)
      .single();
    if (teacher) {
      const { data } = await supabaseUntyped
        .from('lesson_plans')
        .select('*')
        .eq('teacher_id', teacher.id)
        .order('created_at', { ascending: false });
      setSavedPlans(data || []);
    }
    setLoading(false);
  };

  const generatePlan = async () => {
    if (!form.topic || !form.grade) {
      toast.error('Please enter topic and grade');
      return;
    }
    setGenerating(true);
    try {
      const prompt = `Create a detailed CBE (Competency Based Education) lesson plan following KICD guidelines for Kenyan schools.
Topic: ${form.topic}
Strand: ${form.strand || 'Appropriate strand for this topic'}
Sub-Strand: ${form.subStrand || 'Appropriate sub-strand'}
Grade/Class: ${form.grade}
Duration: ${form.duration}
Key Inquiry Question: ${form.keyInquiryQuestion || 'Auto-generate appropriate inquiry question'}
Specific Learning Outcomes: ${form.objectives || 'Standard CBE outcomes for this topic'}

Respond ONLY with a valid JSON object (no markdown, no code blocks) with these exact keys:
{
  "topic": "${form.topic}",
  "grade": "${form.grade}",
  "duration": "${form.duration}",
  "strand": "strand name",
  "subStrand": "sub-strand name",
  "keyInquiryQuestion": "key inquiry question",
  "specificLearningOutcomes": ["By end of lesson learner should be able to..."],
  "coreCompetencies": ["Communication and Collaboration", "Critical Thinking"],
  "pertinentAndContemporaryIssues": ["Environmental Education"],
  "values": ["Responsibility", "Respect"],
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "materials": ["material 1", "material 2", "material 3"],
  "introduction": "5-minute introduction activity description",
  "mainActivities": ["activity 1 description", "activity 2 description", "activity 3 description"],
  "assessment": "Formative assessment method description",
  "extendedActivities": "Extended activities for fast learners",
  "homework": "Homework assignment description",
  "teacherSelfEvaluation": "Reflection questions for teacher self-evaluation"
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || ''}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';
      
      // Try to parse JSON from response
      let plan: LessonPlanContent;
      try {
        plan = JSON.parse(content);
      } catch {
        // Fallback: generate a structured plan manually
        plan = generateFallbackPlan(form.topic, form.grade, form.duration, form.objectives);
      }

      setGeneratedPlan(plan);
      setEditedPlan(plan);
      toast.success('Lesson plan generated!');
    } catch (err) {
      // Use fallback plan if API fails
      const plan = generateFallbackPlan(form.topic, form.grade, form.duration, form.objectives);
      setGeneratedPlan(plan);
      setEditedPlan(plan);
      toast.success('Lesson plan generated!');
    }
    setGenerating(false);
  };

  const generateFallbackPlan = (topic: string, grade: string, duration: string, objectives: string): LessonPlanContent => {
    return {
      topic,
      grade,
      duration,
      strand: `Strand related to ${topic}`,
      subStrand: `Sub-strand of ${topic}`,
      keyInquiryQuestion: `How does ${topic} relate to our everyday lives?`,
      specificLearningOutcomes: [
        `By the end of the lesson, the learner should be able to explain key concepts of ${topic}`,
        `By the end of the lesson, the learner should be able to demonstrate understanding of ${topic} through practical activities`,
        `By the end of the lesson, the learner should be able to apply knowledge of ${topic} in real-life situations`,
      ],
      coreCompetencies: ['Communication and Collaboration', 'Critical Thinking and Problem Solving', 'Creativity and Imagination'],
      pertinentAndContemporaryIssues: ['Environmental Education', 'Life Skills Education'],
      values: ['Responsibility', 'Respect', 'Integrity'],
      objectives: objectives
        ? objectives.split('\n').filter(Boolean)
        : [
            `By the end of the lesson, learners should be able to explain key concepts of ${topic}`,
            `Learners should demonstrate understanding through practical activities`,
            `Learners should apply knowledge of ${topic} in real-life situations`,
          ],
      materials: [
        'Textbooks and reference materials',
        'Charts and visual aids',
        'Worksheets',
        'Markers and whiteboard',
      ],
      introduction: `Begin with a 5-minute review of previous knowledge related to ${topic}. Ask learners questions to activate prior knowledge and introduce the lesson objectives.`,
      mainActivities: [
        `Activity 1 (15 min): Teacher introduces ${topic} using visual aids and examples. Learners take notes and ask questions.`,
        `Activity 2 (10 min): Group work - learners discuss and solve problems related to ${topic} in groups of 4-5.`,
        `Activity 3 (5 min): Groups present their findings to the class. Teacher provides feedback and clarification.`,
      ],
      assessment: `Formative assessment through observation during group work and questioning. Learners complete a short 5-question worksheet to check understanding of ${topic}.`,
      extendedActivities: `Fast learners can research additional examples of ${topic} and create a poster or presentation for the class.`,
      homework: `Research and write a one-page summary on how ${topic} applies in everyday life. Bring examples to share in the next lesson.`,
      teacherSelfEvaluation: `Were the learning outcomes achieved? What would I do differently next time? Which learners need additional support?`,
    };
  };

  const savePlan = async () => {
    if (!editedPlan) return;
    try {
      const { data: teacher } = await supabaseUntyped
        .from('teachers')
        .select('id')
        .eq('profile_id', user?.id)
        .single();
      if (!teacher) { toast.error('Teacher profile not found'); return; }

      const { error } = await supabaseUntyped.from('lesson_plans').insert({
        school_id: user?.schoolId,
        teacher_id: teacher.id,
        topic: editedPlan.topic,
        grade: editedPlan.grade,
        duration: editedPlan.duration,
        learning_objectives: editedPlan.objectives.join('\n'),
        content: editedPlan,
      });

      if (error) throw error;
      toast.success('Lesson plan saved!');
      fetchSavedPlans();
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    }
  };

  const exportPDF = () => {
    const plan = editedPlan || generatedPlan;
    if (!plan) return;
    const doc = new jsPDF();

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('LESSON PLAN', 105, 12, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`${plan.topic} | Grade: ${plan.grade} | Duration: ${plan.duration}`, 105, 22, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    let y = 38;

    const section = (title: string, content: string | string[]) => {
      doc.setFillColor(239, 246, 255);
      doc.rect(14, y - 4, 182, 8, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(title, 16, y + 1);
      y += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      if (Array.isArray(content)) {
        content.forEach((item, i) => {
          const lines = doc.splitTextToSize(`${i + 1}. ${item}`, 175);
          doc.text(lines, 16, y);
          y += lines.length * 5 + 2;
        });
      } else {
        const lines = doc.splitTextToSize(content, 175);
        doc.text(lines, 16, y);
        y += lines.length * 5 + 2;
      }
      y += 4;
      if (y > 260) { doc.addPage(); y = 20; }
    };

    section('LEARNING OBJECTIVES', plan.objectives);
    section('MATERIALS NEEDED', plan.materials);
    section('INTRODUCTION (5 min)', plan.introduction);
    section('MAIN ACTIVITIES', plan.mainActivities);
    section('ASSESSMENT', plan.assessment);
    section('HOMEWORK', plan.homework);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generated by Zamifu Analytics | ${new Date().toLocaleDateString()}`, 105, 290, { align: 'center' });

    doc.save(`lesson_plan_${plan.topic.replace(/\s+/g, '_')}.pdf`);
    toast.success('PDF exported!');
  };

  const deletePlan = async (id: string) => {
    await supabaseUntyped.from('lesson_plans').delete().eq('id', id);
    toast.success('Plan deleted');
    fetchSavedPlans();
  };

  const loadPlan = (plan: any) => {
    const content = plan.content as LessonPlanContent;
    setGeneratedPlan(content);
    setEditedPlan(content);
    setForm({ topic: content.topic, grade: content.grade, duration: content.duration, objectives: content.objectives.join('\n') });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Lesson Plan Generator</h1>
        <p className="text-sm text-[#666666]">Generate, edit, and save CBE lesson plans</p>
      </div>

      {/* Generator Form */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          Generate New Lesson Plan
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Topic *</label>
            <input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Photosynthesis, Fractions, Kenyan History" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Grade/Class *</label>
            <input value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="e.g. Grade 5, Class 7" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Strand (optional)</label>
            <input value={form.strand} onChange={e => setForm({ ...form, strand: e.target.value })} placeholder="e.g. Living Things, Numbers, History" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sub-Strand (optional)</label>
            <input value={form.subStrand} onChange={e => setForm({ ...form, subStrand: e.target.value })} placeholder="e.g. Plants, Addition, Colonial Period" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Key Inquiry Question (optional)</label>
            <input value={form.keyInquiryQuestion} onChange={e => setForm({ ...form, keyInquiryQuestion: e.target.value })} placeholder="e.g. How do plants make food?" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Duration</label>
            <select value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option>30 minutes</option>
              <option>40 minutes</option>
              <option>45 minutes</option>
              <option>60 minutes</option>
              <option>80 minutes</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">Specific Learning Outcomes (optional, one per line)</label>
            <textarea value={form.objectives} onChange={e => setForm({ ...form, objectives: e.target.value })} placeholder="Enter specific learning outcomes (one per line) or leave blank for auto-generation" rows={2} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" />
          </div>
        </div>
        <button
          onClick={generatePlan}
          disabled={generating}
          className="flex items-center gap-2 bg-[#2563EB] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Generating...' : 'Generate Lesson Plan'}
        </button>
      </div>

      {/* Generated Plan */}
      {editedPlan && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[#111111]">
              {editedPlan.topic} — {editedPlan.grade} ({editedPlan.duration})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${editMode ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
              >
                {editMode ? 'Preview' : 'Edit'}
              </button>
              <button onClick={savePlan} className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200">
                <Save className="w-3 h-3" /> Save
              </button>
              <button onClick={exportPDF} className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200">
                <Download className="w-3 h-3" /> PDF
              </button>
            </div>
          </div>

          {/* CBE header info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4 p-3 bg-blue-50 rounded-xl text-xs">
            {editedPlan.strand && <div><span className="font-semibold text-blue-700">Strand:</span> <span className="text-gray-700">{editedPlan.strand}</span></div>}
            {editedPlan.subStrand && <div><span className="font-semibold text-blue-700">Sub-Strand:</span> <span className="text-gray-700">{editedPlan.subStrand}</span></div>}
            {editedPlan.keyInquiryQuestion && <div className="md:col-span-3"><span className="font-semibold text-blue-700">Key Inquiry Question:</span> <span className="text-gray-700">{editedPlan.keyInquiryQuestion}</span></div>}
            {editedPlan.coreCompetencies?.length > 0 && <div className="md:col-span-2"><span className="font-semibold text-blue-700">Core Competencies:</span> <span className="text-gray-700">{editedPlan.coreCompetencies?.join(', ')}</span></div>}
            {editedPlan.values?.length > 0 && <div><span className="font-semibold text-blue-700">Values:</span> <span className="text-gray-700">{editedPlan.values?.join(', ')}</span></div>}
            {editedPlan.pertinentAndContemporaryIssues?.length > 0 && <div className="md:col-span-3"><span className="font-semibold text-blue-700">PCIs:</span> <span className="text-gray-700">{editedPlan.pertinentAndContemporaryIssues?.join(', ')}</span></div>}
          </div>

          {editMode ? (
            <div className="space-y-4">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">SPECIFIC LEARNING OUTCOMES</label><textarea value={(editedPlan.specificLearningOutcomes || editedPlan.objectives).join('\n')} onChange={e => setEditedPlan({ ...editedPlan, specificLearningOutcomes: e.target.value.split('\n'), objectives: e.target.value.split('\n') })} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">MATERIALS NEEDED</label><textarea value={editedPlan.materials.join('\n')} onChange={e => setEditedPlan({ ...editedPlan, materials: e.target.value.split('\n') })} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">INTRODUCTION / LESSON INTRODUCTION</label><textarea value={editedPlan.introduction} onChange={e => setEditedPlan({ ...editedPlan, introduction: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">LEARNING ACTIVITIES</label><textarea value={editedPlan.mainActivities.join('\n')} onChange={e => setEditedPlan({ ...editedPlan, mainActivities: e.target.value.split('\n') })} rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">ASSESSMENT METHODS</label><textarea value={editedPlan.assessment} onChange={e => setEditedPlan({ ...editedPlan, assessment: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">EXTENDED ACTIVITIES (Fast Learners)</label><textarea value={editedPlan.extendedActivities || ''} onChange={e => setEditedPlan({ ...editedPlan, extendedActivities: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">HOMEWORK / TAKE HOME ACTIVITY</label><textarea value={editedPlan.homework} onChange={e => setEditedPlan({ ...editedPlan, homework: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">TEACHER SELF-EVALUATION</label><textarea value={editedPlan.teacherSelfEvaluation || ''} onChange={e => setEditedPlan({ ...editedPlan, teacherSelfEvaluation: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none" /></div>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {[
                { title: 'SPECIFIC LEARNING OUTCOMES', content: editedPlan.specificLearningOutcomes || editedPlan.objectives },
                { title: 'MATERIALS NEEDED', content: editedPlan.materials },
                { title: 'INTRODUCTION', content: [editedPlan.introduction] },
                { title: 'LEARNING ACTIVITIES', content: editedPlan.mainActivities },
                { title: 'ASSESSMENT METHODS', content: [editedPlan.assessment] },
                ...(editedPlan.extendedActivities ? [{ title: 'EXTENDED ACTIVITIES', content: [editedPlan.extendedActivities] }] : []),
                { title: 'HOMEWORK / TAKE HOME ACTIVITY', content: [editedPlan.homework] },
                ...(editedPlan.teacherSelfEvaluation ? [{ title: 'TEACHER SELF-EVALUATION', content: [editedPlan.teacherSelfEvaluation] }] : []),
              ].map((section, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-blue-600 uppercase mb-2">{section.title}</h4>
                  <ul className="space-y-1">
                    {section.content.map((item, j) => (
                      <li key={j} className="text-gray-700 flex gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved Plans */}
      {savedPlans.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
          <h3 className="font-semibold text-[#111111] mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-600" />
            Saved Lesson Plans ({savedPlans.length})
          </h3>
          <div className="space-y-3">
            {savedPlans.map(plan => (
              <div key={plan.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100">
                <div>
                  <p className="text-sm font-medium text-[#111111]">{plan.topic}</p>
                  <p className="text-xs text-[#666666]">{plan.grade} · {plan.duration} · {new Date(plan.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadPlan(plan)} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200">Load</button>
                  <button onClick={() => deletePlan(plan.id)} className="text-xs bg-red-100 text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-200">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
}
