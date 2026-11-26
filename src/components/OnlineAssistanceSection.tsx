import { useState } from 'react';
import {
  Bot,
  ChevronDown,
  FolderCheck,
  Headphones,
  Mail,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';

interface OnlineAssistanceSectionProps {
  onOpenLiveChat: () => void;
  onOpenPortal: () => void;
  onOpenAuth: () => void;
  isSignedIn: boolean;
}

const HELP_TOPICS = [
  {
    id: 'downloads',
    question: 'How do I access my purchased DJ drops and license certificate?',
    answer:
      'Every completed checkout immediately generates a downloadable signed license certificate and unlocks your 24-bit WAV / 320kbps MP3 master files inside Studio Portal -> Orders & Downloads.',
  },
  {
    id: 'payments',
    question: 'Which online payment methods are supported in my country?',
    answer:
      'Checkout automatically adapts to 560+ global jurisdictions, supporting Visa/Mastercard, Apple Pay, Google Pay, PayPal, MTN MoMo, Airtel Money, M-Pesa, SEPA, UK Faster Payments, PIX, UPI, and bank transfers.',
  },
  {
    id: 'custom-milestones',
    question: 'How long do custom DJ drop commissions take and how are they tracked?',
    answer:
      'Standard custom drops are voiced, processed with FX, and mastered within 24–48 hours. You receive automatic email updates at each stage (Submitted, Script Approved, Voicing & FX, Mastering, Delivered).',
  },
  {
    id: 'revisions',
    question: 'Need a pronunciation fix, rush delivery, or bulk station package?',
    answer:
      'Message our studio desk directly on WhatsApp (+256 784 903 051) or email opioisaac21062002@gmail.com with your order ID or DJ handle for same-day engineer assistance.',
  },
];

export function OnlineAssistanceSection({
  onOpenLiveChat,
  onOpenPortal,
  onOpenAuth,
  isSignedIn,
}: OnlineAssistanceSectionProps) {
  const [openTopicId, setOpenTopicId] = useState<string>('downloads');

  return (
    <section
      id="online-assistance"
      className="py-16 border-t border-zinc-800/80 bg-[#0B0D11]/60"
    >
      <div className="max-w-6xl mx-auto px-6 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs font-medium text-amber-400 tracking-wide">
              24/7 Global Support Desk
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight">
              Online Assistance &amp; Studio Help Center
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Choose how you want help — instant AI licensing concierge, live WhatsApp chat with our studio team, direct phone call, email support, or self-service order tracking.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#12151C] border border-zinc-800 rounded-md text-xs text-emerald-400 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Online Assistance Available</span>
          </div>
        </div>

        {/* 4 Direct Online Assistance Channels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Option 1: Live AI Chat Concierge */}
          <div className="bg-[#12151C] border border-zinc-800 hover:border-amber-500/60 rounded-lg p-5 flex flex-col justify-between gap-4 transition-colors">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Live AI Studio Chat
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Instant online answers for voice samples, license rights, VAT/GST tax rules, and pricing.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenLiveChat}
              className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Start Live Chat</span>
            </button>
          </div>

          {/* Option 2: WhatsApp Direct Studio Desk */}
          <div className="bg-[#12151C] border border-zinc-800 hover:border-emerald-500/60 rounded-lg p-5 flex flex-col justify-between gap-4 transition-colors">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100">
                WhatsApp Live Desk
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Chat directly with our producer desk for custom scripts, rush delivery, or payment help.
              </p>
            </div>
            <a
              href="https://wa.me/256784903051?text=Hello%20Quality%20DJ%20Drops%20Worldwide%2C%20I%20need%20online%20assistance."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-md transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat +256 784 903 051</span>
            </a>
          </div>

          {/* Option 3: Email & Direct Voice Line */}
          <div className="bg-[#12151C] border border-zinc-800 hover:border-amber-500/60 rounded-lg p-5 flex flex-col justify-between gap-4 transition-colors">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <Mail className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Email &amp; Phone Support
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Reach billing, licensing verification, or technical support directly by email or phone call.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="mailto:opioisaac21062002@gmail.com?subject=Quality%20DJ%20Drops%20Online%20Assistance"
                className="py-2 px-2.5 bg-[#0B0D11] border border-zinc-700 hover:border-amber-500 text-zinc-200 font-medium text-xs rounded-md transition-colors inline-flex items-center justify-center gap-1"
              >
                <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Email</span>
              </a>
              <a
                href="tel:+256784903051"
                className="py-2 px-2.5 bg-[#0B0D11] border border-zinc-700 hover:border-emerald-500 text-zinc-200 font-medium text-xs rounded-md transition-colors inline-flex items-center justify-center gap-1"
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Call</span>
              </a>
            </div>
          </div>

          {/* Option 4: Order, Download & License Self-Service */}
          <div className="bg-[#12151C] border border-zinc-800 hover:border-amber-500/60 rounded-lg p-5 flex flex-col justify-between gap-4 transition-colors">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <FolderCheck className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Order &amp; License Help
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Track custom drop milestones, re-download audio masters, or print your license certificate.
              </p>
            </div>
            <button
              type="button"
              onClick={isSignedIn ? onOpenPortal : onOpenAuth}
              className="w-full py-2 px-3 bg-[#0B0D11] border border-zinc-700 hover:border-amber-500 text-zinc-100 font-semibold text-xs rounded-md transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSignedIn ? 'Open Studio Portal' : 'Sign In to Track'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Quick Help / FAQ Accordion */}
        <div className="bg-[#12151C] border border-zinc-800 rounded-lg divide-y divide-zinc-800 overflow-hidden">
          <div className="px-5 py-3.5 bg-[#0E1117] flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-200">
              Frequently Asked Support Questions
            </span>
            <span className="text-[11px] font-mono text-zinc-500">
              Instant Self-Service Answers
            </span>
          </div>
          {HELP_TOPICS.map((topic) => {
            const expanded = openTopicId === topic.id;
            return (
              <div key={topic.id}>
                <button
                  type="button"
                  onClick={() => setOpenTopicId(expanded ? '' : topic.id)}
                  aria-expanded={expanded}
                  className="w-full px-5 py-3.5 text-left flex items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors"
                >
                  <span className="text-xs sm:text-sm font-medium text-zinc-100">
                    {topic.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${
                      expanded ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </button>
                {expanded && (
                  <div className="px-5 pb-4 text-xs text-zinc-400 leading-relaxed">
                    {topic.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
