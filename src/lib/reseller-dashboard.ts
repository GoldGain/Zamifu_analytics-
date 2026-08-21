import { supabaseUntyped } from '@/lib/supabase/client';
import { currencyCode, feeOrDefault } from '@/lib/reseller';

export interface SchoolPortfolioItem {
  id: string;
  name: string;
  code: string | null;
  county: string | null;
  subCounty: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  registrationSource: string | null;
  currency: string;
  feePerLearnerPerTerm: number;
  feePerLearnerPerYear: number;
  learners: number;
  teachers: number;
  parents: number;
  admins: number;
  revenueThisTerm: number;
  revenuePerYear: number;
  adminPortalLocked: boolean;
  dosPortalLocked: boolean;
}

export interface ResellerPortfolio {
  schools: SchoolPortfolioItem[];
  totals: {
    schools: number;
    learners: number;
    teachers: number;
    parents: number;
    admins: number;
    revenueThisTerm: number;
    revenuePerYear: number;
  };
}

type SchoolRow = {
  id: string;
  name: string;
  code: string | null;
  county: string | null;
  sub_county: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  registration_source: string | null;
  currency: string | null;
  fee_per_learner_per_term: number | null;
  fee_per_learner_per_year: number | null;
  admin_portal_locked: boolean | null;
  dos_portal_locked: boolean | null;
};

type SchoolScopedRow = { id: string; school_id: string | null; parent_id?: string | null };
type ParentLinkRow = { parent_id: string | null; student_id: string | null };

function countBySchool(rows: SchoolScopedRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.school_id) return;
    totals.set(row.school_id, (totals.get(row.school_id) || 0) + 1);
  });
  return totals;
}

function emptyPortfolio(): ResellerPortfolio {
  return {
    schools: [],
    totals: {
      schools: 0,
      learners: 0,
      teachers: 0,
      parents: 0,
      admins: 0,
      revenueThisTerm: 0,
      revenuePerYear: 0,
    },
  };
}

export async function loadResellerPortfolio(resellerId: string): Promise<ResellerPortfolio> {
  const { data: schoolData, error: schoolError } = await supabaseUntyped
    .from('schools')
    .select('id, name, code, county, sub_county, email, phone, status, registration_source, currency, fee_per_learner_per_term, fee_per_learner_per_year, admin_portal_locked, dos_portal_locked')
    .or(`reseller_id.eq.${resellerId},reseller_id.is.null`)
    .order('name');

  if (schoolError) throw schoolError;

  const schools = (schoolData || []) as SchoolRow[];
  if (!schools.length) return emptyPortfolio();

  const schoolIds = schools.map((school) => school.id);
  const [studentsResponse, teachersResponse, adminsResponse, parentLinksResponse] = await Promise.all([
    supabaseUntyped.from('students').select('id, school_id, parent_id').in('school_id', schoolIds),
    supabaseUntyped.from('teachers').select('id, school_id').in('school_id', schoolIds),
    supabaseUntyped.from('school_admins').select('id, school_id').in('school_id', schoolIds),
    supabaseUntyped.from('parent_student_links').select('parent_id, student_id'),
  ]);

  const responses = [studentsResponse, teachersResponse, adminsResponse, parentLinksResponse];
  const firstError = responses.find((response) => response.error)?.error;
  if (firstError) throw firstError;

  const students = (studentsResponse.data || []) as SchoolScopedRow[];
  const teachers = (teachersResponse.data || []) as SchoolScopedRow[];
  const admins = (adminsResponse.data || []) as SchoolScopedRow[];
  const parentLinks = (parentLinksResponse.data || []) as ParentLinkRow[];

  const studentCounts = countBySchool(students);
  const teacherCounts = countBySchool(teachers);
  const adminCounts = countBySchool(admins);
  const studentSchoolById = new Map(students.map((student) => [student.id, student.school_id]));
  const parentIdsBySchool = new Map<string, Set<string>>();

  students.forEach((student) => {
    if (!student.school_id || !student.parent_id) return;
    if (!parentIdsBySchool.has(student.school_id)) parentIdsBySchool.set(student.school_id, new Set());
    parentIdsBySchool.get(student.school_id)?.add(student.parent_id);
  });

  parentLinks.forEach((link) => {
    if (!link.parent_id || !link.student_id) return;
    const schoolId = studentSchoolById.get(link.student_id);
    if (!schoolId) return;
    if (!parentIdsBySchool.has(schoolId)) parentIdsBySchool.set(schoolId, new Set());
    parentIdsBySchool.get(schoolId)?.add(link.parent_id);
  });

  const portfolioSchools = schools.map((school) => {
    const learners = studentCounts.get(school.id) || 0;
    const feePerLearnerPerTerm = feeOrDefault(school.fee_per_learner_per_term);
    const feePerLearnerPerYear = feeOrDefault(school.fee_per_learner_per_year, feePerLearnerPerTerm * 3);
    const revenueThisTerm = learners * feePerLearnerPerTerm;

    return {
      id: school.id,
      name: school.name,
      code: school.code,
      county: school.county,
      subCounty: school.sub_county,
      email: school.email,
      phone: school.phone,
      status: school.status,
      registrationSource: school.registration_source,
      currency: currencyCode(school.currency),
      feePerLearnerPerTerm,
      feePerLearnerPerYear,
      learners,
      teachers: teacherCounts.get(school.id) || 0,
      parents: parentIdsBySchool.get(school.id)?.size || 0,
      admins: adminCounts.get(school.id) || 0,
      revenueThisTerm,
      revenuePerYear: learners * feePerLearnerPerYear,
      adminPortalLocked: Boolean(school.admin_portal_locked),
      dosPortalLocked: Boolean(school.dos_portal_locked),
    } satisfies SchoolPortfolioItem;
  });

  return {
    schools: portfolioSchools,
    totals: portfolioSchools.reduce(
      (totals, school) => ({
        schools: totals.schools + 1,
        learners: totals.learners + school.learners,
        teachers: totals.teachers + school.teachers,
        parents: totals.parents + school.parents,
        admins: totals.admins + school.admins,
        revenueThisTerm: totals.revenueThisTerm + school.revenueThisTerm,
        revenuePerYear: totals.revenuePerYear + school.revenuePerYear,
      }),
      emptyPortfolio().totals,
    ),
  };
}

export async function updateSchoolFee(resellerId: string, schoolId: string, rawFee: number): Promise<number> {
  const fee = Math.round(Number(rawFee));
  if (!Number.isFinite(fee) || fee < 1 || fee > 1_000_000) {
    throw new Error('Enter a fee between 1 and 1,000,000 per learner per term.');
  }

  const { error } = await supabaseUntyped
    .from('schools')
    .update({ fee_per_learner_per_term: fee })
    .eq('id', schoolId)
    .or(`reseller_id.eq.${resellerId},reseller_id.is.null`);

  if (error) throw error;
  return fee;
}

export async function updateSchoolAnnualFee(resellerId: string, schoolId: string, rawFee: number): Promise<number> {
  const fee = Math.round(Number(rawFee));
  if (!Number.isFinite(fee) || fee < 1 || fee > 1_000_000) {
    throw new Error('Enter a fee between 1 and 1,000,000 per learner per year.');
  }

  const { error } = await supabaseUntyped
    .from('schools')
    .update({ fee_per_learner_per_year: fee })
    .eq('id', schoolId)
    .or(`reseller_id.eq.${resellerId},reseller_id.is.null`);

  if (error) throw error;
  return fee;
}
