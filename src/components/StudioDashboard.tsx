import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Disc3,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileAudio,
  FileCheck2,
  FileSpreadsheet,
  Film,
  Globe2,
  History,
  Image as ImageIcon,
  Layers,
  Mail,
  MessageCircle,
  Palette,
  Pencil,
  Percent,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { INITIAL_DROPS, LICENSE_TIERS } from '../data/catalogSeed';
import { findJurisdiction } from '../data/jurisdictions';
import {
  ADMIN_PAYOUT_METHODS,
  CHECKOUT_CURRENCIES,
  PAYOUT_CURRENCIES,
  getPaymentMethodLabel,
  getPaymentMethodsForJurisdiction,
  getPayoutMethodsForCurrency,
} from '../data/paymentMethods';
import { STUDIO_THEMES } from '../data/themes';
import { db, handleFirestoreError, OperationType, signInWithGoogle, signOutUser } from '../firebase';
import {
  AdminActivityLog,
  AudioAsset,
  CreatorProfile,
  CreatorSaleRecord,
  CustomDropRequest,
  DropProduct,
  EmailNotificationLog,
  EmailTemplateConfig,
  LicenseAgreement,
  LicenseTier,
  MilestoneEmailTemplate,
  OrderRecord,
  PayoutRequest,
  ProductMediaType,
  ProductReview,
  PromoCode,
  PublicStorefrontConfig,
  RequestMilestone,
  StudioGatewaySettings,
  TeamMember,
  ThemeId,
  UserProfileRecord,
  UserRole,
  VoiceCategory,
} from '../types';
import {
  DEFAULT_EMAIL_TEMPLATE_CONFIG,
  EMAIL_TEMPLATE_TOKENS,
  renderMilestoneEmail,
} from '../utils/emailTemplates';
import { AdminDashboardOverview } from './AdminDashboardOverview';
import { JurisdictionSelector } from './JurisdictionSelector';
import {
  inferMediaTypeFromAsset,
  inferMediaTypeFromDrop,
  MediaPreviewModal,
  PreviewTarget,
} from './MediaPreviewModal';

type DashboardTab =
  | 'overview'
  | 'creator_signup'
  | 'catalog'
  | 'orders'
  | 'requests'
  | 'licensing'
  | 'storage'
  | 'payouts'
  | 'reports'
  | 'emails'
  | 'promos'
  | 'users'
  | 'audit_logs'
  | 'system_ops'
  | 'team'
  | 'settings';

const MILESTONES: RequestMilestone[] = [
  'Submitted',
  'Script Approved',
  'Voicing & FX',
  'Mastering',
  'Delivered',
];

const COVER_IMAGE_PRESETS = [
  {
    label: 'Quality DJ Drops Poster',
    url: '/assets/aistudio/file_000000009398821180e94a29152a59ad_dedcce57.png',
  },
  {
    label: 'Female Voice Drop Poster',
    url: '/assets/aistudio/file_0000000037e482118be1c9f13c18e4cf_d4a8a3e9.png',
  },
  {
    label: 'DJ Drop Sunday Offer',
    url: '/assets/aistudio/file_00000000f0e48211ab50105531ba28da_1dc7702d.png',
  },
  {
    label: '2 Custom Drop Packs',
    url: '/assets/aistudio/file_00000000f6cc8211a9cb3adbe4ba8934_6cb24f04.png',
  },
  {
    label: 'Lower Thirds Video Labels',
    url: '/assets/aistudio/file_00000000570882119050958b93e290ff_6998f9bf.png',
  },
];

interface StudioDashboardProps {
  user: User | null;
  userRole: UserRole;
  drops: DropProduct[];
  allAdminDrops: DropProduct[];
  cloudDropIds: string[];
  reviews: ProductReview[];
  orders: OrderRecord[];
  licenses: LicenseAgreement[];
  requests: CustomDropRequest[];
  audioAssets: AudioAsset[];
  emailLogs: EmailNotificationLog[];
  teamMembers: TeamMember[];
  payoutRequests: PayoutRequest[];
  creatorProfiles: CreatorProfile[];
  creatorSales: CreatorSaleRecord[];
  promoCodes?: PromoCode[];
  userDirectory?: UserProfileRecord[];
  adminLogs?: AdminActivityLog[];
  gatewaySettings: StudioGatewaySettings | null;
  emailTemplateConfig: EmailTemplateConfig | null;
  storefrontConfig?: PublicStorefrontConfig | null;
  themeId: ThemeId;
  onSelectTheme: (themeId: ThemeId) => void;
  onRoleUpgraded: (newRole: UserRole) => void;
  onInspectLicense: (license: LicenseAgreement) => void;
  onPlayAudio: (assetId: string, title: string) => void;
  onOpenAuth?: (tab?: 'signin' | 'signup' | 'admin') => void;
  onOpenAdminLogin?: () => void;
  onBackToStorefront: () => void;
}

export function StudioDashboard({
  user,
  userRole,
  drops,
  allAdminDrops,
  cloudDropIds,
  reviews,
  orders,
  licenses,
  requests,
  audioAssets,
  emailLogs,
  teamMembers,
  payoutRequests,
  creatorProfiles,
  creatorSales,
  promoCodes = [],
  userDirectory = [],
  adminLogs = [],
  gatewaySettings,
  emailTemplateConfig,
  storefrontConfig,
  themeId,
  onSelectTheme,
  onRoleUpgraded,
  onInspectLicense,
  onPlayAudio,
  onOpenAuth,
  onOpenAdminLogin,
  onBackToStorefront,
}: StudioDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [statusNotice, setStatusNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  // Upload & Publish Catalog state
  const [uploading, setUploading] = useState(false);
  const [uploadingProductMedia, setUploadingProductMedia] = useState(false);
  const [uploadingCoverMedia, setUploadingCoverMedia] = useState(false);
  const [storageTypeFilter, setStorageTypeFilter] = useState<'all' | ProductMediaType>('all');
  const [portalPreviewTarget, setPortalPreviewTarget] = useState<PreviewTarget | null>(null);
  const [newDropTitle, setNewDropTitle] = useState('');
  const [newDropVoice, setNewDropVoice] = useState('Studio Talent');
  const [newDropGenre, setNewDropGenre] = useState('Afrobeats');
  const [newDropBpm, setNewDropBpm] = useState(112);
  const [newDropPrice, setNewDropPrice] = useState(29);
  const [selectedAssetId, setSelectedAssetId] = useState('');

  // Batch Price Editing state
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [selectedBatchDropIds, setSelectedBatchDropIds] = useState<string[]>([]);
  const [batchPriceDrafts, setBatchPriceDrafts] = useState<
    Record<string, { standard: string; commercial: string; exclusive: string }>
  >({});
  const [batchPercentInput, setBatchPercentInput] = useState('10');
  const [batchFixedStd, setBatchFixedStd] = useState('');
  const [batchFixedCom, setBatchFixedCom] = useState('');
  const [batchFixedExc, setBatchFixedExc] = useState('');
  const [savingBatchPrices, setSavingBatchPrices] = useState(false);

  // Co-Creator Onboarding Sign-Up state
  const [creatorBrandName, setCreatorBrandName] = useState(user?.displayName || '');
  const [creatorHandle, setCreatorHandle] = useState('');
  const [creatorCountryCode, setCreatorCountryCode] = useState('UG');
  const [creatorSpecialty, setCreatorSpecialty] = useState('Afrobeats, Amapiano & Club Drops');
  const [creatorBio, setCreatorBio] = useState('');
  const [signingUpCreator, setSigningUpCreator] = useState(false);

  // Full Product & Price Manager state (Add / Edit)
  const [catalogSearch, setCatalogSearch] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodTitle, setProdTitle] = useState('');
  const [prodVoice, setProdVoice] = useState('Wigman Deep Male');
  const [prodVoiceCategory, setProdVoiceCategory] = useState<VoiceCategory>('Deep male voice');
  const [prodGenre, setProdGenre] = useState('Club & Street Mix');
  const [prodVocalStyle, setProdVocalStyle] = useState('Deep Sub Bass');
  const [prodMediaType, setProdMediaType] = useState<ProductMediaType>('audio');
  const [prodOriginalFileName, setProdOriginalFileName] = useState('');
  const [prodFileSizeBytes, setProdFileSizeBytes] = useState(0);
  const [prodBpm, setProdBpm] = useState(112);
  const [prodDurationSec, setProdDurationSec] = useState(8);
  const [prodKey, setProdKey] = useState('Am');
  const [prodTagsText, setProdTagsText] = useState('afrobeats, club, opener');
  const [prodStdPrice, setProdStdPrice] = useState(29);
  const [prodComPrice, setProdComPrice] = useState(79);
  const [prodExcPrice, setProdExcPrice] = useState(249);
  const [prodCoverImage, setProdCoverImage] = useState(COVER_IMAGE_PRESETS[0].url);
  const [prodAudioId, setProdAudioId] = useState('');
  const [prodAudioFormat, setProdAudioFormat] = useState('WAV 24-bit');
  const [prodSampleRate, setProdSampleRate] = useState('48 kHz');
  const [prodFeatured, setProdFeatured] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [confirmDeleteDropId, setConfirmDeleteDropId] = useState<string | null>(null);
  const [confirmDeleteReviewId, setConfirmDeleteReviewId] = useState<string | null>(null);

  // Custom Reporting state
  const [reportTierFilter, setReportTierFilter] = useState<'all' | LicenseTier>('all');
  const [reportCountryFilter, setReportCountryFilter] = useState('all');
  const [includeTaxCols, setIncludeTaxCols] = useState(true);
  const [includeGatewayCols, setIncludeGatewayCols] = useState(true);
  const [reportClientEmail, setReportClientEmail] = useState('');

  // Email Composer & Admin Milestone Branding state
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSubTab, setEmailSubTab] = useState<'logs' | 'branding'>('logs');
  const [selectedTplMilestone, setSelectedTplMilestone] = useState<RequestMilestone>('Submitted');
  const [tplBrandName, setTplBrandName] = useState(
    emailTemplateConfig?.brandName || DEFAULT_EMAIL_TEMPLATE_CONFIG.brandName
  );
  const [tplBrandTagline, setTplBrandTagline] = useState(
    emailTemplateConfig?.brandTagline || DEFAULT_EMAIL_TEMPLATE_CONFIG.brandTagline
  );
  const [tplAccentColor, setTplAccentColor] = useState(
    emailTemplateConfig?.accentColor || DEFAULT_EMAIL_TEMPLATE_CONFIG.accentColor
  );
  const [tplSenderName, setTplSenderName] = useState(
    emailTemplateConfig?.senderName || DEFAULT_EMAIL_TEMPLATE_CONFIG.senderName
  );
  const [tplReplyToEmail, setTplReplyToEmail] = useState(
    emailTemplateConfig?.replyToEmail || DEFAULT_EMAIL_TEMPLATE_CONFIG.replyToEmail
  );
  const [tplLogoUrl, setTplLogoUrl] = useState(
    emailTemplateConfig?.logoUrl || DEFAULT_EMAIL_TEMPLATE_CONFIG.logoUrl
  );
  const [tplFooterText, setTplFooterText] = useState(
    emailTemplateConfig?.footerText || DEFAULT_EMAIL_TEMPLATE_CONFIG.footerText
  );
  const [tplMilestones, setTplMilestones] = useState<Record<RequestMilestone, MilestoneEmailTemplate>>(
    emailTemplateConfig?.milestoneTemplates || DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates
  );
  const [previewSampleRequestId, setPreviewSampleRequestId] = useState('sample');
  const [testTemplateEmail, setTestTemplateEmail] = useState(user?.email || '');
  const [savingEmailTemplates, setSavingEmailTemplates] = useState(false);
  const [sendingTestTemplate, setSendingTestTemplate] = useState(false);

  // Team RBAC form state
  const [memberUid, setMemberUid] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'producer' | 'licensing_manager' | 'viewer'>('producer');
  const [memberSpecialty, setMemberSpecialty] = useState('Mastering & FX');

  // Gateway Settings state
  const [payoutStatus, setPayoutStatus] = useState<'pending_setup' | 'connected'>(
    gatewaySettings?.payoutStatus || 'pending_setup'
  );
  const [gatewayProvider, setGatewayProvider] = useState<
    StudioGatewaySettings['gatewayProvider']
  >(gatewaySettings?.gatewayProvider || 'deferred_payout');
  const [adminPayoutMethod, setAdminPayoutMethod] = useState<'bank' | 'mobile_money'>(
    gatewaySettings?.adminPayoutMethod ||
      (gatewaySettings?.gatewayProvider === 'mtn_momo' ||
      gatewaySettings?.gatewayProvider === 'mobile_money'
        ? 'mobile_money'
        : 'bank')
  );
  const [merchantAccountLabel, setMerchantAccountLabel] = useState(
    gatewaySettings?.merchantAccountLabel || 'Add Payout Account Later (Sandbox Active)'
  );
  const [payoutCurrency, setPayoutCurrency] = useState(gatewaySettings?.payoutCurrency || 'USD');
  const [settlementEmail, setSettlementEmail] = useState(
    gatewaySettings?.settlementEmail || 'djizeerunkx21062002@gmail.com'
  );
  const [autoTaxCompliance, setAutoTaxCompliance] = useState(
    gatewaySettings?.autoTaxCompliance ?? true
  );
  const [autoMilestoneEmails, setAutoMilestoneEmails] = useState(
    gatewaySettings?.autoMilestoneEmails ?? true
  );
  const [payoutEmailAlerts, setPayoutEmailAlerts] = useState(
    gatewaySettings?.payoutEmailAlerts ?? gatewaySettings?.autoMilestoneEmails ?? true
  );

  // Producer & Global Co-Creator Payouts form state
  const [payoutCountryCode, setPayoutCountryCode] = useState('UG');
  const [payoutRegionScope, setPayoutRegionScope] = useState('All Regions');
  const [payoutAmountInput, setPayoutAmountInput] = useState('');
  const [payoutReqCurrency, setPayoutReqCurrency] = useState(
    gatewaySettings?.payoutCurrency || 'USD'
  );
  const [payoutRequestMethod, setPayoutRequestMethod] = useState<string>(
    gatewaySettings?.gatewayProvider === 'bank_transfer' ||
      gatewaySettings?.adminPayoutMethod === 'bank'
      ? 'bank_transfer'
      : gatewaySettings?.gatewayProvider === 'mobile_money' ||
        gatewaySettings?.adminPayoutMethod === 'mobile_money'
      ? 'mobile_money'
      : gatewaySettings?.gatewayProvider || 'mtn_momo'
  );
  const [payoutDestination, setPayoutDestination] = useState(
    gatewaySettings?.merchantAccountLabel || '+256784903051'
  );
  const [payoutNotes, setPayoutNotes] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [adminRowPayoutMethods, setAdminRowPayoutMethods] = useState<
    Record<string, 'bank_transfer' | 'mobile_money'>
  >({});

  // Payment & Tax Setup Matrix Inspector state
  const [explorerCountryCode, setExplorerCountryCode] = useState('UG');
  const [explorerCurrencyOverride, setExplorerCurrencyOverride] = useState('LOCAL');

  // Promo Codes Management state
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoDiscountPercent, setPromoDiscountPercent] = useState(20);
  const [promoMinSubtotal, setPromoMinSubtotal] = useState(25);
  const [promoDescription, setPromoDescription] = useState('Special 20% discount on DJ drops');
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoSearchQuery, setPromoSearchQuery] = useState('');
  const [confirmDeletePromoId, setConfirmDeletePromoId] = useState<string | null>(null);

  // User Directory & Roles state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [selectedUserForRoleEdit, setSelectedUserForRoleEdit] = useState<UserProfileRecord | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<UserRole>('client');
  const [savingUserRole, setSavingUserRole] = useState(false);

  // Security & Audit Logs state
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');

  // Orders Filter & Status Management state
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);

  // Storefront Announcement & Hero Customizer state
  const [announcementEnabled, setAnnouncementEnabled] = useState(
    storefrontConfig?.announcementEnabled ?? false
  );
  const [announcementBadge, setAnnouncementBadge] = useState(
    storefrontConfig?.announcementBadge || 'VIP PROMO'
  );
  const [announcementText, setAnnouncementText] = useState(
    storefrontConfig?.announcementText || 'Use code VIP20 at checkout for 20% off all studio masters!'
  );
  const [heroHeadline, setHeroHeadline] = useState(
    storefrontConfig?.heroHeadline || 'Own Your Sound Across 550+ Global Jurisdictions'
  );
  const [heroSubheadline, setHeroSubheadline] = useState(
    storefrontConfig?.heroSubheadline ||
      'Discover studio-mastered DJ drops, issue binding custom audio licensing agreements, calculate VAT/GST compliance automatically, and deliver 24-bit WAV masters worldwide.'
  );
  const [customRequestsEnabled, setCustomRequestsEnabled] = useState(
    storefrontConfig?.customRequestsEnabled ?? true
  );
  const [defaultCustomPriceUsd, setDefaultCustomPriceUsd] = useState(
    storefrontConfig?.defaultCustomPriceUsd ?? 49
  );
  const [maintenanceMode, setMaintenanceMode] = useState(
    storefrontConfig?.maintenanceMode ?? false
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    storefrontConfig?.maintenanceMessage || 'Platform maintenance in progress. Orders will resume shortly.'
  );
  const [savingStorefrontCustomization, setSavingStorefrontCustomization] = useState(false);

  useEffect(() => {
    if (!storefrontConfig) return;
    if (storefrontConfig.announcementEnabled !== undefined) {
      setAnnouncementEnabled(storefrontConfig.announcementEnabled);
    }
    if (storefrontConfig.announcementBadge) setAnnouncementBadge(storefrontConfig.announcementBadge);
    if (storefrontConfig.announcementText) setAnnouncementText(storefrontConfig.announcementText);
    if (storefrontConfig.heroHeadline) setHeroHeadline(storefrontConfig.heroHeadline);
    if (storefrontConfig.heroSubheadline) setHeroSubheadline(storefrontConfig.heroSubheadline);
    if (storefrontConfig.customRequestsEnabled !== undefined) {
      setCustomRequestsEnabled(storefrontConfig.customRequestsEnabled);
    }
    if (storefrontConfig.defaultCustomPriceUsd) {
      setDefaultCustomPriceUsd(storefrontConfig.defaultCustomPriceUsd);
    }
    if (storefrontConfig.maintenanceMode !== undefined) {
      setMaintenanceMode(storefrontConfig.maintenanceMode);
    }
    if (storefrontConfig.maintenanceMessage) {
      setMaintenanceMessage(storefrontConfig.maintenanceMessage);
    }
  }, [storefrontConfig]);

  const payoutJurisdiction = useMemo(
    () => findJurisdiction(payoutCountryCode),
    [payoutCountryCode]
  );

  const availablePayoutMethods = useMemo(
    () => getPayoutMethodsForCurrency(payoutReqCurrency, payoutJurisdiction),
    [payoutReqCurrency, payoutJurisdiction]
  );

  useEffect(() => {
    if (!availablePayoutMethods.some((m) => m.id === payoutRequestMethod)) {
      setPayoutRequestMethod(availablePayoutMethods[0]?.id || 'bank_transfer');
    }
  }, [availablePayoutMethods, payoutRequestMethod]);

  useEffect(() => {
    if (!gatewaySettings) return;
    setPayoutStatus(gatewaySettings.payoutStatus);
    setGatewayProvider(gatewaySettings.gatewayProvider);
    const resolvedAdminMethod =
      gatewaySettings.adminPayoutMethod ||
      (gatewaySettings.gatewayProvider === 'mtn_momo' ||
      gatewaySettings.gatewayProvider === 'mobile_money'
        ? 'mobile_money'
        : 'bank');
    setAdminPayoutMethod(resolvedAdminMethod);
    setMerchantAccountLabel(gatewaySettings.merchantAccountLabel);
    setPayoutCurrency(gatewaySettings.payoutCurrency);
    setSettlementEmail(gatewaySettings.settlementEmail);
    setAutoTaxCompliance(gatewaySettings.autoTaxCompliance);
    setAutoMilestoneEmails(gatewaySettings.autoMilestoneEmails);
    setPayoutEmailAlerts(
      gatewaySettings.payoutEmailAlerts ?? gatewaySettings.autoMilestoneEmails ?? true
    );
  }, [gatewaySettings]);

  useEffect(() => {
    if (!emailTemplateConfig) return;
    setTplBrandName(emailTemplateConfig.brandName);
    setTplBrandTagline(emailTemplateConfig.brandTagline);
    setTplAccentColor(emailTemplateConfig.accentColor);
    setTplSenderName(emailTemplateConfig.senderName);
    setTplReplyToEmail(emailTemplateConfig.replyToEmail);
    setTplLogoUrl(emailTemplateConfig.logoUrl || '');
    setTplFooterText(emailTemplateConfig.footerText);
    setTplMilestones(emailTemplateConfig.milestoneTemplates);
  }, [emailTemplateConfig]);

  const draftEmailConfig = useMemo(
    () => ({
      id: 'default',
      brandName: tplBrandName || DEFAULT_EMAIL_TEMPLATE_CONFIG.brandName,
      brandTagline: tplBrandTagline,
      accentColor: /^#[0-9a-fA-F]{6}$/.test(tplAccentColor) ? tplAccentColor : '#F59E0B',
      senderName: tplSenderName || DEFAULT_EMAIL_TEMPLATE_CONFIG.senderName,
      replyToEmail: tplReplyToEmail || DEFAULT_EMAIL_TEMPLATE_CONFIG.replyToEmail,
      logoUrl: tplLogoUrl,
      footerText: tplFooterText,
      milestoneTemplates: tplMilestones,
    }),
    [
      tplBrandName,
      tplBrandTagline,
      tplAccentColor,
      tplSenderName,
      tplReplyToEmail,
      tplLogoUrl,
      tplFooterText,
      tplMilestones,
    ]
  );

  const liveEmailPreview = useMemo(() => {
    const matchedReq = requests.find((r) => r.id === previewSampleRequestId);
    return renderMilestoneEmail(draftEmailConfig, {
      clientName: matchedReq?.clientName || 'DJ Kairo',
      djName: matchedReq?.djName || 'DJ Kairo Live FM',
      milestone: selectedTplMilestone,
      requestId: matchedReq?.id || 'req_1764071200',
      genre: matchedReq?.genre || 'Afrobeats',
      bpm: matchedReq?.bpmTarget || 114,
      producerName:
        matchedReq && matchedReq.assignedProducerName !== 'Unassigned'
          ? matchedReq.assignedProducerName
          : user?.displayName || 'Studio Producer',
    });
  }, [draftEmailConfig, previewSampleRequestId, requests, selectedTplMilestone, user]);

  const explorerJurisdiction = useMemo(
    () => findJurisdiction(explorerCountryCode),
    [explorerCountryCode]
  );
  const explorerActiveCurrency =
    explorerCurrencyOverride === 'LOCAL'
      ? explorerJurisdiction.currency
      : explorerCurrencyOverride;
  const explorerCheckoutMethods = useMemo(
    () => getPaymentMethodsForJurisdiction(explorerJurisdiction, explorerActiveCurrency),
    [explorerJurisdiction, explorerActiveCurrency]
  );
  const explorerPayoutMethods = useMemo(
    () => getPayoutMethodsForCurrency(explorerActiveCurrency),
    [explorerActiveCurrency]
  );

  const isBootstrappedAdmin =
    Boolean(user?.emailVerified) &&
    user?.email?.toLowerCase() === 'djizeerunkx21062002@gmail.com';
  const isAdmin = userRole === 'admin' || isBootstrappedAdmin;
  const isCreator = userRole === 'creator';
  const isProducer = userRole === 'producer' || isAdmin;
  const canManageCatalog = isProducer || isCreator;
  const canWithdrawPayouts = isProducer || isCreator;
  const isLicensingMgr = userRole === 'licensing_manager' || isAdmin;

  const logAdminAction = async (action: string, targetId: string, details: string) => {
    if (!user || !isAdmin) return;
    const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await setDoc(doc(db, 'adminLogs', logId), {
        id: logId,
        actorUid: user.uid,
        actorEmail: (user.email || 'djizeerunkx21062002@gmail.com').slice(0, 160),
        action: action.slice(0, 80),
        targetId: targetId.slice(0, 128),
        details: details.slice(0, 300),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to record admin log:', err);
    }
  };

  const editableCatalogDrops = useMemo(() => {
    if (isProducer) return allAdminDrops;
    if (isCreator && user) return allAdminDrops.filter((d) => d.createdBy === user.uid);
    return [];
  }, [allAdminDrops, isProducer, isCreator, user]);

  // Derived Analytics
  const analytics = useMemo(() => {
    const grossRevenue = orders.reduce((s, o) => s + o.totalUsd, 0);
    const taxCollected = orders.reduce((s, o) => s + o.taxAmountUsd, 0);
    const netRevenue = orders.reduce((s, o) => s + o.subtotalUsd, 0);
    const adminFivePctPurchaseFeesUsd = Number(
      creatorSales.reduce((s, sale) => s + sale.adminFeeUsd, 0).toFixed(2)
    );
    const adminSevenPctWithdrawalFeesUsd = Number(
      payoutRequests
        .filter((p) => p.status !== 'Rejected')
        .reduce((s, p) => s + (p.withdrawalFeeUsd || 0), 0)
        .toFixed(2)
    );
    const creatorGrossSalesUsd = Number(
      creatorSales.reduce((s, sale) => s + sale.grossItemUsd, 0).toFixed(2)
    );
    const creatorNetEarningsUsd = Number(
      creatorSales.reduce((s, sale) => s + sale.creatorNetUsd, 0).toFixed(2)
    );
    const byCountryMap = new Map<string, { country: string; revenue: number; count: number }>();
    if (isCreator) {
      for (const sale of creatorSales) {
        const existing = byCountryMap.get(sale.countryName) || {
          country: sale.countryName,
          revenue: 0,
          count: 0,
        };
        existing.revenue += sale.creatorNetUsd;
        existing.count += 1;
        byCountryMap.set(sale.countryName, existing);
      }
    } else {
      for (const o of orders) {
        const existing = byCountryMap.get(o.countryName) || {
          country: o.countryName,
          revenue: 0,
          count: 0,
        };
        existing.revenue += o.totalUsd;
        existing.count += 1;
        byCountryMap.set(o.countryName, existing);
      }
    }
    const topCountries = Array.from(byCountryMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
    const maxCountryRev = Math.max(1, ...topCountries.map((c) => c.revenue));
    return {
      grossRevenue,
      taxCollected,
      netRevenue,
      adminFivePctPurchaseFeesUsd,
      adminSevenPctWithdrawalFeesUsd,
      totalAdminFeeRevenueUsd: Number(
        (adminFivePctPurchaseFeesUsd + adminSevenPctWithdrawalFeesUsd).toFixed(2)
      ),
      creatorGrossSalesUsd,
      creatorNetEarningsUsd,
      orderCount: isCreator ? creatorSales.length : orders.length,
      activeRequests: requests.filter((r) => r.milestone !== 'Delivered').length,
      topCountries,
      maxCountryRev,
    };
  }, [orders, requests, creatorSales, payoutRequests, isCreator]);

  // Producer & Co-Creator Payout Regional Earnings Analytics
  const payoutAnalytics = useMemo(() => {
    interface RegionAccumulator {
      region: string;
      countries: Set<string>;
      salesCount: number;
      grossSalesUsd: number;
      taxUsd: number;
      netEarningsUsd: number;
    }

    const regionMap = new Map<string, RegionAccumulator>();

    const upsertRegion = (
      regionName: string,
      countryLabel: string,
      grossUsd: number,
      taxUsd: number,
      netUsd: number
    ) => {
      const entry = regionMap.get(regionName) || {
        region: regionName,
        countries: new Set<string>(),
        salesCount: 0,
        grossSalesUsd: 0,
        taxUsd: 0,
        netEarningsUsd: 0,
      };
      entry.countries.add(countryLabel);
      entry.salesCount += 1;
      entry.grossSalesUsd += grossUsd;
      entry.taxUsd += taxUsd;
      entry.netEarningsUsd += netUsd;
      regionMap.set(regionName, entry);
    };

    if (isCreator) {
      for (const sale of creatorSales) {
        const j = findJurisdiction(sale.jurisdictionCode);
        upsertRegion(
          j.region,
          sale.countryName,
          sale.grossItemUsd,
          sale.adminFeeUsd, // 5% platform fee tracked here
          sale.creatorNetUsd // 95% creator earnings
        );
      }
    } else {
      for (const order of orders) {
        const j = findJurisdiction(order.jurisdictionCode);
        upsertRegion(
          j.region,
          order.countryName,
          order.totalUsd,
          order.taxAmountUsd,
          order.subtotalUsd
        );
      }

      // Include fulfilled or assigned custom commissions for producer visibility
      for (const req of requests) {
        const countsForProducer =
          isAdmin || (user && req.assignedProducerUid === user.uid);
        if (!countsForProducer) continue;
        if (req.milestone === 'Delivered' || req.milestone === 'Mastering' || req.milestone === 'Voicing & FX') {
          const j = findJurisdiction(req.countryCode);
          upsertRegion(j.region, j.country, req.quotedPriceUsd, 0, req.quotedPriceUsd);
        }
      }
    }

    const byRegion = Array.from(regionMap.values())
      .map((r) => ({
        region: r.region,
        countriesList: Array.from(r.countries),
        salesCount: r.salesCount,
        grossSalesUsd: Number(r.grossSalesUsd.toFixed(2)),
        taxUsd: Number(r.taxUsd.toFixed(2)),
        netEarningsUsd: Number(r.netEarningsUsd.toFixed(2)),
      }))
      .sort((a, b) => b.netEarningsUsd - a.netEarningsUsd);

    const aggregatedSalesUsd = byRegion.reduce((s, r) => s + r.grossSalesUsd, 0);
    const totalNetEarningsUsd = byRegion.reduce((s, r) => s + r.netEarningsUsd, 0);
    const totalTaxUsd = byRegion.reduce((s, r) => s + r.taxUsd, 0);
    const myPayoutRequests = user
      ? isAdmin
        ? payoutRequests
        : payoutRequests.filter((p) => p.producerUid === user.uid)
      : [];
    const committedPayoutsUsd = myPayoutRequests
      .filter((p) => p.status !== 'Rejected')
      .reduce((s, p) => s + p.amountUsd, 0);
    const pendingEarningsUsd = Math.max(0, Number((totalNetEarningsUsd - committedPayoutsUsd).toFixed(2)));
    const maxRegionNet = Math.max(1, ...byRegion.map((r) => r.netEarningsUsd));

    return {
      byRegion,
      aggregatedSalesUsd,
      totalNetEarningsUsd,
      totalTaxUsd,
      committedPayoutsUsd,
      pendingEarningsUsd,
      maxRegionNet,
    };
  }, [orders, requests, payoutRequests, creatorSales, isAdmin, isCreator, user]);

  const filteredReportOrders = useMemo(() => {
    return orders.filter((o) => {
      if (reportCountryFilter !== 'all' && o.countryName !== reportCountryFilter) return false;
      if (reportTierFilter !== 'all' && !o.items.some((i) => i.tier === reportTierFilter)) {
        return false;
      }
      return true;
    });
  }, [orders, reportCountryFilter, reportTierFilter]);

  const uniqueOrderCountries = useMemo(
    () => Array.from(new Set(orders.map((o) => o.countryName))).sort(),
    [orders]
  );

  const pendingPayoutRequests = useMemo(
    () => payoutRequests.filter((p) => p.status === 'Requested' || p.status === 'Processing'),
    [payoutRequests]
  );

  const completedPayoutHistory = useMemo(
    () => payoutRequests.filter((p) => p.status === 'Settled'),
    [payoutRequests]
  );

  const completedPayoutTotalUsd = useMemo(
    () => completedPayoutHistory.reduce((sum, p) => sum + p.amountUsd, 0),
    [completedPayoutHistory]
  );

  const formatPayoutDate = (ts: unknown) => {
    if (!ts) return 'Just now';
    let dateObj: Date | null = null;
    if (
      typeof ts === 'object' &&
      ts !== null &&
      'toDate' in ts &&
      typeof (ts as { toDate: () => Date }).toDate === 'function'
    ) {
      dateObj = (ts as { toDate: () => Date }).toDate();
    } else if (ts instanceof Date) {
      dateObj = ts;
    } else if (typeof ts === 'string') {
      const parsed = new Date(ts);
      if (!Number.isNaN(parsed.getTime())) dateObj = parsed;
    }
    if (!dateObj) return 'Recently';
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const notifyUser = (msg: string) => {
    setErrorNotice('');
    setStatusNotice(msg);
  };

  const handleSeedCatalogToFirestore = async () => {
    if (!user || !isAdmin) return;
    setErrorNotice('');
    try {
      for (const item of INITIAL_DROPS) {
        await setDoc(doc(db, 'drops', item.id), {
          ...item,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      notifyUser('Catalog drops synced to Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'drops');
    }
  };

  const handleAdvanceMilestone = async (req: CustomDropRequest, nextMilestone: RequestMilestone) => {
    if (!user || !isProducer) return;
    setErrorNotice('');
    try {
      const assignedProducerName =
        req.assignedProducerName === 'Unassigned'
          ? user.displayName || 'Studio Producer'
          : req.assignedProducerName;

      await updateDoc(doc(db, 'customRequests', req.id), {
        milestone: nextMilestone,
        assignedProducerUid: req.assignedProducerUid || user.uid,
        assignedProducerName,
        updatedAt: serverTimestamp(),
      });

      const activeTemplateConfig = emailTemplateConfig || DEFAULT_EMAIL_TEMPLATE_CONFIG;
      const renderedEmail = renderMilestoneEmail(activeTemplateConfig, {
        clientName: req.clientName,
        djName: req.djName,
        milestone: nextMilestone,
        requestId: req.id,
        genre: req.genre,
        bpm: req.bpmTarget,
        producerName: assignedProducerName,
      });

      const idToken = await user.getIdToken();
      const subject = renderedEmail.subject;
      const previewBody = renderedEmail.textBody.slice(0, 1000);

      const res = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientEmail: req.clientEmail,
          subject,
          milestone: nextMilestone,
          previewBody,
          htmlBody: renderedEmail.htmlBody,
          senderName: activeTemplateConfig.senderName,
          replyToEmail: activeTemplateConfig.replyToEmail,
        }),
      });
      const emailData = res.ok ? await res.json() : { deliveryStatus: 'logged_sandbox' };
      const logId = `eml_${Date.now()}`;
      await setDoc(doc(db, 'emailLogs', logId), {
        id: logId,
        ownerUid: req.clientUid,
        recipientEmail: req.clientEmail,
        subject,
        milestone: nextMilestone,
        relatedRequestId: req.id,
        relatedOrderId: '',
        deliveryStatus: emailData.deliveryStatus === 'sent_smtp' ? 'sent_smtp' : 'logged_sandbox',
        previewBody,
        createdAt: serverTimestamp(),
      });

      notifyUser(`Updated ${req.djName} to "${nextMilestone}" & triggered branded client email notification.`);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Unable to update milestone.');
    }
  };

  const handleToggleLicenseStatus = async (lic: LicenseAgreement) => {
    if (!user || !isLicensingMgr) return;
    const nextStatus = lic.status === 'active' ? 'revoked' : 'active';
    try {
      await updateDoc(doc(db, 'licenses', lic.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      notifyUser(`License ${lic.serialNumber} marked ${nextStatus}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `licenses/${lic.id}`);
    }
  };

  const detectBrowserDuration = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      const lower = file.name.toLowerCase();
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/.test(lower);
      const isAudio = file.type.startsWith('audio/') || /\.(wav|mp3|flac|aiff|ogg|m4a|aac)$/.test(lower);
      if (!isVideo && !isAudio) {
        resolve(0);
        return;
      }
      const url = URL.createObjectURL(file);
      const el = document.createElement(isVideo ? 'video' : 'audio');
      el.preload = 'metadata';
      const timer = window.setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(null);
      }, 2500);
      el.onloadedmetadata = () => {
        window.clearTimeout(timer);
        const dur = Number.isFinite(el.duration) ? Math.max(1, Math.min(7200, Math.round(el.duration))) : null;
        URL.revokeObjectURL(url);
        resolve(dur);
      };
      el.onerror = () => {
        window.clearTimeout(timer);
        URL.revokeObjectURL(url);
        resolve(null);
      };
      el.src = url;
    });
  };

  const uploadMediaFileAsset = async (file: File): Promise<AudioAsset> => {
    if (!user) throw new Error('Sign in required to upload files.');
    const detectedDuration = await detectBrowserDuration(file);
    const idToken = await user.getIdToken();
    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
      body: formData,
    });
    if (!uploadRes.ok) {
      const d = await uploadRes.json().catch(() => ({}));
      throw new Error(d.error || 'Upload failed');
    }
    const meta = await uploadRes.json();
    const finalDuration =
      detectedDuration !== null ? detectedDuration : Number(meta.durationSec) || 0;
    const mediaType: ProductMediaType = meta.mediaType || 'audio';

    const assetRecord: AudioAsset = {
      id: meta.assetId,
      fileName: meta.fileName,
      originalName: String(meta.originalName || file.name).slice(0, 200),
      mimeType: String(meta.mimeType || 'application/octet-stream').slice(0, 80),
      sizeBytes: Number(meta.sizeBytes) || file.size,
      format: String(meta.format || 'FILE').slice(0, 20),
      mediaType,
      sampleRate: String(meta.sampleRate || 'Studio').slice(0, 30),
      bitDepth: String(meta.bitDepth || 'Standard').slice(0, 20),
      durationSec: finalDuration,
      uploadedByUid: user.uid,
      uploadedByName: (user.displayName || 'Creator').slice(0, 100),
      linkedDropId: '',
      linkedRequestId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'audioAssets', meta.assetId), assetRecord);
    return assetRecord;
  };

  const handleUploadAudio = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !canManageCatalog) return;
    setUploading(true);
    setErrorNotice('');
    try {
      const savedAsset = await uploadMediaFileAsset(file);
      setSelectedAssetId(savedAsset.id);
      notifyUser(
        `Uploaded ${savedAsset.originalName} (${savedAsset.mediaType?.toUpperCase()} · ${savedAsset.format}) to cloud storage.`
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Media upload error.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleUploadProductMediaInline = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !canManageCatalog) return;
    setUploadingProductMedia(true);
    setErrorNotice('');
    try {
      const savedAsset = await uploadMediaFileAsset(file);
      const mType = savedAsset.mediaType || inferMediaTypeFromAsset(savedAsset);
      setProdAudioId(savedAsset.id);
      setProdMediaType(mType);
      setProdOriginalFileName(savedAsset.originalName);
      setProdFileSizeBytes(savedAsset.sizeBytes);
      setProdAudioFormat(`${savedAsset.format} ${mType === 'audio' ? '' : mType.toUpperCase()}`.trim().slice(0, 20));
      setProdSampleRate(savedAsset.sampleRate);
      setProdDurationSec(savedAsset.durationSec);
      if (!prodTitle.trim()) {
        const baseName = savedAsset.originalName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
        setProdTitle(baseName.slice(0, 120));
      }
      if (mType === 'image') {
        setProdCoverImage(`/api/media/preview/${savedAsset.id}`);
        setProdBpm(0);
      } else if (mType === 'other') {
        setProdBpm(0);
      }
      notifyUser(`Attached "${savedAsset.originalName}" (${mType.toUpperCase()}) to product form.`);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Failed to upload product file.');
    } finally {
      setUploadingProductMedia(false);
      e.target.value = '';
    }
  };

  const handleUploadCoverImageInline = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !canManageCatalog) return;
    setUploadingCoverMedia(true);
    setErrorNotice('');
    try {
      const savedAsset = await uploadMediaFileAsset(file);
      setProdCoverImage(`/api/media/preview/${savedAsset.id}`);
      notifyUser(`Uploaded custom cover artwork "${savedAsset.originalName}".`);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Failed to upload cover image.');
    } finally {
      setUploadingCoverMedia(false);
      e.target.value = '';
    }
  };

  const handlePublishDropFromAsset = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !canManageCatalog || !newDropTitle.trim()) return;
    const matchedAsset = audioAssets.find((a) => a.id === selectedAssetId);
    const dropId = `drop_${Date.now()}`;
    const assetId = selectedAssetId || `synth-${dropId}`;
    const mType: ProductMediaType = matchedAsset
      ? matchedAsset.mediaType || inferMediaTypeFromAsset(matchedAsset)
      : 'audio';
    const coverImg =
      mType === 'image' && matchedAsset
        ? `/api/media/preview/${matchedAsset.id}`
        : COVER_IMAGE_PRESETS[0].url;

    try {
      await setDoc(doc(db, 'drops', dropId), {
        id: dropId,
        title: newDropTitle.trim().slice(0, 120),
        voiceTalent: newDropVoice.trim().slice(0, 80) || 'Studio Talent',
        voiceCategory: newDropVoice.toLowerCase().includes('female') ? 'Female voice' : 'Deep male voice',
        genre: newDropGenre,
        vocalStyle: mType === 'audio' ? 'Studio Master' : `${mType.toUpperCase()} Edition`,
        bpm: mType === 'image' || mType === 'other' ? 0 : Number(newDropBpm) || 112,
        durationSec: matchedAsset ? matchedAsset.durationSec : 8,
        musicalKey: mType === 'audio' ? 'Am' : 'N/A',
        tags: [newDropGenre.toLowerCase(), mType, matchedAsset?.format.toLowerCase() || 'master'],
        standardPriceUsd: Math.max(1, Number(newDropPrice) || 29),
        commercialPriceUsd: Math.max(1, Math.round((Number(newDropPrice) || 29) * 2.5)),
        exclusivePriceUsd: Math.max(1, Math.round((Number(newDropPrice) || 29) * 8)),
        coverImage: coverImg,
        audioFileId: assetId,
        audioFormat: matchedAsset ? matchedAsset.format.slice(0, 20) : 'WAV 24-bit',
        sampleRate: matchedAsset ? matchedAsset.sampleRate.slice(0, 30) : '48 kHz',
        mediaType: mType,
        originalFileName: matchedAsset ? matchedAsset.originalName.slice(0, 200) : '',
        fileSizeBytes: matchedAsset ? matchedAsset.sizeBytes : 0,
        featured: false,
        archived: false,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewDropTitle('');
      notifyUser(`Published "${newDropTitle}" (${mType.toUpperCase()}) to the public storefront catalog.`);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Unable to publish drop.');
    }
  };

  const handleSignUpAsCoCreator = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorNotice('');

    const cleanName = creatorBrandName.trim().slice(0, 100);
    const cleanHandle = creatorHandle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 60);
    const cleanSpecialty = creatorSpecialty.trim().slice(0, 120) || 'DJ Drops & FX';
    const cleanBio = creatorBio.trim().slice(0, 400);
    const j = findJurisdiction(creatorCountryCode);

    if (cleanName.length < 2 || cleanHandle.length < 2) {
      setErrorNotice('Enter a creator brand name and storefront handle (at least 2 characters).');
      return;
    }

    setSigningUpCreator(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const batch = writeBatch(db);
      if (userSnap.exists()) {
        batch.update(userRef, {
          displayName: cleanName,
          role: 'creator',
          countryCode: j.code,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(userRef, {
          uid: user.uid,
          email: (user.email || 'creator@dropvault.audio').slice(0, 160),
          displayName: cleanName,
          role: 'creator',
          countryCode: j.code,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(doc(db, 'creatorProfiles', user.uid), {
        uid: user.uid,
        displayName: cleanName,
        studioHandle: cleanHandle,
        countryCode: j.code,
        countryName: j.country,
        specialty: cleanSpecialty,
        bio: cleanBio,
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      setPayoutCountryCode(j.code);
      setPayoutReqCurrency(j.currency);
      onRoleUpgraded('creator');
      setActiveTab('catalog');
      notifyUser(
        `Welcome @${cleanHandle}! Your Co-Creator Seller studio is active — you earn 95% per sale (5% admin fee) with global payouts (7% withdrawal fee).`
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Unable to activate co-creator studio.');
    } finally {
      setSigningUpCreator(false);
    }
  };

  const toggleBatchSelect = (item: DropProduct) => {
    setSelectedBatchDropIds((prev) => {
      const exists = prev.includes(item.id);
      if (exists) {
        return prev.filter((id) => id !== item.id);
      }
      setBatchPriceDrafts((drafts) => ({
        ...drafts,
        [item.id]: drafts[item.id] || {
          standard: String(item.standardPriceUsd),
          commercial: String(item.commercialPriceUsd),
          exclusive: String(item.exclusivePriceUsd),
        },
      }));
      return [...prev, item.id];
    });
  };

  const toggleSelectAllBatch = (visibleItems: DropProduct[]) => {
    const visibleIds = visibleItems.map((d) => d.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedBatchDropIds.includes(id));
    if (allSelected) {
      setSelectedBatchDropIds([]);
      return;
    }
    const nextDrafts: Record<string, { standard: string; commercial: string; exclusive: string }> = {
      ...batchPriceDrafts,
    };
    for (const item of visibleItems) {
      if (!nextDrafts[item.id]) {
        nextDrafts[item.id] = {
          standard: String(item.standardPriceUsd),
          commercial: String(item.commercialPriceUsd),
          exclusive: String(item.exclusivePriceUsd),
        };
      }
    }
    setBatchPriceDrafts(nextDrafts);
    setSelectedBatchDropIds(visibleIds);
  };

  const applyBatchPercentAdjust = (direction: 1 | -1) => {
    const pctRaw = Math.abs(Number(batchPercentInput) || 0);
    if (pctRaw <= 0) return;
    const multiplier = 1 + (direction * pctRaw) / 100;

    setBatchPriceDrafts((prev) => {
      const next = { ...prev };
      for (const id of selectedBatchDropIds) {
        const baseItem = editableCatalogDrops.find((d) => d.id === id);
        if (!baseItem) continue;
        const current = prev[id] || {
          standard: String(baseItem.standardPriceUsd),
          commercial: String(baseItem.commercialPriceUsd),
          exclusive: String(baseItem.exclusivePriceUsd),
        };
        const calc = (valStr: string, fallback: number) => {
          const v = Number(valStr) || fallback;
          return String(Math.max(1, Math.round(v * multiplier * 100) / 100));
        };
        next[id] = {
          standard: calc(current.standard, baseItem.standardPriceUsd),
          commercial: calc(current.commercial, baseItem.commercialPriceUsd),
          exclusive: calc(current.exclusive, baseItem.exclusivePriceUsd),
        };
      }
      return next;
    });
  };

  const applyBatchFixedPrices = () => {
    setBatchPriceDrafts((prev) => {
      const next = { ...prev };
      for (const id of selectedBatchDropIds) {
        const baseItem = editableCatalogDrops.find((d) => d.id === id);
        if (!baseItem) continue;
        const current = prev[id] || {
          standard: String(baseItem.standardPriceUsd),
          commercial: String(baseItem.commercialPriceUsd),
          exclusive: String(baseItem.exclusivePriceUsd),
        };
        next[id] = {
          standard:
            batchFixedStd.trim() && Number(batchFixedStd) >= 1
              ? String(Number(batchFixedStd))
              : current.standard,
          commercial:
            batchFixedCom.trim() && Number(batchFixedCom) >= 1
              ? String(Number(batchFixedCom))
              : current.commercial,
          exclusive:
            batchFixedExc.trim() && Number(batchFixedExc) >= 1
              ? String(Number(batchFixedExc))
              : current.exclusive,
        };
      }
      return next;
    });
  };

  const handleSaveBatchPrices = async () => {
    if (!user || !canManageCatalog || selectedBatchDropIds.length === 0) return;
    setErrorNotice('');
    setSavingBatchPrices(true);
    try {
      const batch = writeBatch(db);
      let updatedCount = 0;

      for (const id of selectedBatchDropIds) {
        const item = editableCatalogDrops.find((d) => d.id === id);
        if (!item) continue;
        const draft = batchPriceDrafts[id];
        const stdPrice = Math.max(
          1,
          Number((Number(draft?.standard ?? item.standardPriceUsd) || item.standardPriceUsd).toFixed(2))
        );
        const comPrice = Math.max(
          1,
          Number((Number(draft?.commercial ?? item.commercialPriceUsd) || item.commercialPriceUsd).toFixed(2))
        );
        const excPrice = Math.max(
          1,
          Number((Number(draft?.exclusive ?? item.exclusivePriceUsd) || item.exclusivePriceUsd).toFixed(2))
        );

        const inCloud = cloudDropIds.includes(id);
        if (inCloud) {
          batch.update(doc(db, 'drops', id), {
            standardPriceUsd: stdPrice,
            commercialPriceUsd: comPrice,
            exclusivePriceUsd: excPrice,
            updatedAt: serverTimestamp(),
          });
        } else if (isProducer) {
          batch.set(doc(db, 'drops', id), {
            ...item,
            standardPriceUsd: stdPrice,
            commercialPriceUsd: comPrice,
            exclusivePriceUsd: excPrice,
            archived: Boolean(item.archived),
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        updatedCount += 1;
      }

      await batch.commit();
      setBatchEditMode(false);
      setSelectedBatchDropIds([]);
      notifyUser(`Batch updated pricing tiers across ${updatedCount} product${updatedCount === 1 ? '' : 's'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'drops/batch');
    } finally {
      setSavingBatchPrices(false);
    }
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProdTitle('');
    setProdVoice('Wigman Deep Male');
    setProdVoiceCategory('Deep male voice');
    setProdGenre('Club & Street Mix');
    setProdVocalStyle('Deep Sub Bass');
    setProdMediaType('audio');
    setProdOriginalFileName('');
    setProdFileSizeBytes(0);
    setProdBpm(112);
    setProdDurationSec(8);
    setProdKey('Am');
    setProdTagsText('deep male voice, club, opener');
    setProdStdPrice(25);
    setProdComPrice(69);
    setProdExcPrice(199);
    setProdCoverImage(COVER_IMAGE_PRESETS[0].url);
    setProdAudioId('');
    setProdAudioFormat('MP3 320kbps');
    setProdSampleRate('44.1 kHz');
    setProdFeatured(true);
  };

  const handleLoadProductForEdit = (item: DropProduct) => {
    setErrorNotice('');
    setEditingProductId(item.id);
    setProdTitle(item.title);
    setProdVoice(item.voiceTalent);
    setProdVoiceCategory(
      item.voiceCategory ||
        (`${item.voiceTalent} ${item.vocalStyle} ${item.tags.join(' ')}`.toLowerCase().includes('female')
          ? 'Female voice'
          : 'Deep male voice')
    );
    setProdGenre(item.genre);
    setProdVocalStyle(item.vocalStyle);
    setProdMediaType(inferMediaTypeFromDrop(item));
    setProdOriginalFileName(item.originalFileName || '');
    setProdFileSizeBytes(item.fileSizeBytes || 0);
    setProdBpm(item.bpm);
    setProdDurationSec(item.durationSec);
    setProdKey(item.musicalKey);
    setProdTagsText(item.tags.join(', '));
    setProdStdPrice(item.standardPriceUsd);
    setProdComPrice(item.commercialPriceUsd);
    setProdExcPrice(item.exclusivePriceUsd);
    setProdCoverImage(item.coverImage);
    setProdAudioId(item.audioFileId);
    setProdAudioFormat(item.audioFormat);
    setProdSampleRate(item.sampleRate);
    setProdFeatured(item.featured);
  };

  const handleSaveCatalogProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !canManageCatalog) return;
    setErrorNotice('');

    const cleanTitle = prodTitle.trim().slice(0, 120);
    const cleanVoice = prodVoice.trim().slice(0, 80) || 'Studio Talent';
    const cleanGenre = prodGenre.trim().slice(0, 40) || 'Club & Street Mix';
    const cleanVocalStyle = prodVocalStyle.trim().slice(0, 40) || 'Studio Master';
    const cleanBpm = Math.max(0, Math.min(300, Math.round(Number(prodBpm) || 0)));
    const cleanDuration = Math.max(0, Math.min(7200, Math.round(Number(prodDurationSec) || 0)));
    const cleanKey = prodKey.trim().slice(0, 16) || 'Am';
    const parsedTags = prodTagsText
      .split(',')
      .map((t) => t.trim().slice(0, 32))
      .filter(Boolean)
      .slice(0, 10);
    const cleanTags = parsedTags.length > 0 ? parsedTags : [cleanGenre.toLowerCase()];

    const stdPrice = Math.max(1, Number((Number(prodStdPrice) || 29).toFixed(2)));
    const comPrice = Math.max(1, Number((Number(prodComPrice) || 79).toFixed(2)));
    const excPrice = Math.max(1, Number((Number(prodExcPrice) || 249).toFixed(2)));
    const cleanCover = prodCoverImage.trim().slice(0, 300) || COVER_IMAGE_PRESETS[0].url;
    const cleanFormat = prodAudioFormat.trim().slice(0, 20) || 'WAV 24-bit';
    const cleanSampleRate = prodSampleRate.trim().slice(0, 30) || '48 kHz';

    if (cleanTitle.length < 2) {
      setErrorNotice('Product title must be at least 2 characters.');
      return;
    }

    setSavingProduct(true);
    const targetId = editingProductId || `drop_${Date.now()}`;
    const audioId = prodAudioId.trim().slice(0, 128) || `synth-${targetId}`;
    const alreadyInCloud = cloudDropIds.includes(targetId);

    try {
      if (editingProductId && alreadyInCloud) {
        await updateDoc(doc(db, 'drops', targetId), {
          title: cleanTitle,
          voiceTalent: cleanVoice,
          voiceCategory: prodVoiceCategory,
          genre: cleanGenre,
          vocalStyle: cleanVocalStyle,
          bpm: cleanBpm,
          durationSec: cleanDuration,
          musicalKey: cleanKey,
          tags: cleanTags,
          standardPriceUsd: stdPrice,
          commercialPriceUsd: comPrice,
          exclusivePriceUsd: excPrice,
          coverImage: cleanCover,
          audioFileId: audioId,
          audioFormat: cleanFormat,
          sampleRate: cleanSampleRate,
          mediaType: prodMediaType,
          originalFileName: prodOriginalFileName.slice(0, 200),
          fileSizeBytes: Math.max(0, Number(prodFileSizeBytes) || 0),
          featured: prodFeatured,
          updatedAt: serverTimestamp(),
        });
        notifyUser(`Updated "${cleanTitle}" (${prodVoiceCategory}) and pricing tiers in Firestore.`);
      } else {
        await setDoc(doc(db, 'drops', targetId), {
          id: targetId,
          title: cleanTitle,
          voiceTalent: cleanVoice,
          voiceCategory: prodVoiceCategory,
          genre: cleanGenre,
          vocalStyle: cleanVocalStyle,
          bpm: cleanBpm,
          durationSec: cleanDuration,
          musicalKey: cleanKey,
          tags: cleanTags,
          standardPriceUsd: stdPrice,
          commercialPriceUsd: comPrice,
          exclusivePriceUsd: excPrice,
          coverImage: cleanCover,
          audioFileId: audioId,
          audioFormat: cleanFormat,
          sampleRate: cleanSampleRate,
          mediaType: prodMediaType,
          originalFileName: prodOriginalFileName.slice(0, 200),
          fileSizeBytes: Math.max(0, Number(prodFileSizeBytes) || 0),
          featured: prodFeatured,
          archived: false,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notifyUser(
          editingProductId
            ? `Saved "${cleanTitle}" (${prodVoiceCategory}) to Firestore catalog.`
            : `Added new ${prodVoiceCategory} product "${cleanTitle}" to the live storefront.`
        );
      }
      resetProductForm();
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Unable to save product to Firestore.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleArchiveOrDeleteDrop = async (item: DropProduct) => {
    if (!user || (!isAdmin && !(isCreator && item.createdBy === user.uid))) return;
    setErrorNotice('');
    const isSeedItem = INITIAL_DROPS.some((s) => s.id === item.id);
    const inCloud = cloudDropIds.includes(item.id);

    try {
      if (!isSeedItem && inCloud) {
        await deleteDoc(doc(db, 'drops', item.id));
        if (editingProductId === item.id) resetProductForm();
        setConfirmDeleteDropId(null);
        notifyUser(`Deleted "${item.title}" from the catalog.`);
      } else if (isAdmin) {
        const nextArchived = !Boolean(item.archived);
        if (inCloud) {
          await updateDoc(doc(db, 'drops', item.id), {
            archived: nextArchived,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'drops', item.id), {
            ...item,
            archived: nextArchived,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        setConfirmDeleteDropId(null);
        notifyUser(
          nextArchived
            ? `Archived "${item.title}" (hidden from storefront).`
            : `Restored "${item.title}" to the live storefront.`
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `drops/${item.id}`);
    }
  };

  const handleDeleteReviewAdmin = async (reviewId: string) => {
    if (!user || !isAdmin) return;
    setErrorNotice('');
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      setConfirmDeleteReviewId(null);
      notifyUser('Customer review removed by admin.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reviews/${reviewId}`);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Order ID', 'Buyer', 'DJ Handle', 'Country', 'Subtotal USD'];
    if (includeTaxCols) headers.push('Tax Type', 'Tax Rate %', 'Tax USD', 'Reverse Charge');
    headers.push('Total USD');
    if (includeGatewayCols) headers.push('Payment Method', 'Currency', 'Payout Status');

    const rows = filteredReportOrders.map((o) => {
      const base = [
        o.id,
        `"${o.buyerName.replace(/"/g, '""')}"`,
        `"${o.djHandle.replace(/"/g, '""')}"`,
        `"${o.countryName.replace(/"/g, '""')}"`,
        o.subtotalUsd.toFixed(2),
      ];
      if (includeTaxCols) {
        base.push(
          o.taxType,
          (o.taxRate * 100).toFixed(2),
          o.taxAmountUsd.toFixed(2),
          o.reverseChargeApplied ? 'Yes' : 'No'
        );
      }
      base.push(o.totalUsd.toFixed(2));
      if (includeGatewayCols) {
        base.push(
          `"${getPaymentMethodLabel(o.paymentMethod).replace(/"/g, '""')}"`,
          o.currency || 'USD',
          o.paymentStatus
        );
      }
      return base.join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-dj-drops-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifyUser(`Exported ${filteredReportOrders.length} rows to CSV.`);
  };

  const handleSendReportSummary = async () => {
    if (!user || !reportClientEmail.includes('@')) {
      setErrorNotice('Enter a valid recipient email for the custom report summary.');
      return;
    }
    const totalSum = filteredReportOrders.reduce((s, o) => s + o.totalUsd, 0);
    const taxSum = filteredReportOrders.reduce((s, o) => s + o.taxAmountUsd, 0);
    const subject = `Quality DJ Drops Worldwide Sales & Tax Report (${filteredReportOrders.length} Orders)`;
    const previewBody = `Summary Report: ${filteredReportOrders.length} transactions totaling $${totalSum.toFixed(2)} USD (Tax collected: $${taxSum.toFixed(2)} USD). Territory filter: ${reportCountryFilter}. Tier filter: ${reportTierFilter}.`;

    const idToken = await user.getIdToken();
    const res = await fetch('/api/notifications/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        recipientEmail: reportClientEmail.trim(),
        subject,
        milestone: 'Custom Report',
        previewBody,
      }),
    });
    const data = res.ok ? await res.json() : { deliveryStatus: 'logged_sandbox' };
    const logId = `eml_${Date.now()}`;
    await setDoc(doc(db, 'emailLogs', logId), {
      id: logId,
      ownerUid: user.uid,
      recipientEmail: reportClientEmail.trim(),
      subject,
      milestone: 'Custom Report',
      relatedRequestId: '',
      relatedOrderId: '',
      deliveryStatus: data.deliveryStatus === 'sent_smtp' ? 'sent_smtp' : 'logged_sandbox',
      previewBody,
      createdAt: serverTimestamp(),
    });
    setReportClientEmail('');
    notifyUser('Report summary sent and logged in Email Notifications.');
  };

  const handleSendManualEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !emailTo.includes('@') || !emailSubject.trim() || !emailBody.trim()) return;
    setSendingEmail(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientEmail: emailTo.trim(),
          subject: emailSubject.trim(),
          milestone: 'Client Communication',
          previewBody: emailBody.trim(),
        }),
      });
      const data = res.ok ? await res.json() : { deliveryStatus: 'logged_sandbox' };
      const logId = `eml_${Date.now()}`;
      await setDoc(doc(db, 'emailLogs', logId), {
        id: logId,
        ownerUid: user.uid,
        recipientEmail: emailTo.trim(),
        subject: emailSubject.trim(),
        milestone: 'Client Communication',
        relatedRequestId: '',
        relatedOrderId: '',
        deliveryStatus: data.deliveryStatus === 'sent_smtp' ? 'sent_smtp' : 'logged_sandbox',
        previewBody: emailBody.trim(),
        createdAt: serverTimestamp(),
      });
      setEmailTo('');
      setEmailSubject('');
      setEmailBody('');
      notifyUser('Client notification email dispatched and recorded.');
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Failed to dispatch email.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSaveEmailTemplates = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setErrorNotice('');
    setSavingEmailTemplates(true);

    try {
      const normalizedMilestones: Record<RequestMilestone, MilestoneEmailTemplate> = {
        Submitted: {
          subject:
            tplMilestones.Submitted.subject.trim().slice(0, 200) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates.Submitted.subject,
          body:
            tplMilestones.Submitted.body.trim().slice(0, 1500) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates.Submitted.body,
        },
        'Script Approved': {
          subject:
            tplMilestones['Script Approved'].subject.trim().slice(0, 200) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates['Script Approved'].subject,
          body:
            tplMilestones['Script Approved'].body.trim().slice(0, 1500) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates['Script Approved'].body,
        },
        'Voicing & FX': {
          subject:
            tplMilestones['Voicing & FX'].subject.trim().slice(0, 200) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates['Voicing & FX'].subject,
          body:
            tplMilestones['Voicing & FX'].body.trim().slice(0, 1500) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates['Voicing & FX'].body,
        },
        Mastering: {
          subject:
            tplMilestones.Mastering.subject.trim().slice(0, 200) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates.Mastering.subject,
          body:
            tplMilestones.Mastering.body.trim().slice(0, 1500) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates.Mastering.body,
        },
        Delivered: {
          subject:
            tplMilestones.Delivered.subject.trim().slice(0, 200) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates.Delivered.subject,
          body:
            tplMilestones.Delivered.body.trim().slice(0, 1500) ||
            DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates.Delivered.body,
        },
      };

      const safeAccent = /^#[0-9a-fA-F]{6}$/.test(tplAccentColor.trim())
        ? tplAccentColor.trim()
        : '#F59E0B';

      await setDoc(doc(db, 'emailTemplates', 'default'), {
        id: 'default',
        brandName:
          tplBrandName.trim().slice(0, 80) || DEFAULT_EMAIL_TEMPLATE_CONFIG.brandName,
        brandTagline: tplBrandTagline.trim().slice(0, 120),
        accentColor: safeAccent,
        senderName:
          tplSenderName.trim().slice(0, 80) || DEFAULT_EMAIL_TEMPLATE_CONFIG.senderName,
        replyToEmail:
          tplReplyToEmail.trim().slice(0, 160) ||
          user.email ||
          DEFAULT_EMAIL_TEMPLATE_CONFIG.replyToEmail,
        logoUrl: tplLogoUrl.trim().slice(0, 300),
        footerText: tplFooterText.trim().slice(0, 400),
        milestoneTemplates: normalizedMilestones,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });

      notifyUser('Milestone email branding and message templates saved to Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'emailTemplates/default');
    } finally {
      setSavingEmailTemplates(false);
    }
  };

  const handleResetMilestoneTemplate = (milestone: RequestMilestone) => {
    setTplMilestones((prev) => ({
      ...prev,
      [milestone]: { ...DEFAULT_EMAIL_TEMPLATE_CONFIG.milestoneTemplates[milestone] },
    }));
    notifyUser(`Reset "${milestone}" email template to default copy (save to publish).`);
  };

  const handleSendTestTemplateEmail = async () => {
    if (!user || !isAdmin) return;
    const recipient = (testTemplateEmail || user.email || '').trim();
    if (!recipient.includes('@')) {
      setErrorNotice('Enter a valid email address to receive the test milestone preview.');
      return;
    }

    setSendingTestTemplate(true);
    setErrorNotice('');
    try {
      const idToken = await user.getIdToken();
      const previewBody = liveEmailPreview.textBody.slice(0, 1000);
      const res = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientEmail: recipient,
          subject: liveEmailPreview.subject,
          milestone: `Test: ${selectedTplMilestone}`,
          previewBody,
          htmlBody: liveEmailPreview.htmlBody,
          senderName: draftEmailConfig.senderName,
          replyToEmail: draftEmailConfig.replyToEmail,
        }),
      });
      const data = res.ok ? await res.json() : { deliveryStatus: 'logged_sandbox' };
      const logId = `eml_${Date.now()}`;
      await setDoc(doc(db, 'emailLogs', logId), {
        id: logId,
        ownerUid: user.uid,
        recipientEmail: recipient,
        subject: liveEmailPreview.subject,
        milestone: `Test: ${selectedTplMilestone}`,
        relatedRequestId: '',
        relatedOrderId: '',
        deliveryStatus: data.deliveryStatus === 'sent_smtp' ? 'sent_smtp' : 'logged_sandbox',
        previewBody,
        createdAt: serverTimestamp(),
      });
      notifyUser(
        `Sent test "${selectedTplMilestone}" branded email to ${recipient} and logged receipt.`
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Failed to send test template email.');
    } finally {
      setSendingTestTemplate(false);
    }
  };

  const handleSaveTeamMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin || !memberUid.trim() || !memberName.trim()) return;
    const cleanUid = memberUid.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    try {
      await setDoc(doc(db, 'teamMembers', cleanUid), {
        uid: cleanUid,
        displayName: memberName.trim().slice(0, 100),
        role: memberRole,
        specialty: memberSpecialty.trim().slice(0, 100) || 'Audio Production',
        active: true,
        assignedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setMemberUid('');
      setMemberName('');
      notifyUser(`Assigned role "${memberRole}" to collaborator ${cleanUid}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `teamMembers/${cleanUid}`);
    }
  };

  const handleToggleMemberActive = async (member: TeamMember) => {
    if (!user || !isAdmin) return;
    try {
      await updateDoc(doc(db, 'teamMembers', member.uid), {
        active: !member.active,
        assignedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      notifyUser(`${member.displayName} is now ${!member.active ? 'active' : 'suspended'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `teamMembers/${member.uid}`);
    }
  };

  const handleSaveGatewaySettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    try {
      await setDoc(doc(db, 'studioSettings', 'gateway'), {
        payoutStatus,
        gatewayProvider,
        adminPayoutMethod,
        merchantAccountLabel: merchantAccountLabel.trim().slice(0, 120) || 'Deferred Payout Mode',
        payoutCurrency: payoutCurrency.slice(0, 8),
        settlementEmail: settlementEmail.trim().slice(0, 160) || user.email || 'djizeerunkx21062002@gmail.com',
        whatsappSupport: '+256784903051',
        autoTaxCompliance,
        autoMilestoneEmails,
        payoutEmailAlerts,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'publicConfig', 'storefront'), {
        payoutStatus,
        gatewayModeLabel:
          payoutStatus === 'connected'
            ? `${gatewayProvider.toUpperCase()} Connected (${payoutCurrency})`
            : 'Gateway Ready · Payout Account Pending',
        autoTaxCompliance,
        updatedAt: serverTimestamp(),
      });
      notifyUser('Payment gateway and international compliance settings saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'studioSettings/gateway');
    }
  };

  const handleTogglePayoutEmailAlerts = async () => {
    const nextValue = !payoutEmailAlerts;
    setPayoutEmailAlerts(nextValue);

    if (user && isAdmin) {
      try {
        if (gatewaySettings) {
          await updateDoc(doc(db, 'studioSettings', 'gateway'), {
            payoutEmailAlerts: nextValue,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'studioSettings', 'gateway'), {
            payoutStatus,
            gatewayProvider,
            adminPayoutMethod,
            merchantAccountLabel: merchantAccountLabel.trim().slice(0, 120) || 'Deferred Payout Mode',
            payoutCurrency: payoutCurrency.slice(0, 8),
            settlementEmail: settlementEmail.trim().slice(0, 160) || user.email || 'djizeerunkx21062002@gmail.com',
            whatsappSupport: '+256784903051',
            autoTaxCompliance,
            autoMilestoneEmails,
            payoutEmailAlerts: nextValue,
            updatedBy: user.uid,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'studioSettings/gateway');
      }
    }

    notifyUser(
      nextValue
        ? 'Payout email alerts enabled for requests and settlements.'
        : 'Payout email alerts paused.'
    );
  };

  const handleInitiatePayout = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !canWithdrawPayouts) return;
    setErrorNotice('');

    const parsedAmount = Number(payoutAmountInput || payoutAnalytics.pendingEarningsUsd);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorNotice('Enter a valid positive payout amount in USD.');
      return;
    }
    if (!payoutDestination.trim()) {
      setErrorNotice('Enter a payout destination account, email, or Mobile Money number.');
      return;
    }

    const grossAmount = Number(parsedAmount.toFixed(2));
    const withdrawalFeeRate = isCreator ? 0.07 : 0;
    const withdrawalFeeUsd = Number((grossAmount * withdrawalFeeRate).toFixed(2));
    const netPayoutUsd = Number((grossAmount - withdrawalFeeUsd).toFixed(2));

    setSubmittingPayout(true);
    const payoutId = `pay_${Date.now()}`;
    try {
      const payload: PayoutRequest = {
        id: payoutId,
        producerUid: user.uid,
        producerName: (user.displayName || (isCreator ? 'Co-Creator' : 'Studio Producer')).slice(0, 100),
        producerEmail: (user.email || 'producer@dropvault.audio').slice(0, 160),
        amountUsd: grossAmount,
        withdrawalFeeRate,
        withdrawalFeeUsd,
        netPayoutUsd,
        countryCode: payoutCountryCode.slice(0, 32),
        regionSummary: `${payoutJurisdiction.country} (${payoutRegionScope})`.slice(0, 200),
        payoutMethod: payoutRequestMethod,
        destinationAccount: payoutDestination.trim().slice(0, 160),
        currency: payoutReqCurrency.slice(0, 8),
        status: 'Requested',
        notes: payoutNotes.trim().slice(0, 500),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'payoutRequests', payoutId), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `payoutRequests/${payoutId}`);
      }

      if (payoutEmailAlerts) {
        const idToken = await user.getIdToken();
        const subject = `Payout Request ${payoutId} Initiated ($${payload.amountUsd.toFixed(2)} USD)`;
        const feeNote =
          withdrawalFeeUsd > 0
            ? ` After the 7% platform withdrawal fee ($${withdrawalFeeUsd.toFixed(2)} USD to Admin), net settlement is $${netPayoutUsd.toFixed(2)} USD.`
            : '';
        const previewBody = `${payload.producerName} initiated a global payout request of $${payload.amountUsd.toFixed(2)} USD (${payload.currency}) to ${payoutJurisdiction.country} via ${getPaymentMethodLabel(payload.payoutMethod)} (${payload.destinationAccount}).${feeNote}`;

        const emailRes = await fetch('/api/notifications/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            recipientEmail: payload.producerEmail,
            subject,
            milestone: 'Payout Requested',
            previewBody,
          }),
        });
        const emailData = emailRes.ok ? await emailRes.json() : { deliveryStatus: 'logged_sandbox' };
        const logId = `eml_${Date.now()}`;
        try {
          await setDoc(doc(db, 'emailLogs', logId), {
            id: logId,
            ownerUid: user.uid,
            recipientEmail: payload.producerEmail,
            subject,
            milestone: 'Payout Requested',
            relatedRequestId: '',
            relatedOrderId: payoutId,
            deliveryStatus: emailData.deliveryStatus === 'sent_smtp' ? 'sent_smtp' : 'logged_sandbox',
            previewBody,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `emailLogs/${logId}`);
        }
      }

      setPayoutAmountInput('');
      setPayoutNotes('');
      notifyUser(
        `Global payout ${payoutId} requested for $${grossAmount.toFixed(2)} USD${
          withdrawalFeeUsd > 0 ? ` (7% Admin fee $${withdrawalFeeUsd.toFixed(2)} -> Net $${netPayoutUsd.toFixed(2)} USD)` : ''
        }${payoutEmailAlerts ? ' & email alert dispatched.' : '.'}`
      );
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Unable to initiate payout request.');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleUpdatePayoutStatus = async (
    payout: PayoutRequest,
    nextStatus: 'Processing' | 'Settled' | 'Rejected',
    adminMethodOverride?: 'bank_transfer' | 'mobile_money'
  ) => {
    if (!user || !isAdmin) return;
    const chosenMethod = adminMethodOverride || payout.payoutMethod;
    try {
      await updateDoc(doc(db, 'payoutRequests', payout.id), {
        status: nextStatus,
        payoutMethod: chosenMethod,
        updatedAt: serverTimestamp(),
      });

      if (payoutEmailAlerts) {
        try {
          const idToken = await user.getIdToken();
          const subject = `Payout ${payout.id} Marked ${nextStatus} ($${payout.amountUsd.toFixed(2)} USD)`;
          const previewBody = `Your payout request ${payout.id} for $${payout.amountUsd.toFixed(2)} USD (${payout.currency}) is now ${nextStatus} via ${getPaymentMethodLabel(chosenMethod)} to ${payout.destinationAccount}.`;

          const emailRes = await fetch('/api/notifications/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              recipientEmail: payout.producerEmail,
              subject,
              milestone: `Payout ${nextStatus}`,
              previewBody,
            }),
          });
          const emailData = emailRes.ok ? await emailRes.json() : { deliveryStatus: 'logged_sandbox' };
          const logId = `eml_${Date.now()}`;
          await setDoc(doc(db, 'emailLogs', logId), {
            id: logId,
            ownerUid: payout.producerUid,
            recipientEmail: payout.producerEmail,
            subject,
            milestone: `Payout ${nextStatus}`,
            relatedRequestId: '',
            relatedOrderId: payout.id,
            deliveryStatus: emailData.deliveryStatus === 'sent_smtp' ? 'sent_smtp' : 'logged_sandbox',
            previewBody,
            createdAt: serverTimestamp(),
          });
        } catch (emailErr) {
          console.error('Payout status email alert error:', emailErr);
        }
      }

      notifyUser(
        `Payout ${payout.id} marked ${nextStatus} via ${getPaymentMethodLabel(chosenMethod)}${
          payoutEmailAlerts ? ' & email alert sent.' : '.'
        }`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `payoutRequests/${payout.id}`);
    }
  };

  const handleExportPendingPayoutsCsv = () => {
    if (pendingPayoutRequests.length === 0) {
      setErrorNotice('No pending payout requests (Requested or Processing) to export.');
      return;
    }

    const csvEscape = (value: unknown) =>
      `"${String(value ?? '').replace(/"/g, '""')}"`;

    const formatCsvTimestamp = (ts: unknown) => {
      if (!ts) return '';
      if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
        return (ts as { toDate: () => Date }).toDate().toISOString();
      }
      if (ts instanceof Date) return ts.toISOString();
      if (typeof ts === 'string') return ts;
      return '';
    };

    const headers = [
      'Request ID',
      'Seller / Producer',
      'Email',
      'Country / Region Scope',
      'Gross Amount USD',
      'Admin Withdrawal Fee (7%) USD',
      'Net Payout USD',
      'Settlement Currency',
      'Payout Method',
      'Destination Account',
      'Status',
      'Notes',
      'Created At',
    ];

    const rows = pendingPayoutRequests.map((pay) =>
      [
        csvEscape(pay.id),
        csvEscape(pay.producerName),
        csvEscape(pay.producerEmail),
        csvEscape(pay.regionSummary),
        pay.amountUsd.toFixed(2),
        (pay.withdrawalFeeUsd || 0).toFixed(2),
        (pay.netPayoutUsd ?? pay.amountUsd).toFixed(2),
        csvEscape(pay.currency || 'USD'),
        csvEscape(getPaymentMethodLabel(pay.payoutMethod)),
        csvEscape(pay.destinationAccount),
        csvEscape(pay.status),
        csvEscape(pay.notes),
        csvEscape(formatCsvTimestamp(pay.createdAt)),
      ].join(',')
    );

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-dj-drops-pending-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifyUser(
      `Downloaded CSV with ${pendingPayoutRequests.length} pending payout request${
        pendingPayoutRequests.length === 1 ? '' : 's'
      } for external bookkeeping.`
    );
  };

  const handleCreatePromoCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setErrorNotice('');
    const cleanCode = promoCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
    if (cleanCode.length < 3) {
      setErrorNotice('Promo code must be at least 3 alphanumeric characters.');
      return;
    }
    const discount = Math.max(1, Math.min(90, Math.round(Number(promoDiscountPercent) || 20)));
    const minSub = Math.max(0, Math.min(10000, Number((Number(promoMinSubtotal) || 0).toFixed(2))));
    const desc = promoDescription.trim().slice(0, 140) || `${discount}% Studio Discount`;

    setSavingPromo(true);
    try {
      await setDoc(doc(db, 'promoCodes', cleanCode), {
        id: cleanCode,
        code: cleanCode,
        discountPercent: discount,
        minSubtotalUsd: minSub,
        description: desc,
        active: true,
        usageCount: 0,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('create_promo', cleanCode, `Created promo ${cleanCode} (${discount}% off, min $${minSub})`);
      setPromoCodeInput('');
      notifyUser(`Promo code ${cleanCode} created (${discount}% off orders over $${minSub}).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `promoCodes/${cleanCode}`);
    } finally {
      setSavingPromo(false);
    }
  };

  const handleTogglePromoActive = async (promo: PromoCode) => {
    if (!user || !isAdmin) return;
    setErrorNotice('');
    const nextState = !promo.active;
    try {
      await updateDoc(doc(db, 'promoCodes', promo.id), {
        active: nextState,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('toggle_promo', promo.id, `Set promo ${promo.code} active to ${nextState}`);
      notifyUser(`Promo ${promo.code} is now ${nextState ? 'active' : 'paused'}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `promoCodes/${promo.id}`);
    }
  };

  const handleDeletePromo = async (promoId: string) => {
    if (!user || !isAdmin) return;
    setErrorNotice('');
    try {
      await deleteDoc(doc(db, 'promoCodes', promoId));
      await logAdminAction('delete_promo', promoId, `Deleted promo code ${promoId}`);
      setConfirmDeletePromoId(null);
      notifyUser(`Deleted promo code ${promoId}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `promoCodes/${promoId}`);
    }
  };

  const handleUpdateUserRole = async (targetUser: UserProfileRecord, newRole: UserRole) => {
    if (!user || !isAdmin) return;
    setErrorNotice('');
    setSavingUserRole(true);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('update_user_role', targetUser.uid, `Changed role of ${targetUser.email} to ${newRole}`);
      setSelectedUserForRoleEdit(null);
      notifyUser(`Updated role for ${targetUser.displayName || targetUser.email} to "${newRole}".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    } finally {
      setSavingUserRole(false);
    }
  };

  const handleUpdateOrderStatus = async (order: OrderRecord, newStatus: OrderRecord['paymentStatus']) => {
    if (!user || !isAdmin) return;
    setErrorNotice('');
    setUpdatingOrderId(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        paymentStatus: newStatus,
        updatedAt: serverTimestamp(),
      });
      await logAdminAction('update_order_status', order.id, `Updated order ${order.id} status to ${newStatus}`);
      notifyUser(`Order ${order.id} payment status changed to "${newStatus}".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleResendOrderReceipt = async (order: OrderRecord) => {
    if (!user || !isAdmin) return;
    setErrorNotice('');
    setResendingOrderId(order.id);
    try {
      const idToken = await user.getIdToken();
      const subject = `Order Receipt & Audio License: ${order.id} ($${order.totalUsd.toFixed(2)} USD)`;
      const itemsList = order.items.map((i) => `• ${i.title} [${i.tier.toUpperCase()}] ($${i.unitPriceUsd.toFixed(2)})`).join('\n');
      const promoLine = order.promoCode ? `Promo Code: ${order.promoCode} (Saved $${(order.discountUsd || 0).toFixed(2)})\n` : '';
      const previewBody = `Dear ${order.buyerName},\n\nHere is your receipt for Quality DJ Drops Worldwide Order ${order.id}.\nTotal Paid: $${order.totalUsd.toFixed(2)} ${order.currency}\n${promoLine}Items:\n${itemsList}\nLicense ID: ${order.licenseId}\nPayment Status: ${order.paymentStatus}\n\nCustomer Support: opioisaac21062002@gmail.com`;

      const res = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientEmail: order.buyerEmail,
          subject,
          milestone: 'Order Receipt',
          previewBody,
        }),
      });
      const data = res.ok ? await res.json() : { deliveryStatus: 'logged_sandbox' };
      const logId = `eml_${Date.now()}`;
      await setDoc(doc(db, 'emailLogs', logId), {
        id: logId,
        ownerUid: order.buyerUid,
        recipientEmail: order.buyerEmail,
        subject,
        milestone: 'Order Receipt',
        relatedRequestId: '',
        relatedOrderId: order.id,
        deliveryStatus: data.deliveryStatus === 'sent_smtp' ? 'sent_smtp' : 'logged_sandbox',
        previewBody,
        createdAt: serverTimestamp(),
      });
      await logAdminAction('resend_receipt', order.id, `Resent receipt for order ${order.id} to ${order.buyerEmail}`);
      notifyUser(`Receipt resent to ${order.buyerEmail} and logged in Email Notifications.`);
    } catch (err) {
      setErrorNotice(err instanceof Error ? err.message : 'Failed to resend order receipt.');
    } finally {
      setResendingOrderId(null);
    }
  };

  const handleSaveStorefrontCustomization = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !isAdmin) return;
    setErrorNotice('');
    setSavingStorefrontCustomization(true);
    try {
      const payload: Partial<PublicStorefrontConfig> = {
        announcementEnabled,
        announcementBadge: announcementBadge.trim().slice(0, 32) || 'VIP PROMO',
        announcementText: announcementText.trim().slice(0, 200) || 'Use code VIP20 at checkout for 20% off!',
        heroHeadline: heroHeadline.trim().slice(0, 140) || 'Own Your Sound Across 550+ Global Jurisdictions',
        heroSubheadline: heroSubheadline.trim().slice(0, 350) || 'Discover studio-mastered DJ drops, issue binding custom audio licensing agreements...',
        customRequestsEnabled,
        defaultCustomPriceUsd: Math.max(1, Math.min(5000, Number(defaultCustomPriceUsd) || 49)),
        maintenanceMode,
        maintenanceMessage: maintenanceMessage.trim().slice(0, 200) || 'Platform maintenance in progress.',
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'publicConfig', 'storefront'), payload, { merge: true });
      await logAdminAction('update_storefront_config', 'storefront', 'Updated announcement banner and hero headline');
      notifyUser('Storefront announcement banner and hero customization published.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'publicConfig/storefront');
    } finally {
      setSavingStorefrontCustomization(false);
    }
  };

  const handleToggleMaintenanceMode = async (nextMode: boolean) => {
    if (!user || !isAdmin) return;
    setErrorNotice('');
    try {
      await setDoc(
        doc(db, 'publicConfig', 'storefront'),
        {
          maintenanceMode: nextMode,
          maintenanceMessage: maintenanceMessage.trim().slice(0, 200) || 'Platform maintenance in progress.',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMaintenanceMode(nextMode);
      await logAdminAction('maintenance_mode', 'storefront', `Set maintenance mode to ${nextMode}`);
      notifyUser(nextMode ? 'Emergency maintenance mode enabled (checkout locked).' : 'Platform is live and operational.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'publicConfig/storefront');
    }
  };

  const handleExportSystemSnapshot = () => {
    if (!user || !isAdmin) return;
    const snapshot = {
      exportedAt: new Date().toISOString(),
      adminEmail: user.email,
      stats: {
        totalDrops: drops.length,
        totalOrders: orders.length,
        totalRequests: requests.length,
        totalLicenses: licenses.length,
        totalReviews: reviews.length,
        totalPayoutRequests: payoutRequests.length,
        totalUsers: userDirectory.length,
        totalPromoCodes: promoCodes.length,
        totalAdminLogs: adminLogs.length,
        totalEmailLogs: emailLogs.length,
      },
      orders,
      payoutRequests,
      promoCodes,
      userDirectory,
    };
    const jsonStr = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-dj-drops-system-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifyUser('Exported complete system state snapshot to JSON backup.');
  };

  const handleDownloadAdminAccessHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quality DJ Drops Worldwide 🌐 - Official Admin Access & Credentials</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0B0D11] text-zinc-100 min-h-screen flex flex-col items-center justify-center p-6 font-sans">
  <div class="max-w-2xl w-full bg-[#12151C] border border-zinc-800 rounded-xl p-8 shadow-2xl space-y-6">
    <h1 class="text-xl font-bold text-zinc-150">Quality DJ Drops Worldwide 🌐 - Admin Credentials</h1>
    <p class="text-sm text-zinc-400">Super Admin Email: <strong class="text-amber-400">djizeerunkx21062002@gmail.com</strong></p>
    <p class="text-xs text-zinc-400">Customer Support: opioisaac21062002@gmail.com | WhatsApp: +256784903051</p>
  </div>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admin-access.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifyUser('Downloaded admin-access.html successfully.');
  };

  const handleDownloadHomeHtml = () => {
    const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quality DJ Drops Worldwide 🌐 — Global DJ Drops & Audio Licensing</title>
    <meta name="description" content="Own and license broadcast-ready DJ drops across 500+ global jurisdictions with instant digital delivery, automated tax compliance, and studio production workflows." />
  </head>
  <body class="bg-[#0B0D11] text-zinc-100 antialiased">
    <div style="text-align:center; padding: 60px; font-family: sans-serif;">
      <h1>Quality DJ Drops Worldwide 🌐 Home File</h1>
      <p>Official store home template. Access the live app at your deployment URL.</p>
    </div>
  </body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifyUser('Downloaded index.html home file successfully.');
  };

  const handleExportAdminLogsCsv = () => {
    if (adminLogs.length === 0) {
      setErrorNotice('No administrative activity logs to export.');
      return;
    }
    const headers = ['Log ID', 'Timestamp', 'Actor Email', 'Actor UID', 'Action', 'Target ID', 'Details'];
    const rows = adminLogs.map((log) => [
      `"${log.id}"`,
      `"${formatPayoutDate(log.createdAt)}"`,
      `"${(log.actorEmail || '').replace(/"/g, '""')}"`,
      `"${log.actorUid}"`,
      `"${log.action.replace(/"/g, '""')}"`,
      `"${log.targetId.replace(/"/g, '""')}"`,
      `"${log.details.replace(/"/g, '""')}"`,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-dj-drops-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notifyUser(`Exported ${adminLogs.length} admin activity log entries to CSV.`);
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-lg bg-[#12151C] border border-zinc-800 flex items-center justify-center">
          <Shield className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-zinc-100">Studio &amp; Client Portal</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
          Sign in with Email, Google, or Direct Admin Access to view sales analytics, manage custom DJ drop milestones, access signed audio licenses, and configure payout accounts.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => (onOpenAuth ? onOpenAuth('signin') : signInWithGoogle())}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm rounded-md transition-colors"
          >
            Sign In / Email &amp; Google
          </button>
          <button
            type="button"
            onClick={() => (onOpenAuth ? onOpenAuth('signup') : signInWithGoogle())}
            className="px-5 py-2.5 bg-[#12151C] border border-zinc-800 hover:border-amber-500 text-zinc-100 font-semibold text-sm rounded-md transition-colors"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() =>
              onOpenAdminLogin
                ? onOpenAdminLogin()
                : onOpenAuth
                ? onOpenAuth('admin')
                : signInWithGoogle('djizeerunkx21062002@gmail.com')
            }
            className="px-5 py-2.5 bg-[#12151C] border border-amber-500/40 hover:border-amber-500 text-amber-400 font-semibold text-sm rounded-md transition-colors inline-flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4" />
            <span>Direct Admin Login</span>
          </button>
          <button
            type="button"
            onClick={onBackToStorefront}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-md transition-colors"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  type NavItem = {
    id: DashboardTab;
    label: string;
    group: string;
    icon: typeof BarChart3;
    show: boolean;
    badge?: number;
  };

  const navItems: NavItem[] = [
    { id: 'overview', label: isAdmin ? 'Executive Overview' : 'Sales & Analytics', group: 'Executive Suite', icon: BarChart3, show: true },
    { id: 'creator_signup', label: 'Sell as Co-Creator', group: 'Executive Suite', icon: UserPlus, show: userRole === 'client' },
    { id: 'orders', label: 'Orders & Downloads', group: 'Commerce & Finance', icon: Download, show: true, badge: orders.length || undefined },
    { id: 'payouts', label: isCreator ? 'Global Payouts' : 'Payouts & Settlement', group: 'Commerce & Finance', icon: Wallet, show: canWithdrawPayouts, badge: pendingPayoutRequests.length || undefined },
    { id: 'promos', label: 'Promo & Discount Codes', group: 'Commerce & Finance', icon: Tag, show: isAdmin, badge: promoCodes.filter((p) => p.active).length || undefined },
    { id: 'reports', label: 'Custom Reports', group: 'Commerce & Finance', icon: FileSpreadsheet, show: true },
    { id: 'catalog', label: 'Catalog & Products', group: 'Catalog & Production', icon: Disc3, show: canManageCatalog, badge: isAdmin ? drops.length || undefined : undefined },
    { id: 'requests', label: 'Client Requests', group: 'Catalog & Production', icon: SlidersHorizontal, show: true, badge: analytics.activeRequests || undefined },
    { id: 'storage', label: 'Cloud Media Storage', group: 'Catalog & Production', icon: FileAudio, show: canManageCatalog },
    { id: 'licensing', label: 'Audio Licensing', group: 'Catalog & Production', icon: FileCheck2, show: true },
    { id: 'users', label: 'User Directory & Roles', group: 'Access & Governance', icon: Users, show: isAdmin, badge: userDirectory.length || undefined },
    { id: 'team', label: 'Team & Roles', group: 'Access & Governance', icon: Users, show: isAdmin },
    { id: 'audit_logs', label: 'Security & Activity Logs', group: 'Access & Governance', icon: Shield, show: isAdmin },
    { id: 'emails', label: 'Email Notifications', group: 'Platform & CMS', icon: Mail, show: true },
    { id: 'settings', label: 'Payment, Tax & Storefront', group: 'Platform & CMS', icon: Settings, show: isAdmin },
    { id: 'system_ops', label: 'System Ops & Diagnostics', group: 'Platform & CMS', icon: SlidersHorizontal, show: isAdmin },
  ];

  const visibleNavItems = navItems.filter((n) => n.show);
  const navGroups = Array.from(new Set(visibleNavItems.map((n) => n.group)));
  const activeNavMeta = visibleNavItems.find((n) => n.id === activeTab) || visibleNavItems[0];

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 bg-[#12151C] border border-zinc-800 rounded-lg p-4 space-y-5">
          <div className="pb-4 border-b border-zinc-800 space-y-1">
            <div className="text-sm font-semibold text-zinc-100 truncate">
              {user.displayName || user.email}
            </div>
            <div className="text-xs text-zinc-400 truncate">{user.email}</div>
            <div className="text-xs font-mono text-amber-400 pt-1">
              {isAdmin
                ? 'Super Admin'
                : userRole === 'creator'
                ? 'Co-Creator (95%)'
                : userRole.replace('_', ' ')}
            </div>
          </div>

          {isAdmin ? (
            <nav className="space-y-4" aria-label="Admin workspace navigation">
              {navGroups.map((group) => (
                <div key={group} className="space-y-1">
                  <div className="px-3 text-[11px] font-medium text-zinc-500">
                    {group}
                  </div>
                  {visibleNavItems
                    .filter((item) => item.group === group)
                    .map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            active
                              ? 'bg-amber-500 text-zinc-950 font-semibold'
                              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge !== undefined && (
                            <span
                              className={`text-[11px] font-mono tabular-nums shrink-0 ${
                                active ? 'text-zinc-950/80' : 'text-zinc-500'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              ))}
            </nav>
          ) : (
            <nav className="space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-amber-500 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Compact Theme Picker inside Portal */}
          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Studio Theme</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {STUDIO_THEMES.map((theme) => {
                const active = themeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    title={theme.name}
                    aria-label={`Select ${theme.name} theme`}
                    onClick={() => onSelectTheme(theme.id)}
                    className={`h-7 rounded-md border flex items-center justify-center transition-all ${
                      active ? 'border-amber-500 ring-1 ring-amber-500' : 'border-zinc-800 hover:border-zinc-600'
                    }`}
                    style={{ backgroundColor: theme.canvasSwatch }}
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: theme.accentSwatch }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <a
              href="mailto:opioisaac21062002@gmail.com"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md hover:bg-amber-500/20 transition-colors truncate"
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">opioisaac21062002@gmail.com</span>
            </a>
            <a
              href="https://wa.me/256784903051"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-md hover:bg-emerald-500/20 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp +256784903051
            </a>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="w-full px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-100 bg-[#0B0D11] border border-zinc-800 rounded-md transition-colors"
            >
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="flex-1 min-w-0 space-y-6 w-full">
          {isAdmin && (
            <div className="bg-[#12151C] border border-zinc-800 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-zinc-400 min-w-0">
                <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-zinc-300 font-medium whitespace-nowrap">Quality DJ Drops Worldwide Admin</span>
                <span>/</span>
                <span className="whitespace-nowrap hidden sm:inline">{activeNavMeta?.group}</span>
                <span className="hidden sm:inline">/</span>
                <span className="text-zinc-100 font-semibold truncate">{activeNavMeta?.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onBackToStorefront}
                  className="px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-[#0B0D11] border border-zinc-800 rounded transition-colors whitespace-nowrap"
                >
                  View Storefront
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="px-2.5 py-1 text-xs font-medium text-amber-400 hover:text-amber-300 bg-[#0B0D11] border border-zinc-800 rounded transition-colors whitespace-nowrap"
                >
                  Gateway &amp; CMS
                </button>
              </div>
            </div>
          )}

          {statusNotice && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusNotice}</span>
            </div>
          )}
          {errorNotice && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-300">
              {errorNotice}
            </div>
          )}

          {/* OVERVIEW */}
          {activeTab === 'overview' && isAdmin && (
            <AdminDashboardOverview
              orders={orders}
              requests={requests}
              payoutRequests={payoutRequests}
              drops={drops}
              licenses={licenses}
              creatorProfiles={creatorProfiles}
              creatorSales={creatorSales}
              promoCodes={promoCodes}
              userDirectory={userDirectory}
              adminLogs={adminLogs}
              storefrontConfig={storefrontConfig}
              gatewaySettings={gatewaySettings}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onSeedCatalog={handleSeedCatalogToFirestore}
              onExportSnapshot={handleExportSystemSnapshot}
              formatDate={formatPayoutDate}
            />
          )}

          {activeTab === 'overview' && !isAdmin && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100">
                    {isCreator ? 'Co-Creator Studio & Earnings' : 'Sales Analytics & Operations'}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isCreator
                      ? 'Track your drop sales (95% creator share after 5% admin fee) and request global payouts'
                      : 'Real-time revenue, international tax compliance, co-creator fees, and production workload'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {userRole === 'client' && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('creator_signup')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Sign Up as Co-Creator
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleSeedCatalogToFirestore}
                      className="px-3.5 py-2 text-xs font-medium bg-[#12151C] border border-zinc-700 hover:border-amber-500 text-zinc-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      Sync Default Catalog to Cloud
                    </button>
                  )}
                </div>
              </div>

              {userRole === 'client' && (
                <div className="bg-[#12151C] border border-amber-500/30 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-zinc-100">
                      Want to sell your own DJ drops globally on Quality DJ Drops Worldwide 🌐?
                    </div>
                    <p className="text-xs text-zinc-400">
                      Sign up as a Co-Creator to publish your drops worldwide. You keep 95% of every successful sale (5% goes to Admin) and can withdraw globally anytime (7% Admin withdrawal fee).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('creator_signup')}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Start Selling Drops
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {(isCreator
                  ? [
                      {
                        label: 'Your Net Creator Earnings (95%)',
                        value: `$${analytics.creatorNetEarningsUsd.toFixed(2)}`,
                        sub: `${creatorSales.length} drop sale${creatorSales.length === 1 ? '' : 's'}`,
                      },
                      {
                        label: 'Gross Creator Sales',
                        value: `$${analytics.creatorGrossSalesUsd.toFixed(2)}`,
                        sub: `5% Admin fee: $${analytics.adminFivePctPurchaseFeesUsd.toFixed(2)}`,
                      },
                      {
                        label: 'Available for Global Payout',
                        value: `$${payoutAnalytics.pendingEarningsUsd.toFixed(2)}`,
                        sub: '7% Admin fee applies on withdrawal',
                      },
                      {
                        label: 'Your Published Drops',
                        value: String(editableCatalogDrops.length),
                        sub: `${audioAssets.length} uploaded masters`,
                      },
                    ]
                  : [
                      {
                        label: 'Gross Volume',
                        value: `$${analytics.grossRevenue.toFixed(2)}`,
                        sub: `${analytics.orderCount} completed orders`,
                      },
                      {
                        label: 'Net Studio Sales',
                        value: `$${analytics.netRevenue.toFixed(2)}`,
                        sub: isAdmin
                          ? `+$${analytics.totalAdminFeeRevenueUsd.toFixed(2)} co-creator fees`
                          : 'Before international VAT/GST',
                      },
                      {
                        label: isAdmin ? 'Admin Fees (5% Sale + 7% Cashout)' : 'Tax Collected',
                        value: isAdmin
                          ? `$${analytics.totalAdminFeeRevenueUsd.toFixed(2)}`
                          : `$${analytics.taxCollected.toFixed(2)}`,
                        sub: isAdmin
                          ? `$${analytics.adminFivePctPurchaseFeesUsd.toFixed(2)} + $${analytics.adminSevenPctWithdrawalFeesUsd.toFixed(2)}`
                          : 'Automated multi-zone ledger',
                      },
                      {
                        label: 'Active Custom Briefs',
                        value: String(analytics.activeRequests),
                        sub: `${licenses.length} issued licenses · ${creatorProfiles.length} co-creators`,
                      },
                    ]
                ).map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-[#12151C] border border-zinc-800 rounded-lg p-5 space-y-1.5"
                  >
                    <div className="text-xs text-zinc-400">{kpi.label}</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
                      {kpi.value}
                    </div>
                    <div className="text-xs text-zinc-500">{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Revenue by Country SVG Visualization */}
              <div className="bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Revenue by Buyer Jurisdiction
                  </h3>
                  <span className="text-xs text-zinc-500 font-mono">USD Tabular</span>
                </div>
                {analytics.topCountries.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6">
                    No completed orders yet. Place a test order in the storefront bag to populate live jurisdiction analytics.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {analytics.topCountries.map((row) => {
                      const pct = Math.max(4, Math.round((row.revenue / analytics.maxCountryRev) * 100));
                      return (
                        <div key={row.country} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-300 truncate">{row.country}</span>
                            <span className="font-mono tabular-nums text-zinc-200">
                              ${row.revenue.toFixed(2)} · {row.count} order{row.count > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="h-2 bg-[#0B0D11] rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-amber-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="bg-[#12151C] border border-amber-500/30 rounded-lg p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Admin Control Center &amp; Quick Command Matrix
                        </h3>
                        <p className="text-xs text-zinc-400">
                          High-privilege actions for djizeerunkx21062002@gmail.com · Full system oversight
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-[11px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded">
                      SUPER ADMIN ACCESS ACTIVE
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Promo Code Studio */}
                    <div className="p-4 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500/40 rounded-lg space-y-3 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                          <Tag className="w-4 h-4" />
                          <span>Promo Codes Studio</span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {promoCodes.filter((p) => p.active).length} active
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Create discount coupons (e.g. VIP20), adjust percentage off, set minimum subtotal, and inspect redemption counters.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('promos')}
                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        Manage Promo Codes ({promoCodes.length})
                      </button>
                    </div>

                    {/* User Directory & Roles */}
                    <div className="p-4 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500/40 rounded-lg space-y-3 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                          <Users className="w-4 h-4" />
                          <span>User Directory &amp; Roles</span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {userDirectory.length} users
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        View registered users and co-creators, inspect regional countries, and delegate Producer, Licensing Manager, or Admin roles.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('users')}
                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5 text-cyan-400" />
                        Open User Directory
                      </button>
                    </div>

                    {/* Order & Refund Controller */}
                    <div className="p-4 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500/40 rounded-lg space-y-3 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                          <RotateCcw className="w-4 h-4" />
                          <span>Orders &amp; Refund Control</span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {orders.filter((o) => o.paymentStatus === 'refunded').length} refunded
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Adjust order payment statuses (Paid / Pending / Refunded), resend email receipts, and inspect discount audit tokens.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('orders')}
                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                        Manage Orders ({orders.length})
                      </button>
                    </div>

                    {/* Platform Fee Breakdown */}
                    <div className="p-4 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500/40 rounded-lg space-y-3 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                          <Percent className="w-4 h-4" />
                          <span>Platform Fee Ledger</span>
                        </div>
                        <span className="text-[11px] font-mono text-amber-300 font-bold">
                          ${analytics.totalAdminFeeRevenueUsd.toFixed(2)} USD
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-zinc-400">
                        <div className="flex justify-between">
                          <span>5% Co-Creator Purchase Fee:</span>
                          <span className="font-mono text-zinc-200">
                            ${analytics.adminFivePctPurchaseFeesUsd.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>7% Co-Creator Cashout Fee:</span>
                          <span className="font-mono text-zinc-200">
                            ${analytics.adminSevenPctWithdrawalFeesUsd.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('payouts')}
                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Wallet className="w-3.5 h-3.5 text-amber-400" />
                        Review Co-Creator Payouts
                      </button>
                    </div>

                    {/* Storefront Announcement & Hero CMS */}
                    <div className="p-4 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500/40 rounded-lg space-y-3 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold">
                          <Sparkles className="w-4 h-4" />
                          <span>Storefront CMS &amp; Banner</span>
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          storefrontConfig?.announcementEnabled
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {storefrontConfig?.announcementEnabled ? 'BANNER ON' : 'BANNER OFF'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        Top banner: &ldquo;{storefrontConfig?.announcementText || 'Use code VIP20 at checkout'}&rdquo;
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Settings className="w-3.5 h-3.5 text-purple-400" />
                        Edit Banner &amp; Hero CMS
                      </button>
                    </div>

                    {/* Security & Audit Trail */}
                    <div className="p-4 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500/40 rounded-lg space-y-3 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
                          <History className="w-4 h-4" />
                          <span>Security &amp; Audit Trail</span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">
                          {adminLogs.length} events
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Immutable audit logs of all price updates, promo code actions, role modifications, and receipts.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('audit_logs')}
                        className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5 text-rose-400" />
                        Inspect Security Logs
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CO-CREATOR SELLER SIGN-UP */}
          {activeTab === 'creator_signup' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSignUpAsCoCreator}
                className="xl:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4"
              >
                <div className="pb-3 border-b border-zinc-800">
                  <h2 className="text-lg font-bold text-zinc-100">
                    Co-Creator Marketplace Sign-Up
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Launch your global DJ drop storefront on Quality DJ Drops Worldwide 🌐 and get paid in any country
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Creator / Studio Brand Name
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      value={creatorBrandName}
                      onChange={(e) => setCreatorBrandName(e.target.value)}
                      placeholder="e.g. Kampala Bass Lab"
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Storefront Handle (@)
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={60}
                      value={creatorHandle}
                      onChange={(e) => setCreatorHandle(e.target.value)}
                      placeholder="e.g. kampalabass"
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <JurisdictionSelector
                  label="Your Country / Payout Jurisdiction (Global 550+ Zones)"
                  value={creatorCountryCode}
                  onChange={setCreatorCountryCode}
                />

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Primary Genres &amp; Voice Specialty
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={creatorSpecialty}
                    onChange={(e) => setCreatorSpecialty(e.target.value)}
                    placeholder="Afrobeats, Amapiano, Dancehall & Radio Imaging"
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Creator Bio (Public Storefront)
                  </label>
                  <textarea
                    rows={3}
                    maxLength={400}
                    value={creatorBio}
                    onChange={(e) => setCreatorBio(e.target.value)}
                    placeholder="Tell DJs and radio stations about your voice talent and studio rig..."
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={signingUpCreator}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                >
                  {signingUpCreator
                    ? 'Activating Co-Creator Storefront...'
                    : 'Activate Co-Creator Account & Start Selling'}
                </button>
              </form>

              <div className="xl:col-span-5 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Transparent Global Fee Split
                  </h3>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-1">
                    <div className="flex items-center justify-between font-semibold text-zinc-100">
                      <span>Per Successful Purchase</span>
                      <span className="font-mono text-emerald-400">95% to You · 5% Admin</span>
                    </div>
                    <p className="text-zinc-400">
                      Every time a buyer purchases one of your drops anywhere in the world, 5% goes to Quality DJ Drops Worldwide Admin and 95% is credited immediately to your creator balance.
                    </p>
                  </div>
                  <div className="p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-1">
                    <div className="flex items-center justify-between font-semibold text-zinc-100">
                      <span>Global Payout Withdrawal</span>
                      <span className="font-mono text-amber-400">93% Net · 7% Admin Fee</span>
                    </div>
                    <p className="text-zinc-400">
                      Withdraw earnings globally in your local currency or USD/EUR/GBP via Bank/SWIFT/IBAN, Mobile Money (MoMo, Airtel, M-Pesa), PayPal, or Stripe. A 7% withdrawal fee goes to Admin.
                    </p>
                  </div>
                  <div className="p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-1">
                    <div className="font-semibold text-zinc-100">
                      Automated Tax &amp; Licensing Included
                    </div>
                    <p className="text-zinc-400">
                      Quality DJ Drops Worldwide automatically handles VAT/GST across 550+ jurisdictions, generates serialized licenses, and hosts your 24-bit WAV masters.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CATALOG & PRODUCTS MANAGER */}
          {activeTab === 'catalog' && canManageCatalog && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100">
                    {isCreator ? 'My Creator Drops & Pricing' : 'Catalog Products, Pricing & Reviews'}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isCreator
                      ? 'Publish your DJ drops globally, batch-edit tier pricing, and earn 95% of every purchase'
                      : 'Add new DJ drops, batch-edit prices across multiple products simultaneously, and moderate reviews'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchEditMode((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md border transition-colors ${
                      batchEditMode
                        ? 'bg-amber-500 border-amber-500 text-zinc-950'
                        : 'bg-[#12151C] border-zinc-700 hover:border-amber-500 text-zinc-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    {batchEditMode ? 'Exit Batch Edit Mode' : 'Batch Edit Prices'}
                  </button>
                  {editingProductId && (
                    <button
                      type="button"
                      onClick={resetProductForm}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-md transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      New Product Mode
                    </button>
                  )}
                  <span className="text-xs font-mono text-zinc-400 tabular-nums">
                    {editableCatalogDrops.length} managed · {reviews.length} reviews
                  </span>
                </div>
              </div>

              {(batchEditMode || selectedBatchDropIds.length > 0) && (
                <div className="bg-[#12151C] border border-amber-500/40 rounded-lg p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-amber-400" />
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Batch Price Editor ({selectedBatchDropIds.length} Selected)
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Select multiple products below, edit prices inline per row or apply a bulk adjustment, then save all at once.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedBatchDropIds([])}
                        disabled={selectedBatchDropIds.length === 0}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs rounded-md"
                      >
                        Clear Selection
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveBatchPrices}
                        disabled={savingBatchPrices || selectedBatchDropIds.length === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {savingBatchPrices
                          ? 'Saving Batch...'
                          : `Save Batch Prices (${selectedBatchDropIds.length})`}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-2">
                      <div className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                        <Percent className="w-3.5 h-3.5 text-amber-400" />
                        Bulk % Price Adjustment (All Tiers on Selected)
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={200}
                          value={batchPercentInput}
                          onChange={(e) => setBatchPercentInput(e.target.value)}
                          aria-label="Percentage change"
                          className="w-24 px-2.5 py-1.5 bg-[#12151C] border border-zinc-800 rounded text-xs font-mono text-zinc-100"
                        />
                        <button
                          type="button"
                          disabled={selectedBatchDropIds.length === 0}
                          onClick={() => applyBatchPercentAdjust(1)}
                          className="px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 text-emerald-300 text-xs font-semibold rounded"
                        >
                          +{batchPercentInput || 0}% Increase
                        </button>
                        <button
                          type="button"
                          disabled={selectedBatchDropIds.length === 0}
                          onClick={() => applyBatchPercentAdjust(-1)}
                          className="px-3 py-1.5 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 text-red-300 text-xs font-semibold rounded"
                        >
                          -{batchPercentInput || 0}% Discount
                        </button>
                      </div>
                    </div>

                    <div className="p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-2">
                      <div className="text-xs font-medium text-zinc-300">
                        Set Fixed Tier Prices (Optional, applies to selected)
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          value={batchFixedStd}
                          onChange={(e) => setBatchFixedStd(e.target.value)}
                          placeholder="Std $"
                          className="w-20 px-2.5 py-1.5 bg-[#12151C] border border-zinc-800 rounded text-xs font-mono text-zinc-100"
                        />
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          value={batchFixedCom}
                          onChange={(e) => setBatchFixedCom(e.target.value)}
                          placeholder="Com $"
                          className="w-20 px-2.5 py-1.5 bg-[#12151C] border border-zinc-800 rounded text-xs font-mono text-zinc-100"
                        />
                        <input
                          type="number"
                          min={1}
                          step="0.01"
                          value={batchFixedExc}
                          onChange={(e) => setBatchFixedExc(e.target.value)}
                          placeholder="Exc $"
                          className="w-20 px-2.5 py-1.5 bg-[#12151C] border border-zinc-800 rounded text-xs font-mono text-zinc-100"
                        />
                        <button
                          type="button"
                          disabled={selectedBatchDropIds.length === 0}
                          onClick={applyBatchFixedPrices}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-100 text-xs font-medium rounded"
                        >
                          Apply Fixed
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left Column: Inventory + Customer Reviews */}
                <div className="xl:col-span-7 space-y-6">
                  <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
                    {(() => {
                      const visibleInventory = editableCatalogDrops.filter((item) => {
                        const q = catalogSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          item.title.toLowerCase().includes(q) ||
                          item.genre.toLowerCase().includes(q) ||
                          item.voiceTalent.toLowerCase().includes(q)
                        );
                      });
                      const allVisibleSelected =
                        visibleInventory.length > 0 &&
                        visibleInventory.every((d) => selectedBatchDropIds.includes(d.id));

                      return (
                        <>
                          <div className="px-5 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={() => toggleSelectAllBatch(visibleInventory)}
                                aria-label="Select all visible products for batch price editing"
                                className="accent-amber-500 w-4 h-4 cursor-pointer"
                              />
                              <Tag className="w-4 h-4 text-amber-400" />
                              <h3 className="text-sm font-semibold text-zinc-100">
                                Product Inventory ({visibleInventory.length})
                              </h3>
                            </div>
                            <input
                              type="text"
                              value={catalogSearch}
                              onChange={(e) => setCatalogSearch(e.target.value)}
                              placeholder="Filter by title, genre, voice..."
                              className="px-3 py-1.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 w-56"
                            />
                          </div>

                          {visibleInventory.length === 0 ? (
                            <div className="p-8 text-center text-xs text-zinc-500">
                              {isCreator
                                ? 'You have not published any drops yet. Use the form on the right to add your first DJ drop.'
                                : 'No catalog products match your filter.'}
                            </div>
                          ) : (
                            <div className="divide-y divide-zinc-800">
                              {visibleInventory.map((item) => {
                                const itemReviews = reviews.filter((r) => r.dropId === item.id);
                                const avgStars =
                                  itemReviews.length > 0
                                    ? itemReviews.reduce((s, r) => s + r.rating, 0) / itemReviews.length
                                    : 0;
                                const isSeedItem = INITIAL_DROPS.some((s) => s.id === item.id);
                                const inCloud = cloudDropIds.includes(item.id);
                                const isEditingThis = editingProductId === item.id;
                                const isBatchSelected = selectedBatchDropIds.includes(item.id);
                                const draftPrices = batchPriceDrafts[item.id] || {
                                  standard: String(item.standardPriceUsd),
                                  commercial: String(item.commercialPriceUsd),
                                  exclusive: String(item.exclusivePriceUsd),
                                };
                                const canDeleteThis = isAdmin || (isCreator && item.createdBy === user?.uid);

                                return (
                                  <div
                                    key={item.id}
                                    className={`p-4 space-y-3 ${
                                      isEditingThis || isBatchSelected
                                        ? 'bg-amber-500/5'
                                        : 'hover:bg-zinc-800/20'
                                    }`}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                      <div className="flex items-start gap-3 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={isBatchSelected}
                                          onChange={() => toggleBatchSelect(item)}
                                          aria-label={`Select ${item.title} for batch editing`}
                                          className="accent-amber-500 w-4 h-4 mt-1 cursor-pointer shrink-0"
                                        />
                                        <img
                                          src={item.coverImage}
                                          alt={item.title}
                                          referrerPolicy="no-referrer"
                                          className="w-14 h-14 rounded object-cover border border-zinc-800 shrink-0"
                                        />
                                        <div className="min-w-0 space-y-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold text-zinc-100 truncate">
                                              {item.title}
                                            </span>
                                            {item.featured && (
                                              <span className="text-[11px] font-mono text-amber-400">
                                                FEATURED
                                              </span>
                                            )}
                                            {item.archived && (
                                              <span className="text-[11px] font-mono text-red-400">
                                                ARCHIVED
                                              </span>
                                            )}
                                            {!inCloud && (
                                              <span className="text-[11px] font-mono text-zinc-500">
                                                SEED
                                              </span>
                                            )}
                                            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-amber-300">
                                              {item.voiceCategory ||
                                                (`${item.voiceTalent} ${item.vocalStyle}`.toLowerCase().includes('female')
                                                  ? 'Female voice'
                                                  : 'Deep male voice')}
                                            </span>
                                          </div>
                                          <div className="text-xs text-zinc-400">
                                            {item.voiceTalent} · {item.genre} · {item.bpm} BPM · Key{' '}
                                            {item.musicalKey}
                                          </div>
                                          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-zinc-300">
                                            <span>Std ${item.standardPriceUsd}</span>
                                            <span className="text-zinc-600">/</span>
                                            <span>Com ${item.commercialPriceUsd}</span>
                                            <span className="text-zinc-600">/</span>
                                            <span className="text-amber-400">Exc ${item.exclusivePriceUsd}</span>
                                            <span className="text-zinc-600">·</span>
                                            <span className="inline-flex items-center gap-1 text-zinc-400 font-sans">
                                              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                              {itemReviews.length > 0
                                                ? `${avgStars.toFixed(1)} (${itemReviews.length})`
                                                : '0 reviews'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => onPlayAudio(item.audioFileId, item.title)}
                                          aria-label={`Audition ${item.title}`}
                                          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition-colors"
                                        >
                                          <Play className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleLoadProductForEdit(item)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded transition-colors"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                          Edit &amp; Price
                                        </button>
                                        {canDeleteThis &&
                                          (confirmDeleteDropId === item.id ? (
                                            <div className="inline-flex items-center gap-1">
                                              <button
                                                type="button"
                                                onClick={() => handleToggleArchiveOrDeleteDrop(item)}
                                                className="px-2.5 py-1.5 bg-red-500 hover:bg-red-400 text-zinc-950 font-semibold text-xs rounded"
                                              >
                                                Confirm
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => setConfirmDeleteDropId(null)}
                                                className="px-2 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded"
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => setConfirmDeleteDropId(item.id)}
                                              title={
                                                !isSeedItem && inCloud
                                                  ? 'Delete product'
                                                  : item.archived
                                                  ? 'Restore to storefront'
                                                  : 'Archive from storefront'
                                              }
                                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0B0D11] border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-300 text-xs rounded transition-colors"
                                            >
                                              {!isSeedItem && inCloud ? (
                                                <Trash2 className="w-3.5 h-3.5" />
                                              ) : (
                                                <Archive className="w-3.5 h-3.5" />
                                              )}
                                              <span>
                                                {!isSeedItem && inCloud
                                                  ? 'Delete'
                                                  : item.archived
                                                  ? 'Restore'
                                                  : 'Archive'}
                                              </span>
                                            </button>
                                          ))}
                                      </div>
                                    </div>

                                    {isBatchSelected && (
                                      <div className="grid grid-cols-3 gap-2.5 pt-2.5 border-t border-zinc-800/80 pl-7">
                                        <div>
                                          <label className="block text-[11px] text-zinc-400 mb-1">
                                            Batch Std ($)
                                          </label>
                                          <input
                                            type="number"
                                            min={1}
                                            step="0.01"
                                            value={draftPrices.standard}
                                            onChange={(e) =>
                                              setBatchPriceDrafts((prev) => ({
                                                ...prev,
                                                [item.id]: {
                                                  ...draftPrices,
                                                  standard: e.target.value,
                                                },
                                              }))
                                            }
                                            className="w-full px-2.5 py-1.5 bg-[#0B0D11] border border-zinc-700 rounded text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] text-zinc-400 mb-1">
                                            Batch Com ($)
                                          </label>
                                          <input
                                            type="number"
                                            min={1}
                                            step="0.01"
                                            value={draftPrices.commercial}
                                            onChange={(e) =>
                                              setBatchPriceDrafts((prev) => ({
                                                ...prev,
                                                [item.id]: {
                                                  ...draftPrices,
                                                  commercial: e.target.value,
                                                },
                                              }))
                                            }
                                            className="w-full px-2.5 py-1.5 bg-[#0B0D11] border border-zinc-700 rounded text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[11px] text-zinc-400 mb-1">
                                            Batch Exc ($)
                                          </label>
                                          <input
                                            type="number"
                                            min={1}
                                            step="0.01"
                                            value={draftPrices.exclusive}
                                            onChange={(e) =>
                                              setBatchPriceDrafts((prev) => ({
                                                ...prev,
                                                [item.id]: {
                                                  ...draftPrices,
                                                  exclusive: e.target.value,
                                                },
                                              }))
                                            }
                                            className="w-full px-2.5 py-1.5 bg-[#0B0D11] border border-zinc-700 rounded text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Customer Reviews Moderation */}
                  <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-400" />
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Customer Reviews ({reviews.length})
                        </h3>
                      </div>
                      <span className="text-xs text-zinc-500">Live storefront feedback</span>
                    </div>
                    {reviews.length === 0 ? (
                      <div className="p-8 text-center text-xs text-zinc-500">
                        No customer reviews submitted yet. Customers can review any product from the storefront catalog cards.
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800">
                        {reviews.slice(0, 15).map((rev) => (
                          <div key={rev.id} className="p-4 flex items-start justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-mono text-amber-400 font-semibold">
                                  {'★'.repeat(rev.rating)}
                                  {'☆'.repeat(Math.max(0, 5 - rev.rating))}
                                </span>
                                <span className="font-semibold text-zinc-100">{rev.title}</span>
                                <span className="text-zinc-500">on {rev.dropTitle}</span>
                              </div>
                              <p className="text-xs text-zinc-300 leading-relaxed">
                                {rev.comment}
                              </p>
                              <div className="text-[11px] text-zinc-500">
                                By {rev.djHandle}
                                {rev.verifiedBuyer ? ' · Verified Buyer' : ''}
                              </div>
                            </div>
                            {isAdmin &&
                              (confirmDeleteReviewId === rev.id ? (
                                <div className="inline-flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteReviewAdmin(rev.id)}
                                    className="px-2.5 py-1 bg-red-500 hover:bg-red-400 text-zinc-950 font-semibold text-xs rounded"
                                  >
                                    Remove
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteReviewId(null)}
                                    className="px-2 py-1 bg-zinc-800 text-zinc-300 text-xs rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteReviewId(rev.id)}
                                  aria-label={`Remove review ${rev.title}`}
                                  className="px-2.5 py-1 bg-[#0B0D11] border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-300 text-xs rounded shrink-0"
                                >
                                  Remove
                                </button>
                              ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                  {/* Right Column: Add / Edit Multi-Format Product & Pricing Form */}
                  <form
                    onSubmit={handleSaveCatalogProduct}
                    className="xl:col-span-5 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">
                          {editingProductId ? 'Edit Product & Prices' : 'Add New Catalog Product'}
                        </h3>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {editingProductId
                            ? `Editing ID: ${editingProductId}`
                            : 'Upload Audio, Video, Image, PDF or ZIP Packs up to 200 MB'}
                        </p>
                      </div>
                      {editingProductId && (
                        <button
                          type="button"
                          onClick={resetProductForm}
                          className="text-xs text-zinc-400 hover:text-zinc-200"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    {/* Direct Multi-Format Upload Box */}
                    <div className="p-3.5 bg-[#0B0D11] border border-dashed border-zinc-700 rounded-md space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-zinc-200">
                          Upload Product File (Video, Audio, Image, PDF, ZIP, MIDI)
                        </span>
                        {prodAudioId && (
                          <button
                            type="button"
                            onClick={() =>
                              setPortalPreviewTarget({
                                id: editingProductId || prodAudioId,
                                title: prodTitle || prodOriginalFileName || 'Product Preview',
                                subtitle: `${prodGenre} · ${prodAudioFormat}`,
                                assetId: prodAudioId,
                                mediaType: prodMediaType,
                                formatLabel: prodAudioFormat,
                                sampleRate: prodSampleRate,
                                coverImage: prodCoverImage,
                                originalFileName: prodOriginalFileName,
                                fileSizeBytes: prodFileSizeBytes,
                                durationSec: prodDurationSec,
                              })
                            }
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview / Play
                          </button>
                        )}
                      </div>
                      <label className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#12151C] hover:border-amber-500 border border-zinc-800 rounded-md text-xs font-medium text-zinc-200 cursor-pointer transition-colors">
                        <Upload className="w-4 h-4 text-amber-400" />
                        <span>
                          {uploadingProductMedia
                            ? 'Uploading media to studio cloud...'
                            : prodOriginalFileName
                            ? `Uploaded: ${prodOriginalFileName} (${prodMediaType.toUpperCase()})`
                            : 'Choose Video, Audio, Image, PDF, ZIP or DAW File...'}
                        </span>
                        <input
                          type="file"
                          accept=".wav,.mp3,.flac,.aiff,.ogg,.m4a,.aac,.mp4,.webm,.mov,.m4v,.ogv,.jpg,.jpeg,.png,.webp,.gif,.avif,.zip,.rar,.7z,.pdf,.txt,.mid,.midi,.als,.flp,.ptx,.json,.csv"
                          onChange={handleUploadProductMediaInline}
                          disabled={uploadingProductMedia}
                          className="sr-only"
                        />
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['audio', 'video', 'image', 'other'] as ProductMediaType[]).map((typeKey) => (
                          <button
                            key={typeKey}
                            type="button"
                            onClick={() => setProdMediaType(typeKey)}
                            className={`py-1.5 text-[11px] font-mono uppercase rounded border transition-colors ${
                              prodMediaType === typeKey
                                ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                                : 'bg-[#12151C] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {typeKey}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Product Title</label>
                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={120}
                        value={prodTitle}
                        onChange={(e) => setProdTitle(e.target.value)}
                        placeholder="e.g. Nairobi Prime Visual & Audio Pack"
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Creator / Talent</label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={80}
                          value={prodVoice}
                          onChange={(e) => setProdVoice(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Voice Category Tag</label>
                        <select
                          value={prodVoiceCategory}
                          onChange={(e) => setProdVoiceCategory(e.target.value as VoiceCategory)}
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        >
                          <option value="Deep male voice">Deep male voice</option>
                          <option value="Female voice">Female voice</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Category / Genre</label>
                        <select
                          value={prodGenre}
                          onChange={(e) => setProdGenre(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        >
                          <option>Club &amp; Street Mix</option>
                          <option>Afrobeats &amp; Party</option>
                          <option>Social &amp; Radio Promo</option>
                          <option>Radio &amp; Promo Imaging</option>
                          <option>Afrobeats</option>
                          <option>Amapiano</option>
                          <option>House &amp; Techno</option>
                          <option>Dancehall</option>
                          <option>Hip-Hop &amp; Trap</option>
                          <option>Radio Imaging</option>
                          <option>EDM &amp; Festival</option>
                          <option>Visuals &amp; Video Loops</option>
                          <option>Artwork &amp; Cover Kits</option>
                          <option>Stems, MIDI &amp; Presets</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Style / Edition</label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={40}
                          value={prodVocalStyle}
                          onChange={(e) => setProdVocalStyle(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">BPM (0 if N/A)</label>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          required
                          value={prodBpm}
                          onChange={(e) => setProdBpm(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Key / Tag</label>
                        <input
                          type="text"
                          required
                          maxLength={16}
                          value={prodKey}
                          onChange={(e) => setProdKey(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* License Tier Prices */}
                    <div className="p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-2.5">
                      <div className="text-xs font-semibold text-amber-400">
                        License Tier Pricing (USD)
                      </div>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Standard</label>
                          <input
                            type="number"
                            min={1}
                            step="0.01"
                            required
                            value={prodStdPrice}
                            onChange={(e) => setProdStdPrice(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-[#12151C] border border-zinc-800 rounded text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Commercial</label>
                          <input
                            type="number"
                            min={1}
                            step="0.01"
                            required
                            value={prodComPrice}
                            onChange={(e) => setProdComPrice(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-[#12151C] border border-zinc-800 rounded text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-zinc-400 mb-1">Exclusive</label>
                          <input
                            type="number"
                            min={1}
                            step="0.01"
                            required
                            value={prodExcPrice}
                            onChange={(e) => setProdExcPrice(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 bg-[#12151C] border border-zinc-800 rounded text-xs font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Duration (s)</label>
                        <input
                          type="number"
                          min={0}
                          max={7200}
                          required
                          value={prodDurationSec}
                          onChange={(e) => setProdDurationSec(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs font-mono tabular-nums text-zinc-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Format Label</label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={20}
                          value={prodAudioFormat}
                          onChange={(e) => setProdAudioFormat(e.target.value)}
                          placeholder="WAV / MP4 / PNG / ZIP"
                          className="w-full px-2.5 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Spec / Resolution</label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={30}
                          value={prodSampleRate}
                          onChange={(e) => setProdSampleRate(e.target.value)}
                          placeholder="48 kHz / 1080p / 4K"
                          className="w-full px-2.5 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Search Tags (comma-separated, max 10)
                      </label>
                      <input
                        type="text"
                        value={prodTagsText}
                        onChange={(e) => setProdTagsText(e.target.value)}
                        placeholder="afrobeats, video loop, 4k artwork, stems"
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Or Pick Previously Uploaded Cloud Asset
                      </label>
                      <select
                        value={prodAudioId}
                        onChange={(e) => {
                          const chosenId = e.target.value;
                          setProdAudioId(chosenId);
                          const matched = audioAssets.find((a) => a.id === chosenId);
                          if (matched) {
                            const mType = matched.mediaType || inferMediaTypeFromAsset(matched);
                            setProdMediaType(mType);
                            setProdOriginalFileName(matched.originalName);
                            setProdFileSizeBytes(matched.sizeBytes);
                            setProdAudioFormat(matched.format.slice(0, 20));
                            setProdSampleRate(matched.sampleRate.slice(0, 30));
                            setProdDurationSec(matched.durationSec);
                            if (mType === 'image') {
                              setProdCoverImage(`/api/media/preview/${matched.id}`);
                            }
                          }
                        }}
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100"
                      >
                        <option value="">Auto-synthesized studio master</option>
                        {audioAssets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            [{(asset.mediaType || inferMediaTypeFromAsset(asset)).toUpperCase()}] {asset.originalName} ({asset.format})
                          </option>
                        ))}
                        {prodAudioId &&
                          !audioAssets.some((a) => a.id === prodAudioId) && (
                            <option value={prodAudioId}>Current: {prodAudioId}</option>
                          )}
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label className="block text-xs text-zinc-400">Cover Artwork (Preset or Upload Image)</label>
                        <label className="text-[11px] font-semibold text-amber-400 hover:underline cursor-pointer">
                          {uploadingCoverMedia ? 'Uploading...' : '+ Upload Cover Image'}
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.gif,.avif"
                            onChange={handleUploadCoverImageInline}
                            disabled={uploadingCoverMedia}
                            className="sr-only"
                          />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {COVER_IMAGE_PRESETS.map((preset) => (
                          <button
                            key={preset.url}
                            type="button"
                            onClick={() => setProdCoverImage(preset.url)}
                            className={`px-2.5 py-1.5 text-left text-[11px] rounded border transition-colors ${
                              prodCoverImage === preset.url
                                ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-medium'
                                : 'bg-[#0B0D11] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        maxLength={300}
                        value={prodCoverImage}
                        onChange={(e) => setProdCoverImage(e.target.value)}
                        placeholder="/api/media/preview/... or /assets/aistudio/..."
                        className="w-full px-3 py-1.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-[11px] font-mono text-zinc-300 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prodFeatured}
                        onChange={(e) => setProdFeatured(e.target.checked)}
                        className="accent-amber-500"
                      />
                      Mark as Featured Catalog Product
                    </label>

                    <button
                      type="submit"
                      disabled={savingProduct}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                    >
                      {savingProduct
                        ? 'Saving Product...'
                        : editingProductId
                        ? 'Save Product & Price Changes'
                        : 'Add Product to Catalog'}
                    </button>
                  </form>
                </div>
              </div>
            )}

          {/* ORDERS & DOWNLOADS */}
          {activeTab === 'orders' && (
            <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden space-y-0">
              <div className="px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">
                    Orders, Refunds &amp; Signed Digital Delivery
                  </h2>
                  <p className="text-xs text-zinc-400">
                    {isAdmin
                      ? 'Admin controller: update payment status (paid/refunded), view applied promo codes, and resend client receipts'
                      : 'View your completed transactions and download 24-bit studio WAV deliverables'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={orderSearchQuery}
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    placeholder="Search order ID, DJ, email..."
                    className="px-3 py-1.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 w-52"
                  />
                  <span className="text-xs font-mono text-zinc-400 tabular-nums">
                    {orders.length} total
                  </span>
                </div>
              </div>

              {/* Status Tabs */}
              <div className="px-6 py-2.5 bg-[#0B0D11] border-b border-zinc-800 flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'All Orders', count: orders.length },
                  {
                    id: 'paid',
                    label: 'Paid',
                    count: orders.filter((o) => o.paymentStatus === 'paid').length,
                  },
                  {
                    id: 'authorized_pending_payout',
                    label: 'Authorized / Pending Payout',
                    count: orders.filter((o) => o.paymentStatus === 'authorized_pending_payout').length,
                  },
                  {
                    id: 'refunded',
                    label: 'Refunded',
                    count: orders.filter((o) => o.paymentStatus === 'refunded').length,
                  },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setOrderStatusFilter(st.id)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      orderStatusFilter === st.id
                        ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span>{st.label}</span>
                    <span className="px-1.5 py-0.2 bg-zinc-800 text-[10px] rounded-full font-mono text-zinc-300">
                      {st.count}
                    </span>
                  </button>
                ))}
              </div>

              {(() => {
                const filteredOrders = orders.filter((order) => {
                  if (orderStatusFilter !== 'all' && order.paymentStatus !== orderStatusFilter) {
                    return false;
                  }
                  const q = orderSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    order.id.toLowerCase().includes(q) ||
                    order.buyerName.toLowerCase().includes(q) ||
                    order.buyerEmail.toLowerCase().includes(q) ||
                    order.djHandle.toLowerCase().includes(q) ||
                    order.countryName.toLowerCase().includes(q) ||
                    (order.promoCode && order.promoCode.toLowerCase().includes(q))
                  );
                });

                if (filteredOrders.length === 0) {
                  return (
                    <div className="p-10 text-center text-xs text-zinc-500">
                      No orders match your search or status filter.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B0D11] text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">Order</th>
                          <th className="px-4 py-3 font-medium">Buyer / DJ Handle</th>
                          <th className="px-4 py-3 font-medium">Items &amp; Promo</th>
                          <th className="px-4 py-3 font-medium">Jurisdiction &amp; Rail</th>
                          <th className="px-4 py-3 font-medium text-right">Tax</th>
                          <th className="px-4 py-3 font-medium text-right">Total</th>
                          <th className="px-4 py-3 font-medium">Payment Status</th>
                          <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {filteredOrders.map((order) => {
                          const firstAsset = order.items[0]?.audioFileId || 'seed-rasco-street-mix-king';
                          const linkedLic = licenses.find((l) => l.id === order.licenseId);
                          const isRefunded = order.paymentStatus === 'refunded';

                          return (
                            <tr
                              key={order.id}
                              className={`hover:bg-zinc-800/30 transition-colors ${
                                isRefunded ? 'opacity-70 bg-red-950/10' : ''
                              }`}
                            >
                              <td className="px-4 py-3 font-mono text-zinc-200">
                                <div>{order.id}</div>
                                <div className="text-[10px] text-zinc-500">
                                  {formatPayoutDate(order.createdAt)}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-zinc-100 font-medium">{order.djHandle}</div>
                                <div className="text-zinc-400">{order.buyerName}</div>
                                <div className="text-zinc-500 text-[11px]">{order.buyerEmail}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-zinc-300 font-medium">
                                  {order.items.length} item{order.items.length > 1 ? 's' : ''}:{' '}
                                  {order.items[0]?.title}
                                </div>
                                {order.promoCode && (
                                  <div className="mt-1">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                                      <Tag className="w-3 h-3" />
                                      {order.promoCode} (-${(order.discountUsd || 0).toFixed(2)})
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-zinc-300">
                                <div>{order.countryName} · {order.taxType}</div>
                                <div className="text-zinc-500 text-[11px]">
                                  {getPaymentMethodLabel(order.paymentMethod)} ({order.currency || 'USD'})
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-400">
                                ${order.taxAmountUsd.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-zinc-100">
                                ${order.totalUsd.toFixed(2)}
                              </td>
                              <td className="px-4 py-3">
                                {isAdmin ? (
                                  <select
                                    value={order.paymentStatus}
                                    disabled={updatingOrderId === order.id}
                                    onChange={(e) =>
                                      handleUpdateOrderStatus(
                                        order,
                                        e.target.value as OrderRecord['paymentStatus']
                                      )
                                    }
                                    className={`px-2 py-1 bg-[#0B0D11] border rounded text-xs font-mono focus:outline-none transition-colors ${
                                      order.paymentStatus === 'refunded'
                                        ? 'border-red-500/50 text-red-300'
                                        : order.paymentStatus === 'paid'
                                        ? 'border-emerald-500/50 text-emerald-300'
                                        : 'border-zinc-700 text-amber-300'
                                    }`}
                                  >
                                    <option value="paid">Paid</option>
                                    <option value="authorized_pending_payout">
                                      Authorized (Pending Payout)
                                    </option>
                                    <option value="refunded">Refunded</option>
                                    <option value="invoice_issued">Invoice Issued</option>
                                  </select>
                                ) : (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                                      order.paymentStatus === 'paid'
                                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                        : order.paymentStatus === 'refunded'
                                        ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                    }`}
                                  >
                                    {order.paymentStatus}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  {linkedLic && (
                                    <button
                                      type="button"
                                      onClick={() => onInspectLicense(linkedLic)}
                                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs transition-colors"
                                    >
                                      License
                                    </button>
                                  )}
                                  <a
                                    href={`/api/storage/deliver/${encodeURIComponent(
                                      firstAsset
                                    )}?token=${encodeURIComponent(order.downloadToken)}`}
                                    className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded text-xs transition-colors"
                                  >
                                    WAV
                                  </a>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      disabled={resendingOrderId === order.id}
                                      onClick={() => handleResendOrderReceipt(order)}
                                      title="Resend email receipt to buyer"
                                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 hover:text-zinc-100 rounded text-xs transition-colors flex items-center gap-1"
                                    >
                                      <Mail className="w-3 h-3 text-amber-400" />
                                      <span>
                                        {resendingOrderId === order.id ? 'Sending...' : 'Receipt'}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* CUSTOM REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">
                    Custom DJ Drop Requests &amp; Milestones
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Advancing milestones automatically triggers branded client email notifications
                  </p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('emails');
                      setEmailSubTab('branding');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#12151C] border border-zinc-700 hover:border-amber-500 text-zinc-200 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Palette className="w-3.5 h-3.5 text-amber-400" />
                    Customize Milestone Emails
                  </button>
                )}
              </div>
              {requests.length === 0 ? (
                <div className="bg-[#12151C] border border-zinc-800 rounded-lg p-10 text-center text-xs text-zinc-500">
                  No custom requests submitted yet. Use the Custom Drops form on the storefront to create a brief.
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => {
                    const currentIdx = MILESTONES.indexOf(req.milestone);
                    const nextMilestone =
                      currentIdx >= 0 && currentIdx < MILESTONES.length - 1
                        ? MILESTONES[currentIdx + 1]
                        : null;
                    return (
                      <div
                        key={req.id}
                        className="bg-[#12151C] border border-zinc-800 rounded-lg p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-zinc-100">
                              {req.djName} · {req.genre} · {req.bpmTarget} BPM
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {req.clientName} ({req.clientEmail}) · Territory {req.countryCode} · Tier:{' '}
                              {req.licenseTier}
                            </div>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <div className="text-sm font-semibold text-amber-400">
                              ${req.quotedPriceUsd.toFixed(2)} USD
                            </div>
                            <div className="text-xs text-zinc-500">Producer: {req.assignedProducerName}</div>
                          </div>
                        </div>

                        <p className="text-xs text-zinc-300 bg-[#0B0D11] border border-zinc-800 rounded-md p-3">
                          &ldquo;{req.scriptText}&rdquo;
                        </p>

                        <div className="grid grid-cols-5 gap-2">
                          {MILESTONES.map((step, idx) => {
                            const done = idx <= currentIdx;
                            return (
                              <div
                                key={step}
                                className={`px-2 py-1.5 text-center text-xs rounded border ${
                                  done
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-medium'
                                    : 'bg-[#0B0D11] border-zinc-800 text-zinc-500'
                                }`}
                              >
                                {step}
                              </div>
                            );
                          })}
                        </div>

                        {isProducer && nextMilestone && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleAdvanceMilestone(req, nextMilestone)}
                              className="px-4 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md transition-colors"
                            >
                              Advance to {nextMilestone} &amp; Notify Client
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* LICENSING */}
          {activeTab === 'licensing' && (
            <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-base font-semibold text-zinc-100">
                  Custom Audio Licensing Agreements
                </h2>
                <span className="text-xs font-mono text-zinc-400 tabular-nums">
                  {licenses.length} certificates
                </span>
              </div>
              {licenses.length === 0 ? (
                <div className="p-10 text-center text-xs text-zinc-500">
                  No audio licenses issued yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B0D11] text-zinc-400 border-b border-zinc-800">
                      <tr>
                        <th className="px-4 py-3 font-medium">Serial</th>
                        <th className="px-4 py-3 font-medium">Licensee / DJ</th>
                        <th className="px-4 py-3 font-medium">Work</th>
                        <th className="px-4 py-3 font-medium">Tier</th>
                        <th className="px-4 py-3 font-medium">Territory</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
                      {licenses.map((lic) => (
                        <tr key={lic.id} className="hover:bg-zinc-800/30">
                          <td className="px-4 py-3 font-mono text-zinc-200">{lic.serialNumber}</td>
                          <td className="px-4 py-3">
                            <div className="text-zinc-100 font-medium">{lic.djName}</div>
                            <div className="text-zinc-500">{lic.licenseeEmail}</div>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">{lic.dropTitle}</td>
                          <td className="px-4 py-3 text-zinc-300">{LICENSE_TIERS[lic.tier].shortLabel}</td>
                          <td className="px-4 py-3 text-zinc-400">{lic.territory}</td>
                          <td className="px-4 py-3 font-mono">
                            <span
                              className={
                                lic.status === 'active' ? 'text-emerald-400' : 'text-red-400'
                              }
                            >
                              {lic.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onInspectLicense(lic)}
                                className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs"
                              >
                                View Agreement
                              </button>
                              {isLicensingMgr && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleLicenseStatus(lic)}
                                  className="px-2.5 py-1 bg-[#0B0D11] border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded text-xs"
                                >
                                  {lic.status === 'active' ? 'Revoke' : 'Restore'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CLOUD MEDIA STORAGE */}
          {activeTab === 'storage' && canManageCatalog && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-100">
                      Secure Cloud Media Storage
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Upload Videos (MP4/WebM/MOV), Audio (WAV/MP3/FLAC/AIFF), Images (PNG/JPG/WebP), or PDF/ZIP/MIDI Packs up to 200 MB
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0">
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? 'Uploading...' : 'Upload Media File'}</span>
                    <input
                      type="file"
                      accept=".wav,.mp3,.flac,.aiff,.ogg,.m4a,.aac,.mp4,.webm,.mov,.m4v,.ogv,.jpg,.jpeg,.png,.webp,.gif,.avif,.zip,.rar,.7z,.pdf,.txt,.mid,.midi,.als,.flp,.ptx,.json,.csv"
                      onChange={handleUploadAudio}
                      disabled={uploading}
                      className="sr-only"
                    />
                  </label>
                </div>

                {/* Format Filter */}
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#0B0D11] border border-zinc-800 rounded-md w-fit">
                  {(['all', 'audio', 'video', 'image', 'other'] as const).map((typeOpt) => (
                    <button
                      key={typeOpt}
                      type="button"
                      onClick={() => setStorageTypeFilter(typeOpt)}
                      className={`px-3 py-1 text-xs font-medium rounded capitalize transition-colors ${
                        storageTypeFilter === typeOpt
                          ? 'bg-amber-500 text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      {typeOpt === 'all' ? `All (${audioAssets.length})` : typeOpt}
                    </button>
                  ))}
                </div>

                {(() => {
                  const filteredAssets = audioAssets.filter((asset) => {
                    if (storageTypeFilter === 'all') return true;
                    return (asset.mediaType || inferMediaTypeFromAsset(asset)) === storageTypeFilter;
                  });
                  if (filteredAssets.length === 0) {
                    return (
                      <div className="py-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-md">
                        No {storageTypeFilter === 'all' ? '' : `${storageTypeFilter} `}media files uploaded yet. Upload a video, audio master, image, PDF, or ZIP pack to preview and publish it.
                      </div>
                    );
                  }
                  return (
                    <div className="divide-y divide-zinc-800">
                      {filteredAssets.map((asset) => {
                        const mType = asset.mediaType || inferMediaTypeFromAsset(asset);
                        const IconComp =
                          mType === 'video'
                            ? Film
                            : mType === 'image'
                            ? ImageIcon
                            : mType === 'other'
                            ? FileArchive
                            : FileAudio;
                        return (
                          <div key={asset.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded bg-[#0B0D11] border border-zinc-800 flex items-center justify-center shrink-0">
                                <IconComp className="w-4 h-4 text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#0B0D11] border border-zinc-800 text-amber-400">
                                    {mType}
                                  </span>
                                  <span className="text-sm font-medium text-zinc-100 truncate">
                                    {asset.originalName}
                                  </span>
                                </div>
                                <div className="text-xs font-mono text-zinc-400 tabular-nums mt-0.5">
                                  {asset.format} · {asset.sampleRate} · {(asset.sizeBytes / 1024).toFixed(1)} KB · ID: {asset.id}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (mType === 'audio') {
                                    onPlayAudio(asset.id, asset.originalName);
                                  } else {
                                    setPortalPreviewTarget({
                                      id: asset.id,
                                      title: asset.originalName,
                                      subtitle: `${asset.format} · ${asset.sampleRate}`,
                                      assetId: asset.id,
                                      mediaType: mType,
                                      formatLabel: asset.format,
                                      sampleRate: asset.sampleRate,
                                      originalFileName: asset.originalName,
                                      fileSizeBytes: asset.sizeBytes,
                                      durationSec: asset.durationSec,
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs rounded-md"
                              >
                                {mType === 'audio' || mType === 'video' ? (
                                  <Play className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                                {mType === 'audio' || mType === 'video' ? 'Play' : 'Preview'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedAssetId(asset.id)}
                                className={`px-3 py-1.5 text-xs rounded-md border ${
                                  selectedAssetId === asset.id
                                    ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                                    : 'bg-[#0B0D11] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                                }`}
                              >
                                {selectedAssetId === asset.id ? 'Selected' : 'Use in Catalog'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <form
                onSubmit={handlePublishDropFromAsset}
                className="xl:col-span-5 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Publish Media Asset to Storefront
                  </h3>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Product Title</label>
                  <input
                    type="text"
                    required
                    value={newDropTitle}
                    onChange={(e) => setNewDropTitle(e.target.value)}
                    placeholder="e.g. Lagos Midnight Video & Drop Pack"
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Creator / Talent</label>
                    <input
                      type="text"
                      value={newDropVoice}
                      onChange={(e) => setNewDropVoice(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Category / Genre</label>
                    <select
                      value={newDropGenre}
                      onChange={(e) => setNewDropGenre(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    >
                      <option>Afrobeats</option>
                      <option>Amapiano</option>
                      <option>House &amp; Techno</option>
                      <option>Dancehall</option>
                      <option>Hip-Hop &amp; Trap</option>
                      <option>Radio Imaging</option>
                      <option>Visuals &amp; Video Loops</option>
                      <option>Artwork &amp; Cover Kits</option>
                      <option>Stems, MIDI &amp; Presets</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">BPM (0 if N/A)</label>
                    <input
                      type="number"
                      min={0}
                      max={300}
                      value={newDropBpm}
                      onChange={(e) => setNewDropBpm(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Standard Price (USD)</label>
                    <input
                      type="number"
                      min={1}
                      value={newDropPrice}
                      onChange={(e) => setNewDropPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <div className="text-xs text-zinc-500 font-mono">
                  Linked Media Asset: {selectedAssetId || 'Auto-synthesized studio master'}
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                >
                  Publish to Live Catalog
                </button>
              </form>
            </div>
          )}

          {/* PRODUCER & GLOBAL CO-CREATOR PAYOUTS */}
          {activeTab === 'payouts' && canWithdrawPayouts && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100">
                    {isCreator
                      ? 'Global Co-Creator Payouts & Earnings'
                      : 'Producer Payouts & Regional Earnings'}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isCreator
                      ? '95% creator earnings per sale (5% Admin fee) · Global withdrawals worldwide with 7% Admin withdrawal fee'
                      : 'Aggregated international sales, co-creator 5%/7% Admin fee revenue, and global settlement ledger'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-zinc-400">
                    Admin Rail:{' '}
                    {(gatewaySettings?.adminPayoutMethod || adminPayoutMethod) === 'mobile_money'
                      ? 'Mobile Money'
                      : 'Bank Transfer'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={payoutEmailAlerts}
                    onClick={handleTogglePayoutEmailAlerts}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                      payoutEmailAlerts
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15'
                        : 'bg-[#0B0D11] border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {payoutEmailAlerts ? (
                      <Bell className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <BellOff className="w-3.5 h-3.5 text-zinc-500" />
                    )}
                    <span>Email Alerts: {payoutEmailAlerts ? 'ON' : 'OFF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPendingPayoutsCsv}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded-md border border-zinc-700 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    Export Pending CSV ({pendingPayoutRequests.length})
                  </button>
                </div>
              </div>

              {isAdmin && (
                <div className="bg-[#12151C] border border-amber-500/30 rounded-lg p-5 grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-zinc-400">5% Co-Creator Purchase Fees</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-amber-400 mt-1">
                      ${analytics.adminFivePctPurchaseFeesUsd.toFixed(2)} USD
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">7% Co-Creator Withdrawal Fees</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-emerald-400 mt-1">
                      ${analytics.adminSevenPctWithdrawalFeesUsd.toFixed(2)} USD
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Total Admin Fee Revenue</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-zinc-100 mt-1">
                      ${analytics.totalAdminFeeRevenueUsd.toFixed(2)} USD
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Active Global Co-Creators</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-zinc-100 mt-1">
                      {creatorProfiles.length} seller{creatorProfiles.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
              )}

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  {
                    label: isCreator ? 'Gross Drop Sales' : 'Aggregated Gross Sales',
                    value: `$${payoutAnalytics.aggregatedSalesUsd.toFixed(2)}`,
                    sub: isCreator
                      ? `5% Admin fee: $${payoutAnalytics.totalTaxUsd.toFixed(2)}`
                      : `Includes $${payoutAnalytics.totalTaxUsd.toFixed(2)} VAT/GST`,
                  },
                  {
                    label: 'Pending Regional Earnings',
                    value: `$${payoutAnalytics.pendingEarningsUsd.toFixed(2)}`,
                    sub: isCreator ? '95% creator share available' : 'Net balance available to withdraw',
                  },
                  {
                    label: 'Requested & Settled',
                    value: `$${payoutAnalytics.committedPayoutsUsd.toFixed(2)}`,
                    sub: `${payoutRequests.length} payout request${payoutRequests.length === 1 ? '' : 's'}`,
                  },
                  {
                    label: 'Active Revenue Regions',
                    value: String(payoutAnalytics.byRegion.length),
                    sub: 'Global payout coverage (550+ zones)',
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-[#12151C] border border-zinc-800 rounded-lg p-5 space-y-1.5"
                  >
                    <div className="text-xs text-zinc-400">{kpi.label}</div>
                    <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
                      {kpi.value}
                    </div>
                    <div className="text-xs text-zinc-500">{kpi.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Pending Earnings by Region */}
                <div className="xl:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100">
                      Pending Earnings by Region
                    </h3>
                    <span className="text-xs font-mono text-zinc-400 tabular-nums">
                      Net USD After Tax
                    </span>
                  </div>
                  {payoutAnalytics.byRegion.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <p className="text-xs font-medium text-zinc-300">
                        No regional sales recorded yet
                      </p>
                      <p className="text-xs text-zinc-500">
                        Completed storefront orders and fulfilled custom drops will aggregate here by region automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-800">
                      {payoutAnalytics.byRegion.map((row) => {
                        const pct = Math.max(
                          5,
                          Math.round((row.netEarningsUsd / payoutAnalytics.maxRegionNet) * 100)
                        );
                        return (
                          <div key={row.region} className="p-4 space-y-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-zinc-100">
                                  {row.region}
                                </div>
                                <div className="text-xs text-zinc-400 truncate">
                                  {row.countriesList.join(', ')} · {row.salesCount} transaction
                                  {row.salesCount > 1 ? 's' : ''}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <div className="text-right font-mono tabular-nums">
                                  <div className="text-sm font-bold text-amber-400">
                                    ${row.netEarningsUsd.toFixed(2)} USD
                                  </div>
                                  <div className="text-xs text-zinc-500">
                                    Gross ${row.grossSalesUsd.toFixed(2)} · Tax ${row.taxUsd.toFixed(2)}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayoutRegionScope(row.region);
                                    setPayoutAmountInput(row.netEarningsUsd.toFixed(2));
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-md transition-colors whitespace-nowrap shrink-0"
                                >
                                  Select Region
                                </button>
                              </div>
                            </div>
                            <div className="h-1.5 bg-[#0B0D11] rounded-sm overflow-hidden">
                              <div
                                className="h-full bg-amber-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Initiate Global Payout Request Form */}
                <form
                  onSubmit={handleInitiatePayout}
                  className="xl:col-span-5 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      {isCreator ? 'Global Co-Creator Withdrawal' : 'Initiate Payout Request'}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {isCreator
                        ? 'Available worldwide across 550+ zones · 7% withdrawal fee goes to Admin (93% net sent to you)'
                        : 'Submit a withdrawal or settlement notice to your configured destination'}
                    </p>
                  </div>

                  <JurisdictionSelector
                    label="Destination Country / Payout Region (Global)"
                    value={payoutCountryCode}
                    onChange={(code) => {
                      setPayoutCountryCode(code);
                      const j = findJurisdiction(code);
                      setPayoutReqCurrency(j.currency);
                    }}
                  />

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Earnings Region Scope</label>
                    <select
                      value={payoutRegionScope}
                      onChange={(e) => setPayoutRegionScope(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    >
                      <option value="All Regions">
                        All Pending Regions (${payoutAnalytics.pendingEarningsUsd.toFixed(2)} USD)
                      </option>
                      {payoutAnalytics.byRegion.map((r) => (
                        <option key={r.region} value={r.region}>
                          {r.region} (${r.netEarningsUsd.toFixed(2)} USD)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Gross Amount (USD)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        required
                        value={payoutAmountInput}
                        onChange={(e) => setPayoutAmountInput(e.target.value)}
                        placeholder={
                          payoutAnalytics.pendingEarningsUsd > 0
                            ? payoutAnalytics.pendingEarningsUsd.toFixed(2)
                            : '50.00'
                        }
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Settlement Currency</label>
                      <select
                        value={payoutReqCurrency}
                        onChange={(e) => setPayoutReqCurrency(e.target.value)}
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                      >
                        {!PAYOUT_CURRENCIES.some((c) => c.code === payoutReqCurrency) && (
                          <option value={payoutReqCurrency}>
                            {payoutReqCurrency} — Local ({payoutJurisdiction.country})
                          </option>
                        )}
                        {PAYOUT_CURRENCIES.map((cur) => (
                          <option key={cur.code} value={cur.code}>
                            {cur.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {(() => {
                    const previewGross = Math.max(
                      0,
                      Number(payoutAmountInput || payoutAnalytics.pendingEarningsUsd || 0)
                    );
                    const previewFeeRate = isCreator ? 0.07 : 0;
                    const previewFee = Number((previewGross * previewFeeRate).toFixed(2));
                    const previewNet = Number((previewGross - previewFee).toFixed(2));
                    if (!isCreator || previewGross <= 0) return null;
                    return (
                      <div className="p-3.5 bg-[#0B0D11] border border-amber-500/30 rounded-md space-y-1.5 text-xs font-mono tabular-nums">
                        <div className="flex items-center justify-between text-zinc-400">
                          <span>Gross Withdrawal</span>
                          <span className="text-zinc-200">${previewGross.toFixed(2)} USD</span>
                        </div>
                        <div className="flex items-center justify-between text-amber-400">
                          <span>Admin Withdrawal Fee (7%)</span>
                          <span>-${previewFee.toFixed(2)} USD</span>
                        </div>
                        <div className="pt-1.5 border-t border-zinc-800 flex items-center justify-between font-bold text-emerald-400">
                          <span>Net Payout Sent (93%)</span>
                          <span>${previewNet.toFixed(2)} USD</span>
                        </div>
                      </div>
                    );
                  })()}

                  {isAdmin && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1.5">
                        Admin Payout Method (Bank / Mobile Money)
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        {ADMIN_PAYOUT_METHODS.map((option) => {
                          const active = payoutRequestMethod === option.payoutRailId;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setPayoutRequestMethod(option.payoutRailId)}
                              className={`px-3 py-2 text-left rounded-md border text-xs transition-colors ${
                                active
                                  ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                                  : 'bg-[#0B0D11] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                              }`}
                            >
                              <div>{option.label}</div>
                              <div className="text-[11px] font-normal text-zinc-500 truncate mt-0.5">
                                {option.id === 'bank' ? 'IBAN / SWIFT / Local' : 'MoMo / Airtel / M-Pesa'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Global &amp; Localized Payout Rail ({payoutJurisdiction.country} · {payoutReqCurrency})
                    </label>
                    <select
                      value={payoutRequestMethod}
                      onChange={(e) => setPayoutRequestMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                    >
                      {availablePayoutMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.label} — {method.rail} ({method.settlementSpeed})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Destination Account / IBAN / Mobile Number / PayPal Email
                    </label>
                    <input
                      type="text"
                      required
                      value={payoutDestination}
                      onChange={(e) => setPayoutDestination(e.target.value)}
                      placeholder="+256784903051 or IBAN / SWIFT / PayPal Email"
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Reference Note (Optional)</label>
                    <input
                      type="text"
                      value={payoutNotes}
                      onChange={(e) => setPayoutNotes(e.target.value)}
                      placeholder="Global co-creator payout or studio settlement"
                      maxLength={500}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPayout}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                  >
                    {submittingPayout ? 'Submitting Global Payout...' : 'Initiate Global Payout'}
                  </button>
                </form>
              </div>

              {/* Payout Requests History Ledger */}
              <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      Payout Request Ledger
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                      {pendingPayoutRequests.length} pending · {payoutRequests.length} total requests
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportPendingPayoutsCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Pending CSV ({pendingPayoutRequests.length})
                  </button>
                </div>
                {payoutRequests.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    No payout requests initiated yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B0D11] text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">Request ID</th>
                          <th className="px-4 py-3 font-medium">Seller / Producer</th>
                          <th className="px-4 py-3 font-medium">Country &amp; Region</th>
                          <th className="px-4 py-3 font-medium">Method &amp; Destination</th>
                          <th className="px-4 py-3 font-medium text-right">Gross / 7% Fee / Net</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          {isAdmin && <th className="px-4 py-3 font-medium text-right">Admin Settlement</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {payoutRequests.map((pay) => {
                          const defaultRowMethod: 'bank_transfer' | 'mobile_money' =
                            adminRowPayoutMethods[pay.id] ||
                            (pay.payoutMethod === 'bank_transfer' || pay.payoutMethod === 'mobile_money'
                              ? pay.payoutMethod
                              : adminPayoutMethod === 'mobile_money'
                              ? 'mobile_money'
                              : 'bank_transfer');
                          const feeUsd = pay.withdrawalFeeUsd || 0;
                          const netUsd = pay.netPayoutUsd ?? pay.amountUsd;
                          return (
                            <tr key={pay.id} className="hover:bg-zinc-800/30">
                              <td className="px-4 py-3 font-mono text-zinc-200">{pay.id}</td>
                              <td className="px-4 py-3">
                                <div className="text-zinc-100 font-medium">{pay.producerName}</div>
                                <div className="text-zinc-500">{pay.producerEmail}</div>
                              </td>
                              <td className="px-4 py-3 text-zinc-300">{pay.regionSummary}</td>
                              <td className="px-4 py-3">
                                <div className="text-zinc-200 font-medium">
                                  {getPaymentMethodLabel(pay.payoutMethod)}
                                </div>
                                <div className="text-zinc-500">{pay.destinationAccount}</div>
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums">
                                <div className="font-semibold text-zinc-100">
                                  ${netUsd.toFixed(2)} net ({pay.currency})
                                </div>
                                {feeUsd > 0 && (
                                  <div className="text-[11px] text-amber-400">
                                    Gross ${pay.amountUsd.toFixed(2)} · 7% Fee ${feeUsd.toFixed(2)}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono">
                                <span
                                  className={
                                    pay.status === 'Settled'
                                      ? 'text-emerald-400'
                                      : pay.status === 'Rejected'
                                      ? 'text-red-400'
                                      : 'text-amber-400'
                                  }
                                >
                                  {pay.status}
                                </span>
                              </td>
                              {isAdmin && (
                                <td className="px-4 py-3 text-right">
                                  {pay.status !== 'Settled' && (
                                    <div className="inline-flex items-center gap-1.5">
                                      <select
                                        aria-label={`Admin payout method for ${pay.id}`}
                                        value={defaultRowMethod}
                                        onChange={(e) =>
                                          setAdminRowPayoutMethods((prev) => ({
                                            ...prev,
                                            [pay.id]: e.target.value as 'bank_transfer' | 'mobile_money',
                                          }))
                                        }
                                        className="px-2 py-1 bg-[#0B0D11] border border-zinc-700 rounded text-xs text-zinc-200"
                                      >
                                        <option value="bank_transfer">Bank</option>
                                        <option value="mobile_money">Mobile Money</option>
                                      </select>
                                      {pay.status === 'Requested' && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleUpdatePayoutStatus(pay, 'Processing', defaultRowMethod)
                                          }
                                          className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs"
                                        >
                                          Process
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdatePayoutStatus(pay, 'Settled', defaultRowMethod)
                                        }
                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded text-xs"
                                      >
                                        Mark Settled
                                      </button>
                                    </div>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {/* History: Past Completed Payout Transactions */}
              <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <History className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">
                        History — Completed Payout Transactions
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                        {completedPayoutHistory.length} settled transaction
                        {completedPayoutHistory.length === 1 ? '' : 's'} · Total settled: $
                        {completedPayoutTotalUsd.toFixed(2)} USD
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 tabular-nums">
                    Settled Ledger
                  </span>
                </div>

                {completedPayoutHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    No completed payout transactions yet. Marked-settled payouts will appear here with their settlement date, status, and amount.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/70">
                    {completedPayoutHistory.map((item) => (
                      <div
                        key={item.id}
                        className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-zinc-800/20"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2.5 text-xs">
                            <span className="font-mono font-semibold text-zinc-100">
                              {item.id}
                            </span>
                            <span className="text-zinc-500">·</span>
                            <span className="text-zinc-300 font-medium">
                              {item.producerName}
                            </span>
                            <span className="text-zinc-500">·</span>
                            <span className="text-zinc-400">{item.regionSummary}</span>
                          </div>
                          <div className="text-xs text-zinc-400">
                            {getPaymentMethodLabel(item.payoutMethod)} · {item.destinationAccount}
                          </div>
                        </div>

                        <div className="flex items-center gap-6 shrink-0">
                          <div className="text-right">
                            <div className="text-xs text-zinc-500">Completed Date</div>
                            <div className="text-xs font-mono tabular-nums text-zinc-200">
                              {formatPayoutDate(item.updatedAt || item.createdAt)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-zinc-500">Status</div>
                            <div className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{item.status}</span>
                            </div>
                          </div>
                          <div className="text-right min-w-[110px]">
                            <div className="text-xs text-zinc-500">Amount</div>
                            <div className="text-sm font-mono tabular-nums font-bold text-zinc-100">
                              ${item.amountUsd.toFixed(2)} {item.currency}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CUSTOM REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-100">
                      Customizable Reporting &amp; Client Workflow Exports
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Configure tax, territory, and licensing columns, export CSVs, or email summaries directly to clients
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV ({filteredReportOrders.length})
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">License Tier Filter</label>
                    <select
                      value={reportTierFilter}
                      onChange={(e) => setReportTierFilter(e.target.value as 'all' | LicenseTier)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100"
                    >
                      <option value="all">All License Tiers</option>
                      <option value="standard">Standard DJ</option>
                      <option value="commercial">Commercial Broadcast</option>
                      <option value="exclusive">Exclusive Buyout</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Jurisdiction Filter</label>
                    <select
                      value={reportCountryFilter}
                      onChange={(e) => setReportCountryFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100"
                    >
                      <option value="all">All Countries &amp; Zones</option>
                      {uniqueOrderCountries.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 pt-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTaxCols}
                      onChange={(e) => setIncludeTaxCols(e.target.checked)}
                      className="accent-amber-500"
                    />
                    Include International Tax Columns
                  </label>
                  <label className="flex items-center gap-2 text-xs text-zinc-300 pt-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeGatewayCols}
                      onChange={(e) => setIncludeGatewayCols(e.target.checked)}
                      className="accent-amber-500"
                    />
                    Include Gateway Payout Status
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-800">
                  <input
                    type="email"
                    value={reportClientEmail}
                    onChange={(e) => setReportClientEmail(e.target.value)}
                    placeholder="client-or-accountant@domain.com"
                    className="flex-1 min-w-[220px] px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendReportSummary}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Email Report Summary
                  </button>
                </div>
              </div>

              <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0B0D11] text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">Order ID</th>
                      <th className="px-4 py-3 font-medium">Jurisdiction</th>
                      <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                      {includeTaxCols && <th className="px-4 py-3 font-medium">Tax Regime</th>}
                      {includeTaxCols && <th className="px-4 py-3 font-medium text-right">Tax USD</th>}
                      <th className="px-4 py-3 font-medium text-right">Total USD</th>
                      {includeGatewayCols && <th className="px-4 py-3 font-medium">Gateway State</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {filteredReportOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                          No orders match the active report filters.
                        </td>
                      </tr>
                    ) : (
                      filteredReportOrders.map((o) => (
                        <tr key={o.id}>
                          <td className="px-4 py-3 font-mono text-zinc-200">{o.id}</td>
                          <td className="px-4 py-3 text-zinc-300">{o.countryName}</td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-300">
                            ${o.subtotalUsd.toFixed(2)}
                          </td>
                          {includeTaxCols && (
                            <td className="px-4 py-3 text-zinc-400">
                              {o.taxType} ({(o.taxRate * 100).toFixed(1)}%)
                            </td>
                          )}
                          {includeTaxCols && (
                            <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-400">
                              ${o.taxAmountUsd.toFixed(2)}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-zinc-100">
                            ${o.totalUsd.toFixed(2)}
                          </td>
                          {includeGatewayCols && (
                            <td className="px-4 py-3 text-zinc-400">
                              <div>{getPaymentMethodLabel(o.paymentMethod)}</div>
                              <div className="text-zinc-500">
                                {o.currency || 'USD'} · {o.paymentStatus}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* EMAIL NOTIFICATIONS & BRANDING TEMPLATES */}
          {activeTab === 'emails' && (
            <div className="space-y-6">
              {isAdmin && (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-100">
                      Milestone Email Branding &amp; Notification Center
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Customize brand identity, sender details, and automated milestone copy sent to clients
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 p-1 bg-[#12151C] border border-zinc-800 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setEmailSubTab('branding')}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        emailSubTab === 'branding'
                          ? 'bg-amber-500 text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      <Palette className="w-3.5 h-3.5" />
                      Branding &amp; Templates
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmailSubTab('logs')}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        emailSubTab === 'logs'
                          ? 'bg-amber-500 text-zinc-950 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Notification Log &amp; Composer ({emailLogs.length})
                    </button>
                  </div>
                </div>
              )}

              {isAdmin && emailSubTab === 'branding' ? (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  {/* Left: Branding & Milestone Template Editor */}
                  <form
                    onSubmit={handleSaveEmailTemplates}
                    className="xl:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-6"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Studio Brand Identity &amp; Sender Settings
                        </h3>
                        <span className="text-xs font-mono text-zinc-500">
                          Applies to all milestone emails
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Brand Name
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={80}
                            value={tplBrandName}
                            onChange={(e) => setTplBrandName(e.target.value)}
                            placeholder="Quality DJ Drops Worldwide 🌐"
                            className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Brand Tagline
                          </label>
                          <input
                            type="text"
                            maxLength={120}
                            value={tplBrandTagline}
                            onChange={(e) => setTplBrandTagline(e.target.value)}
                            placeholder="Global DJ Drops & Licensing Studio"
                            className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Sender Display Name
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={80}
                            value={tplSenderName}
                            onChange={(e) => setTplSenderName(e.target.value)}
                            placeholder="Quality DJ Drops Worldwide Studio"
                            className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Reply-To Support Email
                          </label>
                          <input
                            type="email"
                            required
                            maxLength={160}
                            value={tplReplyToEmail}
                            onChange={(e) => setTplReplyToEmail(e.target.value)}
                            placeholder="opioisaac21062002@gmail.com"
                            className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Brand Accent Color
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              aria-label="Brand accent color picker"
                              value={
                                /^#[0-9a-fA-F]{6}$/.test(tplAccentColor)
                                  ? tplAccentColor
                                  : '#F59E0B'
                              }
                              onChange={(e) => setTplAccentColor(e.target.value)}
                              className="h-9 w-12 rounded bg-[#0B0D11] border border-zinc-800 p-1 cursor-pointer"
                            />
                            <input
                              type="text"
                              maxLength={7}
                              value={tplAccentColor}
                              onChange={(e) => setTplAccentColor(e.target.value)}
                              placeholder="#F59E0B"
                              className="flex-1 px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-zinc-400 mb-1">
                            Logo Image URL (Optional)
                          </label>
                          <input
                            type="text"
                            maxLength={300}
                            value={tplLogoUrl}
                            onChange={(e) => setTplLogoUrl(e.target.value)}
                            placeholder="https://... or /assets/aistudio/..."
                            className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          Email Footer &amp; Contact Signature
                        </label>
                        <input
                          type="text"
                          maxLength={400}
                          value={tplFooterText}
                          onChange={(e) => setTplFooterText(e.target.value)}
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Milestone Email Content
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleResetMilestoneTemplate(selectedTplMilestone)}
                          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset &ldquo;{selectedTplMilestone}&rdquo;
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {MILESTONES.map((ms) => {
                          const active = selectedTplMilestone === ms;
                          return (
                            <button
                              key={ms}
                              type="button"
                              onClick={() => setSelectedTplMilestone(ms)}
                              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                                active
                                  ? 'bg-amber-500/15 border-amber-500 text-amber-300 font-semibold'
                                  : 'bg-[#0B0D11] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {ms}
                            </button>
                          );
                        })}
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          Subject Line Template ({selectedTplMilestone})
                        </label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          maxLength={200}
                          value={tplMilestones[selectedTplMilestone]?.subject || ''}
                          onChange={(e) =>
                            setTplMilestones((prev) => ({
                              ...prev,
                              [selectedTplMilestone]: {
                                ...prev[selectedTplMilestone],
                                subject: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">
                          Message Body Template ({selectedTplMilestone})
                        </label>
                        <textarea
                          required
                          minLength={4}
                          maxLength={1500}
                          rows={6}
                          value={tplMilestones[selectedTplMilestone]?.body || ''}
                          onChange={(e) =>
                            setTplMilestones((prev) => ({
                              ...prev,
                              [selectedTplMilestone]: {
                                ...prev[selectedTplMilestone],
                                body: e.target.value,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 font-sans leading-relaxed focus:outline-none focus:border-amber-500"
                        />
                        <div className="mt-2 space-y-1.5">
                          <div className="text-[11px] text-zinc-500">
                            Click a variable to append it to the message body:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {EMAIL_TEMPLATE_TOKENS.map((item) => (
                              <button
                                key={item.token}
                                type="button"
                                title={item.label}
                                onClick={() =>
                                  setTplMilestones((prev) => ({
                                    ...prev,
                                    [selectedTplMilestone]: {
                                      ...prev[selectedTplMilestone],
                                      body: `${prev[selectedTplMilestone].body}${
                                        prev[selectedTplMilestone].body.endsWith(' ') ||
                                        prev[selectedTplMilestone].body.endsWith('\n')
                                          ? ''
                                          : ' '
                                      }${item.token}`,
                                    },
                                  }))
                                }
                                className="px-2 py-1 bg-[#0B0D11] hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] font-mono text-amber-300 transition-colors"
                              >
                                {item.token}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800">
                      <span className="text-xs text-zinc-500">
                        {emailTemplateConfig
                          ? 'Custom studio template active'
                          : 'Using default template until saved'}
                      </span>
                      <button
                        type="submit"
                        disabled={savingEmailTemplates}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                      >
                        {savingEmailTemplates ? 'Saving Templates...' : 'Save Branding & Templates'}
                      </button>
                    </div>
                  </form>

                  {/* Right: Live Branded Email Preview & Test Dispatch */}
                  <div className="xl:col-span-5 space-y-4">
                    <div className="bg-[#12151C] border border-zinc-800 rounded-lg p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Live Branded Email Preview
                        </h3>
                        <select
                          aria-label="Preview client brief"
                          value={previewSampleRequestId}
                          onChange={(e) => setPreviewSampleRequestId(e.target.value)}
                          className="px-2.5 py-1 bg-[#0B0D11] border border-zinc-800 rounded text-xs text-zinc-200 max-w-[190px]"
                        >
                          <option value="sample">Sample Client (DJ Kairo)</option>
                          {requests.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.djName} ({r.clientName})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Envelope Metadata */}
                      <div className="p-3 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-1 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="text-zinc-500">From:</span>
                          <span className="text-zinc-200 truncate">{draftEmailConfig.senderName}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-zinc-500">Reply-To:</span>
                          <span className="text-zinc-300 font-mono truncate">
                            {draftEmailConfig.replyToEmail}
                          </span>
                        </div>
                        <div className="pt-1 border-t border-zinc-800/80 text-zinc-100 font-semibold">
                          {liveEmailPreview.subject}
                        </div>
                      </div>

                      {/* Rendered Email Card Preview */}
                      <div className="border border-zinc-800 rounded-lg overflow-hidden bg-[#0B0D11]">
                        <div
                          className="h-1.5 w-full"
                          style={{ backgroundColor: draftEmailConfig.accentColor }}
                        />
                        <div className="p-5 bg-[#12151C] border-b border-zinc-800">
                          {draftEmailConfig.logoUrl &&
                            /^(https:\/\/|\/)/i.test(draftEmailConfig.logoUrl.trim()) && (
                              <img
                                src={draftEmailConfig.logoUrl.trim()}
                                alt={draftEmailConfig.brandName}
                                referrerPolicy="no-referrer"
                                className="max-h-8 mb-2.5 object-contain"
                              />
                            )}
                          <div className="text-base font-bold text-zinc-100">
                            {draftEmailConfig.brandName}
                          </div>
                          {draftEmailConfig.brandTagline && (
                            <div className="text-xs text-zinc-400 mt-0.5">
                              {draftEmailConfig.brandTagline}
                            </div>
                          )}
                        </div>
                        <div className="p-5 bg-[#12151C] space-y-3">
                          <div
                            className="inline-block px-2.5 py-1 rounded text-[11px] font-mono font-semibold uppercase tracking-wide bg-[#0B0D11] border"
                            style={{
                              borderColor: draftEmailConfig.accentColor,
                              color: draftEmailConfig.accentColor,
                            }}
                          >
                            Milestone: {selectedTplMilestone}
                          </div>
                          <div className="text-xs text-zinc-200 leading-relaxed whitespace-pre-line">
                            {liveEmailPreview.textBody
                              .split('\n\n---\n')[0]
                              .split('\n\n')
                              .slice(1)
                              .join('\n\n')}
                          </div>
                        </div>
                        <div className="px-5 py-3.5 bg-[#0B0D11] border-t border-zinc-800 text-[11px] text-zinc-500 leading-relaxed">
                          {draftEmailConfig.footerText}
                        </div>
                      </div>

                      {/* Send Test Milestone Email */}
                      <div className="pt-2 border-t border-zinc-800 space-y-2">
                        <label className="block text-xs text-zinc-400">
                          Send Test Preview ({selectedTplMilestone})
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            value={testTemplateEmail}
                            onChange={(e) => setTestTemplateEmail(e.target.value)}
                            placeholder={user?.email || 'admin@qualitydjdrops.com'}
                            className="flex-1 min-w-0 px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            disabled={sendingTestTemplate}
                            onClick={handleSendTestTemplateEmail}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0"
                          >
                            <Send className="w-3.5 h-3.5 text-amber-400" />
                            {sendingTestTemplate ? 'Sending...' : 'Send Test'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                  <div className="xl:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                      <h2 className="text-base font-semibold text-zinc-100">
                        Automated Email Notification Log
                      </h2>
                      <span className="text-xs font-mono text-zinc-400 tabular-nums">
                        {emailLogs.length} sent/logged
                      </span>
                    </div>
                    {emailLogs.length === 0 ? (
                      <div className="p-10 text-center text-xs text-zinc-500">
                        No email notifications triggered yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-zinc-800">
                        {emailLogs.map((log) => (
                          <div key={log.id} className="p-4 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-zinc-100">{log.subject}</span>
                              <span className="font-mono text-amber-400 shrink-0">
                                {log.deliveryStatus === 'sent_smtp' ? 'SMTP Sent' : 'Delivered Receipt'}
                              </span>
                            </div>
                            <div className="text-xs text-zinc-400">
                              To: {log.recipientEmail} · Milestone: {log.milestone}
                            </div>
                            <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-line">
                              {log.previewBody}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form
                    onSubmit={handleSendManualEmail}
                    className="xl:col-span-5 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4"
                  >
                    <h3 className="text-sm font-semibold text-zinc-100">
                      Send Client Milestone Update
                    </h3>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Recipient Email</label>
                      <input
                        type="email"
                        required
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="dj@station.fm"
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Subject</label>
                      <input
                        type="text"
                        required
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Master stems ready for review"
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Message</label>
                      <textarea
                        required
                        rows={4}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Write client milestone update or licensing note..."
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={sendingEmail}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                    >
                      {sendingEmail ? 'Dispatching...' : 'Send Notification'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* PROMOTIONAL & DISCOUNT CODES */}
          {activeTab === 'promos' && isAdmin && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-amber-500" />
                    <span>Promo &amp; Discount Code Studio</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Create promotional discount vouchers with custom percentage off, minimum order subtotal, and live usage counters.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-3 py-1.5 rounded bg-[#12151C] border border-zinc-800 text-zinc-300">
                    {promoCodes.length} codes total
                  </span>
                  <span className="px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold">
                    {promoCodes.filter((p) => p.active).length} active
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Promo Creator Form */}
                <form
                  onSubmit={handleCreatePromoCode}
                  className="xl:col-span-4 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4"
                >
                  <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 text-sm font-semibold text-zinc-100">
                    <Plus className="w-4 h-4 text-amber-500" />
                    <span>Create Discount Code</span>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Coupon Code (Uppercase)</label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      maxLength={32}
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                      placeholder="e.g. VIP20 or SUMMER50"
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono font-bold text-amber-400 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 uppercase"
                    />
                    <div className="text-[11px] text-zinc-500 mt-1">Alphanumeric, underscores, hyphens only</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Discount %</label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={90}
                          required
                          value={promoDiscountPercent}
                          onChange={(e) => setPromoDiscountPercent(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-zinc-400 font-mono">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Min Order ($ USD)</label>
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        step="0.01"
                        required
                        value={promoMinSubtotal}
                        onChange={(e) => setPromoMinSubtotal(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Description / Campaign Label</label>
                    <input
                      type="text"
                      maxLength={140}
                      value={promoDescription}
                      onChange={(e) => setPromoDescription(e.target.value)}
                      placeholder="e.g. 20% discount on DJ drops and visual packs"
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPromo}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{savingPromo ? 'Creating Code...' : 'Publish Promo Code'}</span>
                  </button>
                </form>

                {/* Promo Code Directory List */}
                <div className="xl:col-span-8 bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden space-y-0">
                  <div className="px-5 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-semibold text-zinc-100">
                        Active Promo Vouchers ({promoCodes.length})
                      </h3>
                    </div>
                    <input
                      type="text"
                      value={promoSearchQuery}
                      onChange={(e) => setPromoSearchQuery(e.target.value)}
                      placeholder="Filter promo codes..."
                      className="px-3 py-1.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 w-52"
                    />
                  </div>

                  {(() => {
                    const visiblePromos = promoCodes.filter((p) => {
                      const q = promoSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        p.code.toLowerCase().includes(q) ||
                        (p.description && p.description.toLowerCase().includes(q))
                      );
                    });

                    if (visiblePromos.length === 0) {
                      return (
                        <div className="p-10 text-center text-xs text-zinc-500 space-y-2">
                          <Tag className="w-8 h-8 text-zinc-600 mx-auto opacity-50" />
                          <p>No promo codes found matching your query.</p>
                          <p className="text-[11px] text-zinc-600">
                            Use the form on the left to create coupons like VIP20 or DROP15.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="divide-y divide-zinc-800">
                        {visiblePromos.map((promo) => (
                          <div
                            key={promo.id}
                            className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                              promo.active ? 'hover:bg-zinc-800/20' : 'opacity-60 bg-zinc-950/20'
                            }`}
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2.5">
                                <span className="text-base font-mono font-bold text-amber-400 tracking-wider">
                                  {promo.code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(promo.code);
                                    notifyUser(`Copied code "${promo.code}" to clipboard.`);
                                  }}
                                  title="Copy promo code"
                                  className="text-zinc-400 hover:text-amber-400 transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                  {promo.discountPercent}% OFF
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                  promo.active
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                }`}>
                                  {promo.active ? 'ACTIVE' : 'PAUSED'}
                                </span>
                              </div>
                              <div className="text-xs text-zinc-300">
                                {promo.description || `${promo.discountPercent}% off studio drops`}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-500 flex flex-wrap items-center gap-3">
                                <span>Min Subtotal: ${promo.minSubtotalUsd.toFixed(2)} USD</span>
                                <span>•</span>
                                <span>Redeemed: {promo.usageCount} time{promo.usageCount === 1 ? '' : 's'}</span>
                                <span>•</span>
                                <span>Created: {formatPayoutDate(promo.createdAt)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleTogglePromoActive(promo)}
                                className={`px-3 py-1.5 text-xs rounded font-medium border transition-colors ${
                                  promo.active
                                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                                }`}
                              >
                                {promo.active ? 'Pause Code' : 'Activate Code'}
                              </button>
                              {confirmDeletePromoId === promo.id ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePromo(promo.id)}
                                    className="px-2.5 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white font-semibold rounded"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeletePromoId(null)}
                                    className="px-2 py-1.5 text-xs bg-zinc-800 text-zinc-400 rounded"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePromoId(promo.id)}
                                  title="Delete promo code"
                                  className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* USER & CREATOR DIRECTORY */}
          {activeTab === 'users' && isAdmin && (
            <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden space-y-0">
              <div className="px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    <Users className="w-5 h-5 text-cyan-400" />
                    <span>Registered User Directory &amp; Creator Roles</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    View registered accounts, inspect co-creator verification, and promote users directly to Creator, Producer, or Admin
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search name, email, country..."
                    className="px-3 py-1.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 w-56"
                  />
                  <span className="text-xs font-mono text-zinc-400 tabular-nums">
                    {userDirectory.length} total users
                  </span>
                </div>
              </div>

              {/* Role Filter Tabs */}
              <div className="px-6 py-2.5 bg-[#0B0D11] border-b border-zinc-800 flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'All Users', count: userDirectory.length },
                  {
                    id: 'creator',
                    label: 'Co-Creators (95%)',
                    count: userDirectory.filter((u) => u.role === 'creator').length,
                  },
                  {
                    id: 'producer',
                    label: 'Producers',
                    count: userDirectory.filter((u) => u.role === 'producer').length,
                  },
                  {
                    id: 'admin',
                    label: 'Admins',
                    count: userDirectory.filter((u) => u.role === 'admin').length,
                  },
                  {
                    id: 'client',
                    label: 'Clients',
                    count: userDirectory.filter((u) => u.role === 'client').length,
                  },
                ].map((rf) => (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() => setUserRoleFilter(rf.id)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      userRoleFilter === rf.id
                        ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span>{rf.label}</span>
                    <span className="px-1.5 py-0.2 bg-zinc-800 text-[10px] rounded-full font-mono text-zinc-300">
                      {rf.count}
                    </span>
                  </button>
                ))}
              </div>

              {(() => {
                const filteredUsers = userDirectory.filter((u) => {
                  if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
                  const q = userSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    u.email.toLowerCase().includes(q) ||
                    u.displayName.toLowerCase().includes(q) ||
                    u.countryCode.toLowerCase().includes(q) ||
                    u.uid.toLowerCase().includes(q)
                  );
                });

                if (filteredUsers.length === 0) {
                  return (
                    <div className="p-10 text-center text-xs text-zinc-500">
                      No user accounts found matching this filter.
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B0D11] text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">User Profile</th>
                          <th className="px-4 py-3 font-medium">Firebase UID</th>
                          <th className="px-4 py-3 font-medium">Country Code</th>
                          <th className="px-4 py-3 font-medium">Current Role</th>
                          <th className="px-4 py-3 font-medium">Joined</th>
                          <th className="px-4 py-3 font-medium text-right">Assign Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {filteredUsers.map((u) => {
                          const isBootstrapped = u.email === 'djizeerunkx21062002@gmail.com';

                          return (
                            <tr key={u.uid} className="hover:bg-zinc-800/30 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-zinc-100 font-medium flex items-center gap-2">
                                  <span>{u.displayName || 'Studio User'}</span>
                                  {isBootstrapped && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      FOUNDER
                                    </span>
                                  )}
                                </div>
                                <div className="text-zinc-400 font-mono text-[11px]">{u.email}</div>
                              </td>
                              <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                                {u.uid.slice(0, 14)}...
                              </td>
                              <td className="px-4 py-3 font-mono text-zinc-300">
                                {u.countryCode}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                                    u.role === 'admin'
                                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                      : u.role === 'producer'
                                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                      : u.role === 'creator'
                                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                      : u.role === 'licensing_manager'
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {u.role === 'creator' ? 'co-creator (95%)' : u.role.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-zinc-400 text-[11px]">
                                {formatPayoutDate(u.createdAt)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {isBootstrapped ? (
                                  <span className="text-[11px] font-mono text-zinc-500">Permanent Owner</span>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5">
                                    <select
                                      disabled={savingUserRole}
                                      value={u.role}
                                      onChange={(e) =>
                                        handleUpdateUserRole(u, e.target.value as UserRole)
                                      }
                                      className="px-2 py-1 bg-[#0B0D11] border border-zinc-700 rounded text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                                    >
                                      <option value="client">Client</option>
                                      <option value="creator">Co-Creator (95%)</option>
                                      <option value="producer">Producer</option>
                                      <option value="licensing_manager">Licensing Manager</option>
                                      <option value="admin">Admin</option>
                                    </select>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* SECURITY & ACTIVITY AUDIT TRAIL */}
          {activeTab === 'audit_logs' && isAdmin && (
            <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden space-y-0">
              <div className="px-6 py-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-rose-400" />
                    <span>Security &amp; Operations Audit Trail</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Immutable log of administrative operations, catalog edits, promo codes, and role updates
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    placeholder="Search logs by action or actor..."
                    className="px-3 py-1.5 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 w-56"
                  />
                  <button
                    type="button"
                    onClick={handleExportAdminLogsCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-rose-400" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Action Filter Pills */}
              <div className="px-6 py-2.5 bg-[#0B0D11] border-b border-zinc-800 flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'All Events' },
                  { id: 'create_promo', label: 'Promo Created' },
                  { id: 'toggle_promo', label: 'Promo Toggled' },
                  { id: 'update_user_role', label: 'Role Changes' },
                  { id: 'update_order_status', label: 'Order Status' },
                  { id: 'resend_receipt', label: 'Receipts Resent' },
                  { id: 'update_storefront_config', label: 'Storefront CMS' },
                ].map((af) => (
                  <button
                    key={af.id}
                    type="button"
                    onClick={() => setAuditActionFilter(af.id)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      auditActionFilter === af.id
                        ? 'bg-rose-500/15 border border-rose-500/40 text-rose-300 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {af.label}
                  </button>
                ))}
              </div>

              {(() => {
                const filteredLogs = adminLogs.filter((log) => {
                  if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
                  const q = auditSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    log.action.toLowerCase().includes(q) ||
                    log.targetId.toLowerCase().includes(q) ||
                    log.details.toLowerCase().includes(q) ||
                    log.actorEmail.toLowerCase().includes(q)
                  );
                });

                if (filteredLogs.length === 0) {
                  return (
                    <div className="p-10 text-center text-xs text-zinc-500 space-y-1">
                      <p>No administrative activity recorded matching this filter.</p>
                      <p className="text-[11px] text-zinc-600">
                        Admin events will populate here when promo codes are created, order statuses changed, or roles delegated.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B0D11] text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">Timestamp</th>
                          <th className="px-4 py-3 font-medium">Actor</th>
                          <th className="px-4 py-3 font-medium">Action</th>
                          <th className="px-4 py-3 font-medium">Target ID</th>
                          <th className="px-4 py-3 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70 font-mono">
                        {filteredLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 text-zinc-400 text-[11px] whitespace-nowrap">
                              {formatPayoutDate(log.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-zinc-300">
                              <div>{log.actorEmail}</div>
                              <div className="text-[10px] text-zinc-500">{log.actorUid.slice(0, 10)}...</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold uppercase">
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-amber-400 font-bold text-[11px]">
                              {log.targetId}
                            </td>
                            <td className="px-4 py-3 font-sans text-xs text-zinc-300 max-w-md">
                              {log.details}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* SYSTEM OPS & DIAGNOSTICS */}
          {activeTab === 'system_ops' && isAdmin && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-amber-500" />
                    <span>System Ops, Diagnostics &amp; Emergency Controls</span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Manage emergency maintenance lockdown, inspect live Firestore collection record counts, and export full JSON system backups.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadAdminAccessHtml}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium text-xs rounded-md transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download admin-access.html</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadHomeHtml}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium text-xs rounded-md transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Download index.html (Home)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSystemSnapshot}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Snapshot JSON</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Emergency Maintenance Lockdown Controller */}
                <div className="xl:col-span-6 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                        maintenanceMode ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Emergency Maintenance Lockdown
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Toggle platform-wide maintenance mode to pause checkout and display broadcast banners
                        </p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-[11px] font-mono rounded ${
                      maintenanceMode ? 'bg-red-500/20 text-red-300 font-bold' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {maintenanceMode ? 'LOCKDOWN ACTIVE' : 'SYSTEM LIVE'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Maintenance Broadcast Message</label>
                      <textarea
                        rows={3}
                        maxLength={200}
                        value={maintenanceMessage}
                        onChange={(e) => setMaintenanceMessage(e.target.value)}
                        placeholder="Platform scheduled maintenance in progress. Orders will resume shortly."
                        className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      {maintenanceMode ? (
                        <button
                          type="button"
                          onClick={() => handleToggleMaintenanceMode(false)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded transition-colors"
                        >
                          Disable Maintenance &amp; Resume Live Sales
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleMaintenanceMode(true)}
                          className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded transition-colors"
                        >
                          Enable Emergency Lockdown Mode
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Firestore Database Collection Record Counts & Health */}
                <div className="xl:col-span-6 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                    <h3 className="text-sm font-semibold text-zinc-100">
                      Firestore Database Diagnostics
                    </h3>
                    <span className="text-xs font-mono text-emerald-400">Connected · Real-time Sync</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Catalog Drops', count: drops.length, path: 'drops' },
                      { label: 'Orders', count: orders.length, path: 'orders' },
                      { label: 'Custom Briefs', count: requests.length, path: 'customRequests' },
                      { label: 'Audio Licenses', count: licenses.length, path: 'licenses' },
                      { label: 'Reviews', count: reviews.length, path: 'reviews' },
                      { label: 'Payout Requests', count: payoutRequests.length, path: 'payoutRequests' },
                      { label: 'Users & Creators', count: userDirectory.length, path: 'users' },
                      { label: 'Promo Codes', count: promoCodes.length, path: 'promoCodes' },
                      { label: 'Audit Logs', count: adminLogs.length, path: 'adminLogs' },
                    ].map((st) => (
                      <div key={st.label} className="p-3 bg-[#0B0D11] border border-zinc-800 rounded space-y-1">
                        <div className="text-[11px] text-zinc-400 truncate">{st.label}</div>
                        <div className="text-lg font-bold font-mono text-zinc-100">{st.count}</div>
                        <div className="text-[10px] font-mono text-zinc-600">/{st.path}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customer Support Inquiries & Email Log Center */}
              <div className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden space-y-0">
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-amber-400" />
                      <span>Customer Support Communications &amp; Email Dispatch Log</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Support recipient: <span className="font-mono text-amber-300">opioisaac21062002@gmail.com</span> · WhatsApp: <span className="font-mono text-emerald-300">+256784903051</span>
                    </p>
                  </div>
                  <span className="text-xs font-mono text-zinc-400">{emailLogs.length} logged emails</span>
                </div>

                {emailLogs.length === 0 ? (
                  <div className="p-10 text-center text-xs text-zinc-500">
                    No email notifications logged yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0B0D11] text-zinc-400 border-b border-zinc-800">
                        <tr>
                          <th className="px-4 py-3 font-medium">Timestamp</th>
                          <th className="px-4 py-3 font-medium">Recipient</th>
                          <th className="px-4 py-3 font-medium">Milestone / Context</th>
                          <th className="px-4 py-3 font-medium">Subject</th>
                          <th className="px-4 py-3 font-medium">Delivery Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/70">
                        {emailLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-zinc-800/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-zinc-400 text-[11px] whitespace-nowrap">
                              {formatPayoutDate(log.createdAt)}
                            </td>
                            <td className="px-4 py-3 font-mono text-zinc-200">{log.recipientEmail}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                {log.milestone}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-zinc-100 font-medium">{log.subject}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                                log.deliveryStatus === 'sent_smtp'
                                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-400'
                              }`}>
                                {log.deliveryStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TEAM & RBAC */}
          {activeTab === 'team' && isAdmin && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-zinc-100">
                    Role-Based Team Collaboration (RBAC)
                  </h2>
                  <span className="text-xs font-mono text-zinc-400">
                    Owner: djizeerunkx21062002@gmail.com
                  </span>
                </div>
                <div className="divide-y divide-zinc-800">
                  {teamMembers.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-500">
                      No additional collaborators assigned yet. Add a collaborator UID on the right to grant Producer, Licensing Manager, or Admin access.
                    </div>
                  ) : (
                    teamMembers.map((member) => (
                      <div key={member.uid} className="p-4 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-100">{member.displayName}</div>
                          <div className="text-xs font-mono text-zinc-400">
                            {member.role} · {member.specialty} · UID: {member.uid}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleMemberActive(member)}
                          className={`px-3 py-1.5 text-xs rounded-md border ${
                            member.active
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          {member.active ? 'Active' : 'Suspended'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <form
                onSubmit={handleSaveTeamMember}
                className="xl:col-span-5 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4"
              >
                <h3 className="text-sm font-semibold text-zinc-100">Assign Collaborator Role</h3>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Collaborator Firebase UID</label>
                  <input
                    type="text"
                    required
                    value={memberUid}
                    onChange={(e) => setMemberUid(e.target.value)}
                    placeholder="Paste user UID"
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    placeholder="e.g. Alex Sound Engineer"
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Role</label>
                  <select
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value as typeof memberRole)}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                  >
                    <option value="producer">Producer (Audio Uploads, Drops &amp; Milestones)</option>
                    <option value="licensing_manager">Licensing Manager (Agreements &amp; Compliance)</option>
                    <option value="admin">Admin (Full Studio Ownership)</option>
                    <option value="viewer">Viewer (Read-only Team Access)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Specialty</label>
                  <input
                    type="text"
                    value={memberSpecialty}
                    onChange={(e) => setMemberSpecialty(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                >
                  Save Collaborator Access
                </button>
              </form>
            </div>
          )}

          {/* PAYMENT & TAX SETTINGS */}
          {activeTab === 'settings' && isAdmin && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveGatewaySettings}
                className="xl:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-6"
              >
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-5 h-5 text-amber-500" />
                  <div>
                    <h2 className="text-base font-semibold text-zinc-100">
                      Payment Gateway &amp; Payout Account Configuration
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Run in Deferred Payout mode right now and link your live merchant settlement account whenever you are ready.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Payout Account Status</label>
                    <select
                      value={payoutStatus}
                      onChange={(e) => setPayoutStatus(e.target.value as 'pending_setup' | 'connected')}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                    >
                      <option value="pending_setup">Add Payout Account Later (Sandbox Ready)</option>
                      <option value="connected">Live Payout Account Connected</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Admin Payout Method</label>
                    <select
                      value={adminPayoutMethod}
                      onChange={(e) => {
                        const next = e.target.value as 'bank' | 'mobile_money';
                        setAdminPayoutMethod(next);
                        setPayoutRequestMethod(next === 'mobile_money' ? 'mobile_money' : 'bank_transfer');
                      }}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                    >
                      <option value="bank">Bank (Local Bank / IBAN / SWIFT Wire)</option>
                      <option value="mobile_money">Mobile Money (MTN MoMo / Airtel Money / M-Pesa)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Primary Merchant Gateway</label>
                    <select
                      value={gatewayProvider}
                      onChange={(e) => setGatewayProvider(e.target.value as typeof gatewayProvider)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                    >
                      <option value="deferred_payout">Deferred Payout (Test &amp; Pre-launch)</option>
                      <option value="bank_transfer">Bank Transfer (Direct Settlement)</option>
                      <option value="mobile_money">Mobile Money (MTN MoMo / Airtel / M-Pesa)</option>
                      <option value="flutterwave">Flutterwave (Africa + Global Cards/MoMo)</option>
                      <option value="stripe">Stripe Connect (Global Multi-Currency)</option>
                      <option value="paypal">PayPal Commerce</option>
                      <option value="mtn_momo">MTN Mobile Money Uganda (+256)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      {adminPayoutMethod === 'bank'
                        ? 'Bank Account / IBAN / SWIFT Reference'
                        : 'Mobile Money Number / Wallet Label'}
                    </label>
                    <input
                      type="text"
                      value={merchantAccountLabel}
                      onChange={(e) => setMerchantAccountLabel(e.target.value)}
                      placeholder={
                        adminPayoutMethod === 'bank'
                          ? 'e.g. Stanbic Bank Account / IBAN / SWIFT'
                          : 'e.g. +256784903051 MTN MoMo'
                      }
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Default Settlement Currency</label>
                    <select
                      value={payoutCurrency}
                      onChange={(e) => setPayoutCurrency(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                    >
                      {PAYOUT_CURRENCIES.map((cur) => (
                        <option key={cur.code} value={cur.code}>
                          {cur.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Settlement Notification Email</label>
                    <input
                      type="email"
                      value={settlementEmail}
                      onChange={(e) => setSettlementEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Customer Support Email</label>
                    <input
                      type="text"
                      readOnly
                      value="opioisaac21062002@gmail.com"
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono text-zinc-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Owner WhatsApp Line</label>
                    <input
                      type="text"
                      readOnly
                      value="+256784903051"
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm font-mono text-zinc-400"
                    />
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-zinc-800">
                  <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoTaxCompliance}
                      onChange={(e) => setAutoTaxCompliance(e.target.checked)}
                      className="accent-amber-500"
                    />
                    Enable automated VAT/GST/Sales Tax compliance across 550+ global jurisdictions
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoMilestoneEmails}
                      onChange={(e) => setAutoMilestoneEmails(e.target.checked)}
                      className="accent-amber-500"
                    />
                    Automatically dispatch milestone &amp; order confirmation email notifications
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={payoutEmailAlerts}
                      onChange={(e) => setPayoutEmailAlerts(e.target.checked)}
                      className="accent-amber-500"
                    />
                    Send email alerts on producer payout requests and settlement updates
                  </label>
                </div>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
                >
                  Save Gateway &amp; Tax Settings
                </button>
              </form>

              {/* Country & Currency Payment Methods Matrix */}
              <div className="xl:col-span-5 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    Country &amp; Currency Payment Rails
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Inspect active buyer checkout methods and producer payout rails for any country or currency.
                  </p>
                </div>

                <JurisdictionSelector
                  label="Inspect Country / Tax Zone"
                  value={explorerCountryCode}
                  onChange={setExplorerCountryCode}
                />

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Currency Override
                  </label>
                  <select
                    value={explorerCurrencyOverride}
                    onChange={(e) => setExplorerCurrencyOverride(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-100"
                  >
                    {CHECKOUT_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code === 'LOCAL'
                          ? `Local (${explorerJurisdiction.currency})`
                          : code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Buyer Checkout Methods</span>
                    <span className="font-mono text-amber-400">{explorerActiveCurrency}</span>
                  </div>
                  <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-md bg-[#0B0D11]">
                    {explorerCheckoutMethods.map((m) => (
                      <div key={m.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-200 truncate">{m.label}</div>
                          <div className="text-zinc-500">{m.rail}</div>
                        </div>
                        <span className="font-mono text-zinc-400 shrink-0">{m.settlementSpeed}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Producer Payout Rails ({explorerActiveCurrency})</span>
                    <span className="font-mono">{explorerPayoutMethods.length} rails</span>
                  </div>
                  <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-md bg-[#0B0D11]">
                    {explorerPayoutMethods.slice(0, 5).map((m) => (
                      <div key={m.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-zinc-200 truncate">{m.label}</span>
                        <span className="font-mono text-zinc-500 shrink-0">{m.settlementSpeed}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Storefront Announcement & Hero CMS Customizer */}
              <form
                onSubmit={handleSaveStorefrontCustomization}
                className="col-span-1 xl:col-span-12 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <div>
                      <h2 className="text-base font-semibold text-zinc-100">
                        Storefront Announcement Banner &amp; Hero Headline CMS
                      </h2>
                      <p className="text-xs text-zinc-400">
                        Customize the promotional message displayed to buyers at the top of the storefront and update hero copy in real time.
                      </p>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingStorefrontCustomization}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{savingStorefrontCustomization ? 'Publishing...' : 'Publish Storefront Changes'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  {/* Announcement Banner Settings */}
                  <div className="p-4 bg-[#0B0D11] border border-zinc-800 rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                        <Tag className="w-4 h-4" />
                        <span>Top Announcement Banner</span>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={announcementEnabled}
                          onChange={(e) => setAnnouncementEnabled(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>Enable Top Banner</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Badge Text</label>
                        <input
                          type="text"
                          maxLength={32}
                          value={announcementBadge}
                          onChange={(e) => setAnnouncementBadge(e.target.value)}
                          placeholder="VIP PROMO"
                          className="w-full px-3 py-2 bg-[#12151C] border border-zinc-800 rounded-md text-xs font-mono font-bold text-amber-300 uppercase focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs text-zinc-400 mb-1">Announcement Message</label>
                        <input
                          type="text"
                          maxLength={200}
                          value={announcementText}
                          onChange={(e) => setAnnouncementText(e.target.value)}
                          placeholder="Use code VIP20 at checkout for 20% off all studio masters!"
                          className="w-full px-3 py-2 bg-[#12151C] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Live Banner Preview */}
                    <div className="space-y-1">
                      <div className="text-[11px] font-mono text-zinc-500">Live Top Banner Preview:</div>
                      {announcementEnabled ? (
                        <div className="p-2.5 bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 border border-amber-500/40 rounded flex items-center justify-center gap-2 text-xs text-amber-200">
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-500 text-zinc-950">
                            {announcementBadge || 'PROMO'}
                          </span>
                          <span className="font-medium truncate">{announcementText}</span>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded text-center text-xs text-zinc-500 italic">
                          Announcement banner is currently disabled (hidden from storefront)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hero Copy & Custom Commission Defaults */}
                  <div className="p-4 bg-[#0B0D11] border border-zinc-800 rounded-lg space-y-4">
                    <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Hero Headline &amp; Commission Settings</span>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Hero Headline</label>
                      <input
                        type="text"
                        maxLength={140}
                        value={heroHeadline}
                        onChange={(e) => setHeroHeadline(e.target.value)}
                        placeholder="Own Your Sound Across 550+ Global Jurisdictions"
                        className="w-full px-3 py-2 bg-[#12151C] border border-zinc-800 rounded-md text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-semibold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Hero Subheadline</label>
                      <textarea
                        rows={2}
                        maxLength={350}
                        value={heroSubheadline}
                        onChange={(e) => setHeroSubheadline(e.target.value)}
                        placeholder="Discover studio-mastered DJ drops, issue binding custom audio licensing agreements..."
                        className="w-full px-3 py-2 bg-[#12151C] border border-zinc-800 rounded-md text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-zinc-800">
                      <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-2">
                        <input
                          type="checkbox"
                          checked={customRequestsEnabled}
                          onChange={(e) => setCustomRequestsEnabled(e.target.checked)}
                          className="accent-amber-500"
                        />
                        <span>Accept Custom Drop Requests</span>
                      </label>
                      <div>
                        <label className="block text-[11px] text-zinc-400 mb-1">Starting Custom Quote ($ USD)</label>
                        <input
                          type="number"
                          min={1}
                          max={5000}
                          value={defaultCustomPriceUsd}
                          onChange={(e) => setDefaultCustomPriceUsd(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-[#12151C] border border-zinc-800 rounded text-xs font-mono text-zinc-100 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      <MediaPreviewModal
        target={portalPreviewTarget}
        reviews={reviews}
        onClose={() => setPortalPreviewTarget(null)}
      />
    </div>
  );
}
