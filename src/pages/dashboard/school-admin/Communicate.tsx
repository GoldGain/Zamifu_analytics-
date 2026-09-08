import { useEffect, useMemo, useState } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Loader2, MessageSquare, Users, UserCheck, Bell, CheckCircle, Search, CheckSquare, Square, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { sendBulkSMS } from '@/lib/sms';

type RecipientType = 'class' | 'teachers' | 'parents';
type Teacher = { id: string; first_name: string; last_name: string; phone?: string | null };
type SchoolClass = { id: string; name: string };
type StudentParentRow = {
  key: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  parentName: string;
  phone: string;
};
type SmsRecipient = { phone: string; label: string; prefix?: string };

export default function Communicate() {
  const { user } = useAuth();
  const [recipientType, setRecipientType] = useState<RecipientType>('class');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [parentRows, setParentRows] = useState<StudentParentRow[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedParentKeys, setSelectedParentKeys] = useState<string[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');
  const [includeStudentName, setIncludeStudentName] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchData(); }, [user?.schoolId]);

  const fetchData = async () => {
    const schoolId = user?.schoolId;
    if (!schoolId) return;
    const [{ data: classRows }, { data: teacherRows }, { data: studentRows }] = await Promise.all([
      supabaseUntyped.from('classes').select('id, name').eq('school_id', schoolId).eq('is_active', true).order('name'),
      supabaseUntyped.from('teachers').select('id, first_name, last_name, phone').eq('school_id', schoolId).eq('is_active', true).order('first_name'),
      supabaseUntyped.from('students').select('id, first_name, last_name, class_id, parent_name, parent_phone, parent2_name, parent2_phone, classes(name)').eq('school_id', schoolId).eq('is_active', true).order('admission_number'),
    ]);
    const classMap = new Map((classRows || []).map((item: SchoolClass) => [item.id, item.name]));
    const rows: StudentParentRow[] = [];
    (studentRows || []).forEach((student: any) => {
      const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unnamed student';
      const className = classMap.get(student.class_id) || student.classes?.name || 'No class';
      [[student.parent_phone, student.parent_name], [student.parent2_phone, student.parent2_name]].forEach(([phone, name], index) => {
        const normalizedPhone = String(phone || '').trim();
        if (normalizedPhone.length < 9) return;
        rows.push({
          key: `${student.id}-${normalizedPhone}-${index}`,
          studentId: student.id,
          studentName,
          classId: student.class_id,
          className,
          parentName: String(name || 'Parent').trim(),
          phone: normalizedPhone,
        });
      });
    });
    setClasses(classRows || []);
    setTeachers(teacherRows || []);
    setParentRows(rows);
  };

  const visibleParents = useMemo(() => parentRows
    .filter((row) => recipientType !== 'class' || !selectedClass || row.classId === selectedClass)
    .filter((row) => {
      const query = parentSearch.trim().toLowerCase();
      if (!query) return true;
      return `${row.parentName} ${row.studentName} ${row.className} ${row.phone}`.toLowerCase().includes(query);
    }), [parentRows, parentSearch, recipientType, selectedClass]);

  const visibleTeachers = useMemo(() => teachers.filter((teacher) => {
    const query = teacherSearch.trim().toLowerCase();
    return !query || `${teacher.first_name} ${teacher.last_name} ${teacher.phone || ''}`.toLowerCase().includes(query);
  }), [teachers, teacherSearch]);

  const activeParentRows = recipientType === 'class' ? visibleParents : parentRows;
  const selectedParentRows = parentRows.filter((row) => selectedParentKeys.includes(row.key));
  const selectedTeachers = teachers.filter((teacher) => selectedTeacherIds.includes(teacher.id));
  const recipientCount = recipientType === 'teachers' ? selectedTeachers.length : selectedParentRows.length;

  const selectAllTeachers = () => {
    const selectable = visibleTeachers.filter((teacher) => teacher.phone && teacher.phone.length >= 9).map((teacher) => teacher.id);
    setSelectedTeacherIds(selectedTeacherIds.length === selectable.length ? [] : selectable);
  };
  const selectAllParents = () => {
    const selectable = activeParentRows.map((row) => row.key);
    const allSelected = selectable.length > 0 && selectable.every((key) => selectedParentKeys.includes(key));
    setSelectedParentKeys(allSelected ? selectedParentKeys.filter((key) => !selectable.includes(key)) : [...new Set([...selectedParentKeys, ...selectable])]);
  };
  const toggleTeacher = (id: string) => setSelectedTeacherIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const toggleParent = (key: string) => setSelectedParentKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);

  const changeType = (type: RecipientType) => {
    setRecipientType(type);
    setSelectedTeacherIds([]);
    setSelectedParentKeys([]);
    setSelectedClass('');
    setTeacherSearch('');
    setParentSearch('');
  };

  const fetchRecipients = (): SmsRecipient[] => {
    if (recipientType === 'teachers') return selectedTeachers.filter((teacher) => teacher.phone && teacher.phone.length >= 9).map((teacher) => ({ phone: teacher.phone as string, label: `${teacher.first_name} ${teacher.last_name}` }));
    return selectedParentRows.map((row) => ({ phone: row.phone, label: `${row.parentName} (${row.studentName})`, prefix: includeStudentName ? `Dear ${row.parentName}, ${row.studentName}'s message: ` : '' }));
  };

  const handleSend = async () => {
    if (!message.trim()) { toast.error('Please enter a message'); return; }
    const recipients = fetchRecipients();
    if (recipients.length === 0) { toast.error('Select at least one recipient with a valid phone number'); return; }
    setSending(true);
    let successCount = 0;
    for (const recipient of recipients) {
      const result = await sendBulkSMS([recipient.phone], `${recipient.prefix || ''}${message}`, undefined, user?.schoolId || undefined);
      if (result.success) successCount += 1;
    }
    setSending(false);
    toast.success(`SMS sent to ${successCount} of ${recipients.length} selected recipient(s)`);
    if (successCount > 0) setMessage('');
  };

  const parentSelectionTitle = recipientType === 'class' ? 'Select parents in this class' : 'Select parents';
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div><h1 className="text-2xl font-bold text-[#111111]">Communicate</h1><p className="text-sm text-[#666666]">Select one, many, or all teachers and parents before sending an SMS.</p></div>

      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">Send to</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { type: 'class' as const, icon: Users, title: 'Parents by class', subtitle: 'Filter parents by class' },
            { type: 'parents' as const, icon: Bell, title: 'Parents', subtitle: 'Select many parents' },
            { type: 'teachers' as const, icon: UserCheck, title: 'Teachers', subtitle: 'Select many teachers' },
          ].map(({ type, icon: Icon, title, subtitle }) => <button key={type} type="button" onClick={() => changeType(type)} className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left ${recipientType === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 hover:border-gray-300'}`}><Icon className="w-5 h-5" /><span><strong className="block text-sm">{title}</strong><small className="text-xs text-gray-500">{subtitle}</small></span></button>)}
        </div>
      </div>

      {recipientType === 'class' && <div className="bg-white rounded-2xl p-5 border border-gray-100"><label className="block text-sm font-medium text-gray-700 mb-2">Choose class first</label><select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedParentKeys([]); }} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"><option value="">Select a class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>}

      {recipientType === 'teachers' && <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"><div className="p-5 border-b"><div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between"><div><h2 className="font-semibold">Choose teachers</h2><p className="text-xs text-gray-500">Tick as many teachers as you need.</p></div><button type="button" onClick={selectAllTeachers} className="inline-flex items-center gap-2 text-sm text-blue-700 font-medium"><CheckSquare className="w-4 h-4" /> {selectedTeacherIds.length === visibleTeachers.filter((t) => t.phone).length ? 'Unmark all' : 'Mark all'}</button></div><div className="relative mt-3"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} placeholder="Search teacher name or phone" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm" /></div></div><div className="max-h-72 overflow-y-auto divide-y">{visibleTeachers.map((teacher) => <label key={teacher.id} className="flex items-center gap-3 px-5 py-3 hover:bg-blue-50 cursor-pointer"><input type="checkbox" checked={selectedTeacherIds.includes(teacher.id)} disabled={!teacher.phone} onChange={() => toggleTeacher(teacher.id)} className="h-4 w-4 accent-blue-600" /><UserRound className="w-4 h-4 text-gray-400" /><span className="text-sm">{teacher.first_name} {teacher.last_name}<small className="block text-xs text-gray-500">{teacher.phone || 'No phone number'}</small></span></label>)}</div></div>}

      {(recipientType === 'parents' || (recipientType === 'class' && selectedClass)) && <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden"><div className="p-5 border-b"><div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between"><div><h2 className="font-semibold">{parentSelectionTitle}</h2><p className="text-xs text-gray-500">Each row shows the student name and the parent name, so you can identify the correct family.</p></div><button type="button" onClick={selectAllParents} className="inline-flex items-center gap-2 text-sm text-blue-700 font-medium"><CheckSquare className="w-4 h-4" /> Mark all visible</button></div><div className="relative mt-3"><Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input value={parentSearch} onChange={(e) => setParentSearch(e.target.value)} placeholder="Search student name, parent name, class, or phone" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm" /></div><label className="flex items-center gap-2 mt-3 text-sm text-gray-700"><input type="checkbox" checked={includeStudentName} onChange={(e) => setIncludeStudentName(e.target.checked)} className="h-4 w-4 accent-blue-600" /> Include student and parent names in the SMS message</label></div><div className="max-h-80 overflow-y-auto divide-y">{activeParentRows.map((row) => <label key={row.key} className="flex items-center gap-3 px-5 py-3 hover:bg-blue-50 cursor-pointer"><input type="checkbox" checked={selectedParentKeys.includes(row.key)} onChange={() => toggleParent(row.key)} className="h-4 w-4 accent-blue-600" />{selectedParentKeys.includes(row.key) ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-gray-300" />}<span className="text-sm"><strong className="text-gray-900">{row.studentName}</strong><span className="text-gray-400"> — Parent: </span><strong className="text-gray-700">{row.parentName}</strong><small className="block text-xs text-gray-500">{row.className} · {row.phone}</small></span></label>)}{activeParentRows.length === 0 && <p className="p-8 text-center text-sm text-gray-500">No parent phone records match your search.</p>}</div></div>}

      <div className="bg-white rounded-2xl p-6 border border-gray-100"><div className="flex items-center gap-2 mb-4"><CheckCircle className="w-4 h-4 text-green-600" /><span className="text-sm text-gray-600">{recipientCount} recipient(s) selected</span></div><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={recipientType === 'teachers' ? 'Write a message to the selected teachers...' : includeStudentName ? 'Write a message to the selected parents. The student and parent name can be included...' : 'Write a message to the selected parents...'} rows={5} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" /><div className="flex items-center justify-between mt-2"><p className="text-xs text-gray-400">{message.length} characters</p><p className="text-xs text-gray-400">Sender: ZAMIFU</p></div><button type="button" onClick={handleSend} disabled={sending || !message.trim() || recipientCount === 0} className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send SMS to {recipientCount} selected</>}</button></div>
    </div>
  );
}
