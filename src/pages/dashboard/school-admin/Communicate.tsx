import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Loader2, MessageSquare, Users, UserCheck, Bell, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { sendBulkSMS, generateAnnouncementSMS } from '@/lib/sms';

type RecipientType = 'class' | 'teachers' | 'all_parents';

export default function Communicate() {
  const { user } = useAuth();
  const [recipientType, setRecipientType] = useState<RecipientType>('class');
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, [user?.schoolId]);

  useEffect(() => {
    updateRecipientCount();
  }, [recipientType, selectedClass, classes, teachers]);

  const fetchData = async () => {
    const schoolId = user?.schoolId;
    const [{ data: c }, { data: t }] = await Promise.all([
      supabaseUntyped.from('classes').select('id, name').eq('school_id', schoolId).eq('is_active', true).order('name'),
      supabaseUntyped.from('teachers').select('id, first_name, last_name, phone').eq('school_id', schoolId).eq('is_active', true),
    ]);
    setClasses(c || []);
    setTeachers(t || []);
  };

  const updateRecipientCount = () => {
    let count = 0;
    if (recipientType === 'class' && selectedClass) {
      // Will be calculated when fetching students
      count = 0; // Placeholder - actual count from parent phones
    } else if (recipientType === 'teachers') {
      count = teachers.filter(t => t.phone).length;
    } else if (recipientType === 'all_parents') {
      count = 0; // Will be calculated
    }
    setRecipientCount(count);
  };

  const fetchRecipients = async (): Promise<string[]> => {
    const schoolId = user?.schoolId;
    const phones: string[] = [];

    if (recipientType === 'class' && selectedClass) {
      const { data } = await supabaseUntyped
        .from('students')
        .select('parent_phone')
        .eq('school_id', schoolId)
        .eq('class_id', selectedClass)
        .eq('is_active', true);
      
      (data || []).forEach((s: any) => {
        if (s.parent_phone && s.parent_phone.length >= 9) {
          phones.push(s.parent_phone);
        }
      });
    } else if (recipientType === 'teachers') {
      teachers.forEach((t: any) => {
        if (t.phone && t.phone.length >= 9) {
          phones.push(t.phone);
        }
      });
    } else if (recipientType === 'all_parents') {
      const { data } = await supabaseUntyped
        .from('students')
        .select('parent_phone')
        .eq('school_id', schoolId)
        .eq('is_active', true);
      
      (data || []).forEach((s: any) => {
        if (s.parent_phone && s.parent_phone.length >= 9) {
          phones.push(s.parent_phone);
        }
      });
    }

    // Deduplicate
    return [...new Set(phones)];
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    const phones = await fetchRecipients();
    if (phones.length === 0) {
      toast.error('No valid phone numbers found for the selected recipients');
      return;
    }

    setSending(true);
    let successCount = 0;
    let failCount = 0;

    for (const phone of phones) {
      const result = await sendBulkSMS([phone], message);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setSending(false);

    if (successCount > 0) {
      toast.success(`SMS sent to ${successCount} recipient(s)`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send to ${failCount} recipient(s)`);
    }

    setMessage('');
  };

  const getPlaceholder = () => {
    switch (recipientType) {
      case 'class':
        return 'Write a message to all parents in the selected class...';
      case 'teachers':
        return 'Write a message to all teachers...';
      case 'all_parents':
        return 'Write a message to all parents in the school...';
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Communicate</h1>
        <p className="text-sm text-[#666666]">Send SMS to classes or teachers</p>
      </div>

      {/* Recipient Type Selection */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">Send To</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => { setRecipientType('class'); setSelectedClass(''); }}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              recipientType === 'class'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Users className="w-5 h-5" />
            <div className="text-left">
              <p className="text-sm font-medium">A Class</p>
              <p className="text-xs text-gray-500">Send to parents in a class</p>
            </div>
          </button>
          <button
            onClick={() => setRecipientType('teachers')}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              recipientType === 'teachers'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <UserCheck className="w-5 h-5" />
            <div className="text-left">
              <p className="text-sm font-medium">All Teachers</p>
              <p className="text-xs text-gray-500">Send to all teachers</p>
            </div>
          </button>
          <button
            onClick={() => setRecipientType('all_parents')}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              recipientType === 'all_parents'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Bell className="w-5 h-5" />
            <div className="text-left">
              <p className="text-sm font-medium">All Parents</p>
              <p className="text-xs text-gray-500">Send to all parents</p>
            </div>
          </button>
        </div>
      </div>

      {/* Class Selection */}
      {recipientType === 'class' && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Class</label>
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
          >
            <option value="">-- Select a class --</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Recipient Info */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-gray-600">
            {recipientType === 'class' && selectedClass
              ? `Sending to parents of: ${classes.find(c => c.id === selectedClass)?.name || 'selected class'}`
              : recipientType === 'teachers'
              ? `Sending to ${teachers.filter(t => t.phone).length} teacher(s)`
              : 'Sending to all parents in school'}
          </span>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder={getPlaceholder()}
          rows={5}
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-400">{message.length} characters</p>
          <p className="text-xs text-gray-400">Sender: PROCALL</p>
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send SMS
            </>
          )}
        </button>
      </div>
    </div>
  );
}
