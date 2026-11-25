import { FormEvent, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { CheckCircle2, Mail, MessageCircle, Send } from 'lucide-react';
import { db, handleFirestoreError, OperationType, signInWithGoogle } from '../firebase';
import { CustomDropRequest, EmailTemplateConfig, LicenseTier } from '../types';
import { DEFAULT_EMAIL_TEMPLATE_CONFIG, renderMilestoneEmail } from '../utils/emailTemplates';
import { JurisdictionSelector } from './JurisdictionSelector';

interface CustomRequestSectionProps {
  user: User | null;
  emailTemplateConfig?: EmailTemplateConfig | null;
  onRequestCreated: (req: CustomDropRequest) => void;
}

export function CustomRequestSection({
  user,
  emailTemplateConfig,
  onRequestCreated,
}: CustomRequestSectionProps) {
  const [djName, setDjName] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [vocalStyle, setVocalStyle] = useState('Deep Sub Bass');
  const [genre, setGenre] = useState('Afrobeats');
  const [bpmTarget, setBpmTarget] = useState(112);
  const [countryCode, setCountryCode] = useState('UG');
  const [licenseTier, setLicenseTier] = useState<LicenseTier>('commercial');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!djName.trim() || scriptText.trim().length < 4) {
      setErrorMessage('Please enter your DJ/station name and drop script (at least 4 characters).');
      return;
    }

    let activeUser = user;
    if (!activeUser) {
      try {
        const cred = await signInWithGoogle();
        activeUser = cred.user;
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Sign-in cancelled.');
        return;
      }
    }

    if (!activeUser) return;
    setSubmitting(true);

    try {
      const requestId = `req_${Date.now()}`;
      const quotedPriceUsd =
        licenseTier === 'standard' ? 49 : licenseTier === 'commercial' ? 119 : 349;

      const reqPayload: CustomDropRequest = {
        id: requestId,
        clientUid: activeUser.uid,
        clientName: (activeUser.displayName || djName).slice(0, 120),
        clientEmail: (activeUser.email || 'client@dropvault.audio').slice(0, 160),
        djName: djName.trim().slice(0, 80),
        scriptText: scriptText.trim().slice(0, 1500),
        vocalStyle: vocalStyle.slice(0, 60),
        genre: genre.slice(0, 40),
        bpmTarget: Math.min(220, Math.max(40, Number(bpmTarget) || 112)),
        countryCode: countryCode.slice(0, 32),
        licenseTier,
        milestone: 'Submitted',
        assignedProducerUid: '',
        assignedProducerName: 'Unassigned',
        deliverableFileId: '',
        notes: notes.trim().slice(0, 1000),
        quotedPriceUsd,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'customRequests', requestId), reqPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `customRequests/${requestId}`);
      }

      const activeTemplateConfig = emailTemplateConfig || DEFAULT_EMAIL_TEMPLATE_CONFIG;
      const renderedEmail = renderMilestoneEmail(activeTemplateConfig, {
        clientName: reqPayload.clientName,
        djName: reqPayload.djName,
        milestone: 'Submitted',
        requestId,
        genre: reqPayload.genre,
        bpm: reqPayload.bpmTarget,
        producerName: 'Studio Queue',
      });

      const idToken = await activeUser.getIdToken();
      const subject = renderedEmail.subject;
      const previewBody = renderedEmail.textBody.slice(0, 1000);

      const emailRes = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientEmail: reqPayload.clientEmail,
          subject,
          milestone: 'Submitted',
          previewBody,
          htmlBody: renderedEmail.htmlBody,
          senderName: activeTemplateConfig.senderName,
          replyToEmail: activeTemplateConfig.replyToEmail,
        }),
      });
      const emailData = emailRes.ok
        ? await emailRes.json()
        : { deliveryStatus: 'logged_sandbox' };

      const logId = `eml_${Date.now()}`;
      try {
        await setDoc(doc(db, 'emailLogs', logId), {
          id: logId,
          ownerUid: activeUser.uid,
          recipientEmail: reqPayload.clientEmail,
          subject,
          milestone: 'Submitted',
          relatedRequestId: requestId,
          relatedOrderId: '',
          deliveryStatus: emailData.deliveryStatus === 'sent_smtp' ? 'sent_smtp' : 'logged_sandbox',
          previewBody,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `emailLogs/${logId}`);
      }

      onRequestCreated(reqPayload);
      setSubmittedId(requestId);
      setDjName('');
      setScriptText('');
      setNotes('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="custom-drops" className="py-16 border-t border-zinc-800/80">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5 space-y-5">
          <p className="text-xs font-medium text-amber-400 tracking-wide">
            Bespoke Voice &amp; Sound Design
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight text-balance">
            Commission a Custom DJ Drop Script
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Submit your DJ name, vocal style, and target BPM. Every custom commission is tracked through live production milestones with automated email notifications and secure master file delivery.
          </p>

          <div className="p-5 bg-[#12151C] border border-zinc-800 rounded-lg space-y-3">
            <div className="text-sm font-semibold text-zinc-100">
              Discuss Timeline, Bulk Packs &amp; Budget Directly
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Need multi-language station imaging, custom buyout agreements, or fast-turnaround festival drops? Message the studio owner directly on WhatsApp.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="https://wa.me/256784903051?text=Hello%20DropVault%20Audio%2C%20I%20would%20like%20to%20discuss%20a%20custom%20DJ%20drop%20timeline%20and%20budget."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp +256 784 903 051
              </a>
              <a
                href="mailto:opioisaac21062002@gmail.com?subject=DropVault%20Audio%20Customer%20Support"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium bg-[#0B0D11] border border-zinc-800 hover:border-amber-500 text-zinc-200 rounded-md transition-colors"
              >
                <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                opioisaac21062002@gmail.com
              </a>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                DJ / Radio Station Name
              </label>
              <input
                type="text"
                required
                value={djName}
                onChange={(e) => setDjName(e.target.value)}
                placeholder="e.g. DJ Kairo Official"
                maxLength={80}
                className="w-full px-3.5 py-2.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Vocal Delivery Style
              </label>
              <select
                value={vocalStyle}
                onChange={(e) => setVocalStyle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option>Deep Sub Bass</option>
                <option>Hype MC</option>
                <option>Broadcast Baritone</option>
                <option>Crisp Studio</option>
                <option>Smooth Velvet</option>
                <option>Robotic FX</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Voiceover Script
            </label>
            <textarea
              required
              rows={3}
              value={scriptText}
              onChange={(e) => setScriptText(e.target.value)}
              placeholder='e.g. "You are now locked into the worldwide mix with DJ Kairo... turn it up!"'
              maxLength={1500}
              className="w-full px-3.5 py-2.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Primary Genre
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option>Afrobeats</option>
                <option>Amapiano</option>
                <option>House &amp; Techno</option>
                <option>Dancehall</option>
                <option>Hip-Hop &amp; Trap</option>
                <option>Radio Imaging</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Target BPM
              </label>
              <input
                type="number"
                min={40}
                max={220}
                value={bpmTarget}
                onChange={(e) => setBpmTarget(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                License Tier
              </label>
              <select
                value={licenseTier}
                onChange={(e) => setLicenseTier(e.target.value as LicenseTier)}
                className="w-full px-3.5 py-2.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="standard">Standard ($49)</option>
                <option value="commercial">Commercial ($119)</option>
                <option value="exclusive">Exclusive ($349)</option>
              </select>
            </div>
          </div>

          <JurisdictionSelector
            label="Licensing Territory / Tax Country"
            value={countryCode}
            onChange={setCountryCode}
          />

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Pronunciation &amp; FX Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Heavy sub drop before the name, clean dry version included"
              maxLength={1000}
              className="w-full px-3.5 py-2.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-300">
              {errorMessage}
            </div>
          )}

          {submittedId && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Request {submittedId} submitted! Automated confirmation logged and visible in your Studio Portal.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <span className="text-xs text-zinc-500">
              {user ? `Submitting as ${user.email}` : 'Google sign-in required on submit'}
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Submit Custom Brief'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
