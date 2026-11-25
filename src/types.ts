export type UserRole = 'admin' | 'producer' | 'licensing_manager' | 'viewer' | 'creator' | 'client';
export type ThemeId = 'obsidian' | 'midnight' | 'crimson' | 'emerald' | 'daylight';
export type LicenseTier = 'standard' | 'commercial' | 'exclusive';
export type ProductMediaType = 'audio' | 'video' | 'image' | 'other';
export type RequestMilestone =
  | 'Submitted'
  | 'Script Approved'
  | 'Voicing & FX'
  | 'Mastering'
  | 'Delivered';

export interface Jurisdiction {
  code: string;
  name: string;
  country: string;
  region: string;
  currency: string;
  fxPerUsd: number;
  taxType: string;
  taxRate: number;
  reverseChargeEligible: boolean;
}

export interface DropProduct {
  id: string;
  title: string;
  voiceTalent: string;
  genre: string;
  vocalStyle: string;
  bpm: number;
  durationSec: number;
  musicalKey: string;
  tags: string[];
  standardPriceUsd: number;
  commercialPriceUsd: number;
  exclusivePriceUsd: number;
  coverImage: string;
  audioFileId: string;
  audioFormat: string;
  sampleRate: string;
  mediaType?: ProductMediaType;
  originalFileName?: string;
  fileSizeBytes?: number;
  featured: boolean;
  archived?: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CartItem {
  drop: DropProduct;
  tier: LicenseTier;
  djNameOverlay: string;
}

export interface OrderItemSummary {
  dropId: string;
  title: string;
  tier: LicenseTier;
  unitPriceUsd: number;
  audioFileId: string;
  djNameOverlay: string;
  creatorUid?: string;
}

export interface UserProfileRecord {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  countryCode: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderRecord {
  id: string;
  buyerUid: string;
  buyerEmail: string;
  buyerName: string;
  djHandle: string;
  jurisdictionCode: string;
  countryName: string;
  taxType: string;
  taxRate: number;
  taxIdProvided: string;
  reverseChargeApplied: boolean;
  currency: string;
  subtotalUsd: number;
  taxAmountUsd: number;
  totalUsd: number;
  platformFeeUsd?: number;
  creatorEarningsUsd?: number;
  promoCode?: string;
  discountUsd?: number;
  paymentStatus: 'authorized_pending_payout' | 'paid' | 'invoice_issued' | 'refunded';
  paymentMethod: string;
  items: OrderItemSummary[];
  licenseId: string;
  downloadToken: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LicenseAgreement {
  id: string;
  orderId: string;
  ownerUid: string;
  licenseeName: string;
  licenseeEmail: string;
  djName: string;
  dropTitle: string;
  tier: LicenseTier;
  territory: string;
  jurisdictionCode: string;
  serialNumber: string;
  rightsSummary: string;
  status: 'active' | 'revoked';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomDropRequest {
  id: string;
  clientUid: string;
  clientName: string;
  clientEmail: string;
  djName: string;
  scriptText: string;
  vocalStyle: string;
  genre: string;
  bpmTarget: number;
  countryCode: string;
  licenseTier: LicenseTier;
  milestone: RequestMilestone;
  assignedProducerUid: string;
  assignedProducerName: string;
  deliverableFileId: string;
  notes: string;
  quotedPriceUsd: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AudioAsset {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  format: string;
  mediaType?: ProductMediaType;
  sampleRate: string;
  bitDepth: string;
  durationSec: number;
  uploadedByUid: string;
  uploadedByName: string;
  linkedDropId: string;
  linkedRequestId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface EmailNotificationLog {
  id: string;
  ownerUid: string;
  recipientEmail: string;
  subject: string;
  milestone: string;
  relatedRequestId: string;
  relatedOrderId: string;
  deliveryStatus: 'sent_smtp' | 'logged_sandbox';
  previewBody: string;
  createdAt?: unknown;
}

export interface TeamMember {
  uid: string;
  displayName: string;
  role: 'admin' | 'producer' | 'licensing_manager' | 'viewer';
  specialty: string;
  active: boolean;
  assignedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StudioGatewaySettings {
  payoutStatus: 'pending_setup' | 'connected';
  gatewayProvider:
    | 'deferred_payout'
    | 'bank_transfer'
    | 'mobile_money'
    | 'stripe'
    | 'flutterwave'
    | 'paypal'
    | 'mtn_momo';
  adminPayoutMethod?: 'bank' | 'mobile_money';
  merchantAccountLabel: string;
  payoutCurrency: string;
  settlementEmail: string;
  whatsappSupport: string;
  autoTaxCompliance: boolean;
  autoMilestoneEmails: boolean;
  payoutEmailAlerts?: boolean;
  updatedBy: string;
  updatedAt?: unknown;
}

export interface PublicStorefrontConfig {
  payoutStatus: 'pending_setup' | 'connected';
  gatewayModeLabel: string;
  autoTaxCompliance: boolean;
  announcementEnabled?: boolean;
  announcementBadge?: string;
  announcementText?: string;
  heroHeadline?: string;
  heroSubheadline?: string;
  customRequestsEnabled?: boolean;
  defaultCustomPriceUsd?: number;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  updatedAt?: unknown;
}

export interface PayoutRequest {
  id: string;
  producerUid: string;
  producerName: string;
  producerEmail: string;
  amountUsd: number;
  withdrawalFeeRate?: number;
  withdrawalFeeUsd?: number;
  netPayoutUsd?: number;
  countryCode?: string;
  regionSummary: string;
  payoutMethod: string;
  destinationAccount: string;
  currency: string;
  status: 'Requested' | 'Processing' | 'Settled' | 'Rejected';
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MilestoneEmailTemplate {
  subject: string;
  body: string;
}

export interface EmailTemplateConfig {
  id: string;
  brandName: string;
  brandTagline: string;
  accentColor: string;
  senderName: string;
  replyToEmail: string;
  logoUrl: string;
  footerText: string;
  milestoneTemplates: Record<RequestMilestone, MilestoneEmailTemplate>;
  updatedBy: string;
  updatedAt?: unknown;
}

export interface ProductReview {
  id: string;
  dropId: string;
  dropTitle: string;
  authorUid: string;
  authorName: string;
  djHandle: string;
  rating: number;
  title: string;
  comment: string;
  verifiedBuyer: boolean;
  orderId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupportChatMessage {
  role: 'user' | 'model';
  text: string;
  createdAt?: string;
}

export interface CreatorProfile {
  uid: string;
  displayName: string;
  studioHandle: string;
  countryCode: string;
  countryName: string;
  specialty: string;
  bio: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CreatorSaleRecord {
  id: string;
  orderId: string;
  buyerUid: string;
  dropId: string;
  dropTitle: string;
  creatorUid: string;
  tier: LicenseTier;
  jurisdictionCode: string;
  countryName: string;
  currency: string;
  grossItemUsd: number;
  platformFeeRate: number;
  adminFeeUsd: number;
  creatorNetUsd: number;
  paymentStatus: 'authorized_pending_payout' | 'paid' | 'invoice_issued';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PromoCode {
  id: string;
  code: string;
  discountPercent: number;
  minSubtotalUsd: number;
  description: string;
  active: boolean;
  usageCount: number;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminActivityLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetId: string;
  details: string;
  createdAt?: unknown;
}
