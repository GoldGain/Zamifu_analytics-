import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseUntyped } from '@/lib/supabase/client';
import { Bot, Send, Loader2, Globe, User } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = {
  en: [
    { label: 'Fee Balance', query: 'What is my child\'s fee balance?' },
    { label: 'Show Results', query: 'Show my child\'s results' },
    { label: 'Download Report', query: 'Download report card' },
    { label: 'Book Meeting', query: 'Book meeting with teacher' },
    { label: 'Next Exam', query: 'When is next exam?' },
    { label: 'Homework', query: 'Show my child\'s homework' },
  ],
  sw: [
    { label: 'Salio la Ada', query: 'Salio la ada ya mtoto wangu ni ngapi?' },
    { label: 'Matokeo', query: 'Nionyeshe matokeo ya mtoto wangu' },
    { label: 'Ripoti', query: 'Pakua kadi ya ripoti' },
    { label: 'Mkutano', query: 'Weka mkutano na mwalimu' },
    { label: 'Mtihani', query: 'Mtihani ujao ni lini?' },
    { label: 'Kazi ya Nyumbani', query: 'Nionyeshe kazi ya nyumbani ya mtoto wangu' },
  ],
};

export default function ParentChatbot() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState<'en' | 'sw'>('en');
  const [childData, setChildData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchChildData();
    const greeting = lang === 'en'
      ? `Hello! I'm your Zamifu Analytics AI Assistant. I can help you with:\n• Fee balance inquiries\n• Viewing your child's results\n• Downloading report cards\n• Booking teacher meetings\n• Exam schedules\n• Class timetables\n\nHow can I help you today?`
      : `Habari! Mimi ni Msaidizi wa Zamifu Analytics. Naweza kukusaidia na:\n• Maswali ya ada\n• Kuona matokeo ya mtoto wako\n• Kupakua kadi ya ripoti\n• Kuweka mkutano na mwalimu\n• Ratiba za mitihani\n• Ratiba za darasa\n\nNinawezaje kukusaidia leo?`;
    setMessages([{ id: '1', role: 'assistant', content: greeting, timestamp: new Date() }]);
  }, [lang]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChildData = async () => {
    const { data: links } = await supabaseUntyped.from('parent_student_links').select('student_id').eq('parent_id', user?.id);
    if (links && links.length > 0) {
      const { data: student } = await supabaseUntyped
        .from('students')
        .select('*, classes(name)')
        .eq('id', links[0].student_id)
        .single();
      setChildData(student);
    }
  };

  const t = (en: string, sw: string) => lang === 'sw' ? sw : en;

  const generateResponse = async (query: string): Promise<string> => {
    const q = query.toLowerCase();
    const child = childData;
    const childName = child ? `${child.first_name} ${child.last_name}` : t('your child', 'mtoto wako');

    // Fee balance
    if (q.includes('fee') || q.includes('balance') || q.includes('ada') || q.includes('salio')) {
      if (child) {
        const { data: invoices } = await supabaseUntyped.from('fee_invoices').select('balance, total_amount, amount_paid').eq('student_id', child.id);
        const balance = invoices?.reduce((s: number, i: any) => s + (i.balance || 0), 0) || 0;
        const total = invoices?.reduce((s: number, i: any) => s + (i.total_amount || 0), 0) || 0;
        const paid = invoices?.reduce((s: number, i: any) => s + (i.amount_paid || 0), 0) || 0;
        return t(
          `📊 **Fee Summary for ${childName}:**\n\nTotal Fees: Ksh ${total.toLocaleString()}\nAmount Paid: Ksh ${paid.toLocaleString()}\nOutstanding Balance: Ksh ${balance.toLocaleString()}\n\nPlease visit the school office or use M-Pesa to pay.\n\n📧 Support: tutorsultimate@gmail.com`,
          `📊 **Muhtasari wa Ada kwa ${childName}:**\n\nJumla ya Ada: Ksh ${total.toLocaleString()}\nKilicholipwa: Ksh ${paid.toLocaleString()}\nSalio Linalobaki: Ksh ${balance.toLocaleString()}\n\nTafadhali tembelea ofisi ya shule au tumia M-Pesa kulipa.\n\n📧 Msaada: tutorsultimate@gmail.com`
        );
      }
      return t('No child linked to your account. Please contact the school.', 'Hakuna mtoto aliyeunganishwa na akaunti yako. Wasiliana na shule.');
    }

    // Results
    if (q.includes('result') || q.includes('grade') || q.includes('mark') || q.includes('matokeo') || q.includes('alama') || q.includes('daraja')) {
      if (child) {
        const { data: results } = await supabaseUntyped
          .from('results')
          .select('*, subjects(name)')
          .eq('student_id', child.id)
          .order('created_at', { ascending: false })
          .limit(6);
        if (results && results.length > 0) {
          const getPct = (r: any) => r.percentage !== undefined && r.percentage !== null ? r.percentage : Math.round((r.marks / (r.out_of || 100)) * 100);
          const avg = Math.round(results.reduce((s: number, r: any) => s + getPct(r), 0) / results.length);
          const resultList = results.map((r: any) => `  • ${r.subjects?.name}: ${getPct(r)}% (${r.cbc_grade || '-'})`).join('\n');
          return t(
            `📚 **Recent Results for ${childName}:**\n\n${resultList}\n\n📈 Average: ${avg}%\n\nFor full report card, go to Report Card section.`,
            `📚 **Matokeo ya Hivi Karibuni ya ${childName}:**\n\n${resultList}\n\n📈 Wastani: ${avg}%\n\nKwa kadi kamili ya ripoti, nenda sehemu ya Kadi ya Ripoti.`
          );
        }
        return t(`No results found for ${childName} yet.`, `Hakuna matokeo ya ${childName} bado.`);
      }
      return t('No child linked to your account.', 'Hakuna mtoto aliyeunganishwa.');
    }

    // Report card download
    if (q.includes('report') || q.includes('download') || q.includes('ripoti') || q.includes('pakua')) {
      return t(
        `📄 To download ${childName}'s report card:\n\n1. Click "My Children" in the sidebar\n2. Select the child\n3. Click "Report Card" tab\n4. Choose the term\n5. Click "Download PDF"\n\nOr go directly to: Parent → Report Card`,
        `📄 Kupakua kadi ya ripoti ya ${childName}:\n\n1. Bonyeza "Watoto Wangu" upande wa kushoto\n2. Chagua mtoto\n3. Bonyeza kichupo "Kadi ya Ripoti"\n4. Chagua muhula\n5. Bonyeza "Pakua PDF"\n\nAu nenda moja kwa moja: Mzazi → Kadi ya Ripoti`
      );
    }

    // Absence recording
    if (q.includes('absent') || q.includes('absence') || q.includes('hayupo') || q.includes('kutokuwepo')) {
      return t(
        `📋 To report ${childName}'s absence:\n\nPlease contact the school directly or visit the school office. The class teacher will record the absence in the system.\n\n📧 Support: tutorsultimate@gmail.com`,
        `📋 Kuripoti kutokuwepo kwa ${childName}:\n\nTafadhali wasiliana na shule moja kwa moja au tembelea ofisi ya shule. Mwalimu wa darasa atarekodi kutokuwepo katika mfumo.\n\n📧 Msaada: tutorsultimate@gmail.com`
      );
    }

    // Book meeting
    if (q.includes('meeting') || q.includes('conference') || q.includes('book') || q.includes('mkutano') || q.includes('weka')) {
      return t(
        `📅 To book a meeting with ${childName}'s teacher:\n\n1. Go to "Conferences" in the sidebar\n2. Click "Book Meeting"\n3. Select the teacher and preferred time\n4. Add meeting notes\n5. Submit request\n\nThe teacher will confirm the meeting time.`,
        `📅 Kuweka mkutano na mwalimu wa ${childName}:\n\n1. Nenda "Mikutano" upande wa kushoto\n2. Bonyeza "Weka Mkutano"\n3. Chagua mwalimu na wakati unaopenda\n4. Ongeza maelezo ya mkutano\n5. Wasilisha ombi\n\nMwalimu atathibitisha wakati wa mkutano.`
      );
    }

    // Exam timetable
    if (q.includes('exam') || q.includes('test') || q.includes('mtihani') || q.includes('lini')) {
      const { data: exams } = await supabaseUntyped
        .from('exam_timetable')
        .select('*, subjects(name)')
        .eq('school_id', child?.school_id)
        .order('exam_date')
        .limit(5);
      if (exams && exams.length > 0) {
        const examList = exams.map((e: any) => `  • ${e.subjects?.name}: ${e.exam_date} at ${e.start_time}`).join('\n');
        return t(`📅 **Upcoming Exams:**\n\n${examList}`, `📅 **Mitihani Inayokuja:**\n\n${examList}`);
      }
      return t(
        '📅 No upcoming exams scheduled yet. Check back later or contact the school.',
        '📅 Hakuna mitihani iliyopangwa bado. Angalia baadaye au wasiliana na shule.'
      );
    }

    // Timetable
    if (q.includes('timetable') || q.includes('schedule') || q.includes('ratiba') || q.includes('darasa')) {
      if (child?.class_id) {
        const { data: timetable } = await supabaseUntyped
          .from('timetable')
          .select('*, subjects(name)')
          .eq('class_id', child.class_id)
          .order('day_of_week')
          .limit(10);
        if (timetable && timetable.length > 0) {
          const ttList = timetable.map((t: any) => `  • ${t.day_of_week}: ${t.subjects?.name} (${t.start_time}-${t.end_time})`).join('\n');
          return t(`📚 **${childName}'s Timetable:**\n\n${ttList}`, `📚 **Ratiba ya ${childName}:**\n\n${ttList}`);
        }
      }
      return t(
        'Timetable not available yet. Please contact the school.',
        'Ratiba haipatikani bado. Tafadhali wasiliana na shule.'
      );
    }

    // Homework
    if (q.includes('homework') || q.includes('assignment') || q.includes('kazi') || q.includes('nyumbani') || q.includes('imebaki')) {
      if (child?.class_id) {
        const { data: hw } = await supabaseUntyped
          .from('homework')
          .select('*, subjects(name)')
          .eq('class_id', child.class_id)
          .eq('is_active', true)
          .gte('due_date', new Date().toISOString().split('T')[0])
          .order('due_date')
          .limit(5);
        if (hw && hw.length > 0) {
          const hwList = hw.map((h: any) => `  • ${h.subjects?.name || 'General'}: ${h.title} (Due: ${h.due_date})`).join('\n');
          return t(
            `📚 **Pending Homework for ${childName}:**\n\n${hwList}\n\nRemind your child to complete these assignments on time!`,
            `📚 **Kazi ya Nyumbani Iliyobaki kwa ${childName}:**\n\n${hwList}\n\nKumbusha mtoto wako kukamilisha kazi hizi kwa wakati!`
          );
        }
        return t(
          `✅ No pending homework for ${childName}. All assignments are up to date!`,
          `✅ Hakuna kazi ya nyumbani iliyobaki kwa ${childName}. Kazi zote zimekamilika!`
        );
      }
      return t('No child linked to your account.', 'Hakuna mtoto aliyeunganishwa.');
    }

    // Default response
    return t(
      `I can help you with:\n\n• **Fee balance** - Ask "What is my child's fee balance?"\n• **Results** - Ask "Show my child's results"\n• **Report card** - Ask "Download report card"\n• **Absence** - Ask "My child was absent today"\n• **Meeting** - Ask "Book meeting with teacher"\n• **Exams** - Ask "When is next exam?"\n• **Timetable** - Ask "Show timetable"\n\n📧 Support: tutorsultimate@gmail.com`,
      `Ninaweza kukusaidia na:\n\n• **Salio la ada** - Uliza "Salio la ada ya mtoto wangu ni ngapi?"\n• **Matokeo** - Uliza "Nionyeshe matokeo"\n• **Kadi ya ripoti** - Uliza "Pakua kadi ya ripoti"\n• **Kutokuwepo** - Uliza "Mtoto wangu hakuwepo leo"\n• **Mkutano** - Uliza "Weka mkutano na mwalimu"\n• **Mitihani** - Uliza "Mtihani ujao ni lini?"\n• **Ratiba** - Uliza "Nionyeshe ratiba"\n\n📧 Msaada: tutorsultimate@gmail.com`
    );
  };

  const handleSend = async (queryText?: string) => {
    const text = queryText || input;
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    const response = await generateResponse(text);
    const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: response, timestamp: new Date() };
    setMessages(prev => [...prev, botMsg]);
    setLoading(false);
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="font-bold text-[#111111]">{line.slice(2, -2)}</p>;
      }
      if (line.includes('**')) {
        const parts = line.split(/\*\*(.*?)\*\*/);
        return <p key={i}>{parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}</p>;
      }
      return <p key={i}>{line}</p>;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111111]">AI Assistant</h1>
          <p className="text-sm text-[#666666]">Ask questions about your child's education</p>
        </div>
        <button
          onClick={() => setLang(lang === 'en' ? 'sw' : 'en')}
          className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-xl text-sm hover:bg-gray-50"
        >
          <Globe className="w-4 h-4" />
          {lang === 'en' ? 'Switch to Kiswahili' : 'Switch to English'}
        </button>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS[lang].map((action, i) => (
          <button
            key={i}
            onClick={() => handleSend(action.query)}
            className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>

      {/* Chat Window */}
      <div className="bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.08)] flex flex-col" style={{ height: '500px' }}>
        <div className="flex items-center gap-3 p-4 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111111]">Zamifu Analytics AI Assistant</p>
            <p className="text-xs text-green-500">● Online</p>
          </div>
          <div className="ml-auto text-xs text-gray-400">{lang === 'en' ? 'English' : 'Kiswahili'}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-[#2563EB]' : 'bg-gray-100'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-gray-600" />}
              </div>
              <div className={`max-w-xs md:max-w-md rounded-2xl p-3 text-sm space-y-1 ${msg.role === 'user' ? 'bg-[#2563EB] text-white rounded-tr-none' : 'bg-gray-50 text-[#111111] rounded-tl-none'}`}>
                {formatMessage(msg.content)}
                <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-100 text-right' : 'text-gray-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-gray-50 rounded-2xl p-3 rounded-tl-none">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === 'en' ? "Ask about fees, results, timetable..." : "Uliza kuhusu ada, matokeo, ratiba..."}
              className="w-full bg-gray-50 border-none rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-blue-500 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
