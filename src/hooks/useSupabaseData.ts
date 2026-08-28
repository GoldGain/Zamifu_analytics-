import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { School, Student, Teacher, Class, Result, FeeInvoice, Announcement } from '@/types/database';

export function useSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchools = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('schools').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setSchools(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSchools(); }, [fetchSchools]);

  return { schools, loading, error, refetch: fetchSchools };
}

export function useStudents(schoolId?: string) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('students').select('*, classes(name)').eq('is_active', true).order('created_at', { ascending: false });
      if (schoolId) query = query.eq('school_id', schoolId);
      const { data, error } = await query;
      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  return { students, loading, refetch: fetchStudents };
}

export function useTeachers(schoolId?: string) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('teachers').select('*').order('created_at', { ascending: false });
      if (schoolId) query = query.eq('school_id', schoolId);
      const { data, error } = await query;
      if (error) throw error;
      setTeachers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  return { teachers, loading, refetch: fetchTeachers };
}

export function useClasses(schoolId?: string) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('classes').select('*').order('level', { ascending: true });
      if (schoolId) query = query.eq('school_id', schoolId);
      const { data, error } = await query;
      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  return { classes, loading, refetch: fetchClasses };
}

export function useResults(schoolId?: string) {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('results').select('*, students(first_name, last_name), subjects(name)').order('created_at', { ascending: false });
      if (schoolId) query = query.eq('school_id', schoolId);
      const { data, error } = await query;
      if (error) throw error;
      setResults(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  return { results, loading, refetch: fetchResults };
}

export function useFeeInvoices(schoolId?: string) {
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('fee_invoices').select('*, students(first_name, last_name)').order('created_at', { ascending: false });
      if (schoolId) query = query.eq('school_id', schoolId);
      const { data, error } = await query;
      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  return { invoices, loading, refetch: fetchInvoices };
}

export function useAnnouncements(schoolId?: string) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (schoolId) query = query.eq('school_id', schoolId);
      const { data, error } = await query;
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  return { announcements, loading, refetch: fetchAnnouncements };
}
