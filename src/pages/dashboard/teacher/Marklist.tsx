import { useState, useEffect, useRef } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, Download, Save, Loader2, BookOpen, Users, GraduationCap, FileSpreadsheet, X, Edit3, Check
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  class_id: string;
}

interface MarklistColumn {
  id: string;
  teacher_id: string;
  class_id: string;
  column_name: string;
  column_type: string;
  column_order: number;
  created_at: string;
}

interface MarklistData {
  id: string;
  marklist_column_id: string;
  student_id: string;
  value: string;
}

interface ClassItem {
  id: string;
  name: string;
  stream?: string;
}

export default function Marklist() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [columns, setColumns] = useState<MarklistColumn[]>([]);
  const [cellData, setCellData] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [teacherId, setTeacherId] = useState<string>('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('text');
  const [editingCell, setEditingCell] = useState<{ studentId: string; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Fetch teacher record and classes on mount
  useEffect(() => {
    fetchTeacherAndClasses();
  }, [user?.id]);

  // Fetch students and columns when class is selected
  useEffect(() => {
    if (selectedClass && teacherId) {
      fetchStudents();
      fetchColumnsAndData();
    }
  }, [selectedClass, teacherId]);

  const fetchTeacherAndClasses = async () => {
    if (!user?.id) return;
    try {
      // Get teacher record
      const { data: teacherData } = await supabaseUntyped
        .from('teachers')
        .select('id, school_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (teacherData) {
        setTeacherId(teacherData.id);

        // Fetch classes for this school
        const { data: classesData } = await supabaseUntyped
          .from('classes')
          .select('id, name, stream')
          .eq('school_id', teacherData.school_id)
          .order('name', { ascending: true });

        setClasses(classesData || []);
      }
    } catch (err) {
      console.error('Error fetching teacher data:', err);
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
        .eq('status', 'active')
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
      // Fetch columns
      const { data: columnsData, error: columnsError } = await supabaseUntyped
        .from('marklist_columns')
        .select('*')
        .eq('class_id', selectedClass)
        .eq('teacher_id', teacherId)
        .order('column_order', { ascending: true });

      if (columnsError) throw columnsError;
      setColumns(columnsData || []);

      // Fetch cell data
      if (columnsData && columnsData.length > 0) {
        const columnIds = columnsData.map((c: MarklistColumn) => c.id);
        const { data: dataRows, error: dataError } = await supabaseUntyped
          .from('marklist_data')
          .select('*')
          .in('marklist_column_id', columnIds);

        if (dataError) throw dataError;

        // Organize data by student_id -> column_id -> value
        const organized: Record<string, Record<string, string>> = {};
        (dataRows || []).forEach((row: MarklistData) => {
          if (!organized[row.student_id]) organized[row.student_id] = {};
          organized[row.student_id][row.marklist_column_id] = row.value || '';
        });
        setCellData(organized);
      } else {
        setCellData({});
      }
    } catch (err: any) {
      toast.error('Failed to load marklist data: ' + err.message);
    }
    setLoading(false);
  };

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) {
      toast.error('Please enter a column name');
      return;
    }
    if (!teacherId || !selectedClass) {
      toast.error('Please select a class first');
      return;
    }

    try {
      const { data, error } = await supabaseUntyped
        .from('marklist_columns')
        .insert({
          teacher_id: teacherId,
          class_id: selectedClass,
          column_name: newColumnName.trim(),
          column_type: newColumnType,
          column_order: columns.length,
        })
        .select()
        .single();

      if (error) throw error;

      setColumns([...columns, data]);
      setNewColumnName('');
      setNewColumnType('text');
      setShowAddColumn(false);
      toast.success('Column added successfully');
    } catch (err: any) {
      toast.error('Failed to add column: ' + err.message);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!confirm('Are you sure you want to delete this column? All data in this column will be lost.')) return;

    try {
      const { error } = await supabaseUntyped
        .from('marklist_columns')
        .delete()
        .eq('id', columnId);

      if (error) throw error;

      setColumns(columns.filter(c => c.id !== columnId));
      // Also remove from cellData
      const newCellData = { ...cellData };
      Object.keys(newCellData).forEach(studentId => {
        delete newCellData[studentId][columnId];
      });
      setCellData(newCellData);
      toast.success('Column deleted');
    } catch (err: any) {
      toast.error('Failed to delete column: ' + err.message);
    }
  };

  const handleCellEdit = (studentId: string, columnId: string, currentValue: string) => {
    setEditingCell({ studentId, columnId });
    setEditValue(currentValue || '');
  };

  const handleCellSave = async (studentId: string, columnId: string) => {
    setSaving(true);
    try {
      // Check if a record already exists
      const { data: existing } = await supabaseUntyped
        .from('marklist_data')
        .select('id')
        .eq('marklist_column_id', columnId)
        .eq('student_id', studentId)
        .maybeSingle();

      if (existing) {
        // Update
        const { error } = await supabaseUntyped
          .from('marklist_data')
          .update({ value: editValue, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabaseUntyped
          .from('marklist_data')
          .insert({
            marklist_column_id: columnId,
            student_id: studentId,
            value: editValue,
          });

        if (error) throw error;
      }

      // Update local state
      setCellData(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [columnId]: editValue,
        },
      }));

      setEditingCell(null);
      toast.success('Saved');
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    }
    setSaving(false);
  };

  const handleDownloadPDF = async () => {
    if (students.length === 0) {
      toast.error('No students to export');
      return;
    }
    setDownloading(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const className = classes.find(c => c.id === selectedClass)?.name || 'Unknown Class';

      // Title
      doc.setFontSize(16);
      doc.text(`Marklist - ${className}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`Generated on ${new Date().toLocaleDateString('en-KE')}`, 14, 28);
      doc.text(`Teacher: ${user?.firstName} ${user?.lastName}`, 14, 34);

      // Table headers
      const headers = ['#', 'Student Name', 'Admission No.', ...columns.map(c => c.column_name)];

      // Table rows
      const body = students.map((student, index) => [
        String(index + 1),
        `${student.first_name} ${student.last_name}`,
        student.admission_number || '-',
        ...columns.map(col => cellData[student.id]?.[col.id] || '-'),
      ]);

      autoTable(doc, {
        head: [headers],
        body,
        startY: 40,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 243, 239] },
      });

      doc.save(`marklist-${className.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('PDF downloaded');
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + err.message);
    }
    setDownloading(false);
  };

  const handleDownloadExcel = () => {
    if (students.length === 0) {
      toast.error('No students to export');
      return;
    }
    setDownloading(true);
    try {
      const className = classes.find(c => c.id === selectedClass)?.name || 'Unknown Class';
      const rows = students.map((student, index) => {
        const row: Record<string, string | number> = {
          '#': index + 1,
          'Student Name': `${student.first_name} ${student.last_name}`,
          'Admission No.': student.admission_number || '-',
        };
        columns.forEach((col) => {
          row[col.column_name] = cellData[student.id]?.[col.id] || '';
        });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Marklist');
      XLSX.writeFile(wb, `marklist-${className.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel downloaded');
    } catch (err: any) {
      toast.error('Failed to generate Excel: ' + err.message);
    }
    setDownloading(false);
  };

  const getCellValue = (studentId: string, columnId: string): string => {
    return cellData[studentId]?.[columnId] || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111111] flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-[#2563EB]" />
            Marklist
          </h1>
          <p className="text-sm text-[#666666] mt-1">
            Create dynamic columns and record student data
          </p>
        </div>
        {selectedClass && students.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download PDF
            </button>
            <button
              onClick={handleDownloadExcel}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
              Download Excel
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {selectedClass && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <div className="text-2xl font-bold text-blue-600">{students.length}</div>
            <div className="text-xs text-gray-500">Students</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <div className="text-2xl font-bold text-green-600">{columns.length}</div>
            <div className="text-xs text-gray-500">Columns</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {Object.values(cellData).reduce((sum, studentCells) => sum + Object.values(studentCells).filter(v => v).length, 0)}
            </div>
            <div className="text-xs text-gray-500">Entries</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {classes.find(c => c.id === selectedClass)?.name || '-'}
            </div>
            <div className="text-xs text-gray-500">Class</div>
          </div>
        </div>
      )}

      {/* Class Selector */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-[#2563EB]" />
          Select Class
        </label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="w-full sm:w-80 px-4 py-3 bg-gray-50 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <option value="">-- Choose a class --</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name} {cls.stream ? `(${cls.stream})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Add Column Button */}
      {selectedClass && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddColumn(!showAddColumn)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2563EB] text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Column
          </button>
        </div>
      )}

      {/* Add Column Form */}
      {showAddColumn && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New Column</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Column name (e.g., CAT 1, Assignment, Attendance)"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
            />
            <select
              value={newColumnType}
              onChange={(e) => setNewColumnType(e.target.value)}
              className="px-4 py-3 bg-gray-50 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
            </select>
            <button
              onClick={handleAddColumn}
              className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Add
            </button>
            <button
              onClick={() => { setShowAddColumn(false); setNewColumnName(''); }}
              className="flex items-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors text-sm font-medium"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Marklist Table */}
      {selectedClass && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2 text-sm">Loading...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No active students found in this class</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[#2563EB] text-white">
                    <th className="px-4 py-3 text-xs font-semibold uppercase whitespace-nowrap">#</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase whitespace-nowrap">Student Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase whitespace-nowrap">Admission No.</th>
                    {columns.map((col) => (
                      <th key={col.id} className="px-4 py-3 text-xs font-semibold uppercase whitespace-nowrap min-w-[120px]">
                        <div className="flex items-center justify-between gap-2">
                          <span>{col.column_name}</span>
                          <button
                            onClick={() => handleDeleteColumn(col.id)}
                            className="text-white/70 hover:text-white transition-colors"
                            title="Delete column"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                    {columns.length === 0 && (
                      <th className="px-4 py-3 text-xs font-semibold uppercase text-white/70">
                        No columns yet — click "Add Column" to start
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {student.admission_number || '-'}
                      </td>
                      {columns.map((col) => {
                        const cellKey = `${student.id}-${col.id}`;
                        const currentValue = getCellValue(student.id, col.id);
                        const isEditing = editingCell?.studentId === student.id && editingCell?.columnId === col.id;

                        return (
                          <td key={cellKey} className="px-4 py-2 min-w-[120px]">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type={col.column_type === 'number' ? 'number' : 'text'}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full px-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCellSave(student.id, col.id);
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleCellSave(student.id, col.id)}
                                  disabled={saving}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                >
                                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                </button>
                                <button
                                  onClick={() => setEditingCell(null)}
                                  className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleCellEdit(student.id, col.id, currentValue)}
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                                  currentValue
                                    ? 'text-gray-900 bg-gray-50 hover:bg-gray-100'
                                    : 'text-gray-300 bg-gray-50/50 hover:bg-gray-100 border border-dashed border-gray-200'
                                }`}
                              >
                                {currentValue || 'Click to edit'}
                              </button>
                            )}
                          </td>
                        );
                      })}
                      {columns.length === 0 && (
                        <td className="px-4 py-3 text-gray-300 italic">No columns added yet</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!selectedClass && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <BookOpen className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Class</h3>
          <p className="text-gray-500 text-sm max-w-md mx-auto">
            Choose a class from the dropdown above to view students and manage your marklist.
          </p>
        </div>
      )}
    </div>
  );
}
