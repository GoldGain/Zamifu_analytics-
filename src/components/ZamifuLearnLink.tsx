import { GraduationCap } from 'lucide-react';

export default function ZamifuLearnLink({ className = '', onClick }: { className?: string; onClick?: () => void }) {
  return (
    <a
      href="https://zamifulearn.company"
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={className || 'inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900'}
      aria-label="Open Zamifu Learn in a new tab"
    >
      <GraduationCap className="h-4 w-4 shrink-0" />
      Zamifu Learn
    </a>
  );
}
