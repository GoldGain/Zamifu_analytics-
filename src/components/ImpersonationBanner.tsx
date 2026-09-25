import { Clock3, LogOut, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function ImpersonationBanner() {
  const { impersonation, exitImpersonation } = useAuth();
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!impersonation) return;
    const update = () => { const seconds = Math.max(0, Math.floor((new Date(impersonation.expiresAt).getTime() - Date.now()) / 1000)); setRemaining(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`); };
    update(); const timer = window.setInterval(update, 1000); return () => window.clearInterval(timer);
  }, [impersonation]);
  if (!impersonation) return null;
  return <div className="sticky top-0 z-40 flex flex-col gap-2 bg-amber-400 px-3 py-2 text-amber-950 shadow-md sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldAlert className="h-5 w-5 shrink-0" /><span>SUPPORT VIEW: {impersonation.target.email || impersonation.target.name} ({impersonation.target.role.replace(/_/g, ' ')})</span><span className="hidden font-normal sm:inline">— changes are visible to this account</span></div><div className="flex items-center gap-3 text-sm"><span className="inline-flex items-center gap-1 font-mono"><Clock3 className="h-4 w-4" />{remaining}</span><button onClick={() => void exitImpersonation('manual_exit')} className="inline-flex items-center gap-1 rounded-md bg-amber-950 px-3 py-1.5 font-semibold text-white hover:bg-black"><LogOut className="h-4 w-4" />Exit support view</button></div></div>;
}
