import { useEffect, useState } from 'react';
import { BookOpen, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';

type Book = { id: string; title: string; author: string | null; category: string | null; total_copies: number; available_copies: number; shelf_location: string | null };

type Borrowing = { id: string; due_date: string; borrowed_at: string; students?: { first_name: string; last_name: string } | null; library_books?: { title: string } | null };

export default function Library() {
  const { user } = useAuth();
  const schoolId = user?.schoolId || '';
  const [books, setBooks] = useState<Book[]>([]);
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({ title: '', author: '', category: '', total_copies: 1, shelf_location: '' });

  const load = async () => {
    if (!schoolId) return;
    setLoading(true);
    const [{ data: bookRows, error: bookError }, { data: borrowingRows, error: borrowingError }] = await Promise.all([
      supabaseUntyped.from('library_books').select('id,title,author,category,total_copies,available_copies,shelf_location').eq('school_id', schoolId).order('title').limit(500),
      supabaseUntyped.from('library_borrowings').select('id,due_date,borrowed_at,students(first_name,last_name),library_books(title)').is('returned_at', null).order('due_date').limit(200),
    ]);
    if (bookError) toast.error(bookError.message); else setBooks((bookRows || []) as Book[]);
    if (borrowingError) toast.error(borrowingError.message); else setBorrowings((borrowingRows || []) as Borrowing[]);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [schoolId]);

  const addBook = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!schoolId || !draft.title.trim()) return;
    const copies = Math.max(1, Number(draft.total_copies) || 1);
    const { error } = await supabaseUntyped.from('library_books').insert({ school_id: schoolId, title: draft.title.trim(), author: draft.author.trim() || null, category: draft.category.trim() || null, total_copies: copies, available_copies: copies, shelf_location: draft.shelf_location.trim() || null });
    if (error) toast.error(error.message); else { toast.success('Book added'); setDraft({ title: '', author: '', category: '', total_copies: 1, shelf_location: '' }); void load(); }
  };

  return <div className="max-w-6xl mx-auto p-6 space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">School Admin</p><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><BookOpen className="w-7 h-7 text-blue-600" /> Library</h1><p className="text-sm text-gray-500 mt-1">Manage books, copies, shelves, and outstanding borrowings.</p></div><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 border rounded-xl px-4 py-2 text-sm"><RefreshCw className="w-4 h-4" /> Refresh</button></div>
    <form onSubmit={addBook} className="bg-white border rounded-2xl p-5 grid grid-cols-1 md:grid-cols-6 gap-3"><input required value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Book title" className="md:col-span-2 border rounded-xl px-3 py-2.5" /><input value={draft.author} onChange={e => setDraft({ ...draft, author: e.target.value })} placeholder="Author" className="border rounded-xl px-3 py-2.5" /><input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} placeholder="Category" className="border rounded-xl px-3 py-2.5" /><input type="number" min={1} value={draft.total_copies} onChange={e => setDraft({ ...draft, total_copies: Number(e.target.value) })} placeholder="Copies" className="border rounded-xl px-3 py-2.5" /><button className="bg-blue-600 text-white rounded-xl px-4 py-2.5 inline-flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Add book</button><input value={draft.shelf_location} onChange={e => setDraft({ ...draft, shelf_location: e.target.value })} placeholder="Shelf location (optional)" className="md:col-span-2 border rounded-xl px-3 py-2.5" /></form>
    <section className="bg-white border rounded-2xl overflow-hidden"><div className="p-5 border-b"><h2 className="font-semibold">Book catalogue</h2></div>{loading ? <p className="p-8 text-center text-gray-500">Loading...</p> : books.length === 0 ? <p className="p-8 text-center text-gray-500">No books added yet.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-left"><tr><th className="p-3">Title</th><th className="p-3">Author</th><th className="p-3">Category</th><th className="p-3">Available</th><th className="p-3">Shelf</th></tr></thead><tbody>{books.map(book => <tr key={book.id} className="border-t"><td className="p-3 font-medium">{book.title}</td><td className="p-3">{book.author || '—'}</td><td className="p-3">{book.category || '—'}</td><td className="p-3">{book.available_copies} / {book.total_copies}</td><td className="p-3">{book.shelf_location || '—'}</td></tr>)}</tbody></table></div>}</section>
    <section className="bg-white border rounded-2xl overflow-hidden"><div className="p-5 border-b"><h2 className="font-semibold">Outstanding borrowings</h2></div>{borrowings.length === 0 ? <p className="p-8 text-center text-gray-500">No outstanding borrowings.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-left"><tr><th className="p-3">Learner</th><th className="p-3">Book</th><th className="p-3">Borrowed</th><th className="p-3">Due</th></tr></thead><tbody>{borrowings.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.students ? `${row.students.first_name} ${row.students.last_name}` : '—'}</td><td className="p-3">{row.library_books?.title || '—'}</td><td className="p-3">{row.borrowed_at?.slice(0, 10)}</td><td className="p-3">{row.due_date}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
