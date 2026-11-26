import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { type DecodedIdToken, getAuth as getAdminAuth } from 'firebase-admin/auth';
import fs from 'fs';
import multer from 'multer';
import nodemailer from 'nodemailer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { calculateTaxBreakdown, GLOBAL_JURISDICTIONS } from './src/data/jurisdictions.ts';

dotenv.config();

const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-applet-config.json'), 'utf8')
) as { projectId: string; firestoreDatabaseId?: string };

const PORT = Number(process.env.PORT) || 3000;
const DOWNLOAD_SIGNING_SECRET =
  process.env.DOWNLOAD_SIGNING_SECRET || crypto.randomBytes(32).toString('hex');

const AUDIO_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'audio');
const MEDIA_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'media');
fs.mkdirSync(AUDIO_UPLOAD_DIR, { recursive: true });
fs.mkdirSync(MEDIA_UPLOAD_DIR, { recursive: true });

// Initialize firebase-admin strictly for verifyIdToken (requires no IAM role)
const adminApp = getApps().length
  ? getApp()
  : initializeApp({ projectId: firebaseConfig.projectId });
const adminAuth = getAdminAuth(adminApp);

interface AuthenticatedRequest extends Request {
  user?: DecodedIdToken;
}

async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.flac', '.aiff', '.ogg', '.m4a', '.aac']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogv']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const OTHER_EXTENSIONS = new Set([
  '.zip',
  '.rar',
  '.7z',
  '.pdf',
  '.txt',
  '.mid',
  '.midi',
  '.als',
  '.flp',
  '.ptx',
  '.json',
  '.csv',
]);
const ALLOWED_MEDIA_EXTENSIONS = new Set([
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...OTHER_EXTENSIONS,
]);
const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function classifyMediaType(ext: string): 'audio' | 'video' | 'image' | 'other' {
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'other';
}

function getMimeTypeForExt(ext: string, fallback = 'application/octet-stream'): string {
  const map: Record<string, string> = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.aiff': 'audio/aiff',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.ogv': 'video/ogg',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.csv': 'text/csv; charset=utf-8',
    '.zip': 'application/zip',
    '.rar': 'application/vnd.rar',
    '.7z': 'application/x-7z-compressed',
    '.mid': 'audio/midi',
    '.midi': 'audio/midi',
  };
  return map[ext] || fallback;
}

function resolveSafePathInDir(baseDir: string, fileName: string): string | null {
  const cleanName = path.basename(fileName);
  const resolved = path.resolve(baseDir, cleanName);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

const PUBLIC_ASSETS_DIR = path.resolve(process.cwd(), 'public', 'assets', 'aistudio');

const SEED_AUDIO_FILES: Record<string, { fileName: string; downloadName: string }> = {
  'seed-rasco-street-mix-king': {
    fileName: 'Wigman-drop-by-nivel-2026-11-25-22-44-Dj-Rasco_-The-Street-Mix-King_df090989.mp3',
    downloadName: 'DJ-Rasco-The-Street-Mix-King-Master.mp3',
  },
  'seed-danningtone-mr-grade': {
    fileName: 'Wigman-drop-by-nivel-2026-11-25-17-28-Dj-Danningtone-mr-grade-on-the-vibe__1__563d9b39.mp3',
    downloadName: 'DJ-Danningtone-Mr-Grade-On-The-Vibe-Master.mp3',
  },
  'seed-izee-ranx-worldwide': {
    fileName: '_Wigman_drop_by_nivel_You_r......tly.._635ce163.mp3',
    downloadName: 'DJ-Izee-Ranx-Worldwide-Drops-Promo-Master.mp3',
  },
  'seed-kizo-signature': {
    fileName: '_Dj_drops_by_dj_mash_pro___Ment......zzo.__aee4e5fa.mp3',
    downloadName: 'DJ-Kizo-Signature-Stamp-Master.mp3',
  },
  'seed-flamezy-follow-clean': {
    fileName: 'Dj-drops-by-dj-Mash-Pro-Ug-2026-11-24-00-00-_upbeat-promotional-tone_-Follow-Deejay-flamezy__e90d96d6.mp3',
    downloadName: 'DJ-Flamezy-Follow-Socials-Upbeat-Master.mp3',
  },
  'seed-flamezy-follow-fx': {
    fileName: 'Dj-drops-by-dj-Mash-Pro-Ug-2026-11-24-00-00-_upbeat-promotional-tone_-Follow-Deejay-flamezy___1__b85b7536.mp3',
    downloadName: 'DJ-Flamezy-Follow-Socials-Club-FX-Master.mp3',
  },
  'seed-flamezy-party-master': {
    fileName: 'Dj-drops-by-dj-Mash-Pro-Ug-2026-11-23-23-31-Deejay-flamezy_-the-incredible-party-master_bc011c1e.mp3',
    downloadName: 'DJ-Flamezy-Incredible-Party-Master.mp3',
  },
};

function findSeedAudioFile(assetId: string): { filePath: string; fileName: string } | null {
  const entry = SEED_AUDIO_FILES[assetId];
  if (!entry) return null;
  const safePath = resolveSafePathInDir(PUBLIC_ASSETS_DIR, entry.fileName);
  if (safePath && fs.existsSync(safePath)) {
    return { filePath: safePath, fileName: entry.downloadName };
  }
  return null;
}

function findUploadedAssetFile(assetId: string): { filePath: string; fileName: string } | null {
  const seedMatch = findSeedAudioFile(assetId);
  if (seedMatch) return seedMatch;
  for (const dir of [MEDIA_UPLOAD_DIR, AUDIO_UPLOAD_DIR]) {
    if (!fs.existsSync(dir)) continue;
    const diskFiles = fs.readdirSync(dir);
    const matched = diskFiles.find((f) => f.startsWith(assetId + '.') || f === assetId);
    if (matched) {
      const safePath = resolveSafePathInDir(dir, matched);
      if (safePath && fs.existsSync(safePath)) {
        return { filePath: safePath, fileName: matched };
      }
    }
  }
  return null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, MEDIA_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_MEDIA_EXTENSIONS.has(ext) ? ext : '.bin';
    const assetId = `asset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${assetId}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
      cb(
        new Error(
          'Unsupported format. Upload Audio (WAV/MP3/FLAC/AIFF/OGG/M4A), Video (MP4/WEBM/MOV/M4V), Image (JPG/PNG/WEBP/GIF/AVIF), or Other (ZIP/PDF/TXT/MIDI/DAW packs).'
        )
      );
      return;
    }
    cb(null, true);
  },
});

function signDownloadToken(payload: { orderId: string; buyerUid: string; exp: number }): string {
  const data = `${payload.orderId}.${payload.buyerUid}.${payload.exp}`;
  const sig = crypto
    .createHmac('sha256', DOWNLOAD_SIGNING_SECRET)
    .update(data)
    .digest('hex');
  return `${payload.orderId}.${payload.buyerUid}.${payload.exp}.${sig}`;
}

function verifyDownloadToken(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [orderId, buyerUid, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expectedSig = crypto
    .createHmac('sha256', DOWNLOAD_SIGNING_SECRET)
    .update(`${orderId}.${buyerUid}.${expStr}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

// Procedural studio DJ-drop WAV synthesizer for authentic preview & master fallback playback
function synthesizeDropWavBuffer(seedKey: string, durationSec = 5): Buffer {
  const sampleRate = 44100;
  const numChannels = 2;
  const bitsPerSample = 16;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const dataSize = totalSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Hash seedKey for unique tonal signature per DJ drop
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  const baseFreq = 55 + (hash % 24); // 55Hz - 79Hz sub root
  const chordFreq = baseFreq * 3;
  const pulseBpm = 105 + (hash % 32);
  const beatPeriod = 60 / pulseBpm;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const progress = t / durationSec;

    // 1. Sub-bass 808 impact in first 1.2s + beat stabs
    const beatPhase = (t % beatPeriod) / beatPeriod;
    const impactEnv = Math.exp(-t * 3.8);
    const subPitch = baseFreq * (1 + 2.2 * Math.exp(-t * 18));
    const subWave = Math.sin(2 * Math.PI * subPitch * t) * impactEnv * 0.55;

    // 2. Rhythmic DJ drop synth stab + stereo shimmer
    const stabEnv = Math.exp(-beatPhase * 6.5) * (t > 0.35 ? 1 : 0.2);
    const chord =
      (Math.sin(2 * Math.PI * chordFreq * t) +
        0.6 * Math.sin(2 * Math.PI * chordFreq * 1.2 * t) +
        0.4 * Math.sin(2 * Math.PI * chordFreq * 1.5 * t)) *
      0.18 *
      stabEnv;

    // 3. Vocal-formant modulated sweep
    const formantEnv = Math.sin(Math.PI * Math.min(1, progress / 0.85));
    const sweepFreq = 240 + 460 * progress + 60 * Math.sin(2 * Math.PI * 6 * t);
    const formant =
      Math.sin(2 * Math.PI * sweepFreq * t) *
      Math.sin(2 * Math.PI * (sweepFreq * 2.02) * t) *
      0.16 *
      formantEnv;

    // 4. Master fade-out at tail
    const tailFade = progress > 0.88 ? Math.max(0, (1 - progress) / 0.12) : 1;

    const left = Math.max(-0.95, Math.min(0.95, (subWave + chord + formant * 0.9) * tailFade));
    const right = Math.max(-0.95, Math.min(0.95, (subWave + chord * 0.85 + formant * 1.1) * tailFade));

    const offset = 44 + i * 4;
    buffer.writeInt16LE(Math.round(left * 32767), offset);
    buffer.writeInt16LE(Math.round(right * 32767), offset + 2);
  }

  return buffer;
}

const previewCache = new Map<string, Buffer>();

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, jurisdictionsCount: GLOBAL_JURISDICTIONS.length });
  });

  app.get('/api/tax/jurisdictions', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) {
      res.json({
        total: GLOBAL_JURISDICTIONS.length,
        results: GLOBAL_JURISDICTIONS.slice(0, 60),
      });
      return;
    }
    const results = GLOBAL_JURISDICTIONS.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.code.toLowerCase().includes(q) ||
        j.country.toLowerCase().includes(q) ||
        j.region.toLowerCase().includes(q)
    ).slice(0, 60);
    res.json({ total: GLOBAL_JURISDICTIONS.length, results });
  });

  app.post('/api/tax/calculate', (req, res) => {
    const subtotalUsd = Number(req.body?.subtotalUsd);
    const jurisdictionCode = String(req.body?.jurisdictionCode || 'UG');
    const taxId = typeof req.body?.taxId === 'string' ? req.body.taxId : '';
    if (!Number.isFinite(subtotalUsd) || subtotalUsd < 0) {
      res.status(400).json({ error: 'Invalid subtotalUsd' });
      return;
    }
    const breakdown = calculateTaxBreakdown(subtotalUsd, jurisdictionCode, taxId);
    res.json(breakdown);
  });

  const streamAssetFileWithRange = (req: Request, res: Response, filePath: string, fileName: string) => {
    const ext = path.extname(fileName).toLowerCase();
    const mediaType = classifyMediaType(ext);
    const contentType = getMimeTypeForExt(ext);
    const stat = fs.statSync(filePath);
    const totalLength = stat.size;

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Force attachment on archive/binary "other" types except inline-safe PDF/TXT/JSON/CSV
    const inlineSafeOther = ext === '.pdf' || ext === '.txt' || ext === '.json' || ext === '.csv';
    if (mediaType === 'other' && !inlineSafeOther) {
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fileName)}"`);
    }

    const range = req.headers.range;
    if (range && (mediaType === 'audio' || mediaType === 'video')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
      if (
        Number.isNaN(start) ||
        Number.isNaN(end) ||
        start < 0 ||
        end < start ||
        start >= totalLength ||
        end >= totalLength
      ) {
        res.status(416).set('Content-Range', `bytes */${totalLength}`).end();
        return;
      }
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${totalLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Type': contentType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.status(200).set({
      'Content-Type': contentType,
      'Content-Length': String(totalLength),
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  };

  app.get('/api/media/preview/:assetId', (req, res) => {
    const assetId = String(req.params.assetId || '');
    if (!VALID_ID_REGEX.test(assetId)) {
      res.status(400).json({ error: 'Invalid media preview identifier' });
      return;
    }

    const found = findUploadedAssetFile(assetId);
    if (found) {
      streamAssetFileWithRange(req, res, found.filePath, found.fileName);
      return;
    }

    res.status(404).json({ error: 'Media asset not found' });
  });

  app.get('/api/audio/preview/:dropId', (req, res) => {
    const dropId = String(req.params.dropId || 'default');
    if (!VALID_ID_REGEX.test(dropId)) {
      res.status(400).json({ error: 'Invalid audio preview identifier' });
      return;
    }

    const found = findUploadedAssetFile(dropId);
    if (found) {
      streamAssetFileWithRange(req, res, found.filePath, found.fileName);
      return;
    }

    let wav = previewCache.get(dropId);
    if (!wav) {
      wav = synthesizeDropWavBuffer(dropId, 5);
      if (previewCache.size > 40) {
        previewCache.clear();
      }
      previewCache.set(dropId, wav);
    }

    const totalLength = wav.length;
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
      if (Number.isNaN(start) || start >= totalLength || end >= totalLength) {
        res.status(416).set('Content-Range', `bytes */${totalLength}`).end();
        return;
      }
      res.status(206).set({
        'Content-Range': `bytes ${start}-${end}/${totalLength}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Type': 'audio/wav',
      });
      res.end(wav.subarray(start, end + 1));
      return;
    }

    res.status(200).set({
      'Content-Type': 'audio/wav',
      'Content-Length': String(totalLength),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
    });
    res.end(wav);
  });

  app.post(
    '/api/storage/upload',
    requireAuth,
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      upload.any()(req, res, (err) => {
        if (err) {
          res.status(400).json({ error: err.message || 'Upload failed' });
          return;
        }
        next();
      });
    },
    (req: AuthenticatedRequest, res: Response) => {
      const files = Array.isArray(req.files) ? req.files : [];
      const uploadedFile = req.file || files[0];
      if (!uploadedFile) {
        res.status(400).json({ error: 'No media file provided' });
        return;
      }
      const ext = path.extname(uploadedFile.filename).toLowerCase();
      const assetId = path.basename(uploadedFile.filename, ext);
      const mediaType = classifyMediaType(ext);
      const resolvedMime = getMimeTypeForExt(ext, uploadedFile.mimetype || 'application/octet-stream');

      const sampleRate =
        mediaType === 'audio'
          ? ext === '.wav' || ext === '.flac' || ext === '.aiff'
            ? '48 kHz'
            : '44.1 kHz'
          : mediaType === 'video'
          ? '1080p HD'
          : mediaType === 'image'
          ? 'High-Res'
          : 'Digital Pack';

      const bitDepth =
        mediaType === 'audio'
          ? ext === '.wav' || ext === '.aiff'
            ? '24-bit'
            : '320 kbps'
          : mediaType === 'video'
          ? 'H.264 / WebM'
          : mediaType === 'image'
          ? 'RGB'
          : ext.replace('.', '').toUpperCase();

      res.json({
        assetId,
        fileName: uploadedFile.filename,
        originalName: uploadedFile.originalname,
        mimeType: resolvedMime,
        sizeBytes: uploadedFile.size,
        format: ext.replace('.', '').toUpperCase(),
        mediaType,
        previewUrl: `/api/media/preview/${assetId}`,
        sampleRate,
        bitDepth,
        durationSec: mediaType === 'audio' || mediaType === 'video' ? 12 : 0,
      });
    }
  );

  const VALID_PAYMENT_METHODS = new Set([
    'mtn_momo',
    'airtel_money',
    'mpesa_ke',
    'tigo_pesa',
    'orange_wave',
    'paystack_ng',
    'ozow_za',
    'sepa_instant',
    'ideal_nl',
    'bancontact_be',
    'giropay_de',
    'cartes_bancaires_fr',
    'bizum_es',
    'multibanco_pt',
    'blik_pl',
    'swish_se',
    'vipps_no',
    'mobilepay_dk',
    'twint_ch',
    'faster_payments_gb',
    'ach_us',
    'cashapp_us',
    'interac_ca',
    'upi_in',
    'netbanking_in',
    'pix_br',
    'boleto_br',
    'spei_mx',
    'paypay_jp',
    'kakaopay_kr',
    'alipay_wechat_cn',
    'paynow_sg',
    'fpx_my',
    'qris_id',
    'promptpay_th',
    'gcash_ph',
    'vietqr_vn',
    'payid_au',
    'mada_sa',
    'apple_google_pay',
    'card_global',
    'flutterwave',
    'stripe',
    'paypal',
    'bank_transfer',
    'mobile_money',
    'bank_invoice',
  ]);

  const INVOICE_PAYMENT_METHODS = new Set(['bank_invoice', 'boleto_br']);

  app.post('/api/checkout/authorize', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const subtotalUsd = Number(req.body?.subtotalUsd);
    const jurisdictionCode = String(req.body?.jurisdictionCode || 'UG');
    const taxId = typeof req.body?.taxId === 'string' ? req.body.taxId : '';
    const payoutStatus = req.body?.payoutStatus === 'connected' ? 'connected' : 'pending_setup';
    const paymentMethod = String(req.body?.paymentMethod || 'mtn_momo').trim().slice(0, 40);
    const paymentDetails = req.body?.paymentDetails && typeof req.body.paymentDetails === 'object'
      ? (req.body.paymentDetails as Record<string, unknown>)
      : {};
    const requestedCurrency = String(req.body?.currency || '').trim().toUpperCase().slice(0, 8);

    if (!Number.isFinite(subtotalUsd) || subtotalUsd <= 0) {
      res.status(400).json({ error: 'Order subtotal must be positive' });
      return;
    }
    if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
      res.status(400).json({ error: `Unsupported payment method: ${paymentMethod}` });
      return;
    }

    const mobileMethods = new Set([
      'mtn_momo', 'airtel_money', 'mpesa_ke', 'tigo_pesa', 'orange_wave', 'bizum_es', 'swish_se', 'vipps_no', 'mobilepay_dk', 'mobile_money',
    ]);
    if (mobileMethods.has(paymentMethod)) {
      const phone = String(paymentDetails.phoneNumber || '').replace(/[^0-9+]/g, '');
      if (phone.length < 7) {
        res.status(400).json({ error: 'Please enter a valid mobile money phone number (at least 7 digits).' });
        return;
      }
    }

    const orderId = `ord_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const licenseId = `lic_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const licenseSerial = `DV-${new Date().getFullYear()}-${crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()}`;
    const transactionRef = `TXN-${paymentMethod.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${crypto
      .randomBytes(4)
      .toString('hex')
      .toUpperCase()}`;
    const rawDiscountUsd = Number(req.body?.discountUsd || 0);
    const discountUsd =
      Number.isFinite(rawDiscountUsd) && rawDiscountUsd > 0
        ? Math.min(subtotalUsd, Number(rawDiscountUsd.toFixed(2)))
        : 0;
    const discountedSubtotalUsd = Math.max(0, Number((subtotalUsd - discountUsd).toFixed(2)));
    const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days signed digital delivery
    const downloadToken = signDownloadToken({ orderId, buyerUid: uid, exp });
    const taxBreakdown = calculateTaxBreakdown(discountedSubtotalUsd, jurisdictionCode, taxId);

    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const PLATFORM_FEE_RATE = 0.05;
    let platformFeeUsd = 0;
    let creatorEarningsUsd = 0;
    if (rawItems.length > 0) {
      for (const rawItem of rawItems.slice(0, 20)) {
        if (!rawItem || typeof rawItem !== 'object') continue;
        const unitPrice = Number((rawItem as { unitPriceUsd?: unknown }).unitPriceUsd);
        const creatorUid = String((rawItem as { creatorUid?: unknown }).creatorUid || 'studio_admin');
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) continue;
        if (creatorUid !== 'studio_admin') {
          const fee = Number((unitPrice * PLATFORM_FEE_RATE).toFixed(2));
          platformFeeUsd += fee;
          creatorEarningsUsd += Number((unitPrice - fee).toFixed(2));
        }
      }
      platformFeeUsd = Number(platformFeeUsd.toFixed(2));
      creatorEarningsUsd = Number(creatorEarningsUsd.toFixed(2));
    }

    const resolvedPaymentStatus = INVOICE_PAYMENT_METHODS.has(paymentMethod)
      ? 'invoice_issued'
      : payoutStatus === 'connected'
      ? 'paid'
      : 'authorized_pending_payout';

    res.json({
      orderId,
      licenseId,
      licenseSerial,
      transactionRef,
      downloadToken,
      paymentMethod,
      currency: requestedCurrency || taxBreakdown.localCurrency,
      paymentStatus: resolvedPaymentStatus,
      taxBreakdown,
      feeBreakdown: {
        platformFeeRate: PLATFORM_FEE_RATE,
        platformFeeUsd,
        creatorEarningsUsd,
      },
    });
  });

  app.get('/api/storage/deliver/:assetId', (req, res) => {
    const assetId = String(req.params.assetId || '');
    const token = String(req.query.token || '');
    if (!VALID_ID_REGEX.test(assetId)) {
      res.status(400).json({ error: 'Invalid asset ID' });
      return;
    }
    if (!token || !verifyDownloadToken(token)) {
      res.status(403).json({ error: 'Invalid or expired digital delivery token' });
      return;
    }

    const found = findUploadedAssetFile(assetId);
    if (found) {
      res.download(found.filePath, found.fileName);
      return;
    }

    const masterWav = synthesizeDropWavBuffer(assetId, 8);
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Disposition': `attachment; filename="${assetId}-24bit-master.wav"`,
      'Content-Length': String(masterWav.length),
    });
    res.send(masterWav);
  });

  app.post('/api/notifications/email', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    const recipientEmail = String(req.body?.recipientEmail || '').trim();
    const subject = String(req.body?.subject || '').trim();
    const milestone = String(req.body?.milestone || 'Update').trim();
    const previewBody = String(req.body?.previewBody || '').trim();
    const htmlBody = typeof req.body?.htmlBody === 'string' ? req.body.htmlBody : undefined;
    const senderName = String(req.body?.senderName || 'Quality DJ Drops Worldwide')
      .replace(/[\r\n<>"]/g, '')
      .trim()
      .slice(0, 80);
    const replyToEmail =
      typeof req.body?.replyToEmail === 'string' && req.body.replyToEmail.includes('@')
        ? req.body.replyToEmail.replace(/[\r\n]/g, '').trim().slice(0, 160)
        : undefined;

    if (!recipientEmail || !recipientEmail.includes('@') || !subject || !previewBody) {
      res.status(400).json({ error: 'Valid recipientEmail, subject, and previewBody are required' });
      return;
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpAddressMatch = (process.env.SMTP_FROM || 'noreply@dropvault.audio').match(
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/
    );
    const smtpFromAddress = smtpAddressMatch ? smtpAddressMatch[1] : 'noreply@dropvault.audio';
    const smtpFrom = `${senderName || 'Quality DJ Drops Worldwide'} <${smtpFromAddress}>`;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });
        const info = await transporter.sendMail({
          from: smtpFrom,
          replyTo: replyToEmail,
          to: recipientEmail,
          subject,
          text: previewBody,
          html: htmlBody,
        });
        res.json({ deliveryStatus: 'sent_smtp', messageId: info.messageId, milestone });
        return;
      } catch (err) {
        console.error('SMTP dispatch failed, recording fallback receipt:', err);
      }
    }

    res.json({
      deliveryStatus: 'logged_sandbox',
      messageId: `sandbox_${Date.now()}`,
      milestone,
    });
  });

  app.post('/api/support/chat', async (req: Request, res: Response) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({
        error:
          'AI Customer Support requires a Gemini API key. Please check your key in the Settings > Secrets panel.',
      });
      return;
    }

    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (rawMessages.length === 0) {
      res.status(400).json({ error: 'At least one message is required.' });
      return;
    }

    const sanitizedMessages = rawMessages
      .slice(-20)
      .map((m: unknown) => {
        if (!m || typeof m !== 'object') return null;
        const msg = m as { role?: unknown; text?: unknown };
        const role = msg.role === 'model' ? 'model' : msg.role === 'user' ? 'user' : null;
        const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, 2000) : '';
        if (!role || !text) return null;
        return { role, parts: [{ text }] };
      })
      .filter((m: unknown): m is { role: 'user' | 'model'; parts: [{ text: string }] } => m !== null);

    if (
      sanitizedMessages.length === 0 ||
      sanitizedMessages[sanitizedMessages.length - 1].role !== 'user'
    ) {
      res.status(400).json({ error: 'The latest support message must come from the user.' });
      return;
    }

    const rawCatalog = Array.isArray(req.body?.catalog) ? req.body.catalog : [];
    const catalogLines = rawCatalog
      .slice(0, 40)
      .map((item: unknown) => {
        if (!item || typeof item !== 'object') return '';
        const p = item as Record<string, unknown>;
        const title = String(p.title || '').slice(0, 100);
        const voice = String(p.voiceTalent || '').slice(0, 60);
        const genre = String(p.genre || '').slice(0, 40);
        const bpm = Number(p.bpm) || 110;
        const std = Number(p.standardPriceUsd) || 0;
        const com = Number(p.commercialPriceUsd) || 0;
        const exc = Number(p.exclusivePriceUsd) || 0;
        const rating = Number(p.avgRating) || 0;
        const reviewCount = Number(p.reviewCount) || 0;
        if (!title) return '';
        const ratingNote =
          reviewCount > 0 ? `, Rating: ${rating.toFixed(1)}/5 (${reviewCount} reviews)` : '';
        return `- "${title}" | Voice: ${voice} | Genre: ${genre} | ${bpm} BPM | Standard: $${std}, Commercial: $${com}, Exclusive: $${exc} USD${ratingNote}`;
      })
      .filter(Boolean)
      .join('\n');

    const systemInstruction = [
      'You are the dedicated Customer Support Specialist for Quality DJ Drops Worldwide 🌐, a global DJ drop marketplace and custom audio licensing studio.',
      'Be concise, helpful, accurate, and friendly. Keep answers focused (2-5 short sentences or clean bullets) so customers get immediate clarity.',
      '',
      'CORE PLATFORM FACTS:',
      `- Coverage: Automated VAT/GST/Sales Tax compliance and digital delivery across ${GLOBAL_JURISDICTIONS.length} global jurisdictions/countries, including B2B reverse-charge support when a VAT/TIN/GST ID is entered at checkout.`,
      '- Licensing Tiers:',
      '  1. Standard DJ License: Non-exclusive worldwide performance license for live club sets, private events, mobile DJ rigs, and non-monetized mixtapes (24-bit WAV + 320kbps MP3, Wet & Dry).',
      '  2. Commercial Broadcast License: Worldwide commercial broadcast rights for FM/DAB radio syndication, monetized YouTube/Twitch/Mixcloud streams, and festival intros (24-bit/48kHz WAV Master + Stems + Radio Edit).',
      '  3. Exclusive Master Buyout: Exclusive master rights transfer in buyer territory with all unprocessed dry & FX stems (24-bit/96kHz WAV).',
      '- Payment Methods: Checkout dynamically presents localized methods per country and currency, including Mobile Money (MTN MoMo, Airtel Money, M-Pesa), Visa/Mastercard, Apple Pay/Google Pay, PayPal, SEPA, UK Faster Payments, PIX, UPI, and Bank Transfers.',
      '- Digital Delivery & Security: Every completed order immediately issues a serialized PDF/printable license certificate and a 30-day signed WAV master download token.',
      '- Custom Drop Commissions: Clients submit custom scripts via the "Custom Drops" section, tracked through 5 automated milestones (Submitted -> Script Approved -> Voicing & FX -> Mastering -> Delivered) with automated email updates.',
      '- Supported Product Formats & Live Website Preview: Sellers and admins can upload and sell Audio (WAV, MP3, FLAC, AIFF, OGG, M4A), Video (MP4, WebM, MOV), High-Res Images (PNG, JPG, WebP, GIF), and Digital Packs/Documents (ZIP, PDF, MIDI, DAW presets) up to 200 MB, with instant in-browser playback, video/image/PDF preview, and customer reviews.',
      '- Co-Creator Marketplace & Global Payouts: Independent creators can sign up in Studio Portal to publish and sell their own products globally. Quality DJ Drops Worldwide takes a 5% platform fee on successful purchases (95% to creator) and a 7% fee on global creator withdrawals (93% net sent worldwide via Bank/SWIFT/IBAN, Mobile Money, PayPal, Stripe, and local instant rails).',
      '- Customer Reviews & Themes: Signed-in customers can post star ratings and written reviews on any catalog product, and users can switch between 5 studio themes (Obsidian Amber, Midnight Cyan, Crimson Club, Emerald Mastering, Daylight Studio).',
      '- Direct Customer Support Email & WhatsApp: Email opioisaac21062002@gmail.com or WhatsApp +256 784 903 051 (https://wa.me/256784903051) for customer care, order assistance, custom timeline, or bulk package quotes.',
      '',
      catalogLines
        ? `LIVE CATALOG & PRICING:\n${catalogLines}`
        : 'LIVE CATALOG: Catalog pricing starts from $25 USD Standard, $69 USD Commercial, $199 USD Exclusive.',
      '',
      'RULES: Only state prices and product titles present in the LIVE CATALOG above. Never invent discount codes or fake order tracking statuses; if a customer needs help with a specific order, guide them to Studio Portal -> Orders & Downloads, email opioisaac21062002@gmail.com, or WhatsApp +256 784 903 051.',
    ].join('\n');

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: sanitizedMessages,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const reply = (response.text ?? '').trim();
      if (!reply) {
        res.status(502).json({ error: 'Support assistant returned an empty response. Please try again.' });
        return;
      }

      res.json({ reply });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Gemini support chat error:', err);
      if (msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID') || msg.includes('403') || msg.includes('400')) {
        res.status(403).json({
          error:
            'AI support could not authenticate with the Gemini API. Please check your API key in Settings > Secrets.',
        });
        return;
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        res.status(429).json({
          error:
            'AI support is temporarily at quota capacity. Please retry shortly or message us on WhatsApp (+256 784 903 051).',
        });
        return;
      }
      res.status(500).json({
        error: 'Unable to reach AI Customer Support right now. Please try again or contact +256 784 903 051.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const publicDir = path.resolve(process.cwd(), 'public');
    app.use(express.static(distDir));
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
    }
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Quality DJ Drops Worldwide server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
