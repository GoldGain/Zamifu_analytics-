import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import {
  Bot,
  Loader2,
  MessageCircle,
  Send,
  Sparkles,
  X,
  Bell,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  askZamifuAssistant,
  explainCurrentPage,
  fetchRoleInsights,
  roleQuickActions,
  type AiChatMessage,
  type AiInsight,
} from '@/lib/ai';

interface ChatItem {
  role: 'user' | 'assistant';
  content: string;
}

function titleFromPath(path: string): string {
  if (path === '/') return 'Landing';
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1]?.replace(/-/g, ' ') || 'Page';
}

function severityClass(s: AiInsight['severity']) {
  if (s === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (s === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return 'border-blue-100 bg-blue-50 text-blue-900';
}

export default function AIAssistant() {
  const { user, schoolData } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [showInsights, setShowInsights] = useState(true);
  const [insightLoading, setInsightLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const shownPopupFor = useRef<string>('');

  const ctx = useMemo(
    () => ({
      pagePath: location.pathname,
      pageTitle: titleFromPath(location.pathname),
      role: user?.role || 'guest',
      schoolName: schoolData?.name,
      userName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email,
      schoolId: user?.schoolId,
      userId: user?.id,
    }),
    [location.pathname, user, schoolData]
  );

  const quick = useMemo(() => roleQuickActions(ctx.role), [ctx.role]);

  // Page intro + insights
  useEffect(() => {
    const intro = explainCurrentPage(ctx);
    const first = user?.firstName ? ` ${user.firstName}` : '';
    setMessages([
      {
        role: 'assistant',
        content: `Hi${first}. I am Zamifu Copilot, your guide for this page.\n\nYou are on ${ctx.pageTitle}.\n${intro}\n\nAsk me to explain this page, walk through a task, or use a quick action below.`,
      },
    ]);
    setShowInsights(true);

    let cancelled = false;
    (async () => {
      setInsightLoading(true);
      try {
        const data = await fetchRoleInsights(ctx);
        if (!cancelled) {
          setInsights(data);
          // Auto-open once per path when there is a warning insight
          const key = location.pathname + ':' + (user?.id || 'guest');
          const hasWarning = data.some((i) => i.severity === 'warning');
          if (hasWarning && shownPopupFor.current !== key) {
            shownPopupFor.current = key;
            setOpen(true);
          }
        }
      } finally {
        if (!cancelled) setInsightLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, user?.id, user?.role, user?.schoolId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, insights]);

  const send = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const history: AiChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const answer = await askZamifuAssistant(question, ctx, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } finally {
      setLoading(false);
    }
  };

  const warningCount = insights.filter((i) => i.severity === 'warning').length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white shadow-lg shadow-blue-600/30 hover:from-blue-700 hover:to-indigo-700 transition-all"
        aria-label="Open Zamifu Copilot"
      >
        <span className="relative">
          <Bot className="h-5 w-5" />
          {warningCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-950">
              {warningCount}
            </span>
          )}
        </span>
        <span className="hidden sm:inline text-sm font-semibold">Zamifu Copilot</span>
      </button>

      {open && (
        <div className="fixed bottom-5 right-5 z-[70] flex h-[min(78vh,640px)] w-[min(100vw-1.5rem,400px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <div>
                <p className="text-sm font-semibold">Zamifu Copilot</p>
                <p className="text-[11px] text-blue-100 capitalize">
                  {ctx.pageTitle} · {(ctx.role || 'guest').replace(/_/g, ' ')}
                  {ctx.schoolName ? ` · ${ctx.schoolName}` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 hover:bg-white/10"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Live insights */}
          <div className="border-b border-gray-100 bg-slate-50">
            <button
              type="button"
              onClick={() => setShowInsights((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-semibold text-gray-700"
            >
              <span className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-indigo-600" />
                Live insights
                {insightLoading && <Loader2 className="h-3 w-3 animate-spin text-gray-400" />}
              </span>
              {showInsights ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showInsights && (
              <div className="max-h-36 space-y-1.5 overflow-y-auto px-3 pb-2">
                {insights.length === 0 && !insightLoading && (
                  <p className="text-[11px] text-gray-500">No insights yet for this role/page.</p>
                )}
                {insights.map((ins) => (
                  <div
                    key={ins.id}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug ${severityClass(ins.severity)}`}
                  >
                    <p className="font-semibold">{ins.title}</p>
                    <p className="opacity-90">{ins.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-md bg-blue-600 text-white'
                      : 'rounded-bl-md border border-gray-100 bg-white text-gray-800 shadow-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 px-1 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-gray-100 bg-white p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => send(q.query)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about this page or any Zamifu task"
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-blue-600 p-2.5 text-white disabled:opacity-50"
                aria-label="Send"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
              <MessageCircle className="h-3 w-3" />
              Page-aware help for your role
            </p>
          </div>
        </div>
      )}
    </>
  );
}
