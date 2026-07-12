import React, { useState, useEffect } from 'react';
import { supabase } from "@/lib/supabase/client";
import { supabaseUntyped } from "@/lib/supabase/client";
import { createScopedUser } from '@/lib/supabase/createUser';
import { useAuth } from '@/contexts/AuthContext';
import { useStudents } from '@/hooks/useSupabaseData';
import { Search, Plus, Loader2, Filter, Camera, Pencil, Trash2, X, ArrowUpDown, ChevronUp, ChevronDown, Users, Download, ChevronUp as ChevronUpIcon } from 'lucide-react';
import { toast } from 'sonner';
import { sendSMS, generateWelcomeSMS } from '@/lib/sms';
import type { GenderType } from '@/types/database';
import PromoteStudentModal from '@/components/PromoteStudentModal';
import PhotoUpload from '@/components/PhotoUpload';
import { useTrial } from '@/contexts/TrialContext';

type SortField = 'name' | 'assessment_number' | 'class' | 'gender';
type SortDir = 'asc' | 'desc';
type ViewMode = 'list' | 'by-grade';

const KENYA_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera',
  'Marsabit','Meru','Migori','Mombasa','Murang\'a','Nairobi','Nakuru','Nandi',
  'Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River',
  'Tharaka-Nithi','Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
];

export default function SchoolAdminStudents() {
  const { user } = useAuth();
  const { trialStatus } = useTrial();
  const { students, loading, refetch } = useStudents(user?.schoolId || undefined);
  const [classes, setClasses] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterClassId, setFilterClassId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  const defaultForm = {
    assessment_number: '', 
    student_email: '',
    first_name: '', 
    middle_name: '',
    last_name: '', 
    class_id: '',
    curriculum: 'CBE' as 'CBE',
    gender: '' as GenderType, 
    date_of_birth: '',
    birth_cert_number: '',
    nationality: 'Kenyan',
    county: '',
    sub_county: '',
    boarding_status: 'day',
    disability_status: '',
    parent_name: '', 
    parent_phone: '', 
    parent_email: '', 
    parent2_name: '',
    parent2_phone: '',
    parent2_email: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  };

  const [formData, setFormData] = useState(defaultForm);

  // Edit state
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    class_id: '',
    parent_name: '',
    parent_phone: '',
    parent_email: '',
    parent2_name: '',
    parent2_phone: '',
    parent2_email: '',
    gender: '' as GenderType,
    date_of_birth: '',
    birth_cert_number: '',
    nationality: 'Kenyan',
    county: '',
    sub_county: '',
    boarding_status: 'day',
    disability_status: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingStudent, setDeletingStudent] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!user?.schoolId) return;
      const { data } = await supabase
        .from('classes')
        .select('id, name, stream')
        .eq('school_id', user.schoolId)
        .order('name', { ascending: true });
      setClasses(data || []);
    };
    fetchClasses();
  }, [user?.schoolId]);

  const ensureParentAccount = async (parentEmail: string, parentName: string): Promise<string> => {
    const normalizedEmail = parentEmail.trim().toLowerCase();
    const { data: existingProfile } = await supabaseUntyped
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (existingProfile?.id) return existingProfile.id as string;
    const nameParts = (parentName || 'Parent').trim().split(' ');
    const firstName = nameParts[0] || 'Parent';
    const lastName = nameParts.slice(1).join(' ') || '';
    const result = await createScopedUser({
      email: normalizedEmail,
      password: 'Parent@2025',
      first_name: firstName,
      last_name: lastName,
      role: 'parent',
      school_id: user?.schoolId || null,
    });
    return result.user.id;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const studentEmail = formData.student_email || `${formData.assessment_number.toLowerCase().replace(/\s+/g, '')}@student.edu`;
      const studentPassword = `${formData.assessment_number}@2025`;
      const authData = await createScopedUser({
        email: studentEmail,
        password: studentPassword,
        first_name: formData.first_name,
        last_name: formData.last_name,
        role: 'student',
        school_id: user?.schoolId || null,
        metadata: { assessment_number: formData.assessment_number },
      });
      const studentUserId = authData.user.id;
      let parentId: string | null = null;
      if (formData.parent_email && formData.parent_email.trim()) {
        try {
          parentId = await ensureParentAccount(formData.parent_email, formData.parent_name);
        } catch (parentError: any) {
          console.warn('Parent account creation warning:', parentError.message);
          toast.warning(`Learner created but parent account issue: ${parentError.message}`);
        }
      }
      const { data: studentData, error: studentError } = await supabaseUntyped
        .from('students')
        .insert({
          profile_id: studentUserId,
          school_id: user?.schoolId,
          admission_number: formData.assessment_number,
          first_name: formData.first_name,
          middle_name: formData.middle_name || null,
          last_name: formData.last_name,
          class_id: formData.class_id,
          student_email: studentEmail,
          parent_id: parentId,
          parent_name: formData.parent_name,
          parent_phone: formData.parent_phone,
          parent_email: formData.parent_email,
          parent2_name: formData.parent2_name || null,
          parent2_phone: formData.parent2_phone || null,
          parent2_email: formData.parent2_email || null,
          curriculum: formData.curriculum,
          date_of_birth: formData.date_of_birth || null,
          gender: formData.gender || null,
          birth_cert_number: formData.birth_cert_number || null,
          nationality: formData.nationality || 'Kenyan',
          county: formData.county || null,
          sub_county: formData.sub_county || null,
          boarding_status: formData.boarding_status || 'day',
          disability_status: formData.disability_status || null,
          emergency_contact_name: formData.emergency_contact_name || null,
          emergency_contact_phone: formData.emergency_contact_phone || null,
          is_active: true,
          enrollment_date: new Date().toISOString().split('T')[0],
        })
        .select('id')
        .single();
      if (studentError) throw new Error('Database error: ' + studentError.message);
      const studentId = (studentData as any)?.id;
      if (parentId && studentId) {
        const { error: linkError } = await supabaseUntyped
          .from('parent_student_links')
          .upsert({ parent_id: parentId, student_id: studentId }, { onConflict: 'parent_id,student_id' });
        if (linkError) console.warn('parent_student_links upsert warning:', linkError.message);
      }
      const parentMsg = parentId ? ` | Parent: ${formData.parent_email} (Password: Parent@2025)` : '';
      toast.success(`✅ Learner added! Login: ${studentEmail} | Password: ${studentPassword}${parentMsg}`);

      // Send Welcome SMS to parent if phone number is provided
      if (formData.parent_phone) {
        const welcomeMessage = generateWelcomeSMS(
          formData.parent_name || 'Parent',
          'Parent',
          formData.parent_email || studentEmail,
          'Parent@2025',
          undefined
        );
        sendSMS(formData.parent_phone, welcomeMessage).then((result) => {
          if (result.success) {
            toast.success('Welcome SMS sent to parent');
          } else {
            toast.warning('Could not send welcome SMS: ' + result.error);
          }
        });
      }

      setShowAdd(false);
      setFormData(defaultForm);
      refetch();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (s: any) => {
    setEditingStudent(s);
    setEditForm({
      first_name: s.first_name || '',
      middle_name: s.middle_name || '',
      last_name: s.last_name || '',
      class_id: s.class_id || '',
      parent_name: s.parent_name || '',
      parent_phone: s.parent_phone || '',
      parent_email: s.parent_email || '',
      parent2_name: s.parent2_name || '',
      parent2_phone: s.parent2_phone || '',
      parent2_email: s.parent2_email || '',
      gender: (s.gender || '') as GenderType,
      date_of_birth: s.date_of_birth || '',
      birth_cert_number: s.birth_cert_number || '',
      nationality: s.nationality || 'Kenyan',
      county: s.county || '',
      sub_county: s.sub_county || '',
      boarding_status: s.boarding_status || 'day',
      disability_status: s.disability_status || '',
      emergency_contact_name: s.emergency_contact_name || '',
      emergency_contact_phone: s.emergency_contact_phone || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setSaving(true);
    try {
      const { error } = await supabaseUntyped.from('students').update({
        first_name: editForm.first_name.trim(),
        middle_name: editForm.middle_name.trim() || null,
        last_name: editForm.last_name.trim(),
        class_id: editForm.class_id || null,
        parent_name: editForm.parent_name.trim() || null,
        parent_phone: editForm.parent_phone.trim() || null,
        parent_email: editForm.parent_email.trim() || null,
        parent2_name: editForm.parent2_name.trim() || null,
        parent2_phone: editForm.parent2_phone.trim() || null,
        parent2_email: editForm.parent2_email.trim() || null,
        gender: editForm.gender || null,
        date_of_birth: editForm.date_of_birth || null,
        birth_cert_number: editForm.birth_cert_number.trim() || null,
        nationality: editForm.nationality || 'Kenyan',
        county: editForm.county || null,
        sub_county: editForm.sub_county.trim() || null,
        boarding_status: editForm.boarding_status || 'day',
        disability_status: editForm.disability_status.trim() || null,
        emergency_contact_name: editForm.emergency_contact_name.trim() || null,
        emergency_contact_phone: editForm.emergency_contact_phone.trim() || null,
      }).eq('id', editingStudent.id);
      if (error) throw new Error(error.message);
      toast.success('Learner updated successfully!');
      setEditingStudent(null);
      refetch();
    } catch (err: any) {
      toast.error('Failed to update learner: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStudent) return;
    setDeleting(true);
    try {
      const { error } = await supabaseUntyped.from('students').delete().eq('id', deletingStudent.id);
      if (error) throw new Error(error.message);
      toast.success(`Learner "${deletingStudent.first_name} ${deletingStudent.last_name}" deleted.`);
      setDeletingStudent(null);
      refetch();
    } catch (err: any) {
      toast.error('Failed to delete learner: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const [promotingStudent, setPromotingStudent] = useState<any | null>(null);
  const [photoStudent, setPhotoStudent] = useState<any | null>(null);

  const handlePhotoSuccess = async (url: string, studentId: string) => {
    await supabaseUntyped.from('students').update({ photo_url: url }).eq('id', studentId);
    toast.success('Learner photo updated!');
    setPhotoStudent(null);
    refetch();
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 text-blue-600 inline" />
      : <ChevronDown className="w-3 h-3 ml-1 text-blue-600 inline" />;
  };

  const filteredStudents = students
    .filter((s: any) => {
      const matchesSearch = 
        (s.first_name + ' ' + (s.middle_name || '') + ' ' + s.last_name).toLowerCase().includes(search.toLowerCase()) ||
        (s.admission_number || s.assessment_number)?.toLowerCase().includes(search.toLowerCase());
      const matchesClass = filterClassId ? s.class_id === filterClassId : true;
      return matchesSearch && matchesClass;
    })
    .sort((a: any, b: any) => {
      let aVal = '', bVal = '';
      if (sortField === 'name') { aVal = `${a.first_name} ${a.last_name}`; bVal = `${b.first_name} ${b.last_name}`; }
      if (sortField === 'assessment_number') { aVal = a.admission_number || ''; bVal = b.admission_number || ''; }
      if (sortField === 'class') { aVal = a.classes?.name || ''; bVal = b.classes?.name || ''; }
      if (sortField === 'gender') { aVal = a.gender || ''; bVal = b.gender || ''; }
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

  // ─── Grade View Data ─────────────────────────────────────────────────────────
  interface ClassGroup {
    classId: string;
    className: string;
    level: number | null;
    stream: string | null;
    students: any[];
    totalBoys: number;
    totalGirls: number;
  }

  const classGroups: ClassGroup[] = classes.map((cls: any) => {
    const classStudents = filteredStudents.filter((s: any) => s.class_id === cls.id);
    const totalBoys = classStudents.filter((s: any) => s.gender?.toLowerCase() === 'male').length;
    const totalGirls = classStudents.filter((s: any) => s.gender?.toLowerCase() === 'female').length;
    return {
      classId: cls.id,
      className: cls.name,
      level: cls.level ?? cls.grade_level,
      stream: cls.stream,
      students: classStudents,
      totalBoys,
      totalGirls,
    };
  }).filter((g: ClassGroup) => g.students.length > 0 || !search)
    .sort((a: ClassGroup, b: ClassGroup) => (a.level || 0) - (b.level || 0));

  const uniqueLevels = Array.from(new Set(classGroups.map(g => g.level).filter(l => l !== null))).sort((a, b) => (a as number) - (b as number));

  const filteredGroups = classGroups.filter((group: ClassGroup) => {
    if (selectedLevel && String(group.level) !== selectedLevel) return false;
    return true;
  });

  const totalStudents = students.length;
  const totalBoys = students.filter((s: any) => s.gender?.toLowerCase() === 'male').length;
  const totalGirls = students.filter((s: any) => s.gender?.toLowerCase() === 'female').length;

  const handlePrint = () => window.print();

  // If trial is expired, show payment lock
  if (trialStatus?.isExpired) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Learners</h1>
          <p className="text-sm text-gray-500">Manage your learners</p>
        </div>
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Trial Period Expired</h2>
          <p className="text-sm text-red-600 mb-4">Please subscribe to continue managing learners.</p>
        </div>
      </div>
    );
  }

  const inputCls = "w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]";
  const labelCls = "block text-xs text-gray-500 mb-1";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Learners</h1>
          <p className="text-sm text-gray-500">{filteredStudents.length} total learners</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1 mr-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('by-grade')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'by-grade' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              View by Grade
            </button>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-[#2563EB] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#1d4ed8]">
            <Plus className="w-4 h-4" /> Add Learner
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search learners..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]" />
        </div>
        <div className="relative w-full sm:w-64">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} className="w-full pl-11 pr-10 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB] appearance-none">
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>{cls.name}{cls.stream ? ` (${cls.stream})` : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold mb-2">Add New Learner</h3>
          <p className="text-xs text-blue-600 mb-1">Learner password: <strong>[Assessment Number]@2025</strong></p>
          <p className="text-xs text-green-600 mb-4">Parent account auto-created with password: <strong>Parent@2025</strong></p>
          <form onSubmit={handleAdd}>
            {/* Section: Basic Info */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Basic Information</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input placeholder="Assessment Number *" value={formData.assessment_number} onChange={e => setFormData({...formData, assessment_number: e.target.value})} className={inputCls} required />
              <input placeholder="First Name *" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} className={inputCls} required />
              <input placeholder="Middle Name (optional)" value={formData.middle_name} onChange={e => setFormData({...formData, middle_name: e.target.value})} className={inputCls} />
              <input placeholder="Last Name / Surname *" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} className={inputCls} required />
              <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as GenderType})} className={inputCls + " bg-white"}>
                <option value="">Select Gender *</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <input type="date" placeholder="Date of Birth" value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} className={inputCls} />
              <input placeholder="Birth Certificate Number" value={formData.birth_cert_number} onChange={e => setFormData({...formData, birth_cert_number: e.target.value})} className={inputCls} />
              <input placeholder="Nationality" value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})} className={inputCls} />
              <input placeholder="Learner Email (optional)" value={formData.student_email} onChange={e => setFormData({...formData, student_email: e.target.value})} className={inputCls} />
            </div>
            {/* Section: School Info */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">School Information</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <select value={formData.class_id} onChange={e => setFormData({...formData, class_id: e.target.value})} className={inputCls + " bg-white"} required>
                <option value="">Select Class *</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}{cls.stream ? ` (${cls.stream})` : ''}</option>
                ))}
              </select>
              <select value={formData.boarding_status} onChange={e => setFormData({...formData, boarding_status: e.target.value})} className={inputCls + " bg-white"}>
                <option value="day">Day Scholar</option>
                <option value="boarding">Boarder</option>
                <option value="day_and_boarding">Day & Boarding</option>
              </select>
              <input placeholder="Disability / Special Needs (if any)" value={formData.disability_status} onChange={e => setFormData({...formData, disability_status: e.target.value})} className={inputCls} />
            </div>
            {/* Section: Location */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Location</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <select value={formData.county} onChange={e => setFormData({...formData, county: e.target.value})} className={inputCls + " bg-white"}>
                <option value="">Select County</option>
                {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input placeholder="Sub-County" value={formData.sub_county} onChange={e => setFormData({...formData, sub_county: e.target.value})} className={inputCls} />
            </div>
            {/* Section: Parent / Guardian 1 */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Parent / Guardian 1</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input placeholder="Parent / Guardian Name" value={formData.parent_name} onChange={e => setFormData({...formData, parent_name: e.target.value})} className={inputCls} />
              <input placeholder="Parent Phone" value={formData.parent_phone} onChange={e => setFormData({...formData, parent_phone: e.target.value})} className={inputCls} />
              <input placeholder="Parent Email (auto-creates parent account)" value={formData.parent_email} onChange={e => setFormData({...formData, parent_email: e.target.value})} className={inputCls} type="email" />
            </div>
            {/* Section: Parent / Guardian 2 */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Parent / Guardian 2 (optional)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input placeholder="Parent 2 Name" value={formData.parent2_name} onChange={e => setFormData({...formData, parent2_name: e.target.value})} className={inputCls} />
              <input placeholder="Parent 2 Phone" value={formData.parent2_phone} onChange={e => setFormData({...formData, parent2_phone: e.target.value})} className={inputCls} />
              <input placeholder="Parent 2 Email" value={formData.parent2_email} onChange={e => setFormData({...formData, parent2_email: e.target.value})} className={inputCls} type="email" />
            </div>
            {/* Section: Emergency Contact */}
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Emergency Contact</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <input placeholder="Emergency Contact Name" value={formData.emergency_contact_name} onChange={e => setFormData({...formData, emergency_contact_name: e.target.value})} className={inputCls} />
              <input placeholder="Emergency Contact Phone" value={formData.emergency_contact_phone} onChange={e => setFormData({...formData, emergency_contact_phone: e.target.value})} className={inputCls} />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => { setShowAdd(false); setFormData(defaultForm); }} className="px-6 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={adding} className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Learner
              </button>
            </div>
          </form>
        </div>
      )}

      {viewMode === 'list' ? (
        /* ─── LIST VIEW ─────────────────────────────────────────────── */
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase">Photo</th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('assessment_number')}>
                    Assessment # <SortIcon field="assessment_number" />
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('name')}>
                    Learner <SortIcon field="name" />
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('class')}>
                    Class <SortIcon field="class" />
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('gender')}>
                    Gender <SortIcon field="gender" />
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase">Parent</th>
                  <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-gray-500">Loading...</td></tr>
                ) : filteredStudents.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-sm text-gray-500">No learners found</td></tr>
                ) : (
                  (() => {
                    const grouped = filteredStudents.reduce((acc: Record<string, any[]>, s: any) => {
                      const className = s.classes?.name || 'No Class';
                      if (!acc[className]) acc[className] = [];
                      acc[className].push(s);
                      return acc;
                    }, {});
                    const sortedClassNames = Object.keys(grouped).sort();
                    return sortedClassNames.map((className) => (
                      <React.Fragment key={className}>
                        <tr className="bg-blue-50 border-y border-blue-100">
                          <td colSpan={7} className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-xs font-bold text-blue-600">{className[0]}</span>
                              </div>
                              <span className="text-sm font-semibold text-blue-800">{className}</span>
                              <span className="text-xs text-blue-500 ml-1">({grouped[className].length} learners)</span>
                            </div>
                          </td>
                        </tr>
                        {grouped[className].map((s: any) => (
                          <tr key={s.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
                                {s.photo_url ? <img src={s.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-gray-400">{(s.first_name?.[0] || '?').toUpperCase()}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm font-medium">{s.admission_number || s.assessment_number}</td>
                            <td className="px-4 py-4">
                              <div className="text-sm font-medium">{s.first_name} {s.middle_name ? s.middle_name + ' ' : ''}{s.last_name}</div>
                              <div className="text-xs text-gray-500">{s.student_email}</div>
                              {s.boarding_status && s.boarding_status !== 'day' && (
                                <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{s.boarding_status === 'boarding' ? 'Boarder' : 'Day & Boarding'}</span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-600">{s.classes?.name || '-'}</td>
                            <td className="px-4 py-4 text-sm text-gray-600 capitalize">{s.gender || '-'}</td>
                            <td className="px-4 py-4">
                              <div className="text-sm">{s.parent_name || '-'}</div>
                              <div className="text-xs text-gray-500">{s.parent_email || s.parent_phone || '-'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 flex-wrap">
                                <button onClick={() => setPhotoStudent(s)} className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors">
                                  <Camera className="w-3 h-3" /> Photo
                                </button>
                                <button onClick={() => setPromotingStudent(s)} className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                                  Promote
                                </button>
                                <button onClick={() => openEdit(s)} className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors">
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                                <button onClick={() => setDeletingStudent(s)} className="flex items-center gap-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ));
                  })()
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ─── VIEW BY GRADE ─────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
              <div className="text-2xl font-bold text-blue-600">{totalStudents}</div>
              <div className="text-xs text-gray-500">Total Learners</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
              <div className="text-2xl font-bold text-green-600">{totalBoys}</div>
              <div className="text-xs text-gray-500">Boys</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
              <div className="text-2xl font-bold text-pink-600">{totalGirls}</div>
              <div className="text-xs text-gray-500">Girls</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
              <div className="text-2xl font-bold text-purple-600">{classes.length}</div>
              <div className="text-xs text-gray-500">Classes</div>
            </div>
          </div>

          {/* Grade Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search learners by name, admission number, or parent name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedLevel}
                onChange={e => setSelectedLevel(e.target.value)}
                className="pl-9 pr-4 py-3 bg-white rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-[#2563EB] appearance-none min-w-[160px]"
              >
                <option value="">All Grades</option>
                {uniqueLevels.map(level => (
                  <option key={level} value={String(level)}>Grade {level}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" /> Print
            </button>
          </div>

          {/* Class Groups */}
          {loading ? (
            <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No learners found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                const isExpanded = expandedClass === group.classId;
                return (
                  <div key={group.classId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <button
                      onClick={() => setExpandedClass(isExpanded ? null : group.classId)}
                      className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-900">{group.className} {group.stream && `(${group.stream})`}</h3>
                          <p className="text-xs text-gray-500">
                            {group.level !== null ? `Grade ${group.level}` : 'Level -'} • {group.students.length} learners
                            {group.totalBoys > 0 && ` • ${group.totalBoys} boys`}
                            {group.totalGirls > 0 && ` • ${group.totalGirls} girls`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 text-xs">
                          {group.totalBoys > 0 && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1">
                              <Users className="w-3 h-3" /> {group.totalBoys} Boys
                            </span>
                          )}
                          {group.totalGirls > 0 && (
                            <span className="px-2 py-1 bg-pink-50 text-pink-600 rounded-full flex items-center gap-1">
                              <Users className="w-3 h-3" /> {group.totalGirls} Girls
                            </span>
                          )}
                        </div>
                        {isExpanded ? <ChevronUpIcon className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-gray-100 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Admission #</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Gender</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Parent</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Parent Phone</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.students.length === 0 ? (
                              <tr><td colSpan={6} className="text-center py-4 text-gray-500">No learners in this class</td></tr>
                            ) : (
                              group.students.map((student: any, idx: number) => (
                                <tr key={student.id} className="border-b hover:bg-gray-50">
                                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                                  <td className="px-4 py-3 text-gray-600">{student.admission_number || '-'}</td>
                                  <td className="px-4 py-3 font-medium">{student.first_name} {student.last_name}</td>
                                  <td className="px-4 py-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      student.gender?.toLowerCase() === 'male' ? 'bg-blue-50 text-blue-600' :
                                      student.gender?.toLowerCase() === 'female' ? 'bg-pink-50 text-pink-600' :
                                      'bg-gray-50 text-gray-600'
                                    }`}>{student.gender || '-'}</span>
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">{student.parent_name || '-'}</td>
                                  <td className="px-4 py-3 text-gray-600">{student.parent_phone || '-'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Promote Learner Modal */}
      {promotingStudent && (
        <PromoteStudentModal
          student={promotingStudent}
          classes={classes}
          onClose={() => setPromotingStudent(null)}
          onSuccess={() => { refetch(); setPromotingStudent(null); }}
        />
      )}

      {/* Learner Photo Modal */}
      {photoStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <h2 className="text-lg font-semibold mb-1">Learner Photo</h2>
            <p className="text-sm text-gray-500 mb-4">{photoStudent.first_name} {photoStudent.last_name} — {photoStudent.admission_number || photoStudent.assessment_number}</p>
            <div className="flex flex-col items-center py-4">
              <PhotoUpload
                currentPhotoUrl={photoStudent.photo_url}
                bucket="student-photos"
                folder="students"
                entityId={photoStudent.id}
                onSuccess={(url) => handlePhotoSuccess(url, photoStudent.id)}
                label="Learner Photo"
                size="lg"
              />
            </div>
            <button onClick={() => setPhotoStudent(null)} className="w-full mt-3 px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50">Close</button>
          </div>
        </div>
      )}

      {/* Edit Learner Modal */}
      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-lg my-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Learner</h2>
              <button onClick={() => setEditingStudent(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Assessment #: <strong>{editingStudent.admission_number}</strong></p>
            <form onSubmit={handleSaveEdit}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Basic Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div><label className={labelCls}>First Name *</label><input value={editForm.first_name} onChange={e => setEditForm({...editForm, first_name: e.target.value})} className={inputCls} required /></div>
                <div><label className={labelCls}>Middle Name</label><input value={editForm.middle_name} onChange={e => setEditForm({...editForm, middle_name: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Last Name *</label><input value={editForm.last_name} onChange={e => setEditForm({...editForm, last_name: e.target.value})} className={inputCls} required /></div>
                <div><label className={labelCls}>Gender</label>
                  <select value={editForm.gender} onChange={e => setEditForm({...editForm, gender: e.target.value as GenderType})} className={inputCls + " bg-white"}>
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div><label className={labelCls}>Date of Birth</label><input type="date" value={editForm.date_of_birth} onChange={e => setEditForm({...editForm, date_of_birth: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Birth Certificate Number</label><input value={editForm.birth_cert_number} onChange={e => setEditForm({...editForm, birth_cert_number: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Nationality</label><input value={editForm.nationality} onChange={e => setEditForm({...editForm, nationality: e.target.value})} className={inputCls} /></div>
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">School Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div><label className={labelCls}>Class</label>
                  <select value={editForm.class_id} onChange={e => setEditForm({...editForm, class_id: e.target.value})} className={inputCls + " bg-white"}>
                    <option value="">No Class</option>
                    {classes.map((cls) => (<option key={cls.id} value={cls.id}>{cls.name} {cls.stream}</option>))}
                  </select>
                </div>
                <div><label className={labelCls}>Boarding Status</label>
                  <select value={editForm.boarding_status} onChange={e => setEditForm({...editForm, boarding_status: e.target.value})} className={inputCls + " bg-white"}>
                    <option value="day">Day Scholar</option>
                    <option value="boarding">Boarder</option>
                    <option value="day_and_boarding">Day & Boarding</option>
                  </select>
                </div>
                <div><label className={labelCls}>Disability / Special Needs</label><input value={editForm.disability_status} onChange={e => setEditForm({...editForm, disability_status: e.target.value})} className={inputCls} /></div>
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Location</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div><label className={labelCls}>County</label>
                  <select value={editForm.county} onChange={e => setEditForm({...editForm, county: e.target.value})} className={inputCls + " bg-white"}>
                    <option value="">Select County</option>
                    {KENYA_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Sub-County</label><input value={editForm.sub_county} onChange={e => setEditForm({...editForm, sub_county: e.target.value})} className={inputCls} /></div>
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Parent / Guardian 1</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div><label className={labelCls}>Parent Name</label><input value={editForm.parent_name} onChange={e => setEditForm({...editForm, parent_name: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Parent Phone</label><input value={editForm.parent_phone} onChange={e => setEditForm({...editForm, parent_phone: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Parent Email</label><input type="email" value={editForm.parent_email} onChange={e => setEditForm({...editForm, parent_email: e.target.value})} className={inputCls} /></div>
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Parent / Guardian 2</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div><label className={labelCls}>Parent 2 Name</label><input value={editForm.parent2_name} onChange={e => setEditForm({...editForm, parent2_name: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Parent 2 Phone</label><input value={editForm.parent2_phone} onChange={e => setEditForm({...editForm, parent2_phone: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Parent 2 Email</label><input type="email" value={editForm.parent2_email} onChange={e => setEditForm({...editForm, parent2_email: e.target.value})} className={inputCls} /></div>
              </div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Emergency Contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div><label className={labelCls}>Emergency Contact Name</label><input value={editForm.emergency_contact_name} onChange={e => setEditForm({...editForm, emergency_contact_name: e.target.value})} className={inputCls} /></div>
                <div><label className={labelCls}>Emergency Contact Phone</label><input value={editForm.emergency_contact_phone} onChange={e => setEditForm({...editForm, emergency_contact_phone: e.target.value})} className={inputCls} /></div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingStudent(null)} className="px-6 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-6 py-2.5 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 flex items-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Delete Learner</h2>
                <p className="text-xs text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you sure you want to delete <strong>{deletingStudent.first_name} {deletingStudent.last_name}</strong> ({deletingStudent.admission_number || deletingStudent.assessment_number})?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingStudent(null)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
