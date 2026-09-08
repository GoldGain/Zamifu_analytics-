import { useEffect, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, Download, Save, Loader2, BookOpen, Users, FileSpreadsheet, X, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { sortByAdmissionNumber } from '@/lib/student-order';
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
  teacher_id: string | null;
  school_id?: string | null;
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

interface LogoAsset {
  dataUrl: string;
  extension: 'png' | 'jpeg' | 'gif';
  format: 'PNG' | 'JPEG' | 'GIF';
}

async function loadLogoAsset(url?: string | null): Promise<LogoAsset | null> {
  if (!url) return null;
  try {
    if (url.startsWith('data:image/')) {
      const match = url.match(/^data:image\/(png|jpeg|jpg|gif);/i);
      const extension = match?.[1]?.toLowerCase() === 'jpg' ? 'jpeg' : (match?.[1]?.toLowerCase() as LogoAsset['extension']) || 'png';
      return { dataUrl: url, extension, format: extension.toUpperCase() === 'JPEG' ? 'JPEG' : extension.toUpperCase() as LogoAsset['format'] };
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const mime = blob.type.toLowerCase();
    const extension: LogoAsset['extension'] = mime.includes('jpeg') || mime.includes('jpg') ? 'jpeg' : mime.includes('gif') ? 'gif' : 'png';
    const format: LogoAsset['format'] = extension === 'jpeg' ? 'JPEG' : extension.toUpperCase() as LogoAsset['format'];
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
    }
    return { dataUrl: `data:${mime || `image/${extension}`};base64,${btoa(binary)}`, extension, format };
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ClassListWorkspace({ admin = false }: { admin?: boolean }) {
  const { user, schoolData } = useAuth();
  const isAdmin = admin || user?.role === 'school_admin';
  const schoolId = user?.schoolId || '';
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [columns, setColumns] = useState<ClassListColumn[]>([]);
  const [cellData, setCellData] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [editingCell, setEditingCell] = useState<{ studentId: string; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchClasses();
  }, [user?.id, user?.role, schoolId, isAdmin]);

  useEffect(() => {
    if (selectedClass && (isAdmin || teacherId)) {
      fetchStudents();
      fetchColumnsAndData();
    }
  }, [selectedClass, teacherId, isAdmin, schoolId]);

  const fetchClasses = async () => {
    if (!user?.id || !schoolId) return;
    try {
      let resolvedTeacherId: string | null = null;
      if (!isAdmin) {
        const { data: teacherData } = await supabaseUntyped
          .from('teachers')
          .select('id, school_id')
          .eq('profile_id', user.id)
          .maybeSingle();
        if (!teacherData) {
          toast.error('Teacher profile not found');
          return;
        }
        resolvedTeacherId = teacherData.id;
        setTeacherId(resolvedTeacherId);
      } else {
        setTeacherId(null);
      }

      let query = supabaseUntyped
        .from('classes')
        .select('id, name, stream')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (resolvedTeacherId) {
        const { data: assignments } = await supabaseUntyped
          .from('teacher_subject_assignments')
          .select('class_id')
          .eq('teacher_id', resolvedTeacherId)
          .eq('is_active', true);
        const assignedIds = [...new Set((assignments || []).map((a: any) => a.class_id).filter(Boolean))];
        if (assignedIds.length > 0) query = query.in('id', assignedIds);
      }

      const { data: classesData, error } = await query;
      if (error) throw error;
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
        .eq('school_id', schoolId)
        .eq('class_id', selectedClass)
        .or('status.eq.active,status.is.null')
        .eq('is_active', true);
      if (error) throw error;
      setStudents(sortByAdmissionNumber(data || []));
    } catch (err: any) {
      toast.error('Failed to load students: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchColumnsAndData = async () => {
    if (!selectedClass || (!isAdmin && !teacherId) || !schoolId) return;
    setLoading(true);
    try {
      let query = supabaseUntyped
        .from('class_list_columns')
        .select('*')
        .eq('class_id', selectedClass)
        .order('sort_order', { ascending: true });
      query = isAdmin ? query.eq('school_id', schoolId) : query.eq('teacher_id', teacherId);
      const { data: columnsData, error: columnsError } = await query;
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
    } finally {
      setLoading(false);
    }
  };

  const addColumn = async () => {
    if (!newColumnName.trim() || !selectedClass || (!isAdmin && !teacherId) || !schoolId) return;
    setSaving(true);
    try {
      const { data, error } = await supabaseUntyped
        .from('class_list_columns')
        .insert({
          teacher_id: isAdmin ? null : teacherId,
          school_id: schoolId,
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
    } finally {
      setSaving(false);
    }
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
        { column_id: columnId, student_id: studentId, value, updated_at: new Date().toISOString() },
        { onConflict: 'column_id,student_id' },
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
    } finally {
      setSaving(false);
    }
  };

  const exportRows = () => students.map((student, index) => [
    String(index + 1),
    student.admission_number || '',
    `${student.first_name || ''} ${student.last_name || ''}`.trim(),
    ...columns.map((column) => cellData[student.id]?.[column.id] || ''),
  ]);

  const downloadPdf = async () => {
    if (!students.length) {
      toast.error('No students to export');
      return;
    }
    setDownloading(true);
    try {
      const className = classes.find((c) => c.id === selectedClass)?.name || 'Class';
      const logo = await loadLogoAsset(schoolData?.logo_url || user?.avatarUrl);
      const doc = new jsPDF({ orientation: columns.length > 0 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
      let titleX = 14;
      if (logo) {
        doc.addImage(logo.dataUrl, logo.format, 14, 8, 24, 20);
        titleX = 42;
      }
      doc.setFontSize(14);
      doc.text(schoolData?.name || 'School', titleX, 14);
      doc.setFontSize(12);
      doc.text(`Class List — ${className}`, titleX, 21);
      doc.setFontSize(9);
      doc.text(`Generated ${new Date().toLocaleString()}`, titleX, 27);

      autoTable(doc, {
        startY: 34,
        margin: { left: 8, right: 8 },
        head: [['#', 'Admission No.', 'Name', ...columns.map((c) => c.column_name)]],
        body: exportRows(),
        theme: 'grid',
        tableWidth: 'auto',
        showHead: 'everyPage',
        styles: {
          fontSize: columns.length > 6 ? 5.5 : columns.length > 3 ? 6.5 : 8,
          cellPadding: columns.length > 6 ? 1 : 1.5,
          overflow: 'linebreak',
          lineColor: [210, 214, 220],
          lineWidth: 0.1,
          valign: 'middle',
        },
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { cellWidth: 9, halign: 'center' },
          1: { cellWidth: 25 },
          2: { cellWidth: columns.length > 5 ? 38 : 48 },
        },
        didParseCell: (data) => {
          if (data.section === 'head') data.cell.styles.minCellHeight = 8;
        },
      });
      doc.save(`class-list-${className.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      toast.success('PDF downloaded with school branding');
    } catch (err: any) {
      toast.error('PDF failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  const downloadExcel = async () => {
    if (!students.length) {
      toast.error('No students to export');
      return;
    }
    setDownloading(true);
    try {
      const ExcelJS = await import('exceljs');
      const className = classes.find((c) => c.id === selectedClass)?.name || 'Class';
      const logo = await loadLogoAsset(schoolData?.logo_url || user?.avatarUrl);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Class List');
      const totalColumns = 3 + columns.length;
      sheet.mergeCells(1, 1, 1, totalColumns);
      sheet.getCell('A1').value = schoolData?.name || 'School';
      sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: '1D4ED8' } };
      sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getRow(1).height = 42;
      sheet.mergeCells(2, 1, 2, totalColumns);
      sheet.getCell('A2').value = `Class List — ${className}`;
      sheet.getCell('A2').font = { bold: true, size: 13 };
      sheet.getCell('A2').alignment = { horizontal: 'center' };
      sheet.mergeCells(3, 1, 3, totalColumns);
      sheet.getCell('A3').value = `Generated ${new Date().toLocaleString()}`;
      sheet.getCell('A3').font = { italic: true, size: 10, color: { argb: '666666' } };
      sheet.getCell('A3').alignment = { horizontal: 'center' };
      if (logo) {
        const imageId = workbook.addImage({ base64: logo.dataUrl, extension: logo.extension });
        sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 96, height: 56 } });
      }
      const headerRow = sheet.addRow(['#', 'Admission No.', 'Name', ...columns.map((c) => c.column_name)]);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2563EB' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      exportRows().forEach((row) => sheet.addRow(row));
      sheet.columns = [
        { width: 8 },
        { width: 18 },
        { width: 28 },
        ...columns.map(() => ({ width: 18 })),
      ];
      sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + students.length, column: totalColumns } };
      sheet.views = [{ state: 'frozen', ySplit: 4 }];
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `class-list-${className.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
      toast.success('Excel file downloaded with school branding');
    } catch (err: any) {
      toast.error('Excel export failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-blue-600" /> {isAdmin ? 'Class Lists' : 'Class List'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin ? 'Review every class, add custom columns, and download branded class lists.' : 'View learners, add custom columns, record values, and download branded class lists.'}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-sm">
          {schoolData?.logo_url || user?.avatarUrl ? <img src={schoolData?.logo_url || user?.avatarUrl || ''} alt="School logo" className="h-10 w-10 rounded-lg object-contain" /> : <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg">{(schoolData?.name || 'S')[0]}</div>}
          <div><p className="text-xs font-semibold text-gray-800">{schoolData?.name || 'School'}</p><p className="text-[11px] text-gray-500">Logo on PDF &amp; Excel</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedClass && (
            <>
              <button type="button" onClick={() => setShowAddColumn(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                <Plus className="w-4 h-4" /> Add Column
              </button>
              <button type="button" onClick={downloadPdf} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF
              </button>
              <button type="button" onClick={downloadExcel} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-full sm:w-80 rounded-xl border border-gray-200 px-3 py-2 text-sm">
          <option value="">Select class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.stream ? ` (${c.stream})` : ''}</option>)}
        </select>
      </div>

      {showAddColumn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3"><h3 className="font-semibold text-gray-900">Add Column</h3><button type="button" onClick={() => setShowAddColumn(false)}><X className="w-4 h-4" /></button></div>
            <input value={newColumnName} onChange={(e) => setNewColumnName(e.target.value)} placeholder="e.g. CAT 1, Assignment, Behaviour" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm mb-3" />
            <div className="flex gap-2"><button type="button" onClick={() => setShowAddColumn(false)} className="flex-1 rounded-xl border px-3 py-2 text-sm">Cancel</button><button type="button" onClick={addColumn} disabled={saving || !newColumnName.trim()} className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">{saving ? 'Saving…' : 'Add'}</button></div>
          </div>
        </div>
      )}

      {selectedClass && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100"><div className="flex items-center gap-2 text-sm text-gray-600"><Users className="w-4 h-4" /> {students.length} learners · {columns.length} columns</div>{saving && <span className="text-xs text-blue-600 flex items-center gap-1"><Save className="w-3 h-3" /> Saving…</span>}</div>
          {loading ? <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : students.length === 0 ? <div className="p-12 text-center text-gray-500 text-sm">No active learners in this class.</div> : (
            <div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm"><thead className="bg-gray-50 text-left"><tr>
              <th className="border border-gray-200 px-3 py-2 font-semibold text-gray-600 sticky left-0 bg-gray-50">#</th>
              <th className="border border-gray-200 px-3 py-2 font-semibold text-gray-600 sticky left-8 bg-gray-50">Adm No.</th>
              <th className="border border-gray-200 px-3 py-2 font-semibold text-gray-600 sticky left-28 bg-gray-50 min-w-[160px]">Name</th>
              {columns.map((col) => <th key={col.id} className="border border-gray-200 px-3 py-2 font-semibold text-gray-600 min-w-[120px]"><div className="flex items-center gap-2"><span>{col.column_name}</span><button type="button" onClick={() => deleteColumn(col.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></div></th>)}
            </tr></thead><tbody>
              {students.map((s, idx) => <tr key={s.id} className="border-t border-gray-50 hover:bg-slate-50/60">
                <td className="border border-gray-200 px-3 py-2 text-gray-400 sticky left-0 bg-white">{idx + 1}</td>
                <td className="border border-gray-200 px-3 py-2 font-mono text-xs sticky left-8 bg-white">{s.admission_number}</td>
                <td className="border border-gray-200 px-3 py-2 font-medium text-gray-800 sticky left-28 bg-white">{s.first_name} {s.last_name}</td>
                {columns.map((col) => {
                  const isEditing = editingCell?.studentId === s.id && editingCell?.columnId === col.id;
                  const value = cellData[s.id]?.[col.id] || '';
                  return <td key={col.id} className="border border-gray-200 px-2 py-1">{isEditing ? <div className="flex items-center gap-1"><input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveCell(s.id, col.id, editValue); if (e.key === 'Escape') setEditingCell(null); }} className="w-full rounded-lg border border-blue-300 px-2 py-1 text-sm" /><button type="button" onClick={() => saveCell(s.id, col.id, editValue)} className="text-green-600"><Check className="w-4 h-4" /></button></div> : <button type="button" onClick={() => { setEditingCell({ studentId: s.id, columnId: col.id }); setEditValue(value); }} className="w-full min-h-[32px] rounded-lg px-2 py-1 text-left hover:bg-blue-50 text-gray-700">{value || <span className="text-gray-300">—</span>}</button>}</td>;
                })}
                {columns.length === 0 && <td className="border border-gray-200 px-4 py-3 text-gray-300 italic">No columns yet — click Add Column</td>}
              </tr>)}
            </tbody></table></div>
          )}
        </div>
      )}

      {!selectedClass && <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" /><h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Class</h3><p className="text-gray-500 text-sm max-w-md mx-auto">Choose a class to view learners in ascending admission-number order, add columns, record information, and export a branded PDF or Excel class list.</p></div>}
    </div>
  );
}
