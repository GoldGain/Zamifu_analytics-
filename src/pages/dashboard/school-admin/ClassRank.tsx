import { useState, useEffect, useMemo } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Users, Save, Loader2, Award, Download, FileText, ChevronUp, ChevronDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateCompetencyGrade, getSchoolLevelBand } from '@/lib/grading';
import type { SchoolLevelBand } from '@/lib/grading';

interface Learner {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  gender: string;
  marks: Record<string, number | null>;
  total: number;
  average: number;
  rank: number;
  grade?: string;
}

interface Subject {
  id: string;
  name: string;
}

function overallGradeLabel(pct: number, band: SchoolLevelBand) {
  const g = calculateCompetencyGrade(pct, band);
  return { subLevel: g.subLevel, grade: g.grade, points: g.points };
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
  const [sortField, setSortField] = useState<'total' | 'average' | 'rank'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    const schoolId = user?.schoolId;
    try {
      const [{ data: cls }, { data: trm }, { data: exm }] = await Promise.all([
        supabaseUntyped.from('classes').select('id, name, curriculum, grade_level, level').eq('school_id', schoolId).order('name'),
        supabaseUntyped.from('terms').select('id, name, academic_year').eq('school_id', schoolId).order('academic_year', { ascending: false }),
        supabaseUntyped.from('school_exams').select('id, name, type, term_id, is_active').eq('school_id', schoolId).order('created_at', { ascending: false }),
      ]);
      setClasses(cls || []);
      setTerms(trm || []);
      setExams(exm || []);
    } catch (err: any) {
      toast.error('Failed to load initial data: ' + err.message);
    }
  };

  // Fetch subjects and results for the class+term+exam combo
  const loadResults = async () => {
    if (!selectedClass) { setLearners([]); return; }
    setLoading(true);
    try {
      const schoolId = user?.schoolId;

      // Get subjects for this school
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

      const studentsData = students || [];
      if (studentsData.length === 0) { setLearners([]); setLoading(false); return; }

      // Get results for this class+term+exam
      let resultsData: any[] = [];
      if (selectedTerm && selectedExam) {
        const { data: results } = await supabaseUntyped
          .from('results')
          .select('student_id, subject_id, marks, percentage, out_of')
          .eq('class_id', selectedClass)
          .eq('term_id', selectedTerm)
          .eq('exam_id', selectedExam)
          .eq('school_id', schoolId);
        resultsData = results || [];
      } else if (selectedTerm) {
        // If only term is selected (no exam), load all results for this class+term
        const { data: results } = await supabaseUntyped
          .from('results')
          .select('student_id, subject_id, marks, percentage, out_of')
          .eq('class_id', selectedClass)
          .eq('term_id', selectedTerm)
          .eq('school_id', schoolId);
        resultsData = results || [];
      } else if (selectedExam) {
        // If only exam is selected (no term), load results for this class+exam
        const { data: results } = await supabaseUntyped
          .from('results')
          .select('student_id, subject_id, marks, percentage, out_of')
          .eq('class_id', selectedClass)
          .eq('exam_id', selectedExam)
          .eq('school_id', schoolId);
        resultsData = results || [];
      } else {
        // Only class selected — load latest results for each student
        const { data: results } = await supabaseUntyped
          .from('results')
          .select('student_id, subject_id, marks, percentage, out_of')
          .eq('class_id', selectedClass)
          .eq('school_id', schoolId);
        resultsData = results || [];
      }

      // Build learner records with marks
      const classObj = classes.find(c => c.id === selectedClass);
      const band = getSchoolLevelBand(classObj);
      const isPrimary = band === 'primary';

      const learnerMap = new Map<string, {
        id: string; first_name: string; last_name: string; admission_number: string;
        gender: string; marks: Record<string, number | null>; total: number; count: number;
      }>();

      studentsData.forEach(s => {
        learnerMap.set(s.id, {
          id: s.id, first_name: s.first_name, last_name: s.last_name,
          admission_number: s.admission_number, gender: s.gender,
          marks: {}, total: 0, count: 0,
        });
      });

      // Group results by subject to get latest
      const subjectLatestResults: Record<string, Record<string, any>> = {};
      resultsData.forEach((r: any) => {
        const subjectId = r.subject_id;
        const studentId = r.student_id;
        if (!subjectLatestResults[subjectId]) subjectLatestResults[subjectId] = {};
        const existing = subjectLatestResults[subjectId][studentId];
        if (!existing || (r.created_at && r.created_at > (existing.created_at || ''))) {
          subjectLatestResults[subjectId][studentId] = r;
        }
      });

      // Apply marks to learners
      Object.entries(subjectLatestResults).forEach(([subjectId, studentResults]) => {
        Object.entries(studentResults).forEach(([studentId, result]: [string, any]) => {
          const learner = learnerMap.get(studentId);
          if (learner) {
            const mark = result.marks ?? null;
            learner.marks[subjectId] = mark;
            if (mark !== null) {
              learner.total += mark;
              learner.count++;
            }
          }
        });
      });

      // Convert to array, compute average, rank, and grade
      const learnerArray: Learner[] = Array.from(learnerMap.values()).map(l => ({
        id: l.id, first_name: l.first_name, last_name: l.last_name,
        admission_number: l.admission_number, gender: l.gender,
        marks: l.marks, total: l.total, average: l.count > 0 ? l.total / l.count : 0,
        rank: 0,
      }));

      // Sort by total descending for ranking
      learnerArray.sort((a, b) => b.total - a.total);
      learnerArray.forEach((l, i) => {
        l.rank = i + 1;
        const gradeInfo = overallGradeLabel(l.average, band);
        l.grade = isPrimary ? gradeInfo.grade : gradeInfo.subLevel;
      });

      // Re-sort by average descending
      learnerArray.sort((a, b) => b.average - a.average);
      learnerArray.forEach((l, i) => { l.rank = i + 1; });

      setLearners(learnerArray);
    } catch (err: any) {
      toast.error('Failed to load results: ' + err.message);
      console.error(err);
    }
    setLoading(false);
  };

  // Auto-load when class, term, and exam are selected
  useEffect(() => {
    if (selectedClass && selectedTerm && selectedExam) {
      loadResults();
    }
  }, [selectedClass, selectedTerm, selectedExam]);

  // Also load when just class + term are selected (no exam filter)
  useEffect(() => {
    if (selectedClass && selectedTerm && !selectedExam) {
      loadResults();
    }
  }, [selectedClass, selectedTerm]);

  const filteredLearners = useMemo(() => {
    let list = learners.filter(l =>
      !search ||
      l.first_name.toLowerCase().includes(search.toLowerCase()) ||
      l.last_name.toLowerCase().includes(search.toLowerCase()) ||
      l.admission_number.toLowerCase().includes(search.toLowerCase())
    );

    // Sort
    list.sort((a, b) => {
      if (sortField === 'rank') return sortDir === 'asc' ? a.rank - b.rank : b.rank - a.rank;
      if (sortField === 'total') return sortDir === 'asc' ? a.total - b.total : b.total - a.total;
      if (sortField === 'average') return sortDir === 'asc' ? a.average - b.average : b.average - a.average;
      return b.total - a.total;
    });

    return list;
  }, [learners, search, sortField, sortDir]);

  const handleSort = (field: 'rank' | 'total' | 'average') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const exportToPDF = () => {
    if (!filteredLearners.length) { toast.error('No learners to export'); return; }
    const doc = new jsPDF({ orientation: 'landscape' });
    const cls = classes.find(c => c.id === selectedClass);
    const trm = terms.find(t => t.id === selectedTerm);
    const exm = exams.find(e => e.id === selectedExam);
    const classObj = classes.find(c => c.id === selectedClass);
    const band = getSchoolLevelBand(classObj);
    const isPrimary = band === 'primary';

    doc.setFillColor(37, 99, 235); doc.rect(0, 0, 297, 15, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`CLASS RANK LIST — ${cls?.name || ''}`, 14, 10);
    doc.setFontSize(9);
    doc.text(`Term: ${trm?.name || ''} ${trm?.academic_year || ''}${exm ? ` | Assessment: ${exm.name}` : ''}`, 14, 22);
    doc.setTextColor(0, 0, 0);

    const shortNames = subjects.map(s => {
      if (s.name.length > 8) return s.name.substring(0, 8);
      return s.name;
    });

    const gradeCol = isPrimary ? 'Grade' : 'Sub-Level';
    const headers = ['Rank', 'Assessment #', 'Learner Name', 'Gender', ...shortNames, 'Total', 'Avg%', gradeCol];
    const body = filteredLearners.map((l, i) => {
      const gradeInfo = overallGradeLabel(l.average, band);
      const gradeLabel = isPrimary ? gradeInfo.grade : gradeInfo.subLevel;
      return [
        String(l.rank),
        l.admission_number,
        `${l.first_name} ${l.last_name}`,
        l.gender || '-',
        ...subjects.map(s => l.marks[s.id] !== null && l.marks[s.id] !== undefined ? String(l.marks[s.id]) : ''),
        String(l.total),
        `${l.average.toFixed(1)}%`,
        gradeLabel,
      ];
    });

    autoTable(doc, {
      head: [headers],
      body,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 255] },
    });

    doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    doc.text('Generated by Zamifu Analytics School Management System', 148.5, 205, { align: 'center' });
    doc.save(`class-rank-${cls?.name || 'class'}.pdf`);
    toast.success('Class Rank PDF exported!');
  };

  const saveAllMarks = async () => {
    if (!selectedClass || !selectedTerm) {
      toast.error('Please select class and term first');
      return;
    }

    setSaving(true);
    try {
      const schoolId = user?.schoolId;
      let saved = 0;

      for (const learner of learners) {
        for (const [subjectId, mark] of Object.entries(learner.marks)) {
          if (mark === null || isNaN(mark) || mark < 0) continue;

          const outOf = 100;
          const percentage = Math.round((mark / outOf) * 100);
          const classObj = classes.find(c => c.id === selectedClass);
          const band = getSchoolLevelBand(classObj);

          // Compute CBC grades
          const isPrimary = band === 'primary';
          const gradeInfo = calculateCompetencyGrade(mark, band);

          const { error } = await supabaseUntyped
            .from('results')
            .upsert({
              school_id: schoolId,
              class_id: selectedClass,
              term_id: selectedTerm,
              exam_id: selectedExam || null,
              student_id: learner.id,
              subject_id: subjectId,
              marks: mark,
              out_of: outOf,
              percentage: percentage,
              converted_marks: mark,
              cbc_sublevel: isPrimary ? undefined : gradeInfo.subLevel,
              cbc_grade: isPrimary ? gradeInfo.grade : undefined,
              cbc_points: isPrimary ? undefined : gradeInfo.points,
              cbc_descriptor: isPrimary ? undefined : gradeInfo.descriptor,
              status: 'draft',
            }, {
              onConflict: 'school_id,class_id,term_id,student_id,subject_id',
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

  const classObj = classes.find(c => c.id === selectedClass);
  const band = getSchoolLevelBand(classObj);
  const isPrimary = band === 'primary';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Class Rank List</h1>
        <p className="text-sm text-[#666666]">
          {learners.length > 0
            ? `${learners.length} learners ranked — ${subjects.length} learning areas`
            : 'Select a class, term, and assessment to view the rank list'}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Class *</label>
            <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedTerm(''); setSelectedExam(''); }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">Select Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Term *</label>
            <select value={selectedTerm} onChange={e => { setSelectedTerm(e.target.value); setSelectedExam(''); }}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">Select Term</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Assessment (optional)</label>
            <select value={selectedExam} onChange={e => setSelectedExam(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white">
              <option value="">All Assessments</option>
              {exams.filter(e => !e.term_id || e.term_id === selectedTerm).map(e => (
                <option key={e.id} value={e.id}>{e.name} {e.type ? `(${e.type})` : ''} {e.is_active ? '' : '[Inactive]'}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadResults}
              disabled={!selectedClass || !selectedTerm}
              className="w-full px-4 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
              {loading ? 'Loading...' : 'Load Rank List'}
            </button>
          </div>
        </div>

        {selectedClass && selectedTerm && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
              {classes.find(c => c.id === selectedClass)?.name}
            </span>
            <span className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-medium">
              {terms.find(t => t.id === selectedTerm)?.name} {terms.find(t => t.id === selectedTerm)?.academic_year}
            </span>
            {selectedExam && (
              <span className="text-xs px-3 py-1 bg-purple-50 text-purple-700 rounded-full font-medium">
                {exams.find(e => e.id === selectedExam)?.name}
              </span>
            )}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search learners by name or admission number..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-gray-50 rounded-xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
        </div>
      </div>

      {/* Summary Stats */}
      {learners.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Total Learners</p>
            <p className="text-2xl font-bold text-[#111111]">{learners.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Learning Areas</p>
            <p className="text-2xl font-bold text-[#111111]">{subjects.length}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Class Average</p>
            <p className="text-2xl font-bold text-blue-600">
              {learners.length > 0 ? (learners.reduce((s, l) => s + l.average, 0) / learners.length).toFixed(1) : 0}%
            </p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-gray-500">Top Performer</p>
            <p className="text-sm font-bold text-green-600 truncate">
              {learners[0] ? `${learners[0].first_name} ${learners[0].last_name}` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Learners Table */}
      {learners.length > 0 && (
        <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#2563EB] text-white">
                  <th
                    className="text-center text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-12 cursor-pointer hover:bg-blue-700"
                    onClick={() => handleSort('rank')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Rank
                      {sortField === 'rank' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="text-left text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-28">Assessment #</th>
                  <th className="text-left text-xs font-semibold uppercase px-3 py-3 border border-blue-700">Learner Name</th>
                  <th className="text-left text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-16">Gender</th>
                  {subjects.map(s => (
                    <th key={s.id} className="text-center text-xs font-semibold uppercase px-2 py-3 border border-blue-700 min-w-[100px]">
                      <div className="whitespace-nowrap">{s.name}</div>
                    </th>
                  ))}
                  <th
                    className="text-center text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-20 cursor-pointer hover:bg-blue-700"
                    onClick={() => handleSort('total')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Total
                      {sortField === 'total' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th
                    className="text-center text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-16 cursor-pointer hover:bg-blue-700"
                    onClick={() => handleSort('average')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Avg%
                      {sortField === 'average' && (sortDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="text-center text-xs font-semibold uppercase px-3 py-3 border border-blue-700 w-20">{isPrimary ? 'Grade' : 'Sub-Level'}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7 + subjects.length} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : filteredLearners.length === 0 ? (
                  <tr><td colSpan={7 + subjects.length} className="text-center py-8 text-sm text-gray-500">No learners match your search</td></tr>
                ) : (
                  filteredLearners.map((learner, idx) => {
                    const filledCount = Object.values(learner.marks).filter(m => m !== null && m !== undefined).length;
                    const allFilled = filledCount === subjects.length;
                    return (
                      <tr key={learner.id} className={`border-b border-gray-100 hover:bg-blue-50/30 ${idx < 3 ? 'bg-yellow-50/30' : idx % 2 === 0 ? 'bg-gray-50/30' : ''}`}>
                        <td className="px-3 py-2 border border-gray-100 text-center">
                          {learner.rank === 1 && <span className="text-yellow-500 text-base">🥇</span>}
                          {learner.rank === 2 && <span className="text-gray-400 text-base">🥈</span>}
                          {learner.rank === 3 && <span className="text-amber-600 text-base">🥉</span>}
                          {learner.rank > 3 && <span className="font-bold text-gray-700 text-sm">{learner.rank}</span>}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-xs font-mono text-gray-600">{learner.admission_number}</td>
                        <td className="px-3 py-2 border border-gray-100">
                          <span className="font-medium text-gray-900">{learner.first_name} {learner.last_name}</span>
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-xs text-gray-600 capitalize">{learner.gender || '-'}</td>
                        {subjects.map(s => (
                          <td key={s.id} className="px-2 py-2 border border-gray-100 text-center text-sm">
                            {learner.marks[s.id] !== null && learner.marks[s.id] !== undefined
                              ? <span className="font-medium">{learner.marks[s.id]}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-2 border border-gray-100 text-center font-semibold text-gray-800">
                          {learner.total > 0 ? learner.total : '—'}
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-center">
                          <span className={`font-bold text-sm ${learner.average >= 75 ? 'text-green-600' : learner.average >= 41 ? 'text-blue-600' : learner.average >= 21 ? 'text-amber-600' : 'text-red-600'}`}>
                            {learner.average > 0 ? `${learner.average.toFixed(1)}%` : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2 border border-gray-100 text-center">
                          {learner.grade ? (
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              learner.average >= 75 ? 'bg-green-100 text-green-700' :
                              learner.average >= 41 ? 'bg-blue-100 text-blue-700' :
                              learner.average >= 21 ? 'bg-amber-100 text-amber-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {learner.grade}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-gray-100 flex flex-wrap gap-3 items-center">
            <button
              onClick={saveAllMarks}
              disabled={saving || !selectedTerm}
              className="flex items-center gap-2 bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save All Marks'}
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-green-700"
            >
              <Download className="w-4 h-4" /> Export Rank List PDF
            </button>
            <span className="text-xs text-gray-500 flex items-center ml-auto">
              <Users className="w-3 h-3 mr-1" /> {filteredLearners.length} learners · {subjects.length} subjects
              {allFilled(filteredLearners) && <span className="ml-2 text-green-600 font-medium">All marks filled ✓</span>}
            </span>
          </div>
        </div>
      )}

      {!selectedClass && !loading && (
        <div className="bg-white rounded-2xl p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] text-center">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Select a class and term to load the rank list</p>
          <p className="text-xs text-gray-400 mt-1">Results will be loaded automatically from the database</p>
        </div>
      )}

      {loading && !learners.length && selectedClass && (
        <div className="bg-white rounded-2xl p-8 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#2563EB] mb-3" />
          <p className="text-sm text-gray-500">Loading results...</p>
        </div>
      )}
    </div>
  );
}

// Helper to check if all marks are filled
function allFilled(learners: any[]) {
  return learners.length > 0 && learners.every(l =>
    Object.values(l.marks).every(m => m !== null && m !== undefined && m > 0)
  );
}
