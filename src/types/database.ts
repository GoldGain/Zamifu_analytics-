
export type CurriculumType = 'CBE' | '';
export type UserRole = 'master_super_admin' | 'reseller_super_admin' | 'super_admin' | 'school_admin' | 'teacher' | 'student' | 'parent';

export interface Reseller {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'active' | 'suspended' | 'inactive';
  paystack_public_key?: string;
  paystack_secret_key?: string;
  parent_pay_enabled: boolean;
  view_results_fee: number;
  pdf_report_fee: number;
  total_schools: number;
  total_students: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
}

export interface ParentPayment {
  id: string;
  parent_id?: string;
  student_id?: string;
  school_id?: string;
  reseller_id?: string;
  parent_name?: string;
  student_name?: string;
  school_name?: string;
  reseller_name?: string;
  amount: number;
  payment_type: 'view_results' | 'pdf_report';
  status: 'pending' | 'success' | 'failed';
  paystack_reference?: string;
  paystack_transaction_id?: string;
  created_at: string;
  updated_at: string;
}
export type SubscriptionPlan = 'trial' | 'basic' | 'pro' | 'premium';
export type SubscriptionStatus = 'active' | 'suspended' | 'expired' | 'trial';
export type SchoolStatus = 'active' | 'suspended' | 'inactive';
export type GenderType = 'male' | 'female' | 'other';
export type TermType = 'Term 1' | 'Term 2' | 'Term 3';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type FeeStatus = 'paid' | 'partial' | 'unpaid' | 'waived';
export type PaymentMethod = 'mpesa' | 'bank' | 'cash' | 'cheque' | 'other';
export type ResultStatus = 'draft' | 'submitted' | 'approved' | 'published';
export type CBEGrade = 'EE' | 'ME' | 'AE' | 'BE';
export type CBESublevel = 'EE1' | 'EE2' | 'ME1' | 'ME2' | 'AE1' | 'AE2' | 'BE1' | 'BE2';
// Issue 8: Added custom_message and group announcement types
export type AnnouncementType = 'general' | 'fee_reminder' | 'exam' | 'event' | 'emergency' | 'custom_message' | 'class_group' | 'teachers' | 'parents';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface Database {
  public: {
    Tables: {
      schools: {
        Row: any;
        Insert: any;
        Update: any;
      };
      profiles: {
        Row: any;
        Insert: any;
        Update: any;
      };
      classes: {
        Row: any;
        Insert: any;
        Update: any;
      };
      subjects: {
        Row: any;
        Insert: any;
        Update: any;
      };
      students: {
        Row: any;
        Insert: any;
        Update: any;
      };
      teachers: {
        Row: any;
        Insert: any;
        Update: any;
      };
      results: {
        Row: any;
        Insert: any;
        Update: any;
      };
      fee_invoices: {
        Row: any;
        Insert: any;
        Update: any;
      };
      fee_payments: {
        Row: any;
        Insert: any;
        Update: any;
      };
      attendance: {
        Row: any;
        Insert: any;
        Update: any;
      };
      timetable: {
        Row: any;
        Insert: any;
        Update: any;
      };
      announcements: {
        Row: any;
        Insert: any;
        Update: any;
      };
      terms: {
        Row: any;
        Insert: any;
        Update: any;
      };
      homework: {
        Row: any;
        Insert: any;
        Update: any;
      };
      homework_submissions: {
        Row: any;
        Insert: any;
        Update: any;
      };
      notifications: {
        Row: any;
        Insert: any;
        Update: any;
      };
      platform_settings: {
        Row: any;
        Insert: any;
        Update: any;
      };
      parent_student_links: {
        Row: any;
        Insert: any;
        Update: any;
      };
      fee_structures: {
        Row: any;
        Insert: any;
        Update: any;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Tables = Database['public']['Tables'];
export type School = any;
export type Profile = any;
export type Class = any;
export type Subject = any;
export type Student = any;
export type Teacher = any;
export type Result = any;
export type FeeInvoice = any;
export type FeePayment = any;
export type Attendance = any;
export type Timetable = any;
export type Announcement = any;
export type Term = any;
export type Homework = any;
export type Notification = any;
