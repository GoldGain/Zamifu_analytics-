import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Users, Save, Loader2, Award, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Learner {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  gender: string;
  marks: Record<string, number | null>;
}

interface Subject {
  id: string;
  name: string;
}

export default function ClassRank() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [learners, setLearners] = useState<Learner[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchInitialData(); }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchSubjectsAndLearners();
    }
  }, [selectedClass]);

  const fetchInitialData = async () => {
    const schoolId = user?.schoolId;
    const [{ data: cls }, { data: trm }, { data: exm }] = await Promise.all([
      supabaseUntyped.from('classes').select('id, name').eq('school_id', schoolId).order('name'),
      supabaseUntyped.from('terms').select('id, name, academic_year').eq('school_id', schoolId).order('academic_year', { ascending: false }),
      supabaseUntyped.from('school_exams').select('id, name').eq('school_id', schoolId),
    ]);
    setClasses(cls || []);
    setTerms(trm || []);
    setExams(exm || []);
  };

  const fetchSubjectsAndLearners = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const schoolId = user?.schoolId;
      // Get subjects for this class
      const { data: subj } = await supabaseUntyped
        .from('subjects')
        .select('id, name')
        .eq('school_id', schoolId)
        .order('name');
      
      setSubjects(subj || []);

      // Get learners in this class
      const { data: students } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number, gender')
        .eq('class_id', selectedClass)
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('first_name');

      // Initialize learners with empty marks
      const learnersWithMarks: Learner[] = (students || []).map(s => ({
        ...s,
        marks: {},
      }));

      // If term and exam are selected, load existing marks
      if (selectedTerm && selectedExam) {
        const { data: results } = await supabaseUntyped
          .from('results')
          .select('student_id, subject_id, marks, percentage')
          .eq('class_id', selectedClass)
          .eq('term_id', selectedTerm)
          .eq('school_id', schoolId);

        if (results) {
          results.forEach((r: any) => {
            const learner = learnersWithMarks.find(l => l.id === r.student_id);
            if (learner) {
              learner.marks[r.subject_id] = r.marks ?? r.percentage ?? null;
            }
          });
        }
      }

      setLearners(learnersWithMarks);
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    }
    setLoading(false);
  };

  const handleMarkChange = (learnerId: string, subjectId: string, value: string) => {
    const num = value === '' ? null : parseFloat(value);
    setLearners(prev => prev.map(l => {
      if (l.id !== learnerId) return l;
      return { ...l, marks: { ...l.marks, [subjectId]: num } };
    }));
  };

  const saveMarks = async () => {
    if (!selectedClass || !selectedTerm || !selectedExam) {
      toast.error('Please select class, term, and assessment');
      return;
    }

    setSaving(true);
    try {
      const schoolId = user?.schoolId;
      let saved = 0;

      for (const learner of learners) {
        for (const [subjectId, mark] of Object.entries(learner.marks)) {
          if (mark === null || isNaN(mark)) continue;

          const outOf = 100; // Default out_of
          const percentage = Math.round((mark / outOf) * 100);

          // Upsert result
          const { error } = await supabaseUntyped
            .from('results')
            .upsert({
              school_id: schoolId,
              class_id: selectedClass,
              term_id: selectedTerm,
              exam_id: selectedExam,
              student_id: learner.id,
              subject_id: subjectId,
              marks: mark,
              out_of: outOf,
              percentage: percentage,
              converted_marks: mark,
              status: 'draft',
            }, {
              onConflict: 'school_id,class_id,term_id,exam_id,student_id,subject_id',
            });

          if (!error) saved++;
        }
      }

      toast.success(`${saved} marks saved successfully!`);
    } catch (err: any) {
      toast.error('Failed to save marks: ' + err.message);
    }
    setSaving(false);
  };

  const exportToPDF = () => {
    if (!learners.length) { toast.error('No learners to export'); return; }
    const doc = new jsPDF({ orientation: 'landscape' });
    const cls = classes.find(c => c.id === selectedClass);
    const trm = terms.find(t => t.id === selectedTerm);
    const exm = exams.find(e => e.id === selectedExam);

    doc.setFontSize(14);
    doc.text(`Class Rank List - ${cls?.name || ''}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Term: ${trm?.name || ''} ${trm?.academic_year || ''} | Assessment: ${exm?.name || 'General'}`, 14, 22);

    const headers = ['No.', 'Assessment #', 'Learner Name', 'Gender', ...subjects.map(s => s.name), 'Total', 'Average'];
    const body = learners.map((l, i) => {
      const total = Object.values(l.marks).reduce((sum, m) => sum + (m || 0), 0);
      const count = subjects.length;
      const avg = count > 0 ? (total / count).toFixed(1) : '0';
      return [
        String(i + 1),
        l.admission_number,
        `${l.first_name} ${l.last_name}`,
        l.gender || '-',
        ...subjects.map(s => l.marks[s.id] !== null && l.marks[s.id] !== undefined ? String(l.marks[s.id]) : ''),
        String(total),
        String(avg),
      ];
    });

    autoTable(doc, { head: [headers], body, startY: 28, styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] } });
    doc.save(`class-rank-${cls?.name || 'class'}.pdf`);
    toast.success('PDF exported!');
  };

  const filteredLearners = learners.filter(l =>
    !search ||
    l.first_name.toLowerCase().includes(search.toLowerCase()) ||
    l.last_name.toLowerCase().includes(search.toLowerCase()) ||
    l.admission_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Class Rank List</h1>
        <p className="text-sm text-[#666666]">Enter marks for all learners in a class</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Class *</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Term *</label>
            <select value={selectedTerm} onChange={e => { setSelectedTerm(e.target.value); }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">Select Term</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assessment *</label>
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">Select Assessment</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchSubjectsAndLearners}
              disabled={!selectedClass}
              className="w-full px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              Load Learners
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search learners..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
        </div>
      </div>

      {/* Learners Table with Mark Entry */}
      {learners.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#2563EB] text-white">
                  <th className="text-left text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-8">#</th>
                  <th className="text-left text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-28">Assessment #</th>
                  <th className="text-left text-xs font-semibold uppercase px-3 py-3 border border-blue-700">Learner Name</th>
                  <th className="text-left text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-16">Gender</th>
                  {subjects.map(s => (
                    <th key={s.id} className="text-center text-xs font-semibold uppercase px-2 py-3 border border-blue-700 min-w-20">
                      <div className="writing-mode-vertical">{s.name}</div>
                    </th>
                  ))}
                  <th className="text-center text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-16">Total</th>
                  <th className="text-center text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-16">Avg</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5 + subjects.length} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : filteredLearners.length === 0 ? (
                  <tr><td colSpan={5 + subjects.length} className="text-center py-8 text-sm text-gray-500">No learners found</td></tr>
                ) : (
                  filteredLearners.map((learner, idx) => {
                    const total = Object.values(learner.marks).reduce((sum, m) => sum + (m || 0), 0);
                    const filledCount = Object.values(learner.marks).filter(m => m !== null && m !== undefined).length;
                    const avg = filledCount > 0 ? (total / filledCount).toFixed(1) : '-';
                    return (
                      <tr key={learner.id} className="border-b border-gray-100 hover:bg-blue-50/30 even:bg-gray-50/30">
                        <td className="px-3 py-2 border border-gray-100 text-center text-xs text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2 border border-gray-100 text-xs font-mono text-gray-600">{learner.admission_number}</td>
                        <td className="px-3 py-2 border border-gray-100">
                          <span className="font-medium text-gray-900">{learner.first_name} {learner.last_name}</span>
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-xs text-gray-600 capitalize">{learner.gender || '-'}</td>
                        {subjects.map(s => (
                          <td key={s.id} className="px-1 py-1 border border-gray-100 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={learner.marks[s.id] ?? ''}
                              onChange={e => handleMarkChange(learner.id, s.id, e.target.value)}
                              className="w-full px-1 py-1.5 text-center text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent bg-white"
                              placeholder="-"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 border border-gray-100 text-center font-semibold text-gray-800">{total > 0 ? total.toFixed(0) : '-'}</td>
                        <td className="px-3 py-2 border border-gray-100 text-center font-semibold text-blue-600">{avg}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-gray-100 flex flex-wrap gap-3">
            <button
              onClick={saveMarks}
              disabled={saving || !selectedTerm || !selectedExam}
              className="flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save All Marks'}
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700"
            >
              <Download className="w-4 h-4" /> Export PDF
            </button>
            <span className="text-xs text-gray-500 flex items-center ml-auto">
              <Users className="w-3 h-3 mr-1" /> {filteredLearners.length} learners · {subjects.length} subjects
            </span>
          </div>
        </div>
      )}

      {!selectedClass && (
        <div className="bg-white rounded-2xl p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Select a class, term, and assessment to load the rank list</p>
        </div>
      )}
    </div>
  );
}
