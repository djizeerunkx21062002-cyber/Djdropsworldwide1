import { EmailTemplateConfig, RequestMilestone } from '../types';

export const EMAIL_TEMPLATE_TOKENS = [
  { token: '{{clientName}}', label: 'Client Name' },
  { token: '{{djName}}', label: 'DJ / Station Name' },
  { token: '{{milestone}}', label: 'Milestone Stage' },
  { token: '{{requestId}}', label: 'Request ID' },
  { token: '{{genre}}', label: 'Genre' },
  { token: '{{bpm}}', label: 'Target BPM' },
  { token: '{{producerName}}', label: 'Assigned Producer' },
  { token: '{{brandName}}', label: 'Studio Brand Name' },
] as const;

export const DEFAULT_EMAIL_TEMPLATE_CONFIG: Omit<EmailTemplateConfig, 'updatedBy' | 'updatedAt'> = {
  id: 'default',
  brandName: 'DropVault Audio',
  brandTagline: 'Global DJ Drops, Licensing & Mastering Studio',
  accentColor: '#F59E0B',
  senderName: 'DropVault Audio Studio',
  replyToEmail: 'opioisaac21062002@gmail.com',
  logoUrl: '',
  footerText:
    'Need revisions or rush delivery? Email opioisaac21062002@gmail.com or WhatsApp +256 784 903 051. Licensed worldwide by DropVault Audio.',
  milestoneTemplates: {
    Submitted: {
      subject: '[{{brandName}}] Brief Received: "{{djName}}" ({{requestId}})',
      body: 'Hello {{clientName}},\n\nYour custom DJ drop script for "{{djName}}" ({{genre}}, {{bpm}} BPM) has entered our studio production queue.\n\nCurrent Milestone: {{milestone}}\nTracking ID: {{requestId}}\n\nWe will notify you automatically as soon as your script is approved for voice tracking.',
    },
    'Script Approved': {
      subject: '[{{brandName}}] Script Approved for "{{djName}}"',
      body: 'Hello {{clientName}},\n\nGreat news — your voiceover script for "{{djName}}" ({{requestId}}) has been reviewed and approved by {{producerName}}.\n\nOur vocal talent is prepping your session for {{genre}} at {{bpm}} BPM. You will receive another update when Voicing & FX begins.',
    },
    'Voicing & FX': {
      subject: '[{{brandName}}] Voicing & Sound FX Underway — "{{djName}}"',
      body: 'Hello {{clientName}},\n\nStudio recording and custom sound design FX are now underway for "{{djName}}" ({{requestId}}) with producer {{producerName}}.\n\nOnce vocal layers and impacts are locked, your drop moves to final 24-bit mastering.',
    },
    Mastering: {
      subject: '[{{brandName}}] Final 24-bit Mastering — "{{djName}}"',
      body: 'Hello {{clientName}},\n\nYour custom DJ drop "{{djName}}" ({{requestId}}) is now in our mastering suite ({{producerName}}) for loudness calibration, stereo imaging, and final dry/wet stem exports.',
    },
    Delivered: {
      subject: '[{{brandName}}] Ready for Download: "{{djName}}" Master Delivered',
      body: 'Hello {{clientName}},\n\nYour custom DJ drop "{{djName}}" ({{requestId}}) is officially complete and delivered!\n\nSign in to your Studio Portal to download your 24-bit WAV masters and inspect your signed audio license certificate.',
    },
  },
};

export interface MilestoneEmailVariables {
  clientName: string;
  djName: string;
  milestone: RequestMilestone;
  requestId: string;
  genre?: string;
  bpm?: number | string;
  producerName?: string;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function interpolateTemplate(
  template: string,
  config: Pick<EmailTemplateConfig, 'brandName'>,
  vars: MilestoneEmailVariables
): string {
  const replacements: Record<string, string> = {
    '{{clientName}}': vars.clientName || 'DJ Client',
    '{{djName}}': vars.djName || 'Custom Drop',
    '{{milestone}}': vars.milestone,
    '{{requestId}}': vars.requestId || 'req_preview',
    '{{genre}}': vars.genre || 'Afrobeats',
    '{{bpm}}': String(vars.bpm ?? 112),
    '{{producerName}}': vars.producerName || 'Studio Producer',
    '{{brandName}}': config.brandName || 'DropVault Audio',
  };

  let out = template;
  for (const [token, val] of Object.entries(replacements)) {
    out = out.split(token).join(val);
  }
  return out;
}

export function renderMilestoneEmail(
  config: Pick<
    EmailTemplateConfig,
    | 'brandName'
    | 'brandTagline'
    | 'accentColor'
    | 'senderName'
    | 'replyToEmail'
    | 'logoUrl'
    | 'footerText'
    | 'milestoneTemplates'
  >,
  vars: MilestoneEmailVariables
): { subject: string; textBody: string; htmlBody: string } {
  const activeTemplate =
    config.milestoneTemplates[vars.milestone] ||
    DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates[vars.milestone];

  const subject = interpolateTemplate(activeTemplate.subject, config, vars).slice(0, 200);
  const renderedBody = interpolateTemplate(activeTemplate.body, config, vars);
  const safeAccent = /^#[0-9a-fA-F]{6}$/.test(config.accentColor)
    ? config.accentColor
    : '#F59E0B';
  const safeBrand = escapeHtml(config.brandName || 'DropVault Audio');
  const safeTagline = escapeHtml(config.brandTagline || '');
  const safeFooter = escapeHtml(config.footerText || '');
  const safeMilestone = escapeHtml(vars.milestone);
  const safeBodyHtml = escapeHtml(renderedBody).replace(/\n/g, '<br />');
  const safeLogoUrl =
    typeof config.logoUrl === 'string' && /^(https:\/\/|\/)/i.test(config.logoUrl.trim())
      ? escapeHtml(config.logoUrl.trim())
      : '';

  const textBody = `${config.brandName}${config.brandTagline ? ` — ${config.brandTagline}` : ''}\nMilestone: ${vars.milestone}\n\n${renderedBody}\n\n---\n${config.footerText}`;

  const htmlBody = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background-color:#0B0D11;color:#E4E4E7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background-color:#12151C;border:1px solid #27272A;border-radius:8px;overflow:hidden;">
      <div style="height:4px;background-color:${safeAccent};"></div>
      <div style="padding:24px;border-bottom:1px solid #27272A;">
        ${
          safeLogoUrl
            ? `<img src="${safeLogoUrl}" alt="${safeBrand}" style="max-height:36px;margin-bottom:12px;display:block;" />`
            : ''
        }
        <div style="font-size:18px;font-weight:700;color:#F4F4F5;">${safeBrand}</div>
        ${
          safeTagline
            ? `<div style="font-size:12px;color:#A1A1AA;margin-top:4px;">${safeTagline}</div>`
            : ''
        }
      </div>
      <div style="padding:24px;">
        <div style="display:inline-block;padding:4px 10px;border-radius:4px;background-color:#18181B;border:1px solid ${safeAccent};color:${safeAccent};font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:16px;">
          Milestone: ${safeMilestone}
        </div>
        <div style="font-size:14px;line-height:1.65;color:#E4E4E7;">
          ${safeBodyHtml}
        </div>
      </div>
      <div style="padding:16px 24px;background-color:#0B0D11;border-top:1px solid #27272A;font-size:12px;line-height:1.5;color:#71717A;">
        ${safeFooter}
      </div>
    </div>
  </body>
</html>`;

  return { subject, textBody, htmlBody };
}
