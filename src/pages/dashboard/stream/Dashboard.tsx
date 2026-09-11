import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  BarChart3, Users, Loader2, TrendingUp, Award, BookOpen,
  Search, Download, FileSpreadsheet, Trophy, GitCompareArrows,
  ListOrdered, Layers, AlertCircle,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getSchoolLevelBand, is844Curriculum, calculateCompetencyGrade, calculate844Grade } from '@/lib/grading';

interface StreamClass {
  id: string;
  name: string;
  stream: string | null;
  label: string;
  curriculum: string | null;
  level: number | null;
  grade_level: number | null;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_id: string;
}

interface ResultRow {
  student_id: string;
  class_id: string;
  subject_id: string;
  percentage: number | null;
  marks: number | null;
  out_of: number | null;
  cbc_points: number | null;
  points_844: number | null;
  cbc_sublevel: string | null;
  cbc_grade: string | null;
  grade_844: string | null;
  exam_id: string | null;
}

interface StudentStats {
  avg: number | null;
  totalPoints: number;
  count: number;
}

interface OverviewRow {
  classId: string;
  label: string;
  learners: number;
  withResults: number;
  average: number | null;
  points: number | null;
  grade: string;
  rank: number | null;
}

interface SubjectMatrixRow {
  subjectId: string;
  subjectName: string;
  byClass: Record<string, number | null>;
  bestClassId: string | null;
  bestAvg: number | null;
  diff: number | null;
}

interface LearnerRank {
  classId: string;
  label: string;
  studentId: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  avg: number | null;
  points: number;
  grade: string;
  position: number | null;
}

type TabKey = 'overview' | 'subjects' | 'rankings' | 'comparison';

export default function StreamDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [classes, setClasses] = useState<StreamClass[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);

  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedExam, setSelectedExam] = useState<string>('');

  const [overview, setOverview] = useState<OverviewRow[]>([]);
  const [subjectMatrix, setSubjectMatrix] = useState<SubjectMatrixRow[]>([]);
  const [rankings, setRankings] = useState<LearnerRank[]>([]);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const classById = new Map(classes.map((c) => [c.id, c]));

  useEffect(() => {
    if (user?.schoolId) fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedGrade && selectedTerm) fetchStreamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrade, selectedTerm, selectedExam]);

  const streamLabel = (c: any): string => {
    const base = String(c?.name || 'Class').trim();
    const stream = String(c?.stream || '').trim();
    return stream ? `${base} ${stream}` : (base || 'Unassigned stream');
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [{ data: classesData }, { data: termsData }, { data: examsData }] = await Promise.all([
        supabaseUntyped
          .from('classes')
          .select('id, name, stream, curriculum, level, grade_level, is_active')
          .eq('school_id', user?.schoolId)
          .eq('is_active', true)
          .order('level', { ascending: true })
          .order('name', { ascending: true }),
        supabaseUntyped
          .from('terms')
          .select('*')
          .eq('school_id', user?.schoolId)
          .order('academic_year', { ascending: false })
          .order('name', { ascending: true }),
        supabaseUntyped
          .from('school_exams')
          .select('id, name, type, term_id, is_active, target_type, target_grade_level')
          .eq('school_id', user?.schoolId)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
      ]);
      const streamClasses: StreamClass[] = (classesData || []).map((c: any) => ({
        id: c.id, name: c.name, stream: c.stream ?? null,
        label: streamLabel(c), curriculum: c.curriculum ?? null,
        level: c.level ?? null, grade_level: c.grade_level ?? null,
      }));
      setClasses(streamClasses);
      const gradeNames: string[] = [];
      streamClasses.forEach((c) => { if (!gradeNames.includes(c.name)) gradeNames.push(c.name); });
      gradeNames.sort((a, b) => {
        const an = parseInt(String(a).replace(/[^0-9]/g, ''), 10) || 999;
        const bn = parseInt(String(b).replace(/[^0-9]/g, ''), 10) || 999;
        return an - bn;
      });
      setGrades(gradeNames);
      if (gradeNames.length > 0) setSelectedGrade(gradeNames[0]);
      const allTerms = termsData || [];
      setTerms(allTerms);
      const current = allTerms.find((t: any) => t.is_current);
      if (allTerms.length > 0) setSelectedTerm(current?.id || allTerms[0].id);
      setExams(examsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const gradeFor = (r: ResultRow): string => {
    const c = r.class_id ? classById.get(r.class_id) : undefined;
    return c?.name || '';
  };

  const fetchStreamData = async () => {
    if (!selectedGrade || !selectedTerm) return;
    setLoadingData(true);
    try {
      const streamClasses = classes
        .filter((c) => c.name === selectedGrade)
        .sort((a, b) => (a.stream || a.name).localeCompare(b.stream || b.name));
      const classIds = streamClasses.map((c) => c.id);
      if (classIds.length === 0) {
        setOverview([]); setSubjectMatrix([]); setRankings([]);
        return;
      }

      const [{ data: students }, { data: results }, subjectRes] = await Promise.all([
        supabaseUntyped
          .from('students')
          .select('id, first_name, last_name, admission_number, class_id')
          .in('class_id', classIds)
          .eq('is_active', true)
          .range(0, 9999),
        (() => {
          let q: any = supabaseUntyped
            .from('results')
            .select('student_id, class_id, subject_id, percentage, marks, out_of, cbc_points, points_844, cbc_sublevel, cbc_grade, grade_844, exam_id')
            .in('class_id', classIds)
            .eq('term_id', selectedTerm);
          if (selectedExam) q = q.eq('exam_id', selectedExam);
          return q.range(0, 9999);
        })(),
        (async () => {
          const subjectIds = await (async () => {
            const r2 = await supabaseUntyped
              .from('results')
              .select('subject_id')
              .in('class_id', classIds)
              .eq('term_id', selectedTerm);
            return [...new Set(((selectedExam ? r2.data || [] : r2.data) || []).map((x: any) => x.subject_id).filter(Boolean))];
          })();
          if (subjectIds.length === 0) return { data: [], error: null };
          return supabaseUntyped.from('subjects').select('id, name').in('id', subjectIds);
        })(),
      ]);

      const studentList: StudentRow[] = (students || []) as StudentRow[];
      const resultList: ResultRow[] = (results || []) as ResultRow[];
      const subjectRows: any[] = (subjectRes?.data || []) as any[];
      const subjectName = new Map(subjectRows.map((s: any) => [s.id, s.name]));

      const pctOf = (r: ResultRow): number => {
        if (r.percentage != null) return Math.round(r.percentage);
        if (r.out_of && r.out_of > 0) return Math.round(((r.marks ?? 0) / r.out_of) * 100);
        return 0;
      };

      const pointsOf = (r: ResultRow): number => {
        const c = classById.get(r.class_id);
        if (is844Curriculum(c)) return r.points_844 ?? calculate844Grade(pctOf(r)).points;
        const band = getSchoolLevelBand(c);
        if (band === 'primary') return 0;
        return r.cbc_points ?? calculateCompetencyGrade(pctOf(r), band).points;
      };

      const statsByStudent: Record<string, StudentStats> = {};
      const subjectAgg: Record<string, { name: string; byClass: Record<string, { sum: number; count: number }> }> = {};
      const studentClass: Record<string, string> = {};

      resultList.forEach((r) => {
        const sid = r.student_id;
        if (!statsByStudent[sid]) statsByStudent[sid] = { avg: null, totalPoints: 0, count: 0 };
        const pct = pctOf(r);
        statsByStudent[sid].count += 1;
        statsByStudent[sid].totalPoints += pointsOf(r);
        studentClass[sid] = r.class_id;
        const sub = r.subject_id;
        if (!subjectAgg[sub]) subjectAgg[sub] = { name: subjectName.get(sub) || sub, byClass: {} };
        const clsId = r.class_id;
        if (!subjectAgg[sub].byClass[clsId]) subjectAgg[sub].byClass[clsId] = { sum: 0, count: 0 };
        subjectAgg[sub].byClass[clsId].sum += pct;
        subjectAgg[sub].byClass[clsId].count += 1;
      });
      Object.keys(statsByStudent).forEach((sid) => {
        const s = statsByStudent[sid];
        s.avg = s.count > 0 ? Math.round(s.totalPoints === 0 && classById.get(studentClass[sid]) ? (() => {
          // primary band has no points; avg is computed from percentages independently
          return s.avg;
        })() : s.avg) : null;
      });
      // Recompute averages from percentages (points are tracked separately)
      const pctSum: Record<string, { sum: number; count: number }> = {};
      resultList.forEach((r) => {
        if (!pctSum[r.student_id]) pctSum[r.student_id] = { sum: 0, count: 0 };
        pctSum[r.student_id].sum += pctOf(r);
        pctSum[r.student_id].count += 1;
      });
      Object.keys(pctSum).forEach((sid) => {
        const rec = pctSum[sid];
        statsByStudent[sid].avg = rec.count > 0 ? Math.round(rec.sum / rec.count) : null;
      });

      const gradeFromAvg = (c: StreamClass | undefined, avg: number | null): string => {
        if (avg === null) return '';
        if (is844Curriculum(c)) return calculate844Grade(avg).grade;
        const band = getSchoolLevelBand(c);
        const cg = calculateCompetencyGrade(avg, band);
        return band === 'primary' ? cg.grade : cg.subLevel;
      };

      // ---- Stream overview ----
      const rosterByClass: Record<string, number> = {};
      studentList.forEach((s) => { rosterByClass[s.class_id] = (rosterByClass[s.class_id] || 0) + 1; });
      const overviewRows: OverviewRow[] = streamClasses.map((c) => {
        const ids = studentList.filter((s) => s.class_id === c.id).map((s) => s.id);
        const avgs = ids.map((id) => statsByStudent[id]?.avg).filter((v): v is number => v != null);
        const pts = ids.map((id) => statsByStudent[id]?.totalPoints ?? 0);
        const nonZeroPts = pts.filter((p) => p > 0);
        const bandCheck = getSchoolLevelBand(c);
        return {
          classId: c.id,
          label: c.label,
          learners: rosterByClass[c.id] || ids.length,
          withResults: avgs.length,
          average: avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null,
          points: (bandCheck === 'primary' || nonZeroPts.length === 0) ? null : Math.round(pts.reduce((a, b) => a + b, 0) / pts.length),
          grade: gradeFromAvg(c, avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null),
          rank: null,
        };
      });
      const sortedOverview = [...overviewRows].sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
      sortedOverview.forEach((row, i) => { row.rank = row.average === null ? null : i + 1; });
      setOverview(sortedOverview);

      // ---- Subject matrix ----
      const matrix: SubjectMatrixRow[] = Object.keys(subjectAgg).map((subId) => {
        const agg = subjectAgg[subId];
        const byClass: Record<string, number | null> = {};
        streamClasses.forEach((c) => {
          const b = agg.byClass[c.id];
          byClass[c.id] = b && b.count > 0 ? Math.round(b.sum / b.count) : null;
        });
        let bestClassId: string | null = null;
        let bestAvg: number | null = null;
        let minAvg: number | null = null;
        streamClasses.forEach((c) => {
          const v = byClass[c.id];
          if (v == null) return;
          if (bestAvg === null || v > bestAvg) { bestAvg = v; bestClassId = c.id; }
          if (minAvg === null || v < minAvg) minAvg = v;
        });
        return {
          subjectId: subId,
          subjectName: agg.name,
          byClass,
          bestClassId,
          bestAvg,
          diff: bestAvg !== null && minAvg !== null ? Math.round((bestAvg - minAvg) * 10) / 10 : null,
        };
      }).sort((a, b) => b.subjectName.localeCompare(a.subjectName));
      setSubjectMatrix(matrix);

      // ---- Student rankings per stream ----
      const rankRows: LearnerRank[] = [];
      streamClasses.forEach((c) => {
        const ids = studentList.filter((s) => s.class_id === c.id);
        const withResults = ids
          .map((s) => ({ student: s, stats: statsByStudent[s.id] }))
          .filter((x) => x.stats && x.stats.avg !== null);
        withResults.sort((a, b) => (b.stats!.avg ?? -1) - (a.stats!.avg ?? -1));
        withResults.forEach((x, idx) => {
          const stats = x.stats!;
          rankRows.push({
            classId: c.id,
            label: c.label,
            studentId: x.student.id,
            first_name: x.student.first_name,
            last_name: x.student.last_name,
            admission_number: x.student.admission_number,
            avg: stats.avg,
            points: stats.totalPoints,
            grade: gradeFromAvg(c, stats.avg),
            position: idx + 1,
          });
        });
      });
      setRankings(rankRows);
    } catch (err) {
      console.error(err);
      setOverview([]); setSubjectMatrix([]); setRankings([]);
    } finally {
      setLoadingData(false);
    }
  };

  const topStream = overview.find((r) => r.rank === 1) || null;
  const filteredRankings = rankings.filter((r) =>
    `${r.first_name} ${r.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    (r.admission_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const avgColor = (avg: number) => {
    if (avg >= 75) return 'text-green-600';
    if (avg >= 50) return 'text-blue-600';
    if (avg >= 30) return 'text-orange-600';
    return 'text-red-600';
  };
  const gradeColor = (grade: string) => {
    if (grade?.startsWith('EE') || grade === 'A' || grade === 'A-') return 'bg-green-100 text-green-700';
    if (grade?.startsWith('ME') || grade?.startsWith('B')) return 'bg-blue-100 text-blue-700';
    if (grade?.startsWith('AE') || grade?.startsWith('C')) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const termName = terms.find((t) => t.id === selectedTerm);
  const examName = exams.find((e) => e.id === selectedExam);

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Stream Dashboard — ' + (selectedGrade || 'All'), '', '', '', '', '', ''],
      ['Term', termName ? `${termName.name} ${termName.academic_year || ''}` : (selectedTerm || '')],
      ['Assessment', examName ? examName.name : 'All Assessments'],
      [],
      ['Stream Overview'],
      ['Rank', 'Stream', 'Learners', 'Results In', 'Average %', 'Points', 'Grade'],
      ...overview.map((r) => [r.rank ?? '', r.label, r.learners, r.withResults, r.average ?? '', r.points ?? '', r.grade]),
      [],
      ['Subject Performance by Stream'],
      ['Subject', ...overview.map((r) => r.label), 'Best Stream', 'Highest %', 'Diff'],
      ...subjectMatrix.map((m) => [
        m.subjectName,
        ...overview.map((o) => m.byClass[o.classId] ?? ''),
        m.bestClassId ? classById.get(m.bestClassId)?.label || '' : '',
        m.bestAvg ?? '',
        m.diff ?? '',
      ]),
      [],
      ['Student Rankings per Stream'],
      ['Stream', 'Pos', 'Student', 'Adm No', 'Average %', 'Points', 'Grade'],
      ...rankings.map((r) => [r.label, r.position ?? '', `${r.first_name} ${r.last_name}`, r.admission_number || '', r.avg ?? '', r.points, r.grade]),
    ]), { sheetName: 'Stream Dashboard' });
    XLSX.writeFile(wb, `stream_dashboard_${(selectedGrade || 'grade').replace(/\s+/g, '_')}_${(termName?.name || 'term').replace(/\s+/g, '_')}.xlsx`);
  };

  const downloadPdf = () => {
    if (overview.length === 0 && rankings.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(16); doc.text('Stream Dashboard', 14, 14);
    doc.setFontSize(9); doc.text(`Grade: ${selectedGrade || 'All'}  |  Term: ${termName ? `${termName.name} ${termName.academic_year || ''}` : (selectedTerm || '')}  |  Assessment: ${examName ? examName.name : 'All'}`, 14, 20);
    const startY = 26;
    if (overview.length) {
      doc.setFontSize(11); doc.text('Stream Overview', 14, startY + 2);
      autoTable(doc, {
        startY: startY + 5,
        head: [['Rank', 'Stream', 'Learners', 'Results In', 'Average %', 'Points', 'Grade']],
        body: overview.map((r) => [r.rank ?? '', r.label, r.learners, r.withResults, r.average ?? '', r.points ?? '', r.grade].map((v) => String(v ?? ''))),
        styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [37, 99, 235] }, theme: 'grid',
      });
    }
    if (subjectMatrix.length) {
      doc.addPage();
      doc.setFontSize(11); doc.text('Subject Performance by Stream', 14, 15);
      autoTable(doc, {
        startY: 20,
        head: [['Subject', ...overview.map((r) => r.label), 'Best', 'Diff']],
        body: subjectMatrix.map((m) => [
          m.subjectName,
          ...overview.map((o) => m.byClass[o.classId] != null ? `${m.byClass[o.classId]}%` : ''),
          m.bestClassId ? classById.get(m.bestClassId)?.label || '' : '',
          m.diff != null ? `+${m.diff}%` : '',
        ].map((v) => String(v ?? ''))),
        styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [16, 185, 129] }, theme: 'grid',
      });
    }
    if (rankings.length) {
      const labels = [...new Set(rankings.map((r) => r.label))];
      labels.forEach((label) => {
        doc.addPage();
        doc.setFontSize(11); doc.text(`Student Rankings — ${label}`, 14, 15);
        autoTable(doc, {
          startY: 20,
          head: [['Pos', 'Student', 'Adm No', 'Average %', 'Points', 'Grade']],
          body: rankings.filter((r) => r.label === label).map((r) => [r.position ?? '', `${r.first_name} ${r.last_name}`, r.admission_number || '', r.avg ?? '', r.points, r.grade].map((v) => String(v ?? ''))),
          styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [245, 158, 11] }, theme: 'grid',
        });
      });
    }
    doc.save(`stream_dashboard_${(selectedGrade || 'grade').replace(/\s+/g, '_')}_${(termName?.name || 'term').replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: 'Stream Overview', icon: Layers },
    { key: 'subjects', label: 'Subject Performance', icon: BookOpen },
    { key: 'rankings', label: 'Student Rankings', icon: ListOrdered },
    { key: 'comparison', label: 'Stream Comparison', icon: GitCompareArrows },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">Stream Dashboard</h1>
          <p className="text-sm text-[#666666]">Compare streams, subjects and learners across a grade.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl shadow-sm border border-gray-200">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            <select
              value={selectedGrade}
              onChange={(e) => { setSelectedGrade(e.target.value); setSelectedExam(''); }}
              className="text-sm font-medium border-none focus:ring-0 bg-transparent"
            >
              {grades.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            {terms.length > 0 && (
              <select
                value={selectedTerm}
                onChange={(e) => { setSelectedTerm(e.target.value); setSelectedExam(''); }}
                className="text-sm font-medium border-none focus:ring-0 bg-transparent"
              >
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name} {t.academic_year}</option>)}
              </select>
            )}
          </div>
          {exams.length > 0 && (
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
            >
              <option value="">All Assessments</option>
              {exams.filter((e) => !e.term_id || e.term_id === selectedTerm).map((e) => (
                <option key={e.id} value={e.id}>{e.name} {e.type ? `(${e.type})` : ''}</option>
              ))}
            </select>
          )}
          <button onClick={downloadPdf} disabled={overview.length === 0 && rankings.length === 0} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={downloadExcel} disabled={overview.length === 0 && rankings.length === 0} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1"><Layers className="w-4 h-4 text-blue-600" /><span className="text-xs text-gray-500">Streams</span></div>
          <div className="text-2xl font-bold text-gray-900">{overview.length}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-green-600" /><span className="text-xs text-gray-500">Learners</span></div>
          <div className="text-2xl font-bold text-gray-900">{overview.reduce((s, r) => s + r.learners, 0)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-purple-600" /><span className="text-xs text-gray-500">Scored Learners</span></div>
          <div className="text-2xl font-bold text-gray-900">{overview.reduce((s, r) => s + r.withResults, 0)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-1"><Trophy className="w-4 h-4 text-yellow-600" /><span className="text-xs text-gray-500">Top Stream</span></div>
          <div className="text-lg font-bold text-gray-900 truncate">{topStream ? topStream.label : '—'}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {loadingData ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : overview.length === 0 && rankings.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-gray-300">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No results uploaded for this grade and term yet.</p>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Stream Overview — {selectedGrade}</h3>
                  <p className="text-xs text-gray-500 mt-1">Ranking of every stream in this grade for the selected term and assessment.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Rank</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Stream</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Learners</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Results In</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Average %</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Points</th>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {overview.map((row) => (
                        <tr key={row.classId} className="hover:bg-gray-50">
                          <td className="py-3 px-6">
                            {row.rank !== null ? (
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${row.rank === 1 ? 'bg-yellow-100 text-yellow-700' : row.rank === 2 ? 'bg-gray-200 text-gray-700' : row.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>{row.rank}</span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-3 px-6 font-medium text-gray-900">{row.label}</td>
                          <td className="py-3 px-6 text-gray-600">{row.learners}</td>
                          <td className="py-3 px-6 text-gray-600">{row.withResults}</td>
                          <td className={`py-3 px-6 font-bold ${row.average === null ? 'text-gray-300' : avgColor(row.average)}`}>{row.average === null ? '—' : `${row.average}%`}</td>
                          <td className="py-3 px-6 text-gray-600">{row.points === null ? '—' : row.points}</td>
                          <td className="py-3 px-6">{row.grade ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeColor(row.grade)}`}>{row.grade}</span> : <span className="text-gray-300">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {topStream && (
                <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-5">
                  <Trophy className="w-8 h-8 text-yellow-500" />
                  <div>
                    <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Top Stream</p>
                    <p className="font-bold text-gray-900">{topStream.label} <span className="text-sm font-medium text-gray-500">({topStream.average}% average{topStream.points !== null ? `, ${topStream.points} pts` : ''})</span></p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'subjects' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Subject Performance by Stream — {selectedGrade}</h3>
                  <p className="text-xs text-gray-500 mt-1">Average score per subject for each stream. Best stream highlighted.</p>
                </div>
                {subjectMatrix.length === 0 ? (
                  <div className="p-10 text-center text-gray-500 text-sm">No subject results found.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                          {overview.map((o) => (
                            <th key={o.classId} className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">{o.label}</th>
                          ))}
                          <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Best</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {subjectMatrix.map((m) => (
                          <tr key={m.subjectId} className="hover:bg-gray-50">
                            <td className="py-3 px-6 font-medium text-gray-900">{m.subjectName}</td>
                            {overview.map((o) => {
                              const v = m.byClass[o.classId];
                              const isBest = m.bestClassId === o.classId;
                              return (
                                <td key={o.classId} className="py-3 px-6">
                                  {v === null ? <span className="text-gray-300">—</span> : (
                                    <span className={`font-bold ${isBest ? 'text-green-600' : avgColor(v)}${isBest ? ' flex items-center gap-1' : ''}`}>
                                      {v}%{isBest && <Trophy className="w-3 h-3 text-yellow-500 inline" />}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-3 px-6 text-gray-600">{m.bestClassId ? (classById.get(m.bestClassId)?.label || '') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'rankings' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search students by name or admission number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              {[...new Set(rankings.map((r) => r.label))].map((label) => {
                const rows = filteredRankings.filter((r) => r.label === label);
                if (rows.length === 0) return null;
                return (
                  <div key={label} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" />
                      <h3 className="font-bold text-gray-900">{label}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Pos</th>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Student</th>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Adm No</th>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Average %</th>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Points</th>
                            <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {rows.map((r) => (
                            <tr key={r.studentId} className="hover:bg-gray-50">
                              <td className="py-3 px-6">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${r.position === 1 ? 'bg-yellow-100 text-yellow-700' : r.position === 2 ? 'bg-gray-200 text-gray-700' : r.position === 3 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>{r.position}</span>
                              </td>
                              <td className="py-3 px-6 font-medium text-gray-900">{r.first_name} {r.last_name}</td>
                              <td className="py-3 px-6 text-gray-500">{r.admission_number}</td>
                              <td className={`py-3 px-6 font-bold ${r.avg !== null ? avgColor(r.avg) : 'text-gray-300'}`}>{r.avg !== null ? `${r.avg}%` : '—'}</td>
                              <td className="py-3 px-6 text-gray-600">{r.points || '—'}</td>
                              <td className="py-3 px-6">{r.grade ? <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeColor(r.grade)}`}>{r.grade}</span> : <span className="text-gray-300">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              {filteredRankings.length === 0 && <div className="bg-white rounded-2xl p-10 text-center text-gray-500 text-sm">No students match your search.</div>}
            </div>
          )}

          {activeTab === 'comparison' && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900">Stream Comparison — {selectedGrade}</h3>
                  <p className="text-xs text-gray-500 mt-1">Side-by-side subject averages and the gap between the strongest and weakest stream.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Subject</th>
                        {overview.map((o) => <th key={o.classId} className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">{o.label}</th>)}
                        <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Gap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {subjectMatrix.map((m) => (
                        <tr key={m.subjectId} className="hover:bg-gray-50">
                          <td className="py-3 px-6 font-medium text-gray-900">{m.subjectName}</td>
                          {overview.map((o) => {
                            const v = m.byClass[o.classId];
                            const isBest = m.bestClassId === o.classId;
                            return <td key={o.classId} className={`py-3 px-6 font-bold ${v === null ? 'text-gray-300' : isBest ? 'text-green-600' : avgColor(v)}`}>{v === null ? '—' : `${v}%`}</td>;
                          })}
                          <td className="py-3 px-6 text-gray-600">{m.diff !== null ? <span className="font-semibold text-blue-600">+{m.diff}%</span> : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <h3 className="font-bold text-gray-900 mb-3">Stream Ranking</h3>
                <ol className="space-y-2">
                  {overview.map((r) => (
                    <li key={r.classId} className="flex items-center gap-3 text-sm">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${r.rank === 1 ? 'bg-yellow-100 text-yellow-700' : r.rank === 2 ? 'bg-gray-200 text-gray-700' : r.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600'}`}>{r.rank ?? '—'}</span>
                      <span className="font-medium text-gray-900">{r.label}</span>
                      <span className={`ml-auto font-bold ${r.average !== null ? avgColor(r.average) : 'text-gray-300'}`}>{r.average !== null ? `${r.average}%` : '—'}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
