import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { askZamifuAssistant, explainCurrentPage, type AiChatMessage } from '@/lib/ai';

interface ChatItem {
  role: 'user' | 'assistant';
  content: string;
}

function titleFromPath(path: string): string {
  if (path === '/') return 'Landing';
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1]?.replace(/-/g, ' ') || 'Page';
}

export default function AIAssistant() {
  const { user, schoolData } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const ctx = useMemo(
    () => ({
      pagePath: location.pathname,
      pageTitle: titleFromPath(location.pathname),
      role: user?.role || 'guest',
      schoolName: schoolData?.name,
      userName: [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email,
    }),
    [location.pathname, user, schoolData]
  );

  useEffect(() => {
    // Reset intro when page changes so context stays relevant
    const intro = explainCurrentPage(ctx);
    const first = user?.firstName ? ` ${user.firstName}` : '';
    setMessages([
      {
        role: 'assistant',
        content: `Hi${first}! I'm Zamifu Assistant.\n\n**${ctx.pageTitle}**\n${intro}\n\nAsk me anything about this page or the system.`,
      },
    ]);
  }, [location.pathname]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

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

  const quick = [
    'Explain this page',
    'How do I publish results?',
    'How does graduation work?',
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-[#2563EB] px-4 py-3 text-white shadow-lg shadow-blue-600/30 hover:bg-[#1d4ed8] transition-colors"
        aria-label="Open Zamifu AI Assistant"
      >
        <Bot className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-semibold">AI Help</span>
      </button>

      {open && (
        <div className="fixed bottom-5 right-5 z-[70] flex h-[min(70vh,560px)] w-[min(100vw-1.5rem,380px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <div>
                <p className="text-sm font-semibold">Zamifu Assistant</p>
                <p className="text-[11px] text-blue-100 capitalize">{ctx.pageTitle} · {ctx.role?.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/10" aria-label="Close assistant">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="border-t border-gray-100 bg-white p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
                >
                  {q}
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
                placeholder="Ask about this page…"
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
              <MessageCircle className="h-3 w-3" /> Contextual help for Zamifu Analytics
            </p>
          </div>
        </div>
      )}
    </>
  );
}
