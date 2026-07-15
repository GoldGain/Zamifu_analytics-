import { useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, Download, Save, Loader2, BookOpen, Users, FileSpreadsheet, X, Check
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_id: string;
}

interface ClassListColumn {
  id: string;
  teacher_id: string;
  class_id: string | null;
  column_name: string;
  sort_order: number;
  created_at?: string;
}

interface ClassItem {
  id: string;
  name: string;
  stream?: string;
}

export default function ClassList() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [columns, setColumns] = useState<ClassListColumn[]>([]);
  const [cellData, setCellData] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingCell, setEditingCell] = useState<{ studentId: string; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchTeacherAndClasses();
  }, [user?.id]);

  useEffect(() => {
    if (selectedClass && teacherId) {
      fetchStudents();
      fetchColumnsAndData();
    }
  }, [selectedClass, teacherId]);

  const fetchTeacherAndClasses = async () => {
    if (!user?.id) return;
    try {
      const { data: teacherData } = await supabaseUntyped
        .from('teachers')
        .select('id, school_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!teacherData) {
        toast.error('Teacher profile not found');
        return;
      }
      setTeacherId(teacherData.id);

      // Prefer assigned classes; fall back to school classes
      const { data: assignments } = await supabaseUntyped
        .from('teacher_subject_assignments')
        .select('class_id')
        .eq('teacher_id', teacherData.id);

      const assignedIds = [...new Set((assignments || []).map((a: any) => a.class_id).filter(Boolean))];

      let query = supabaseUntyped
        .from('classes')
        .select('id, name, stream')
        .eq('school_id', teacherData.school_id)
        .order('name', { ascending: true });

      if (assignedIds.length > 0) {
        query = query.in('id', assignedIds);
      }

      const { data: classesData } = await query;
      setClasses(classesData || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load classes');
    }
  };

  const fetchStudents = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const { data, error } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number, class_id')
        .eq('class_id', selectedClass)
        .or('status.eq.active,status.is.null')
        .eq('is_active', true)
        .order('first_name', { ascending: true });
      if (error) throw error;
      setStudents(data || []);
    } catch (err: any) {
      toast.error('Failed to load students: ' + err.message);
    }
    setLoading(false);
  };

  const fetchColumnsAndData = async () => {
    if (!selectedClass || !teacherId) return;
    setLoading(true);
    try {
      const { data: columnsData, error: columnsError } = await supabaseUntyped
        .from('class_list_columns')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('teacher_id', teacherId)
        .order('sort_order', { ascending: true });
      if (columnsError) throw columnsError;
      setColumns(columnsData || []);

      if (columnsData && columnsData.length > 0) {
        const columnIds = columnsData.map((c: ClassListColumn) => c.id);
        const { data: dataRows, error: dataError } = await supabaseUntyped
          .from('class_list_data')
          .select('*')
          .in('column_id', columnIds);
        if (dataError) throw dataError;

        const organized: Record<string, Record<string, string>> = {};
        (dataRows || []).forEach((row: any) => {
          if (!organized[row.student_id]) organized[row.student_id] = {};
          organized[row.student_id][row.column_id] = row.value || '';
        });
        setCellData(organized);
      } else {
        setCellData({});
      }
    } catch (err: any) {
      toast.error('Failed to load class list: ' + err.message);
    }
    setLoading(false);
  };

  const addColumn = async () => {
    if (!newColumnName.trim() || !selectedClass || !teacherId) return;
    setSaving(true);
    try {
      const { data, error } = await supabaseUntyped
        .from('class_list_columns')
        .insert({
          teacher_id: teacherId,
          class_id: selectedClass,
          column_name: newColumnName.trim(),
          sort_order: columns.length,
        })
        .select()
        .single();
      if (error) throw error;
      setColumns((prev) => [...prev, data]);
      setNewColumnName('');
      setShowAddColumn(false);
      toast.success('Column added');
    } catch (err: any) {
      toast.error('Failed to add column: ' + err.message);
    }
    setSaving(false);
  };

  const deleteColumn = async (columnId: string) => {
    if (!confirm('Delete this column and all its values?')) return;
    try {
      const { error } = await supabaseUntyped.from('class_list_columns').delete().eq('id', columnId);
      if (error) throw error;
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      setCellData((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((sid) => {
          const row = { ...next[sid] };
          delete row[columnId];
          next[sid] = row;
        });
        return next;
      });
      toast.success('Column deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const saveCell = async (studentId: string, columnId: string, value: string) => {
    setSaving(true);
    try {
      const { error } = await supabaseUntyped.from('class_list_data').upsert(
        {
          column_id: columnId,
          student_id: studentId,
          value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'column_id,student_id' }
      );
      if (error) throw error;
      setCellData((prev) => ({
        ...prev,
        [studentId]: { ...(prev[studentId] || {}), [columnId]: value },
      }));
      setEditingCell(null);
      toast.success('Saved');
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    }
    setSaving(false);
  };

  const downloadPdf = () => {
    if (!students.length) {
      toast.error('No students to export');
      return;
    }
    setDownloading(true);
    try {
      const doc = new jsPDF({ orientation: columns.length > 3 ? 'landscape' : 'portrait' });
      const className = classes.find((c) => c.id === selectedClass)?.name || 'Class';
      doc.setFontSize(14);
      doc.text(`Class List — ${className}`, 14, 16);
      doc.setFontSize(10);
      doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);

      const head = [['#', 'Admission No.', 'Name', ...columns.map((c) => c.column_name)]];
      const body = students.map((s, i) => [
        String(i + 1),
        s.admission_number || '',
        `${s.first_name || ''} ${s.last_name || ''}`.trim(),
        ...columns.map((c) => cellData[s.id]?.[c.id] || ''),
      ]);

      autoTable(doc, {
        startY: 28,
        head,
        body,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
      });
      doc.save(`class-list-${className.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      toast.success('PDF downloaded');
    } catch (err: any) {
      toast.error('PDF failed: ' + err.message);
    }
    setDownloading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-blue-600" /> Class List
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View learners, add custom columns, record values, and download PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedClass && (
            <>
              <button
                type="button"
                onClick={() => setShowAddColumn(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Add Column
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={downloading}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PDF
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="w-full sm:w-80 rounded-xl border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">Select class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.stream ? ` (${c.stream})` : ''}
            </option>
          ))}
        </select>
      </div>

      {showAddColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Add Column</h3>
              <button type="button" onClick={() => setShowAddColumn(false)}><X className="w-4 h-4" /></button>
            </div>
            <input
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="e.g. CAT 1, Assignment, Behaviour"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-3"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowAddColumn(false)} className="flex-1 rounded-xl border px-3 py-2 text-sm">Cancel</button>
              <button
                type="button"
                onClick={addColumn}
                disabled={saving || !newColumnName.trim()}
                className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedClass && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" /> {students.length} learners · {columns.length} columns
            </div>
            {saving && <span className="text-xs text-blue-600 flex items-center gap-1"><Save className="w-3 h-3" /> Saving…</span>}
          </div>

          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : students.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No active learners in this class.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-50">#</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 sticky left-8 bg-gray-50">Adm No.</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 sticky left-28 bg-gray-50 min-w-[160px]">Name</th>
                    {columns.map((col) => (
                      <th key={col.id} className="px-3 py-2 font-semibold text-gray-600 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <span>{col.column_name}</span>
                          <button type="button" onClick={() => deleteColumn(col.id)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => (
                    <tr key={s.id} className="border-t border-gray-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-gray-400 sticky left-0 bg-white">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs sticky left-8 bg-white">{s.admission_number}</td>
                      <td className="px-3 py-2 font-medium text-gray-800 sticky left-28 bg-white">
                        {s.first_name} {s.last_name}
                      </td>
                      {columns.map((col) => {
                        const isEditing = editingCell?.studentId === s.id && editingCell?.columnId === col.id;
                        const value = cellData[s.id]?.[col.id] || '';
                        return (
                          <td key={col.id} className="px-2 py-1">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  autoFocus
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveCell(s.id, col.id, editValue);
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full rounded-lg border border-blue-300 px-2 py-1 text-sm"
                                />
                                <button type="button" onClick={() => saveCell(s.id, col.id, editValue)} className="text-green-600">
                                  <Check className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCell({ studentId: s.id, columnId: col.id });
                                  setEditValue(value);
                                }}
                                className="w-full min-h-[32px] rounded-lg px-2 py-1 text-left hover:bg-blue-50 text-gray-700"
                              >
                                {value || <span className="text-gray-300">—</span>}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      {columns.length === 0 && (
                        <td className="px-4 py-3 text-gray-300 italic">No columns yet — click Add Column</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedClass && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Class</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Choose a class to view Name and Admission Number, add columns, record information, and export PDF.
          </p>
        </div>
      )}
    </div>
  );
}
