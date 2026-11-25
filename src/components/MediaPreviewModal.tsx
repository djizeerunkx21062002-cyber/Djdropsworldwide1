import { useEffect, useState } from 'react';
import {
  FileArchive,
  FileAudio,
  FileText,
  Film,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  ShoppingBag,
  Star,
  X,
} from 'lucide-react';
import { LICENSE_TIERS } from '../data/catalogSeed';
import { AudioAsset, DropProduct, LicenseTier, ProductMediaType, ProductReview } from '../types';

export interface PreviewTarget {
  id: string;
  title: string;
  subtitle?: string;
  assetId: string;
  mediaType: ProductMediaType;
  formatLabel: string;
  sampleRate?: string;
  coverImage?: string;
  originalFileName?: string;
  fileSizeBytes?: number;
  durationSec?: number;
  drop?: DropProduct;
}

interface MediaPreviewModalProps {
  target: PreviewTarget | null;
  reviews?: ProductReview[];
  selectedTier?: LicenseTier;
  onSelectTier?: (dropId: string, tier: LicenseTier) => void;
  onAddToCart?: (drop: DropProduct) => void;
  onOpenReviews?: (drop: DropProduct) => void;
  onClose: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Studio Master';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function inferMediaTypeFromDrop(drop: DropProduct): ProductMediaType {
  if (drop.mediaType) return drop.mediaType;
  const fmt = `${drop.audioFormat || ''} ${drop.originalFileName || ''}`.toLowerCase();
  if (/(mp4|webm|mov|m4v|ogv|video)/.test(fmt)) return 'video';
  if (/(png|jpg|jpeg|webp|gif|avif|image)/.test(fmt)) return 'image';
  if (/(zip|rar|7z|pdf|txt|mid|midi|als|flp|ptx|json|csv|pack|doc)/.test(fmt)) return 'other';
  return 'audio';
}

export function inferMediaTypeFromAsset(asset: AudioAsset): ProductMediaType {
  if (asset.mediaType) return asset.mediaType;
  const mime = (asset.mimeType || '').toLowerCase();
  const fmt = (asset.format || '').toLowerCase();
  if (mime.startsWith('video/') || /(mp4|webm|mov|m4v|ogv)/.test(fmt)) return 'video';
  if (mime.startsWith('image/') || /(png|jpg|jpeg|webp|gif|avif)/.test(fmt)) return 'image';
  if (mime.startsWith('audio/') || /(wav|mp3|flac|aiff|ogg|m4a|aac)/.test(fmt)) return 'audio';
  return 'other';
}

export function MediaPreviewModal({
  target,
  reviews = [],
  selectedTier = 'standard',
  onSelectTier,
  onAddToCart,
  onOpenReviews,
  onClose,
}: MediaPreviewModalProps) {
  const [imageZoomed, setImageZoomed] = useState(false);
  const [textSnippet, setTextSnippet] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  const previewUrl = target
    ? target.mediaType === 'audio' && target.assetId.startsWith('synth-')
      ? `/api/audio/preview/${encodeURIComponent(target.assetId)}`
      : `/api/media/preview/${encodeURIComponent(target.assetId)}`
    : '';

  const extLower = (target?.originalFileName || target?.formatLabel || '').toLowerCase();
  const isPdf = target?.mediaType === 'other' && extLower.includes('pdf');
  const isTextPreviewable =
    target?.mediaType === 'other' &&
    (extLower.includes('txt') || extLower.includes('json') || extLower.includes('csv'));

  useEffect(() => {
    setImageZoomed(false);
    setTextSnippet(null);
    if (!target || !isTextPreviewable || !previewUrl) return;

    let cancelled = false;
    setTextLoading(true);
    fetch(previewUrl)
      .then((res) => (res.ok ? res.text() : ''))
      .then((txt) => {
        if (!cancelled) {
          setTextSnippet(txt.slice(0, 8000));
        }
      })
      .catch(() => {
        if (!cancelled) setTextSnippet(null);
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target, isTextPreviewable, previewUrl]);

  if (!target) return null;

  const drop = target.drop;
  const dropReviews = drop ? reviews.filter((r) => r.dropId === drop.id) : [];
  const avgRating =
    dropReviews.length > 0
      ? dropReviews.reduce((sum, r) => sum + r.rating, 0) / dropReviews.length
      : 0;

  const activePrice = drop
    ? selectedTier === 'standard'
      ? drop.standardPriceUsd
      : selectedTier === 'commercial'
      ? drop.commercialPriceUsd
      : drop.exclusivePriceUsd
    : 0;

  const renderTypeIcon = () => {
    if (target.mediaType === 'video') return <Film className="w-4 h-4 text-amber-400" />;
    if (target.mediaType === 'image') return <ImageIcon className="w-4 h-4 text-amber-400" />;
    if (target.mediaType === 'other') return <FileArchive className="w-4 h-4 text-amber-400" />;
    return <FileAudio className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${target.title}`}
    >
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#12151C] border border-zinc-800 rounded-lg flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-start justify-between gap-4 bg-[#0B0D11]">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-amber-400">
              {renderTypeIcon()}
              <span className="uppercase">{target.mediaType}</span>
              <span className="text-zinc-600">·</span>
              <span>{target.formatLabel}</span>
              {target.sampleRate && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">{target.sampleRate}</span>
                </>
              )}
              {target.fileSizeBytes ? (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">{formatFileSize(target.fileSizeBytes)}</span>
                </>
              ) : null}
            </div>
            <h2 className="text-lg font-bold text-zinc-100 truncate">{target.title}</h2>
            {target.subtitle && (
              <p className="text-xs text-zinc-400 truncate">{target.subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Interactive Player / Media Canvas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-[#0B0D11] border border-zinc-800 rounded-lg overflow-hidden">
            {target.mediaType === 'video' && (
              <div className="bg-black flex items-center justify-center">
                <video
                  key={previewUrl}
                  src={previewUrl}
                  poster={target.coverImage}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="w-full max-h-[460px] object-contain"
                >
                  Your browser does not support HTML5 video playback.
                </video>
              </div>
            )}

            {target.mediaType === 'audio' && (
              <div className="p-6 flex flex-col sm:flex-row items-center gap-5">
                {target.coverImage && (
                  <img
                    src={target.coverImage}
                    alt={target.title}
                    referrerPolicy="no-referrer"
                    className="w-28 h-28 rounded-md object-cover border border-zinc-800 shrink-0"
                  />
                )}
                <div className="flex-1 w-full space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                    <span className="font-medium text-zinc-200">
                      Studio Master Stream Player
                    </span>
                    <span className="font-mono tabular-nums">
                      {target.durationSec ? `${target.durationSec}s` : 'Preview'} · {target.formatLabel}
                    </span>
                  </div>
                  <audio
                    key={previewUrl}
                    src={previewUrl}
                    controls
                    autoPlay
                    preload="metadata"
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {target.mediaType === 'image' && (
              <div className="relative bg-black/60 flex flex-col items-center justify-center p-4">
                <img
                  src={target.assetId.startsWith('asset_') ? previewUrl : target.coverImage || previewUrl}
                  alt={target.title}
                  referrerPolicy="no-referrer"
                  className={`rounded object-contain transition-all ${
                    imageZoomed ? 'max-h-[75vh] w-full' : 'max-h-[440px]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setImageZoomed((prev) => !prev)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#12151C] border border-zinc-700 hover:border-amber-500 text-xs text-zinc-200 rounded-md"
                >
                  {imageZoomed ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      Fit Image
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      Expand View
                    </>
                  )}
                </button>
              </div>
            )}

            {target.mediaType === 'other' && (
              <div className="p-5 space-y-4">
                {isPdf ? (
                  <iframe
                    src={previewUrl}
                    title={target.title}
                    className="w-full h-[440px] rounded border border-zinc-800 bg-white"
                  />
                ) : isTextPreviewable ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                      <FileText className="w-4 h-4" />
                      <span>Document Preview ({target.originalFileName || target.formatLabel})</span>
                    </div>
                    <pre className="p-4 bg-[#12151C] border border-zinc-800 rounded text-xs font-mono text-zinc-200 overflow-x-auto max-h-80 whitespace-pre-wrap">
                      {textLoading
                        ? 'Loading document preview...'
                        : textSnippet || 'Preview unavailable for this document.'}
                    </pre>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#12151C] border border-zinc-800 rounded-md">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                        <FileArchive className="w-5 h-5 text-amber-400" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-zinc-100">
                          {target.originalFileName || target.title}
                        </div>
                        <div className="text-xs font-mono text-zinc-400">
                          Format: {target.formatLabel} · Size: {formatFileSize(target.fileSizeBytes)}
                        </div>
                        <p className="text-xs text-zinc-400">
                          Digital project pack / stems / archive ready for instant tokenized download after licensing checkout.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product Purchase & Reviews Bar (for storefront items) */}
          {drop && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 bg-[#0B0D11] border border-zinc-800 rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <h3 className="text-sm font-semibold text-zinc-100">
                      Customer Reviews ({dropReviews.length})
                    </h3>
                    {dropReviews.length > 0 && (
                      <span className="text-xs font-mono text-amber-400">
                        {avgRating.toFixed(1)} / 5.0
                      </span>
                    )}
                  </div>
                  {onOpenReviews && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReviews(drop);
                      }}
                      className="text-xs font-semibold text-amber-400 hover:underline"
                    >
                      Write / View All Reviews
                    </button>
                  )}
                </div>

                {dropReviews.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No reviews yet for this product. Click &ldquo;Write / View All Reviews&rdquo; to leave the first rating.
                  </p>
                ) : (
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                    {dropReviews.slice(0, 4).map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3 bg-[#12151C] border border-zinc-800/80 rounded space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-zinc-100">{rev.title}</span>
                          <span className="font-mono text-amber-400">
                            {'★'.repeat(rev.rating)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed">{rev.comment}</p>
                        <div className="text-[11px] text-zinc-500">
                          {rev.djHandle}
                          {rev.verifiedBuyer ? ' · Verified Buyer' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {onAddToCart && onSelectTier && (
                <div className="lg:col-span-5 bg-[#0B0D11] border border-zinc-800 rounded-lg p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-zinc-100">
                      Select License Tier
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 bg-[#12151C] p-1 rounded-md border border-zinc-800">
                      {(['standard', 'commercial', 'exclusive'] as LicenseTier[]).map((tierKey) => (
                        <button
                          key={tierKey}
                          type="button"
                          onClick={() => onSelectTier(drop.id, tierKey)}
                          className={`py-1.5 text-xs font-medium rounded transition-colors ${
                            selectedTier === tierKey
                              ? 'bg-zinc-800 text-zinc-100'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {LICENSE_TIERS[tierKey].shortLabel}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {LICENSE_TIERS[selectedTier].rightsSummary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xl font-bold font-mono tabular-nums text-zinc-100">
                        ${activePrice} USD
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {LICENSE_TIERS[selectedTier].name}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onAddToCart(drop);
                        onClose();
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      License &amp; Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
