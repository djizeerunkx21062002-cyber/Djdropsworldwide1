import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Download,
  FileCheck2,
  FolderSync,
  Globe2,
  Mic,
  Settings,
  Shield,
  SlidersHorizontal,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';
import { getPaymentMethodLabel } from '../data/paymentMethods';
import {
  AdminActivityLog,
  CreatorProfile,
  CreatorSaleRecord,
  CustomDropRequest,
  DropProduct,
  LicenseAgreement,
  OrderRecord,
  PayoutRequest,
  PromoCode,
  PublicStorefrontConfig,
  StudioGatewaySettings,
  UserProfileRecord,
} from '../types';

export type AdminOverviewNavTarget =
  | 'catalog'
  | 'orders'
  | 'requests'
  | 'licensing'
  | 'payouts'
  | 'reports'
  | 'emails'
  | 'promos'
  | 'users'
  | 'audit_logs'
  | 'system_ops'
  | 'team'
  | 'settings';

interface AdminDashboardOverviewProps {
  orders: OrderRecord[];
  requests: CustomDropRequest[];
  payoutRequests: PayoutRequest[];
  drops: DropProduct[];
  licenses: LicenseAgreement[];
  creatorProfiles: CreatorProfile[];
  creatorSales: CreatorSaleRecord[];
  promoCodes: PromoCode[];
  userDirectory: UserProfileRecord[];
  adminLogs: AdminActivityLog[];
  storefrontConfig?: PublicStorefrontConfig | null;
  gatewaySettings: StudioGatewaySettings | null;
  onNavigateTab: (tab: AdminOverviewNavTarget) => void;
  onSeedCatalog: () => void;
  onExportSnapshot: () => void;
  formatDate: (ts: unknown) => string;
}

type TimeRangeKey = '7d' | '30d' | '90d' | 'all';

function extractDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toDate' in ts &&
    typeof (ts as { toDate: () => Date }).toDate === 'function'
  ) {
    return (ts as { toDate: () => Date }).toDate();
  }
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function resolveDropVoiceCategory(drop: DropProduct): 'Deep male voice' | 'Female voice' {
  if (drop.voiceCategory === 'Female voice' || drop.voiceCategory === 'Deep male voice') {
    return drop.voiceCategory;
  }
  const text = `${drop.voiceTalent} ${drop.vocalStyle} ${drop.tags.join(' ')}`.toLowerCase();
  return text.includes('female') ? 'Female voice' : 'Deep male voice';
}

export function AdminDashboardOverview({
  orders,
  requests,
  payoutRequests,
  drops,
  licenses,
  creatorProfiles,
  creatorSales,
  promoCodes,
  userDirectory,
  adminLogs,
  storefrontConfig,
  gatewaySettings,
  onNavigateTab,
  onSeedCatalog,
  onExportSnapshot,
  formatDate,
}: AdminDashboardOverviewProps) {
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('30d');
  const [hoveredBucketIdx, setHoveredBucketIdx] = useState<number | null>(null);
  const [activityFeedMode, setActivityFeedMode] = useState<'orders' | 'audit'>('orders');

  const filteredOrders = useMemo(() => {
    if (timeRange === 'all') return orders;
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoff = Date.now() - days * 86400 * 1000;
    return orders.filter((order) => {
      const dt = extractDate(order.createdAt);
      if (!dt) return true;
      return dt.getTime() >= cutoff;
    });
  }, [orders, timeRange]);

  const metrics = useMemo(() => {
    const grossRevenue = filteredOrders.reduce((sum, o) => sum + o.totalUsd, 0);
    const netRevenue = filteredOrders.reduce((sum, o) => sum + o.subtotalUsd, 0);
    const taxCollected = filteredOrders.reduce((sum, o) => sum + o.taxAmountUsd, 0);
    const paidOrdersCount = filteredOrders.filter((o) => o.paymentStatus === 'paid').length;
    const pendingOrdersCount = filteredOrders.filter(
      (o) => o.paymentStatus === 'authorized_pending_payout' || o.paymentStatus === 'invoice_issued'
    ).length;

    const adminFivePctPurchaseFeesUsd = Number(
      creatorSales.reduce((s, sale) => s + sale.adminFeeUsd, 0).toFixed(2)
    );
    const adminSevenPctWithdrawalFeesUsd = Number(
      payoutRequests
        .filter((p) => p.status !== 'Rejected')
        .reduce((s, p) => s + (p.withdrawalFeeUsd || 0), 0)
        .toFixed(2)
    );
    const totalPlatformFeesUsd = Number(
      (adminFivePctPurchaseFeesUsd + adminSevenPctWithdrawalFeesUsd).toFixed(2)
    );

    const activeBriefs = requests.filter((r) => r.milestone !== 'Delivered');
    const pendingPayouts = payoutRequests.filter(
      (p) => p.status === 'Requested' || p.status === 'Processing'
    );
    const pendingPayoutAmountUsd = pendingPayouts.reduce((sum, p) => sum + p.amountUsd, 0);

    const deepMaleDrops = drops.filter((d) => resolveDropVoiceCategory(d) === 'Deep male voice');
    const femaleDrops = drops.filter((d) => resolveDropVoiceCategory(d) === 'Female voice');

    // Payment rail aggregation
    const railMap = new Map<string, { id: string; label: string; totalUsd: number; count: number }>();
    for (const o of filteredOrders) {
      const id = o.paymentMethod || 'card_stripe';
      const entry = railMap.get(id) || {
        id,
        label: getPaymentMethodLabel(id),
        totalUsd: 0,
        count: 0,
      };
      entry.totalUsd += o.totalUsd;
      entry.count += 1;
      railMap.set(id, entry);
    }
    const paymentRails = Array.from(railMap.values())
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, 5);

    // Jurisdiction breakdown
    const countryMap = new Map<string, { country: string; revenue: number; count: number }>();
    for (const o of filteredOrders) {
      const entry = countryMap.get(o.countryName) || {
        country: o.countryName,
        revenue: 0,
        count: 0,
      };
      entry.revenue += o.totalUsd;
      entry.count += 1;
      countryMap.set(o.countryName, entry);
    }
    const topCountries = Array.from(countryMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
    const maxCountryRev = Math.max(1, ...topCountries.map((c) => c.revenue));

    return {
      grossRevenue,
      netRevenue,
      taxCollected,
      paidOrdersCount,
      pendingOrdersCount,
      adminFivePctPurchaseFeesUsd,
      adminSevenPctWithdrawalFeesUsd,
      totalPlatformFeesUsd,
      activeBriefs,
      pendingPayouts,
      pendingPayoutAmountUsd,
      deepMaleCount: deepMaleDrops.length,
      femaleCount: femaleDrops.length,
      paymentRails,
      topCountries,
      maxCountryRev,
    };
  }, [filteredOrders, creatorSales, payoutRequests, requests, drops]);

  // SVG Revenue & Order Time-Series Buckets
  const chartSeries = useMemo(() => {
    const bucketCount = timeRange === '7d' ? 7 : timeRange === '30d' ? 10 : 12;
    const windowDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 180;
    const now = Date.now();
    const bucketMs = (windowDays * 86400 * 1000) / bucketCount;
    const startMs = now - windowDays * 86400 * 1000;

    const buckets = Array.from({ length: bucketCount }, (_, i) => {
      const endDate = new Date(startMs + (i + 1) * bucketMs);
      return {
        label: endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: 0,
        orders: 0,
      };
    });

    for (const order of filteredOrders) {
      const dt = extractDate(order.createdAt);
      const t = dt ? dt.getTime() : now;
      const rawIdx = Math.floor((t - startMs) / bucketMs);
      const idx = Math.max(0, Math.min(bucketCount - 1, rawIdx));
      buckets[idx].revenue += order.totalUsd;
      buckets[idx].orders += 1;
    }

    const maxRev = Math.max(100, ...buckets.map((b) => b.revenue * 1.15));
    return { buckets, maxRev };
  }, [filteredOrders, timeRange]);

  const activeDropVoiceTotal = Math.max(1, metrics.deepMaleCount + metrics.femaleCount);
  const deepMaleShare = Math.round((metrics.deepMaleCount / activeDropVoiceTotal) * 100);
  const femaleShare = Math.max(0, 100 - deepMaleShare);

  const activePromoCount = promoCodes.filter((p) => p.active).length;

  return (
    <div className="space-y-6">
      {/* Top Executive Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Executive Revenue &amp; Operations
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Consolidated studio revenue, fee ledger, fulfillment queue, and catalog governance
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Timeframe Filter */}
          <div
            className="inline-flex items-center bg-[#12151C] border border-zinc-800 rounded-md p-0.5"
            role="group"
            aria-label="Analytics timeframe"
          >
            {(
              [
                { id: '7d', label: '7D' },
                { id: '30d', label: '30D' },
                { id: '90d', label: '90D' },
                { id: 'all', label: 'All' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setTimeRange(opt.id);
                  setHoveredBucketIdx(null);
                }}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors ${
                  timeRange === opt.id
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onSeedCatalog}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#12151C] border border-zinc-800 hover:border-amber-500 text-zinc-200 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <FolderSync className="w-3.5 h-3.5 text-amber-400" />
            <span>Sync Cloud Catalog</span>
          </button>

          <button
            type="button"
            onClick={onExportSnapshot}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Snapshot</span>
          </button>
        </div>
      </div>

      {/* 4-Column Single-Elevation Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 border border-zinc-800 rounded-lg bg-[#12151C] divide-y sm:divide-y-0 sm:divide-x divide-zinc-800">
        <div className="p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Gross Order Volume</span>
            <span className="font-mono tabular-nums text-zinc-500">
              {filteredOrders.length} orders
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
            ${metrics.grossRevenue.toFixed(2)}
          </div>
          <div className="text-xs text-zinc-400 font-mono tabular-nums">
            <span className="text-emerald-400">{metrics.paidOrdersCount} settled</span>
            {' · '}
            <span>{metrics.pendingOrdersCount} pending</span>
            {' · '}
            <span>Tax ${metrics.taxCollected.toFixed(2)}</span>
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Platform Fee Revenue</span>
            <span className="font-mono tabular-nums text-zinc-500">5% + 7%</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
            ${metrics.totalPlatformFeesUsd.toFixed(2)}
          </div>
          <div className="text-xs text-zinc-400 font-mono tabular-nums">
            Sale ${metrics.adminFivePctPurchaseFeesUsd.toFixed(2)} · Cashout $
            {metrics.adminSevenPctWithdrawalFeesUsd.toFixed(2)}
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Action Queue</span>
            <span
              className={`font-mono tabular-nums ${
                metrics.activeBriefs.length + metrics.pendingPayouts.length > 0
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {metrics.activeBriefs.length + metrics.pendingPayouts.length} open
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
            {metrics.activeBriefs.length}{' '}
            <span className="text-sm font-normal text-zinc-400">briefs</span>
            {' · '}
            {metrics.pendingPayouts.length}{' '}
            <span className="text-sm font-normal text-zinc-400">payouts</span>
          </div>
          <div className="text-xs text-zinc-400 font-mono tabular-nums">
            Payout queue ${metrics.pendingPayoutAmountUsd.toFixed(2)} USD
          </div>
        </div>

        <div className="p-5 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Catalog &amp; Accounts</span>
            <span className="font-mono tabular-nums text-zinc-500">
              {licenses.length} licenses
            </span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">
            {drops.length}{' '}
            <span className="text-sm font-normal text-zinc-400">drops</span>
            {' · '}
            {userDirectory.length}{' '}
            <span className="text-sm font-normal text-zinc-400">users</span>
          </div>
          <div className="text-xs text-zinc-400 font-mono tabular-nums">
            {creatorProfiles.length} co-creators · {activePromoCount} active promos
          </div>
        </div>
      </div>

      {/* Main Analytics Row: Revenue Trend Chart + Voice & Payment Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* SVG Revenue & Order Trend */}
        <div className="xl:col-span-8 bg-[#12151C] border border-zinc-800 rounded-lg p-6 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Revenue &amp; Order Trajectory
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {hoveredBucketIdx !== null
                  ? `${chartSeries.buckets[hoveredBucketIdx].label}: $${chartSeries.buckets[hoveredBucketIdx].revenue.toFixed(2)} USD across ${chartSeries.buckets[hoveredBucketIdx].orders} order${chartSeries.buckets[hoveredBucketIdx].orders === 1 ? '' : 's'}`
                  : `Showing ${filteredOrders.length} order${filteredOrders.length === 1 ? '' : 's'} totaling $${metrics.grossRevenue.toFixed(2)} USD`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 hover:underline"
            >
              <span>Inspect Order Ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {(() => {
            const width = 680;
            const height = 210;
            const padLeft = 48;
            const padRight = 16;
            const padTop = 16;
            const padBottom = 28;
            const plotW = width - padLeft - padRight;
            const plotH = height - padTop - padBottom;
            const buckets = chartSeries.buckets;
            const stepX = plotW / Math.max(1, buckets.length - 1);

            const coords = buckets.map((b, idx) => {
              const x = padLeft + idx * stepX;
              const y = padTop + plotH - (b.revenue / chartSeries.maxRev) * plotH;
              return { x, y, ...b };
            });

            const linePath = coords
              .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
              .join(' ');
            const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(
              padTop + plotH
            ).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

            const gridLevels = [0, 0.25, 0.5, 0.75, 1];

            return (
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full min-w-[480px] h-52 select-none"
                  role="img"
                  aria-label="Revenue trend chart"
                >
                  <defs>
                    <linearGradient id="adminRevFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {gridLevels.map((lvl) => {
                    const y = padTop + plotH - lvl * plotH;
                    const val = Math.round(chartSeries.maxRev * lvl);
                    return (
                      <g key={lvl}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={width - padRight}
                          y2={y}
                          stroke="#27272A"
                          strokeDasharray="3 3"
                          strokeWidth="1"
                        />
                        <text
                          x={padLeft - 8}
                          y={y + 3}
                          textAnchor="end"
                          fill="#71717A"
                          fontSize="10"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          ${val}
                        </text>
                      </g>
                    );
                  })}

                  <path d={areaPath} fill="url(#adminRevFill)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />

                  {coords.map((pt, idx) => {
                    const active = hoveredBucketIdx === idx;
                    const showLabel =
                      idx === 0 ||
                      idx === coords.length - 1 ||
                      idx % Math.max(1, Math.floor(coords.length / 5)) === 0;
                    return (
                      <g
                        key={pt.label + idx}
                        onMouseEnter={() => setHoveredBucketIdx(idx)}
                        onMouseLeave={() => setHoveredBucketIdx(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={pt.x - stepX / 2}
                          y={padTop}
                          width={stepX}
                          height={plotH + padBottom}
                          fill="transparent"
                        />
                        {active && (
                          <line
                            x1={pt.x}
                            y1={padTop}
                            x2={pt.x}
                            y2={padTop + plotH}
                            stroke="#F59E0B"
                            strokeOpacity="0.5"
                            strokeWidth="1"
                          />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={active ? 4.5 : pt.revenue > 0 ? 3 : 2}
                          fill={active || pt.revenue > 0 ? '#F59E0B' : '#3F3F46'}
                          stroke="#0B0D11"
                          strokeWidth="1.5"
                        />
                        {showLabel && (
                          <text
                            x={pt.x}
                            y={height - 8}
                            textAnchor="middle"
                            fill="#A1A1AA"
                            fontSize="10"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {pt.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })()}
        </div>

        {/* Voice Talent Mix & Payment Rails */}
        <div className="xl:col-span-4 bg-[#12151C] border border-zinc-800 rounded-lg p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Mic className="w-4 h-4 text-amber-400" />
                <span>Catalog Voice Mix</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('catalog')}
                className="text-xs text-amber-400 hover:underline"
              >
                Catalog
              </button>
            </div>

            <div className="space-y-2">
              <div className="h-2.5 w-full rounded-sm overflow-hidden flex bg-[#0B0D11]">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${deepMaleShare}%` }}
                />
                <div
                  className="h-full bg-fuchsia-500 transition-all"
                  style={{ width: `${femaleShare}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-zinc-300">
                  Deep male voice: <strong className="text-zinc-100">{metrics.deepMaleCount}</strong> ({deepMaleShare}%)
                </span>
                <span className="text-zinc-300">
                  Female voice: <strong className="text-zinc-100">{metrics.femaleCount}</strong> ({femaleShare}%)
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">
                Revenue by Payment Rail
              </h3>
              <span className="text-xs font-mono text-zinc-500">USD</span>
            </div>

            {metrics.paymentRails.length === 0 ? (
              <p className="text-xs text-zinc-500 py-2">
                Payment rail volume appears after orders are completed.
              </p>
            ) : (
              <div className="divide-y divide-zinc-800/80">
                {metrics.paymentRails.map((rail) => (
                  <div
                    key={rail.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-zinc-300 truncate">{rail.label}</span>
                    <span className="font-mono tabular-nums text-zinc-100 shrink-0">
                      ${rail.totalUsd.toFixed(2)} · {rail.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Buyer Jurisdictions & Platform Configuration Health */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-amber-400" />
              <span>Top Buyer Jurisdictions</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="text-xs text-amber-400 hover:underline"
            >
              Export Tax Report
            </button>
          </div>

          {metrics.topCountries.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6">
              No completed orders in this timeframe. Buyer territory metrics populate automatically on checkout.
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.topCountries.map((row) => {
                const pct = Math.max(4, Math.round((row.revenue / metrics.maxCountryRev) * 100));
                return (
                  <div key={row.country} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-200 truncate">{row.country}</span>
                      <span className="font-mono tabular-nums text-zinc-300">
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

        {/* Studio Governance & Quick Navigation */}
        <div className="xl:col-span-5 bg-[#12151C] border border-zinc-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              <span>Platform Governance &amp; CMS</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('settings')}
              className="text-xs text-amber-400 hover:underline"
            >
              Configure
            </button>
          </div>

          <div className="divide-y divide-zinc-800/80 border-t border-b border-zinc-800/80 text-xs">
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-zinc-400">System State</span>
              <span
                className={`font-mono font-medium ${
                  storefrontConfig?.maintenanceMode ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {storefrontConfig?.maintenanceMode ? 'Maintenance Lockdown' : 'Live & Operational'}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-zinc-400">Gateway Mode</span>
              <span className="font-mono text-zinc-200">
                {gatewaySettings?.payoutStatus === 'connected' ? 'Live Connected' : 'Sandbox / Deferred'}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-zinc-400">Storefront Banner</span>
              <span
                className={`font-mono ${
                  storefrontConfig?.announcementEnabled ? 'text-emerald-400' : 'text-zinc-500'
                }`}
              >
                {storefrontConfig?.announcementEnabled
                  ? `Active (${storefrontConfig.announcementBadge || 'Promo'})`
                  : 'Disabled'}
              </span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-zinc-400">Active Promo Codes</span>
              <span className="font-mono tabular-nums text-zinc-200">
                {activePromoCount} active / {promoCodes.length} total
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => onNavigateTab('promos')}
              className="px-3 py-2 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500 rounded-md text-xs font-medium text-zinc-200 flex items-center gap-2 transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Promo Codes</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('users')}
              className="px-3 py-2 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500 rounded-md text-xs font-medium text-zinc-200 flex items-center gap-2 transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">User Roles</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('licensing')}
              className="px-3 py-2 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500 rounded-md text-xs font-medium text-zinc-200 flex items-center gap-2 transition-colors"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Licenses</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('system_ops')}
              className="px-3 py-2 bg-[#0B0D11] border border-zinc-800 hover:border-amber-500 rounded-md text-xs font-medium text-zinc-200 flex items-center gap-2 transition-colors"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">System Ops</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Action Queue + Recent Orders / Audit Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Action Queue */}
        <div className="xl:col-span-5 bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Action Required Queue
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Open custom drop commissions &amp; pending payout disbursements
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-amber-400">
              {metrics.activeBriefs.length + metrics.pendingPayouts.length} items
            </span>
          </div>

          {metrics.activeBriefs.length === 0 && metrics.pendingPayouts.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs font-medium text-zinc-300">All queues clear</p>
              <p className="text-xs text-zinc-500">
                New custom drop briefs and co-creator payout requests will appear here for review.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/80">
              {metrics.pendingPayouts.slice(0, 3).map((payout) => (
                <div
                  key={payout.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-zinc-800/20 transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-zinc-100 truncate">
                        Payout · {payout.producerName}
                      </div>
                      <div className="text-xs text-zinc-400 font-mono tabular-nums truncate">
                        ${payout.amountUsd.toFixed(2)} · {payout.status}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('payouts')}
                    className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded transition-colors shrink-0"
                  >
                    Review
                  </button>
                </div>
              ))}

              {metrics.activeBriefs.slice(0, 4).map((req) => (
                <div
                  key={req.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-zinc-800/20 transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-zinc-100 truncate">
                        {req.djName} · {req.genre}
                      </div>
                      <div className="text-xs text-zinc-400 font-mono tabular-nums truncate">
                        {req.milestone} · ${req.quotedPriceUsd.toFixed(0)} USD
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('requests')}
                    className="px-2.5 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded transition-colors shrink-0"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders / Audit Feed Table */}
        <div className="xl:col-span-7 bg-[#12151C] border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 bg-[#0B0D11] border border-zinc-800 rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setActivityFeedMode('orders')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  activityFeedMode === 'orders'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Recent Orders ({orders.length})
              </button>
              <button
                type="button"
                onClick={() => setActivityFeedMode('audit')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  activityFeedMode === 'audit'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Security Audit ({adminLogs.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                onNavigateTab(activityFeedMode === 'orders' ? 'orders' : 'audit_logs')
              }
              className="text-xs text-amber-400 hover:underline"
            >
              View All
            </button>
          </div>

          {activityFeedMode === 'orders' ? (
            orders.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No orders recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0E1117] text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Buyer / DJ</th>
                      <th className="px-4 py-2.5 font-medium">Territory</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Total USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {orders.slice(0, 6).map((o) => (
                      <tr key={o.id} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-zinc-100 truncate max-w-[170px]">
                            {o.djHandle || o.buyerName}
                          </div>
                          <div className="text-[11px] font-mono text-zinc-500">
                            {formatDate(o.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-zinc-300">{o.countryName}</td>
                        <td className="px-4 py-2.5 font-mono">
                          <span
                            className={
                              o.paymentStatus === 'paid'
                                ? 'text-emerald-400'
                                : o.paymentStatus === 'refunded'
                                ? 'text-red-400'
                                : 'text-amber-400'
                            }
                          >
                            {o.paymentStatus === 'paid'
                              ? 'Paid'
                              : o.paymentStatus === 'refunded'
                              ? 'Refunded'
                              : o.paymentStatus === 'invoice_issued'
                              ? 'Invoiced'
                              : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-zinc-100">
                          ${o.totalUsd.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : adminLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No administrative audit events logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0E1117] text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">When</th>
                    <th className="px-4 py-2.5 font-medium">Action</th>
                    <th className="px-4 py-2.5 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {adminLogs.slice(0, 6).map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-2.5 font-mono tabular-nums text-zinc-400 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-amber-400 whitespace-nowrap">
                        {log.action.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300 truncate max-w-[260px]">
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
