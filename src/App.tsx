import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  Check,
  Disc3,
  Eye,
  FileArchive,
  Film,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  Palette,
  Pause,
  Play,
  Search,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Volume2,
} from 'lucide-react';
import { CheckoutDrawer } from './components/CheckoutDrawer';
import { CustomerSupportWidget } from './components/CustomerSupportWidget';
import { CustomRequestSection } from './components/CustomRequestSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LicenseModal } from './components/LicenseModal';
import {
  inferMediaTypeFromDrop,
  MediaPreviewModal,
  PreviewTarget,
} from './components/MediaPreviewModal';
import { ProductReviewsModal } from './components/ProductReviewsModal';
import { StudioDashboard } from './components/StudioDashboard';
import { INITIAL_DROPS, LICENSE_TIERS } from './data/catalogSeed';
import { getStoredThemeId, STUDIO_THEMES, THEME_STORAGE_KEY } from './data/themes';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './firebase';
import {
  AdminActivityLog,
  AudioAsset,
  CartItem,
  CreatorProfile,
  CreatorSaleRecord,
  CustomDropRequest,
  DropProduct,
  EmailNotificationLog,
  EmailTemplateConfig,
  LicenseAgreement,
  LicenseTier,
  OrderRecord,
  PayoutRequest,
  ProductMediaType,
  ProductReview,
  PromoCode,
  PublicStorefrontConfig,
  StudioGatewaySettings,
  TeamMember,
  ThemeId,
  UserProfileRecord,
  UserRole,
} from './types';

function MainApp() {
  const [view, setView] = useState<'storefront' | 'portal'>('storefront');
  const [themeId, setThemeId] = useState<ThemeId>(() => getStoredThemeId());
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('client');

  // Storefront Catalog & Search State
  const [cloudDrops, setCloudDrops] = useState<DropProduct[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('All');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | ProductMediaType>('all');
  const [maxBpm, setMaxBpm] = useState(200);
  const [selectedTiers, setSelectedTiers] = useState<Record<string, LicenseTier>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [inspectedLicense, setInspectedLicense] = useState<LicenseAgreement | null>(null);
  const [inspectedReviewDrop, setInspectedReviewDrop] = useState<DropProduct | null>(null);
  const [previewMediaTarget, setPreviewMediaTarget] = useState<PreviewTarget | null>(null);

  // Audio Preview Player State
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingAudio, setPlayingAudio] = useState<{ id: string; title: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Workspace Collections State
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [licenses, setLicenses] = useState<LicenseAgreement[]>([]);
  const [requests, setRequests] = useState<CustomDropRequest[]>([]);
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailNotificationLog[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [creatorProfiles, setCreatorProfiles] = useState<CreatorProfile[]>([]);
  const [creatorSales, setCreatorSales] = useState<CreatorSaleRecord[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [userDirectory, setUserDirectory] = useState<UserProfileRecord[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminActivityLog[]>([]);
  const [gatewaySettings, setGatewaySettings] = useState<StudioGatewaySettings | null>(null);
  const [emailTemplateConfig, setEmailTemplateConfig] = useState<EmailTemplateConfig | null>(null);
  const [storefrontConfig, setStorefrontConfig] = useState<PublicStorefrontConfig | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  }, [themeId]);

  // Startup connection check & public catalog + reviews + creatorProfiles listeners
  useEffect(() => {
    testConnection();

    const unsubDrops = onSnapshot(
      collection(db, 'drops'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as DropProduct);
        setCloudDrops(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'drops')
    );

    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as ProductReview);
        setReviews(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
    );

    const unsubCreators = onSnapshot(
      collection(db, 'creatorProfiles'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as CreatorProfile);
        setCreatorProfiles(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'creatorProfiles')
    );

    const unsubPublicConfig = onSnapshot(
      doc(db, 'publicConfig', 'storefront'),
      (snap) => {
        if (snap.exists()) {
          setStorefrontConfig(snap.data() as PublicStorefrontConfig);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'publicConfig/storefront')
    );

    return () => {
      unsubDrops();
      unsubReviews();
      unsubCreators();
      unsubPublicConfig();
    };
  }, []);

  // Auth state & role resolution
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setUserRole('client');
        setOrders([]);
        setLicenses([]);
        setRequests([]);
        setAudioAssets([]);
        setEmailLogs([]);
        setTeamMembers([]);
        setPayoutRequests([]);
        setCreatorSales([]);
        setGatewaySettings(null);
        setEmailTemplateConfig(null);
        setAuthReady(true);
        return;
      }

      const isBootstrappedAdmin =
        currentUser.emailVerified && currentUser.email === BOOTSTRAPPED_ADMIN_EMAIL;

      let resolvedRole: UserRole = isBootstrappedAdmin ? 'admin' : 'client';

      if (!isBootstrappedAdmin) {
        try {
          const teamSnap = await getDoc(doc(db, 'teamMembers', currentUser.uid));
          if (teamSnap.exists()) {
            const tm = teamSnap.data() as TeamMember;
            if (tm.active) resolvedRole = tm.role;
          }
        } catch {
          // Default to client role if not in teamMembers
        }
      }

      // Sync isolated user profile cleanly & preserve self-registered creator role
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const existingSnap = await getDoc(userRef);
        if (!existingSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: (currentUser.email || 'user@dropvault.audio').slice(0, 160),
            displayName: (currentUser.displayName || 'Studio User').slice(0, 100),
            role: resolvedRole,
            countryCode: 'UG',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (resolvedRole === 'client') {
          const existingData = existingSnap.data() as { role?: UserRole };
          if (existingData.role === 'creator') {
            resolvedRole = 'creator';
          }
        }
      } catch (err) {
        console.error('User profile sync note:', err);
      }

      setUserRole(resolvedRole);
      setAuthReady(true);
    });

    return () => unsubAuth();
  }, []);

  // Authenticated Firestore listeners strictly aligned with security rules
  useEffect(() => {
    if (!authReady || !user) return;

    const isBootstrappedAdmin =
      user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL;

    const ordersQuery = isBootstrappedAdmin
      ? collection(db, 'orders')
      : query(collection(db, 'orders'), where('buyerUid', '==', user.uid));

    const licensesQuery = isBootstrappedAdmin
      ? collection(db, 'licenses')
      : query(collection(db, 'licenses'), where('ownerUid', '==', user.uid));

    const requestsQuery = isBootstrappedAdmin
      ? collection(db, 'customRequests')
      : userRole === 'producer'
      ? query(collection(db, 'customRequests'), where('assignedProducerUid', '==', user.uid))
      : query(collection(db, 'customRequests'), where('clientUid', '==', user.uid));

    const emailsQuery = isBootstrappedAdmin
      ? collection(db, 'emailLogs')
      : query(collection(db, 'emailLogs'), where('ownerUid', '==', user.uid));

    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => setOrders(snap.docs.map((d) => d.data() as OrderRecord)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
    );

    const unsubLicenses = onSnapshot(
      licensesQuery,
      (snap) => setLicenses(snap.docs.map((d) => d.data() as LicenseAgreement)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'licenses')
    );

    const unsubRequests = onSnapshot(
      requestsQuery,
      (snap) => setRequests(snap.docs.map((d) => d.data() as CustomDropRequest)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'customRequests')
    );

    const unsubEmails = onSnapshot(
      emailsQuery,
      (snap) => setEmailLogs(snap.docs.map((d) => d.data() as EmailNotificationLog)),
      (err) => handleFirestoreError(err, OperationType.LIST, 'emailLogs')
    );

    let unsubAssets = () => {};
    let unsubPayouts = () => {};
    let unsubCreatorSales = () => {};
    if (isBootstrappedAdmin || userRole === 'producer' || userRole === 'creator') {
      const assetsQuery = isBootstrappedAdmin
        ? collection(db, 'audioAssets')
        : query(collection(db, 'audioAssets'), where('uploadedByUid', '==', user.uid));
      unsubAssets = onSnapshot(
        assetsQuery,
        (snap) => setAudioAssets(snap.docs.map((d) => d.data() as AudioAsset)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'audioAssets')
      );

      const payoutsQuery = isBootstrappedAdmin
        ? collection(db, 'payoutRequests')
        : query(collection(db, 'payoutRequests'), where('producerUid', '==', user.uid));
      unsubPayouts = onSnapshot(
        payoutsQuery,
        (snap) => setPayoutRequests(snap.docs.map((d) => d.data() as PayoutRequest)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'payoutRequests')
      );
    }

    if (isBootstrappedAdmin || userRole === 'creator') {
      const salesQuery = isBootstrappedAdmin
        ? collection(db, 'creatorSales')
        : query(collection(db, 'creatorSales'), where('creatorUid', '==', user.uid));
      unsubCreatorSales = onSnapshot(
        salesQuery,
        (snap) => setCreatorSales(snap.docs.map((d) => d.data() as CreatorSaleRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'creatorSales')
      );
    }

    let unsubTeam = () => {};
    let unsubSettings = () => {};
    let unsubPromos = () => {};
    let unsubUsers = () => {};
    let unsubLogs = () => {};
    if (isBootstrappedAdmin) {
      unsubTeam = onSnapshot(
        collection(db, 'teamMembers'),
        (snap) => setTeamMembers(snap.docs.map((d) => d.data() as TeamMember)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'teamMembers')
      );
      unsubSettings = onSnapshot(
        doc(db, 'studioSettings', 'gateway'),
        (snap) => {
          if (snap.exists()) setGatewaySettings(snap.data() as StudioGatewaySettings);
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'studioSettings/gateway')
      );
      unsubPromos = onSnapshot(
        collection(db, 'promoCodes'),
        (snap) => setPromoCodes(snap.docs.map((d) => d.data() as PromoCode)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'promoCodes')
      );
      unsubUsers = onSnapshot(
        collection(db, 'users'),
        (snap) => setUserDirectory(snap.docs.map((d) => d.data() as UserProfileRecord)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'users')
      );
      unsubLogs = onSnapshot(
        collection(db, 'adminLogs'),
        (snap) => setAdminLogs(snap.docs.map((d) => d.data() as AdminActivityLog)),
        (err) => handleFirestoreError(err, OperationType.LIST, 'adminLogs')
      );
    }

    const unsubEmailTemplate = onSnapshot(
      doc(db, 'emailTemplates', 'default'),
      (snap) => {
        if (snap.exists()) setEmailTemplateConfig(snap.data() as EmailTemplateConfig);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'emailTemplates/default')
    );

    return () => {
      unsubOrders();
      unsubLicenses();
      unsubRequests();
      unsubEmails();
      unsubAssets();
      unsubPayouts();
      unsubCreatorSales();
      unsubTeam();
      unsubSettings();
      unsubPromos();
      unsubUsers();
      unsubLogs();
      unsubEmailTemplate();
    };
  }, [authReady, user, userRole]);

  const allAdminDrops = useMemo(() => {
    if (cloudDrops.length === 0) return INITIAL_DROPS;
    const mergedMap = new Map<string, DropProduct>();
    for (const d of INITIAL_DROPS) mergedMap.set(d.id, d);
    for (const d of cloudDrops) mergedMap.set(d.id, d);
    return Array.from(mergedMap.values());
  }, [cloudDrops]);

  const catalogDrops = useMemo(
    () => allAdminDrops.filter((d) => !d.archived),
    [allAdminDrops]
  );

  const cloudDropIds = useMemo(
    () => cloudDrops.map((d) => d.id),
    [cloudDrops]
  );

  const reviewSummaryMap = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const r of reviews) {
      const entry = map.get(r.dropId) || { sum: 0, count: 0 };
      entry.sum += r.rating;
      entry.count += 1;
      map.set(r.dropId, entry);
    }
    const result = new Map<string, { avg: number; count: number }>();
    for (const [dropId, data] of map.entries()) {
      result.set(dropId, {
        avg: Number((data.sum / data.count).toFixed(1)),
        count: data.count,
      });
    }
    return result;
  }, [reviews]);

  const genres = useMemo(
    () => ['All', ...Array.from(new Set(catalogDrops.map((d) => d.genre)))],
    [catalogDrops]
  );

  const filteredDrops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogDrops.filter((d) => {
      const mType = inferMediaTypeFromDrop(d);
      if (mediaTypeFilter !== 'all' && mType !== mediaTypeFilter) return false;
      if (genreFilter !== 'All' && d.genre !== genreFilter) return false;
      if (d.bpm > maxBpm && mType === 'audio') return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.voiceTalent.toLowerCase().includes(q) ||
        d.genre.toLowerCase().includes(q) ||
        d.vocalStyle.toLowerCase().includes(q) ||
        d.musicalKey.toLowerCase().includes(q) ||
        (d.audioFormat && d.audioFormat.toLowerCase().includes(q)) ||
        (d.originalFileName && d.originalFileName.toLowerCase().includes(q)) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [catalogDrops, genreFilter, maxBpm, mediaTypeFilter, searchQuery]);

  const handleTogglePlay = (audioId: string, title: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playingAudio?.id === audioId && isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    const srcUrl = `/api/audio/preview/${encodeURIComponent(audioId)}`;
    if (playingAudio?.id !== audioId) {
      audio.src = srcUrl;
      setPlayingAudio({ id: audioId, title });
    }
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  const handleAddToCart = (drop: DropProduct) => {
    const tier = selectedTiers[drop.id] || 'standard';
    setCart((prev) => [
      ...prev,
      {
        drop,
        tier,
        djNameOverlay: user?.displayName || 'DJ Licensee',
      },
    ]);
    setCheckoutOpen(true);
  };

  const scrollToSection = (id: string) => {
    setView('storefront');
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  return (
    <div className="min-h-screen bg-[#0B0D11] text-zinc-100 flex flex-col">
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />

      {/* Storefront Announcement Banner (Admin Controlled) */}
      {storefrontConfig?.announcementEnabled && (
        <aside
          aria-label="Platform Announcement"
          className="bg-gradient-to-r from-amber-500/20 via-amber-500/30 to-amber-500/20 border-b border-amber-500/30 px-6 py-2 text-center text-xs text-amber-200 flex items-center justify-center gap-2.5"
        >
          <span className="px-2 py-0.5 rounded bg-amber-500 text-zinc-950 font-bold font-mono text-[10px] uppercase">
            {storefrontConfig.announcementBadge || 'PROMO'}
          </span>
          <span className="font-medium">
            {storefrontConfig.announcementText || 'Exclusive DJ drops & custom audio licensing agreements.'}
          </span>
        </aside>
      )}

      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#0B0D11]/95 backdrop-blur-md border-b border-zinc-800/80">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => setView('storefront')}
            className="text-lg font-bold tracking-tight text-zinc-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-500"
          >
            DropVault Audio
          </button>

          {/* Zone 2: 4 Single-line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
            <button
              type="button"
              onClick={() => scrollToSection('catalog')}
              className="hover:text-zinc-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('licensing')}
              className="hover:text-zinc-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Licensing
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('custom-drops')}
              className="hover:text-zinc-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Custom Drops
            </button>
            <button
              type="button"
              onClick={() => setView('portal')}
              className={`hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                view === 'portal' ? 'text-amber-400 font-semibold' : 'hover:text-zinc-100'
              }`}
            >
              <span>Studio Portal</span>
              {userRole === 'admin' && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] uppercase">
                  Admin
                </span>
              )}
            </button>
          </nav>

          {/* Zone 3: Theme Selector & Bag Primary Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((prev) => !prev)}
                aria-label="Switch studio theme"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#12151C] border border-zinc-800 hover:border-amber-500 text-zinc-200 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">
                  {STUDIO_THEMES.find((t) => t.id === themeId)?.name || 'Theme'}
                </span>
              </button>
              {themeMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-[#12151C] border border-zinc-800 rounded-lg shadow-xl p-2 z-50 space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-mono text-zinc-400">
                    Studio Appearance Theme
                  </div>
                  {STUDIO_THEMES.map((theme) => {
                    const active = themeId === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          setThemeId(theme.id);
                          setThemeMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left text-xs transition-colors ${
                          active
                            ? 'bg-amber-500/15 text-amber-400 font-semibold'
                            : 'text-zinc-300 hover:bg-zinc-800/60'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-zinc-700 shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: theme.canvasSwatch }}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: theme.accentSwatch }}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{theme.name}</div>
                          <div className="text-[11px] font-normal text-zinc-500 truncate">
                            {theme.tagline}
                          </div>
                        </div>
                        {active && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCheckoutOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">Bag ({cart.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {view === 'portal' ? (
          <StudioDashboard
            user={user}
            userRole={userRole}
            drops={catalogDrops}
            allAdminDrops={allAdminDrops}
            cloudDropIds={cloudDropIds}
            reviews={reviews}
            orders={orders}
            licenses={licenses}
            requests={requests}
            audioAssets={audioAssets}
            emailLogs={emailLogs}
            teamMembers={teamMembers}
            payoutRequests={payoutRequests}
            creatorProfiles={creatorProfiles}
            creatorSales={creatorSales}
            promoCodes={promoCodes}
            userDirectory={userDirectory}
            adminLogs={adminLogs}
            gatewaySettings={gatewaySettings}
            emailTemplateConfig={emailTemplateConfig}
            storefrontConfig={storefrontConfig}
            themeId={themeId}
            onSelectTheme={setThemeId}
            onRoleUpgraded={(role) => setUserRole(role)}
            onInspectLicense={(lic) => setInspectedLicense(lic)}
            onPlayAudio={handleTogglePlay}
            onBackToStorefront={() => setView('storefront')}
          />
        ) : (
          <>
            {/* Hero Section */}
            <section className="max-w-[1440px] mx-auto px-6 pt-12 pb-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                <div className="lg:col-span-6 flex flex-col justify-center space-y-6 py-4">
                  <p className="text-xs font-medium text-amber-400 tracking-wide">
                    Global DJ Drops &amp; Broadcast Licensing Platform
                  </p>
                  <h1 className="text-3xl sm:text-5xl font-extrabold text-zinc-100 tracking-tight leading-[1.1] text-balance max-w-2xl">
                    {storefrontConfig?.heroHeadline || 'Own Your Sound Across 550+ Global Jurisdictions'}
                  </h1>
                  <p className="text-base text-zinc-400 leading-relaxed max-w-xl">
                    {storefrontConfig?.heroSubheadline ||
                      'Discover studio-mastered DJ drops, issue binding custom audio licensing agreements, calculate VAT/GST compliance automatically, and deliver 24-bit WAV masters worldwide.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => scrollToSection('catalog')}
                      className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      Browse DJ Drops
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('portal')}
                      className="px-5 py-2.5 bg-[#12151C] hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium text-sm rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      Open Studio Portal
                    </button>
                    <button
                      type="button"
                      onClick={() => setView('portal')}
                      className="px-4 py-2.5 bg-[#12151C] hover:border-amber-500 border border-zinc-800 text-amber-400 font-medium text-sm rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      Sell as Co-Creator (Earn 95%)
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6 relative rounded-lg overflow-hidden border border-zinc-800 bg-[#12151C] min-h-[300px]">
                  <img
                    src="/src/assets/images/hero_dj_studio_1795606571688.jpg"
                    alt="Mastering console and vocal condenser microphone inside DropVault Audio studio"
                    referrerPolicy="no-referrer"
                    className="w-full h-full lg:h-full object-cover"
                  />
                  <div className="hero-overlay-text absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-6">
                    <div className="flex items-center justify-between w-full gap-4">
                      <div>
                        <div className="text-sm font-semibold text-zinc-100">
                          Instant Digital Master Delivery
                        </div>
                        <div className="text-xs text-zinc-300 mt-0.5">
                          {storefrontConfig?.gatewayModeLabel ||
                            'Built-in Gateway Ready · Add Payout Account Anytime'}
                        </div>
                      </div>
                      <span className="font-mono text-xs text-amber-400 shrink-0 tabular-nums">
                        24-bit / 96 kHz
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full-Width 4-Column Capability Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-zinc-800/80">
                {[
                  { value: '550+ Zones', label: 'Countries & Regional Tax Rules' },
                  { value: '3-Tier Rights', label: 'Standard, Commercial & Buyout' },
                  { value: '24-Bit WAV', label: 'Signed Cloud Master Delivery' },
                  { value: '+256 784 903 051', label: 'Direct WhatsApp Production Line' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-[#12151C] border border-zinc-800/90 rounded-lg px-5 py-4"
                  >
                    <div className="text-lg font-bold font-mono tabular-nums text-zinc-100">
                      {stat.value}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Seamless Search & Catalog Discovery */}
            <section id="catalog" className="max-w-[1440px] mx-auto px-6 py-12 border-t border-zinc-800/80 space-y-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
                    Studio DJ Drop Catalog
                  </h2>
                  <p className="text-sm text-zinc-400 mt-1">
                    Search by vocal style, BPM, musical key, or genre and audition live masters instantly
                  </p>
                </div>

                {/* Live Search Input + BPM slider */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                  <div className="relative flex-1 sm:w-80">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search tracks, voice, BPM, key, tags..."
                      className="w-full pl-10 pr-4 py-2.5 bg-[#12151C] border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex items-center gap-3 px-3.5 py-2 bg-[#12151C] border border-zinc-800 rounded-md">
                    <span className="text-xs text-zinc-400 whitespace-nowrap">
                      Max BPM: <span className="font-mono text-zinc-100 tabular-nums">{maxBpm}</span>
                    </span>
                    <input
                      type="range"
                      min={80}
                      max={200}
                      value={maxBpm}
                      onChange={(e) => setMaxBpm(Number(e.target.value))}
                      className="w-24 accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Media Format Filter Bar */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'all', label: 'All Formats', icon: Sparkles },
                  { id: 'audio', label: 'Audio Masters', icon: Disc3 },
                  { id: 'video', label: 'Video Visuals', icon: Film },
                  { id: 'image', label: 'Artwork & Images', icon: ImageIcon },
                  { id: 'other', label: 'Packs & Stems', icon: FileArchive },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const active = mediaTypeFilter === tab.id;
                  const count = catalogDrops.filter(
                    (d) => tab.id === 'all' || inferMediaTypeFromDrop(d) === tab.id
                  ).length;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMediaTypeFilter(tab.id as 'all' | ProductMediaType)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-zinc-100 text-zinc-950 font-semibold shadow'
                          : 'bg-[#12151C] border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${active ? 'text-amber-500' : 'text-zinc-400'}`} />
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                          active ? 'bg-zinc-200 text-zinc-900 font-bold' : 'bg-[#0B0D11] text-zinc-500'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Genre Interactive Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#12151C] border border-zinc-800 rounded-lg w-fit">
                {genres.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenreFilter(g)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      genreFilter === g
                        ? 'bg-amber-500 text-zinc-950 font-semibold'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {/* 3-Column Product Grid */}
              {filteredDrops.length === 0 ? (
                <div className="bg-[#12151C] border border-zinc-800 rounded-lg p-12 text-center space-y-2">
                  <p className="text-sm font-medium text-zinc-200">No DJ drops match your search</p>
                  <p className="text-xs text-zinc-500">
                    Clear your filter or commission a bespoke drop script below.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredDrops.map((drop) => {
                    const activeTier = selectedTiers[drop.id] || 'standard';
                    const price =
                      activeTier === 'standard'
                        ? drop.standardPriceUsd
                        : activeTier === 'commercial'
                        ? drop.commercialPriceUsd
                        : drop.exclusivePriceUsd;
                    const playingThis = playingAudio?.id === drop.audioFileId && isPlaying;
                    const mediaType = inferMediaTypeFromDrop(drop);

                    return (
                      <article
                        key={drop.id}
                        className="bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden flex flex-col hover:border-zinc-700 transition-colors"
                      >
                        <div className="relative aspect-[4/3] bg-zinc-900 overflow-hidden">
                          {mediaType === 'video' ? (
                            <video
                              src={`/api/media/preview/${encodeURIComponent(drop.audioFileId)}#t=0.5`}
                              poster={drop.coverImage}
                              muted
                              playsInline
                              preload="metadata"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={drop.coverImage}
                              alt={drop.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          )}

                          {/* Media Type Badge */}
                          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/80 backdrop-blur-sm rounded text-[10px] font-mono uppercase tracking-wider text-amber-300 border border-amber-500/30">
                            {mediaType === 'video' && <Film className="w-3 h-3" />}
                            {mediaType === 'image' && <ImageIcon className="w-3 h-3" />}
                            {mediaType === 'other' && <FileArchive className="w-3 h-3" />}
                            {mediaType === 'audio' && <Disc3 className="w-3 h-3" />}
                            <span>{mediaType}</span>
                            <span className="text-zinc-500">·</span>
                            <span className="text-zinc-200">{drop.audioFormat}</span>
                          </div>

                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex items-end justify-between p-4">
                            <div className="flex items-center gap-2">
                              {mediaType === 'video' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewMediaTarget({
                                      id: drop.id,
                                      title: drop.title,
                                      subtitle: `${drop.genre} · ${drop.vocalStyle}`,
                                      assetId: drop.audioFileId,
                                      mediaType: 'video',
                                      formatLabel: drop.audioFormat,
                                      coverImage: drop.coverImage,
                                      durationSec: drop.durationSec,
                                      fileSizeBytes: drop.fileSizeBytes,
                                      originalFileName: drop.originalFileName,
                                      drop,
                                    })
                                  }
                                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                                >
                                  <Film className="w-3.5 h-3.5" />
                                  <span>Play Video</span>
                                </button>
                              ) : mediaType === 'image' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewMediaTarget({
                                      id: drop.id,
                                      title: drop.title,
                                      subtitle: `${drop.genre} · High-Res Artwork`,
                                      assetId: drop.audioFileId,
                                      mediaType: 'image',
                                      formatLabel: drop.audioFormat,
                                      coverImage: drop.coverImage,
                                      fileSizeBytes: drop.fileSizeBytes,
                                      originalFileName: drop.originalFileName,
                                      drop,
                                    })
                                  }
                                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                  <span>View Image</span>
                                </button>
                              ) : mediaType === 'other' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewMediaTarget({
                                      id: drop.id,
                                      title: drop.title,
                                      subtitle: `${drop.genre} · Digital Pack & Stems`,
                                      assetId: drop.audioFileId,
                                      mediaType: 'other',
                                      formatLabel: drop.audioFormat,
                                      coverImage: drop.coverImage,
                                      fileSizeBytes: drop.fileSizeBytes,
                                      originalFileName: drop.originalFileName,
                                      drop,
                                    })
                                  }
                                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                                >
                                  <FileArchive className="w-3.5 h-3.5" />
                                  <span>Inspect Pack</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePlay(drop.audioFileId, drop.title)}
                                    aria-label={playingThis ? `Pause ${drop.title}` : `Play ${drop.title}`}
                                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                                  >
                                    {playingThis ? (
                                      <Pause className="w-3.5 h-3.5" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5" />
                                    )}
                                    <span>{playingThis ? 'Pause Master' : 'Preview Drop'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewMediaTarget({
                                        id: drop.id,
                                        title: drop.title,
                                        subtitle: `${drop.genre} · ${drop.vocalStyle} · Voice: ${drop.voiceTalent}`,
                                        assetId: drop.audioFileId,
                                        mediaType: 'audio',
                                        formatLabel: drop.audioFormat,
                                        sampleRate: drop.sampleRate,
                                        coverImage: drop.coverImage,
                                        durationSec: drop.durationSec,
                                        fileSizeBytes: drop.fileSizeBytes,
                                        originalFileName: drop.originalFileName,
                                        drop,
                                      })
                                    }
                                    title="Open preview player & reviews modal"
                                    aria-label="Inspect audio player"
                                    className="p-2 bg-black/60 hover:bg-black/90 border border-zinc-700 text-zinc-200 rounded-md transition-colors shrink-0"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                            <span className="font-mono text-xs text-zinc-200 tabular-nums">
                              {mediaType === 'audio' && drop.bpm > 0
                                ? `${drop.durationSec}s · ${drop.bpm} BPM`
                                : drop.audioFormat}
                            </span>
                          </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-zinc-400">
                                {drop.genre} · {drop.vocalStyle} · Key {drop.musicalKey}
                              </div>
                              {(() => {
                                const revStats = reviewSummaryMap.get(drop.id);
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setInspectedReviewDrop(drop)}
                                    className="inline-flex items-center gap-1 text-xs text-zinc-300 hover:text-amber-400 transition-colors shrink-0"
                                  >
                                    <Star
                                      className={`w-3.5 h-3.5 ${
                                        revStats && revStats.count > 0
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'text-zinc-500'
                                      }`}
                                    />
                                    <span className="font-mono tabular-nums">
                                      {revStats && revStats.count > 0
                                        ? `${revStats.avg.toFixed(1)} (${revStats.count})`
                                        : 'Review'}
                                    </span>
                                  </button>
                                );
                              })()}
                            </div>
                            <h3 className="text-base font-semibold text-zinc-100">
                              {drop.title}
                            </h3>
                            <div className="text-xs text-zinc-500">
                              Voice: {drop.voiceTalent} · {drop.audioFormat} / {drop.sampleRate}
                            </div>
                            {(() => {
                              const creator = creatorProfiles.find((c) => c.uid === drop.createdBy);
                              if (!creator) return null;
                              return (
                                <div className="text-[11px] font-mono text-amber-400">
                                  Creator: @{creator.studioHandle} ({creator.countryName})
                                </div>
                              );
                            })()}
                          </div>

                          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
                            <div className="grid grid-cols-3 gap-1.5 bg-[#0B0D11] p-1 rounded-md border border-zinc-800/80">
                              {(['standard', 'commercial', 'exclusive'] as LicenseTier[]).map(
                                (tierKey) => (
                                  <button
                                    key={tierKey}
                                    type="button"
                                    onClick={() =>
                                      setSelectedTiers((prev) => ({ ...prev, [drop.id]: tierKey }))
                                    }
                                    className={`py-1.5 text-xs font-medium rounded transition-colors ${
                                      activeTier === tierKey
                                        ? 'bg-zinc-800 text-zinc-100'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                                  >
                                    {LICENSE_TIERS[tierKey].shortLabel}
                                  </button>
                                )
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-lg font-bold font-mono tabular-nums text-zinc-100">
                                  ${price} USD
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {LICENSE_TIERS[activeTier].name}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddToCart(drop)}
                                className="px-4 py-2 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs rounded-md transition-colors whitespace-nowrap shrink-0"
                              >
                                License &amp; Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Licensing Matrix */}
            <section id="licensing" className="max-w-[1440px] mx-auto px-6 py-16 border-t border-zinc-800/80 space-y-8">
              <div className="max-w-2xl space-y-2">
                <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">
                  Custom Audio Licensing &amp; Rights Architecture
                </h2>
                <p className="text-sm text-zinc-400">
                  Every checkout generates a serialized licensing agreement bound to your DJ handle, selected territory, and international tax record.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {(['standard', 'commercial', 'exclusive'] as LicenseTier[]).map((tierKey) => {
                  const tier = LICENSE_TIERS[tierKey];
                  return (
                    <div
                      key={tierKey}
                      className="bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="text-xs font-mono text-amber-400">
                          {tier.shortLabel.toUpperCase()} TIER
                        </div>
                        <h3 className="text-lg font-semibold text-zinc-100">{tier.name}</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                          {tier.rightsSummary}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-zinc-800 space-y-2 text-xs text-zinc-300">
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>{tier.deliverables}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span>Signed certificate + 30-day tokenized download</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Custom DJ Drop Commission + WhatsApp */}
            <CustomRequestSection
              user={user}
              emailTemplateConfig={emailTemplateConfig}
              onRequestCreated={() => setView('portal')}
            />
          </>
        )}
      </main>

      {/* Active Audio Preview Strip (only shown while auditioning audio) */}
      {playingAudio && (
        <div className="sticky bottom-0 z-30 bg-[#12151C]/95 backdrop-blur border-t border-zinc-800 px-6 py-2.5">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Disc3 className={`w-5 h-5 text-amber-500 shrink-0 ${isPlaying ? 'animate-spin' : ''}`} />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-zinc-100 truncate">
                  {playingAudio.title}
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                  Studio Master Preview · 44.1 kHz PCM
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Volume2 className="w-4 h-4 text-zinc-400 hidden sm:block" />
              <button
                type="button"
                onClick={() => handleTogglePlay(playingAudio.id, playingAudio.title)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs rounded-md transition-colors"
              >
                {isPlaying ? 'Pause' : 'Resume'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean Studio Footer */}
      <footer className="border-t border-zinc-800/80 bg-[#0B0D11]">
        <div className="max-w-[1440px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="space-y-1">
            <div className="font-semibold text-zinc-300">DropVault Audio</div>
            <div>Global DJ drops, international tax compliance &amp; custom audio licensing.</div>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <a
              href="mailto:opioisaac21062002@gmail.com"
              className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              opioisaac21062002@gmail.com
            </a>
            <a
              href="https://wa.me/256784903051"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp: +256 784 903 051
            </a>
            <button
              type="button"
              onClick={() => setView('portal')}
              className="hover:text-zinc-200 transition-colors"
            >
              Studio Portal
            </button>
          </div>
        </div>
      </footer>

      <CheckoutDrawer
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        cart={cart}
        onRemoveItem={(idx) => setCart((prev) => prev.filter((_, i) => i !== idx))}
        onClearCart={() => setCart([])}
        user={user}
        storefrontConfig={storefrontConfig}
        onOrderCompleted={(_order, license) => {
          setInspectedLicense(license);
        }}
      />

      <LicenseModal
        license={inspectedLicense}
        onClose={() => setInspectedLicense(null)}
      />

      <MediaPreviewModal
        target={previewMediaTarget}
        reviews={reviews}
        selectedTier={previewMediaTarget?.drop ? selectedTiers[previewMediaTarget.drop.id] || 'standard' : 'standard'}
        onSelectTier={(dropId, tier) => setSelectedTiers((prev) => ({ ...prev, [dropId]: tier }))}
        onAddToCart={(drop) => handleAddToCart(drop)}
        onOpenReviews={(drop) => setInspectedReviewDrop(drop)}
        onClose={() => setPreviewMediaTarget(null)}
      />

      <ProductReviewsModal
        drop={inspectedReviewDrop}
        reviews={reviews}
        orders={orders}
        user={user}
        userRole={userRole}
        onClose={() => setInspectedReviewDrop(null)}
      />

      <CustomerSupportWidget
        catalogDrops={catalogDrops}
        reviews={reviews}
        hasAudioPlayerBar={Boolean(playingAudio)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}
