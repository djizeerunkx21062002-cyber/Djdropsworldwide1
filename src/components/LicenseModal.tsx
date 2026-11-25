import { Download, Printer, X } from 'lucide-react';
import { LICENSE_TIERS } from '../data/catalogSeed';
import { LicenseAgreement } from '../types';

interface LicenseModalProps {
  license: LicenseAgreement | null;
  onClose: () => void;
}

export function LicenseModal({ license, onClose }: LicenseModalProps) {
  if (!license) return null;

  const tierInfo = LICENSE_TIERS[license.tier];

  const handleDownloadCertificate = () => {
    const content = [
      'DROPVAULT AUDIO — CUSTOM AUDIO LICENSING AGREEMENT',
      '====================================================',
      `License Serial: ${license.serialNumber}`,
      `Order Reference: ${license.orderId}`,
      `Status: ${license.status.toUpperCase()}`,
      '',
      '1. PARTIES',
      `Licensor: DropVault Audio Studio (Support: +256784903051)`,
      `Licensee: ${license.licenseeName} (${license.licenseeEmail})`,
      `Authorized DJ / Broadcast Handle: ${license.djName}`,
      '',
      '2. LICENSED MASTER WORK',
      `Track / Drop Title: ${license.dropTitle}`,
      `License Tier: ${tierInfo.name}`,
      `Deliverables Included: ${tierInfo.deliverables}`,
      `Licensed Territory / Jurisdiction: ${license.territory} (${license.jurisdictionCode})`,
      '',
      '3. GRANT OF RIGHTS',
      license.rightsSummary,
      '',
      '4. OWNERSHIP & COMPLIANCE',
      'Master copyright remains with DropVault Audio unless Exclusive Master Buyout is specified.',
      'This agreement is digitally verified and recorded in the DropVault Audio Licensing Ledger.',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${license.serialNumber}-audio-license.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-modal-title"
    >
      <div className="bg-[#12151C] border border-zinc-800 rounded-lg max-w-2xl w-full overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h3 id="license-modal-title" className="text-base font-semibold text-zinc-100">
              Custom Audio Licensing Agreement
            </h3>
            <p className="font-mono text-xs text-zinc-400 mt-0.5 tabular-nums">
              {license.serialNumber} · {license.status.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close license modal"
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-5 border-b border-zinc-800/80">
            <div>
              <div className="text-xs text-zinc-500">Licensee</div>
              <div className="font-medium text-zinc-100 mt-0.5">{license.licenseeName}</div>
              <div className="text-xs text-zinc-400">{license.licenseeEmail}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">DJ / Broadcast Handle</div>
              <div className="font-medium text-zinc-100 mt-0.5">{license.djName}</div>
              <div className="text-xs text-zinc-400">
                Territory: {license.territory} ({license.jurisdictionCode})
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Licensed Audio Work</div>
              <div className="font-medium text-zinc-100 mt-0.5">{license.dropTitle}</div>
              <div className="text-xs text-zinc-400">{tierInfo.name}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Master Deliverables</div>
              <div className="font-medium text-zinc-100 mt-0.5">{tierInfo.deliverables}</div>
              <div className="font-mono text-xs text-zinc-400">Order {license.orderId}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-zinc-400">Scope of Rights Granted</div>
            <p className="text-zinc-300 leading-relaxed bg-[#0B0D11] border border-zinc-800 rounded-md p-4">
              {license.rightsSummary}
            </p>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed">
            This digital licensing certificate is bound to the purchaser jurisdiction and tax record. For territory expansion or custom exclusive buyout amendments, contact studio licensing on WhatsApp at +256 784 903 051.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 flex flex-wrap items-center justify-end gap-3 bg-[#0E1117]">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Certificate
          </button>
          <button
            type="button"
            onClick={handleDownloadCertificate}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-500 hover:bg-amber-400 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Download Agreement
          </button>
        </div>
      </div>
    </div>
  );
}
