import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  FolderCheck,
  Headphones,
  Loader2,
  Mail,
  MessageCircle,
  PhoneCall,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { DropProduct, ProductReview, SupportChatMessage } from '../types';

interface CustomerSupportWidgetProps {
  catalogDrops: DropProduct[];
  reviews: ProductReview[];
  hasAudioPlayerBar?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenPortal?: () => void;
}

const STARTER_QUESTIONS = [
  'Which license tier covers FM radio?',
  'Recommend an Afrobeats or Amapiano drop',
  'What payment methods work in my country?',
  'How do custom DJ drop milestones work?',
];

export function CustomerSupportWidget({
  catalogDrops,
  reviews,
  hasAudioPlayerBar = false,
  open: controlledOpen,
  onOpenChange,
  onOpenPortal,
}: CustomerSupportWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [messages, setMessages] = useState<SupportChatMessage[]>([
    {
      role: 'model',
      text: 'Welcome to Quality DJ Drops Worldwide 🌐 Online Assistance! Ask me about DJ drop recommendations, licensing tiers, VAT/GST tax compliance, local payment methods, or custom drop milestones — or use WhatsApp, Call, or Email above for human support.',
    },
  ]);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, loading]);

  const catalogPayload = useMemo(() => {
    return catalogDrops.slice(0, 40).map((d) => {
      const dropRevs = reviews.filter((r) => r.dropId === d.id);
      const avgRating =
        dropRevs.length > 0
          ? dropRevs.reduce((sum, r) => sum + r.rating, 0) / dropRevs.length
          : 0;
      return {
        title: d.title,
        voiceTalent: d.voiceTalent,
        genre: d.genre,
        bpm: d.bpm,
        standardPriceUsd: d.standardPriceUsd,
        commercialPriceUsd: d.commercialPriceUsd,
        exclusivePriceUsd: d.exclusivePriceUsd,
        avgRating,
        reviewCount: dropRevs.length,
      };
    });
  }, [catalogDrops, reviews]);

  const sendQuestion = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || loading) return;

    setErrorMsg('');
    const userMsg: SupportChatMessage = {
      role: 'user',
      text: trimmed.slice(0, 2000),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = nextHistory.slice(-20).map((m) => ({
        role: m.role,
        text: m.text,
      }));
      // Drop the initial canned greeting if it is the very first turn so Gemini starts cleanly with user
      const trimmedApiMessages =
        apiMessages.length > 1 && apiMessages[0].role === 'model'
          ? apiMessages.slice(1)
          : apiMessages;

      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: trimmedApiMessages,
          catalog: catalogPayload,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Support service failed to respond.');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: String(data.reply || '').trim() || 'How else can I assist you today?',
        },
      ]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to reach AI Customer Support right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendQuestion(input);
  };

  const handleReset = () => {
    setErrorMsg('');
    setMessages([
      {
        role: 'model',
        text: 'Conversation reset. Ask me anything about Quality DJ Drops Worldwide 🌐 drops, licensing rights, global tax rules, or custom commissions.',
      },
    ]);
  };

  const bottomOffsetClass = hasAudioPlayerBar ? 'bottom-16' : 'bottom-5';

  return (
    <div className={`fixed ${bottomOffsetClass} right-5 z-40`}>
      {open ? (
        <div
          className="w-[calc(100vw-2.5rem)] sm:w-[400px] h-[540px] max-h-[80vh] bg-[#12151C] border border-zinc-800 rounded-lg shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Quality DJ Drops Worldwide AI Customer Support"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[#0B0D11] border-b border-zinc-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-100 truncate">
                  Quality DJ Drops Support Concierge
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  Live AI chat + WhatsApp, Phone &amp; Email help
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                title="Reset conversation"
                aria-label="Reset support chat"
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close AI Customer Support"
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Direct Online Assistance Channels Bar */}
          <div className="px-3 py-2 bg-[#0E1117] border-b border-zinc-800 grid grid-cols-4 gap-1.5">
            <a
              href="https://wa.me/256784903051?text=Hello%20Quality%20DJ%20Drops%20Worldwide%2C%20I%20need%20online%20assistance."
              target="_blank"
              rel="noopener noreferrer"
              className="py-1.5 px-2 bg-[#12151C] hover:border-emerald-500 border border-zinc-800 rounded text-[11px] font-medium text-emerald-400 flex items-center justify-center gap-1 transition-colors"
            >
              <MessageCircle className="w-3 h-3 shrink-0" />
              <span>WhatsApp</span>
            </a>
            <a
              href="tel:+256784903051"
              className="py-1.5 px-2 bg-[#12151C] hover:border-emerald-500 border border-zinc-800 rounded text-[11px] font-medium text-zinc-200 flex items-center justify-center gap-1 transition-colors"
            >
              <PhoneCall className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Call</span>
            </a>
            <a
              href="mailto:opioisaac21062002@gmail.com?subject=Quality%20DJ%20Drops%20Online%20Assistance"
              className="py-1.5 px-2 bg-[#12151C] hover:border-amber-500 border border-zinc-800 rounded text-[11px] font-medium text-zinc-200 flex items-center justify-center gap-1 transition-colors"
            >
              <Mail className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Email</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenPortal?.();
              }}
              className="py-1.5 px-2 bg-[#12151C] hover:border-amber-500 border border-zinc-800 rounded text-[11px] font-medium text-zinc-200 flex items-center justify-center gap-1 transition-colors"
            >
              <FolderCheck className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Orders</span>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-amber-500 text-zinc-950 font-medium'
                      : 'bg-[#0B0D11] border border-zinc-800 text-zinc-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {messages.length <= 1 && (
              <div className="pt-1 space-y-1.5">
                <div className="text-[11px] text-zinc-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Quick questions</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendQuestion(q)}
                      className="text-left px-2.5 py-1.5 bg-[#0B0D11] hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] text-zinc-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#0B0D11] border border-zinc-800 rounded-lg text-xs text-zinc-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Checking studio catalog &amp; licensing rules...</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-300">
                {errorMsg}
              </div>
            )}
            <div ref={scrollEndRef} />
          </div>

          {/* Input + WhatsApp Escalation */}
          <div className="border-t border-zinc-800 bg-[#0B0D11] p-3 space-y-2">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={1000}
                placeholder="Ask about drops, prices, licensing, tax..."
                className="flex-1 min-w-0 px-3 py-2 bg-[#12151C] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send support message"
                className="p-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-md transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
              <a
                href="mailto:opioisaac21062002@gmail.com"
                className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors truncate"
              >
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">opioisaac21062002@gmail.com</span>
              </a>
              <a
                href="https://wa.me/256784903051"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors shrink-0"
              >
                <MessageCircle className="w-3 h-3" />
                +256 784 903 051
              </a>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md shadow-lg border border-amber-400/50 transition-colors"
        >
          <Headphones className="w-4 h-4" />
          <span>Online Help</span>
        </button>
      )}
    </div>
  );
}
