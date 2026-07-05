import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Loader2, ChevronDown, ChevronUp, Search, Download, Filter } from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  gender: string;
  date_of_birth: string | null;
  parent_name: string | null;
  parent_phone: string | null;
}

interface ClassGroup {
  classId: string;
  className: string;
  level: number | null;
  stream: string | null;
  students: Student[];
  totalBoys: number;
  totalGirls: number;
}

export default function ViewLearners() {
  const { user } = useAuth();
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Issue 11: Add grade/level filter
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  useEffect(() => {
    fetchLearners();
  }, [user?.schoolId]);

  const fetchLearners = async () => {
    setLoading(true);
    try {
      const schoolId = user?.schoolId;
      
      const { data: classesData } = await supabaseUntyped
        .from('classes')
        .select('id, name, level, stream')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('level');

      const { data: studentsData } = await supabaseUntyped
        .from('students')
        .select('id, first_name, last_name, admission_number, gender, date_of_birth, parent_name, parent_phone, class_id')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .order('first_name');

      const groups: ClassGroup[] = [];
      
      (classesData || []).forEach((cls: any) => {
        const classStudents = (studentsData || []).filter((s: any) => s.class_id === cls.id);
        const totalBoys = classStudents.filter((s: any) => s.gender?.toLowerCase() === 'male').length;
        const totalGirls = classStudents.filter((s: any) => s.gender?.toLowerCase() === 'female').length;
        
        groups.push({
          classId: cls.id,
          className: cls.name,
          level: cls.level,
          stream: cls.stream,
          students: classStudents,
          totalBoys,
          totalGirls,
        });
      });

      groups.sort((a, b) => (a.level || 0) - (b.level || 0));
      setClassGroups(groups);
    } catch (err: any) {
      toast.error('Failed to load learners: ' + err.message);
    }
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  // Issue 11: Get unique levels for filter dropdown
  const uniqueLevels = Array.from(new Set(classGroups.map(g => g.level).filter(l => l !== null))).sort((a, b) => (a as number) - (b as number));

  const filteredGroups = classGroups
    .filter(group => {
      // Issue 11: Filter by selected level/grade
      if (selectedLevel && String(group.level) !== selectedLevel) return false;
      return true;
    })
    .map(group => ({
      ...group,
      students: group.students.filter(s => 
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        (s.admission_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.parent_name || '').toLowerCase().includes(search.toLowerCase())
      ),
    })).filter(group => group.students.length > 0 || !search);

  const totalStudents = classGroups.reduce((sum, g) => sum + g.students.length, 0);
  const totalBoys = classGroups.reduce((sum, g) => sum + g.totalBoys, 0);
  const totalGirls = classGroups.reduce((sum, g) => sum + g.totalGirls, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">View Learners by Grade</h1>
          <p className="text-sm text-[#666666]">View all learners organized by grade and class</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          <Download className="w-4 h-4" /> Print
        </button>
      </div>

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
          <div className="text-2xl font-bold text-purple-600">{classGroups.length}</div>
          <div className="text-xs text-gray-500">Classes</div>
        </div>
      </div>

      {/* Search and Grade Filter */}
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
        {/* Issue 11: Grade/Level filter dropdown */}
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
                {/* Class Header */}
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
                        {group.level ? `Grade ${group.level}` : 'Level -'} • {group.students.length} learners
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
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                  </div>
                </button>

                {/* Students Table */}
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
                          <tr>
                            <td colSpan={6} className="text-center py-4 text-gray-500">No learners in this class</td>
                          </tr>
                        ) : (
                          group.students.map((student, idx) => (
                            <tr key={student.id} className="border-b hover:bg-gray-50">
                              <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                              <td className="px-4 py-3 text-gray-600">{student.admission_number || '-'}</td>
                              <td className="px-4 py-3 font-medium">{student.first_name} {student.last_name}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  student.gender?.toLowerCase() === 'male' 
                                    ? 'bg-blue-50 text-blue-600' 
                                    : student.gender?.toLowerCase() === 'female'
                                    ? 'bg-pink-50 text-pink-600'
                                    : 'bg-gray-50 text-gray-600'
                                }`}>
                                  {student.gender || '-'}
                                </span>
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
  );
}
