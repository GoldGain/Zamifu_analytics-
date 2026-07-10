import { useState, useEffect } from 'react';
import { supabaseUntyped } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Loader2, MessageSquare, Users, CheckCircle, AlertCircle, Bell, Info } from 'lucide-react';
import { toast } from 'sonner';
import { sendBulkSMS, generateAnnouncementSMS } from '@/lib/sms';

type SMSType = 'announcement' | 'custom';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  admission_number: string;
  parent_phone: string;
  parent_name: string;
  class_id: string;
  classes?: { name: string } | null;
}

export default function BulkSms() {
  const { user } = useAuth();
  const [smsType, setSmsType] = useState<SMSType>('custom');
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => {
    fetchClasses();
  }, [user?.schoolId]);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    }
  }, [selectedClass]);

  useEffect(() => {
    const validPhones = students.filter(s => s.parent_phone && s.parent_phone.length >= 10);
    setRecipientCount(validPhones.length);
  }, [students]);

  const fetchClasses = async () => {
    const { data } = await supabaseUntyped
      .from('classes')
      .select('id, name')
      .eq('school_id', user?.schoolId)
      .eq('is_active', true)
      .order('name');
    setClasses(data || []);
    setLoading(false);
  };

  const fetchStudents = async () => {
    setLoading(true);
    let query = supabaseUntyped
      .from('students')
      .select('id, first_name, last_name, admission_number, parent_phone, parent_name, class_id, classes(name)')
      .eq('school_id', user?.schoolId)
      .eq('is_active', true);

    if (selectedClass === 'all') {
      // All classes - no filter
    } else if (selectedClass) {
      query = query.eq('class_id', selectedClass);
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Failed to load learners');
    } else {
      setStudents(data || []);
    }
    setLoading(false);
  };

  const getPreviewMessage = (student: Student): string => {
    switch (smsType) {
      case 'announcement':
        return generateAnnouncementSMS(
          user?.schoolName || 'School',
          message || '[Announcement will be inserted]'
        );
      default:
        return message || '[Custom message will be inserted]';
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (recipientCount === 0) {
      toast.error('No valid parent phone numbers found');
      return;
    }

    setSending(true);
    let successCount = 0;
    let failCount = 0;

    const validStudents = students.filter(s => s.parent_phone && s.parent_phone.length >= 10);

    for (const student of validStudents) {
      let personalizedMessage = message;

      personalizedMessage = personalizedMessage
        .replace(/{learner_name}/g, `${student.first_name} ${student.last_name}`)
        .replace(/{parent_name}/g, student.parent_name || 'Parent')
        .replace(/{assessment_number}/g, student.admission_number || '')
        .replace(/{class}/g, student.classes?.name || '')
        .replace(/{school}/g, user?.schoolName || 'School');

      const result = await sendBulkSMS([student.parent_phone], personalizedMessage);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setSending(false);

    if (successCount > 0) {
      toast.success(`SMS sent successfully to ${successCount} parent${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to send to ${failCount} parent${failCount > 1 ? 's' : ''}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#111111]">Bulk SMS</h1>
        <p className="text-sm text-[#666666]">Send SMS messages to parents</p>
      </div>

      {/* Automated Results SMS Info */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex gap-3 text-sm text-green-900">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-600" />
        <div>
          <p className="font-bold mb-1">Results SMS are now automated!</p>
          <p>When you publish results via the Results page, SMS notifications are sent automatically to all parents. No need to compose results SMS manually.</p>
        </div>
      </div>

      {/* SMS Type Selection */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">Select SMS Type</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setSmsType('announcement')}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              smsType === 'announcement'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Bell className="w-5 h-5" />
            <div className="text-left">
              <p className="text-sm font-medium">Announcement</p>
              <p className="text-xs text-gray-500">School announcements</p>
            </div>
          </button>
          <button
            onClick={() => setSmsType('custom')}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              smsType === 'custom'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <div className="text-left">
              <p className="text-sm font-medium">Custom Message</p>
              <p className="text-xs text-gray-500">Write your own message</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recipient Selection */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">Select Recipients</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white"
          >
            <option value="">-- Select Class --</option>
            <option value="all">All Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">{recipientCount} parent{recipientCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Message Composition */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <p className="text-sm font-semibold text-gray-700 mb-3">Compose Message</p>

        {smsType === 'announcement' && (
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Subject / Title</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Parent Meeting, School Closure..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter your message here..."
            rows={4}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-gray-400">{message.length} characters</p>
            <p className="text-xs text-gray-400">Sender: PROCALL</p>
          </div>
        </div>

        {/* Placeholder Help */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-blue-800 mb-1">Available Placeholders:</p>
          <div className="flex flex-wrap gap-2">
            {['{learner_name}', '{parent_name}', '{assessment_number}', '{class}', '{school}'].map((ph) => (
              <button
                key={ph}
                onClick={() => setMessage((prev) => prev + ph)}
                className="text-xs px-2 py-1 bg-white text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
              >
                {ph}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !message.trim() || recipientCount === 0}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#2563EB] text-white rounded-xl text-sm font-medium hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending {recipientCount} SMS...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send SMS to {recipientCount} Parent{recipientCount !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>

      {/* Preview */}
      {students.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <p className="text-sm font-semibold text-gray-700 mb-3">Preview (First 3 Learners)</p>
          <div className="space-y-3">
            {students.slice(0, 3).map((student) => (
              <div key={student.id} className="p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gray-700">{student.first_name} {student.last_name}</span>
                  <span className="text-xs text-gray-400">- Parent: {student.parent_name || 'N/A'} ({student.parent_phone || 'No phone'})</span>
                </div>
                <p className="text-xs text-gray-600 bg-white p-2 rounded-lg border border-gray-100">
                  {getPreviewMessage(student).substring(0, 160)}
                  {getPreviewMessage(student).length > 160 && '...'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
