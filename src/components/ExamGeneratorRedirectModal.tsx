import { useState } from 'react';
import { toast } from 'sonner';
import { ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createLearnHandoff } from '@/lib/learn-sso';

export default function ExamGeneratorRedirectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, schoolData } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!open) return null;

  const go = async () => {
    if (!user) {
      toast.error('Please sign in again before continuing.');
      return;
    }
    setBusy(true);
    try {
      const url = await createLearnHandoff({
        userId: user.id,
        email: user.email,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        schoolName: schoolData?.name || null,
        role: user.role,
        classLevel: null,
      });
      window.location.assign(url);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Could not open Zamifu Learn.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2 text-[#2563EB]"><ExternalLink className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-black text-gray-900">Opening the Exam Generator</h2>
            <p className="mt-1 text-sm text-gray-600">
              You are being redirected to <strong>Zamifu Learn</strong> to use the Exam Generator.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Accessing the exam generator requires a Zamifu Learn subscription:{' '}
          <strong>Day pass KES 50</strong>, <strong>Week KES 300</strong>, <strong>Month KES 1000</strong>.
          You will be signed in automatically — no second password.
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={go} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Continue to Exam Generator
          </button>
        </div>
      </div>
    </div>
  );
}
