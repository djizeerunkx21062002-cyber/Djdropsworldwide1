import { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { CheckCircle2, Download, Lock, Tag, Trash2, X } from 'lucide-react';
import { LICENSE_TIERS } from '../data/catalogSeed';
import { calculateTaxBreakdown, findJurisdiction } from '../data/jurisdictions';
import {
  CHECKOUT_CURRENCIES,
  getPaymentMethodLabel,
  getPaymentMethodsForJurisdiction,
} from '../data/paymentMethods';
import { db, handleFirestoreError, OperationType, signInWithGoogle } from '../firebase';
import {
  CartItem,
  CreatorSaleRecord,
  LicenseAgreement,
  OrderItemSummary,
  OrderRecord,
  PromoCode,
  PublicStorefrontConfig,
} from '../types';
import { JurisdictionSelector } from './JurisdictionSelector';

interface CheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  user: User | null;
  storefrontConfig: PublicStorefrontConfig | null;
  onOrderCompleted: (order: OrderRecord, license: LicenseAgreement) => void;
}

export function CheckoutDrawer({
  open,
  onClose,
  cart,
  onRemoveItem,
  onClearCart,
  user,
  storefrontConfig,
  onOrderCompleted,
}: CheckoutDrawerProps) {
  const [jurisdictionCode, setJurisdictionCode] = useState('UG');
  const [currencyOverride, setCurrencyOverride] = useState('LOCAL');
  const [taxId, setTaxId] = useState('');
  const [djHandle, setDjHandle] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('mtn_momo');
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoStatus, setPromoStatus] = useState('');
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderRecord | null>(null);
  const [completedLicense, setCompletedLicense] = useState<LicenseAgreement | null>(null);

  const subtotalUsd = useMemo(
    () =>
      cart.reduce((sum, item) => {
        const price =
          item.tier === 'standard'
            ? item.drop.standardPriceUsd
            : item.tier === 'commercial'
            ? item.drop.commercialPriceUsd
            : item.drop.exclusivePriceUsd;
        return sum + price;
      }, 0),
    [cart]
  );

  const discountUsd = useMemo(() => {
    if (!appliedPromo || !appliedPromo.active) return 0;
    if (subtotalUsd < appliedPromo.minSubtotalUsd) return 0;
    return Number(((subtotalUsd * appliedPromo.discountPercent) / 100).toFixed(2));
  }, [appliedPromo, subtotalUsd]);

  const discountedSubtotalUsd = useMemo(
    () => Math.max(0, Number((subtotalUsd - discountUsd).toFixed(2))),
    [subtotalUsd, discountUsd]
  );

  const taxSummary = useMemo(
    () => calculateTaxBreakdown(discountedSubtotalUsd, jurisdictionCode, taxId),
    [discountedSubtotalUsd, jurisdictionCode, taxId]
  );

  const activeCurrency =
    currencyOverride === 'LOCAL' ? taxSummary.localCurrency : currencyOverride;

  const availableMethods = useMemo(
    () => getPaymentMethodsForJurisdiction(taxSummary.jurisdiction, activeCurrency),
    [taxSummary.jurisdiction, activeCurrency]
  );

  useEffect(() => {
    if (availableMethods.length > 0 && !availableMethods.some((m) => m.id === paymentMethod)) {
      setPaymentMethod(availableMethods[0].id);
    }
  }, [availableMethods, paymentMethod]);

  const activeJurisdictionObj = useMemo(
    () => findJurisdiction(jurisdictionCode),
    [jurisdictionCode]
  );

  if (!open) return null;

  const handleApplyPromoCode = async () => {
    const cleanCode = promoInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    setPromoStatus('');
    if (!cleanCode || cleanCode.length < 2) {
      setPromoStatus('Enter a valid promo code.');
      return;
    }
    setCheckingPromo(true);
    try {
      const snap = await getDoc(doc(db, 'promoCodes', cleanCode));
      if (!snap.exists()) {
        setAppliedPromo(null);
        setPromoStatus(`Code "${cleanCode}" not found.`);
        return;
      }
      const promo = snap.data() as PromoCode;
      if (!promo.active) {
        setAppliedPromo(null);
        setPromoStatus(`Code "${cleanCode}" is currently paused.`);
        return;
      }
      if (subtotalUsd < promo.minSubtotalUsd) {
        setAppliedPromo(null);
        setPromoStatus(`Minimum order of $${promo.minSubtotalUsd.toFixed(2)} USD required.`);
        return;
      }
      setAppliedPromo(promo);
      setPromoStatus(`${promo.code} applied (${promo.discountPercent}% off)!`);
    } catch {
      setPromoStatus('Unable to validate promo code right now.');
    } finally {
      setCheckingPromo(false);
    }
  };

  const handleCheckout = async () => {
    setErrorMessage('');
    if (cart.length === 0) return;

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
    setProcessing(true);

    try {
      const orderItemsPayload = cart.map((item) => ({
        dropId: item.drop.id,
        title: item.drop.title,
        tier: item.tier,
        unitPriceUsd:
          item.tier === 'standard'
            ? item.drop.standardPriceUsd
            : item.tier === 'commercial'
            ? item.drop.commercialPriceUsd
            : item.drop.exclusivePriceUsd,
        audioFileId: item.drop.audioFileId,
        djNameOverlay: item.djNameOverlay || djHandle.trim() || activeUser.displayName || 'DJ Licensee',
        creatorUid: item.drop.createdBy || 'studio_admin',
      }));

      const idToken = await activeUser.getIdToken();
      const authRes = await fetch('/api/checkout/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          subtotalUsd,
          discountUsd,
          jurisdictionCode,
          taxId,
          payoutStatus: storefrontConfig?.payoutStatus || 'pending_setup',
          items: orderItemsPayload.map((i) => ({
            unitPriceUsd: i.unitPriceUsd,
            creatorUid: i.creatorUid,
          })),
        }),
      });

      if (!authRes.ok) {
        const data = await authRes.json().catch(() => ({}));
        throw new Error(data.error || 'Checkout authorization failed.');
      }

      const authData = await authRes.json();
      const orderId: string = authData.orderId;
      const licenseId: string = authData.licenseId;
      const downloadToken: string = authData.downloadToken;
      const licenseSerial: string = authData.licenseSerial;
      const serverTax = authData.taxBreakdown;
      const feeBreakdown = authData.feeBreakdown || {
        platformFeeRate: 0.05,
        platformFeeUsd: 0,
        creatorEarningsUsd: 0,
      };
      const cleanDjHandle = djHandle.trim() || activeUser.displayName || 'DJ Licensee';

      const orderItems: OrderItemSummary[] = orderItemsPayload.map((i) => ({
        ...i,
        djNameOverlay: cleanDjHandle,
      }));

      const orderDoc: OrderRecord = {
        id: orderId,
        buyerUid: activeUser.uid,
        buyerEmail: activeUser.email || 'client@dropvault.audio',
        buyerName: activeUser.displayName || cleanDjHandle,
        djHandle: cleanDjHandle,
        jurisdictionCode: serverTax.jurisdiction.code,
        countryName: serverTax.jurisdiction.name,
        taxType: serverTax.taxType,
        taxRate: serverTax.taxRate,
        taxIdProvided: taxId.trim().slice(0, 64),
        reverseChargeApplied: Boolean(serverTax.reverseChargeApplied),
        currency: activeCurrency.slice(0, 8),
        subtotalUsd: Number(subtotalUsd.toFixed(2)),
        taxAmountUsd: serverTax.taxAmountUsd,
        totalUsd: serverTax.totalUsd,
        platformFeeUsd: Number(feeBreakdown.platformFeeUsd || 0),
        creatorEarningsUsd: Number(feeBreakdown.creatorEarningsUsd || 0),
        ...(appliedPromo && discountUsd > 0
          ? { promoCode: appliedPromo.code, discountUsd }
          : {}),
        paymentStatus: authData.paymentStatus,
        paymentMethod: paymentMethod.slice(0, 40),
        items: orderItems,
        licenseId,
        downloadToken,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const primaryTier = cart[0].tier;
      const tierMeta = LICENSE_TIERS[primaryTier];
      const licenseDoc: LicenseAgreement = {
        id: licenseId,
        orderId,
        ownerUid: activeUser.uid,
        licenseeName: activeUser.displayName || cleanDjHandle,
        licenseeEmail: activeUser.email || 'client@dropvault.audio',
        djName: cleanDjHandle,
        dropTitle: cart.map((c) => c.drop.title).join(', ').slice(0, 120),
        tier: primaryTier,
        territory: serverTax.jurisdiction.name,
        jurisdictionCode: serverTax.jurisdiction.code,
        serialNumber: licenseSerial,
        rightsSummary: tierMeta.rightsSummary,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'orders', orderId), orderDoc);
      batch.set(doc(db, 'licenses', licenseId), licenseDoc);

      orderItems.forEach((item, idx) => {
        if (!item.creatorUid || item.creatorUid === 'studio_admin') return;
        const saleId = `sale_${orderId}_${idx}`;
        const adminFeeUsd = Number((item.unitPriceUsd * 0.05).toFixed(2));
        const creatorNetUsd = Number((item.unitPriceUsd - adminFeeUsd).toFixed(2));
        const saleDoc: CreatorSaleRecord = {
          id: saleId,
          orderId,
          buyerUid: activeUser.uid,
          dropId: item.dropId,
          dropTitle: item.title.slice(0, 120),
          creatorUid: item.creatorUid,
          tier: item.tier,
          jurisdictionCode: serverTax.jurisdiction.code,
          countryName: serverTax.jurisdiction.name,
          currency: activeCurrency.slice(0, 8),
          grossItemUsd: item.unitPriceUsd,
          platformFeeRate: 0.05,
          adminFeeUsd,
          creatorNetUsd,
          paymentStatus: authData.paymentStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(doc(db, 'creatorSales', saleId), saleDoc);
      });

      if (appliedPromo && discountUsd > 0) {
        batch.update(doc(db, 'promoCodes', appliedPromo.code), {
          usageCount: (appliedPromo.usageCount || 0) + 1,
          updatedAt: serverTimestamp(),
        });
      }

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
      }

      // Automated email confirmation receipt
      const emailSubject = `Order ${orderId} & License ${licenseSerial} Confirmed`;
      const emailBody = `Hello ${cleanDjHandle}, your DropVault Audio order (${orderId}) for ${licenseDoc.dropTitle} is confirmed. Jurisdiction: ${serverTax.jurisdiction.name}. Total: $${serverTax.totalUsd.toFixed(2)} USD. Your master files and license agreement (${licenseSerial}) are ready for download.`;

      const emailRes = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipientEmail: activeUser.email || 'client@dropvault.audio',
          subject: emailSubject,
          milestone: 'Order Confirmed',
          previewBody: emailBody,
        }),
      });
      const emailStatusData = emailRes.ok
        ? await emailRes.json()
        : { deliveryStatus: 'logged_sandbox' };

      const logId = `eml_${Date.now()}`;
      try {
        await setDoc(doc(db, 'emailLogs', logId), {
          id: logId,
          ownerUid: activeUser.uid,
          recipientEmail: activeUser.email || 'client@dropvault.audio',
          subject: emailSubject,
          milestone: 'Order Confirmed',
          relatedRequestId: '',
          relatedOrderId: orderId,
          deliveryStatus: emailStatusData.deliveryStatus === 'sent_smtp' ? 'sent_smtp' : 'logged_sandbox',
          previewBody: emailBody,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `emailLogs/${logId}`);
      }

      setCompletedOrder(orderDoc);
      setCompletedLicense(licenseDoc);
      onOrderCompleted(orderDoc, licenseDoc);
      onClearCart();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to complete checkout.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg bg-[#12151C] border-l border-zinc-800 h-full flex flex-col">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              {completedOrder ? 'Digital Delivery Ready' : 'International Checkout'}
            </h2>
            <p className="text-xs text-zinc-400">
              {completedOrder
                ? 'Signed masters & licensing certificate issued'
                : 'Automated tax compliance across 550+ global zones'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCompletedOrder(null);
              setCompletedLicense(null);
              onClose();
            }}
            aria-label="Close checkout drawer"
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {completedOrder && completedLicense ? (
            <div className="space-y-6">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-md flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold text-zinc-100">
                    Order {completedOrder.id} Confirmed
                  </div>
                  <div className="text-xs text-zinc-300 mt-1">
                    {completedOrder.paymentStatus === 'authorized_pending_payout'
                      ? 'Authorized in Sandbox Gateway (owner payout account can be linked anytime in Studio Settings).'
                      : 'Payment verified and settled.'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-medium text-zinc-400">Instant Digital File Delivery</div>
                {completedOrder.items.map((item, idx) => (
                  <div
                    key={`${item.dropId}-${idx}`}
                    className="flex items-center justify-between gap-3 p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-md"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100 truncate">{item.title}</div>
                      <div className="text-xs text-zinc-400">
                        {LICENSE_TIERS[item.tier].name} · Tag: {item.djNameOverlay}
                      </div>
                    </div>
                    <a
                      href={`/api/storage/deliver/${encodeURIComponent(item.audioFileId)}?token=${encodeURIComponent(completedOrder.downloadToken)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 text-zinc-950 rounded-md hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Master
                    </a>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-2 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>License Serial</span>
                  <span className="font-mono text-zinc-100">{completedLicense.serialNumber}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Tax Jurisdiction</span>
                  <span className="text-zinc-200">{completedOrder.countryName}</span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Payment Rail</span>
                  <span className="text-zinc-200">
                    {getPaymentMethodLabel(completedOrder.paymentMethod)} ({completedOrder.currency})
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400 tabular-nums">
                  <span>Total Charged</span>
                  <span className="font-mono text-zinc-100 font-semibold">
                    ${completedOrder.totalUsd.toFixed(2)} USD
                  </span>
                </div>
              </div>
            </div>
          ) : cart.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm text-zinc-300 font-medium">Your Studio Bag is empty</p>
              <p className="text-xs text-zinc-500">
                Select a licensing tier on any DJ drop to preview international tax and checkout.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {cart.map((item, idx) => {
                  const unitPrice =
                    item.tier === 'standard'
                      ? item.drop.standardPriceUsd
                      : item.tier === 'commercial'
                      ? item.drop.commercialPriceUsd
                      : item.drop.exclusivePriceUsd;
                  return (
                    <div
                      key={`${item.drop.id}-${item.tier}-${idx}`}
                      className="flex items-center justify-between gap-3 p-3.5 bg-[#0B0D11] border border-zinc-800 rounded-md"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-100 truncate">
                          {item.drop.title}
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {LICENSE_TIERS[item.tier].shortLabel} License · {item.drop.audioFormat}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-sm text-zinc-100 tabular-nums">
                          ${unitPrice.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(idx)}
                          aria-label={`Remove ${item.drop.title}`}
                          className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4 pt-2 border-t border-zinc-800">
                <JurisdictionSelector
                  label="Buyer Country / Tax Jurisdiction (550+ Global Zones)"
                  value={jurisdictionCode}
                  onChange={setJurisdictionCode}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      DJ / Station Name on License
                    </label>
                    <input
                      type="text"
                      value={djHandle}
                      onChange={(e) => setDjHandle(e.target.value)}
                      placeholder="e.g. DJ Kairo Live"
                      maxLength={80}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      VAT / TIN / GST ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="B2B Reverse Charge"
                      maxLength={64}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                      Settlement Currency
                    </label>
                    <select
                      value={currencyOverride}
                      onChange={(e) => setCurrencyOverride(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    >
                      {CHECKOUT_CURRENCIES.map((cur) => (
                        <option key={cur} value={cur}>
                          {cur === 'LOCAL'
                            ? `Local (${activeJurisdictionObj.currency})`
                            : cur}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="px-3 py-2 bg-[#0B0D11] border border-zinc-800 rounded-md text-xs text-zinc-400 font-mono">
                      Country Rail: {activeJurisdictionObj.country} · {activeCurrency}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-zinc-400">
                      Available Payment Methods ({activeJurisdictionObj.country} · {activeCurrency})
                    </label>
                    <span className="text-xs font-mono text-zinc-500">
                      {availableMethods.length} rails
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableMethods.map((method) => {
                      const active = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={`p-2.5 rounded-md border text-left transition-colors ${
                            active
                              ? 'bg-amber-500/15 border-amber-500 text-amber-200'
                              : 'bg-[#0B0D11] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          <div className="text-xs font-semibold truncate">{method.label}</div>
                          <div className="text-[11px] text-zinc-500 mt-0.5 flex items-center justify-between gap-2">
                            <span className="truncate">{method.rail}</span>
                            <span className="font-mono shrink-0">{method.settlementSpeed}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>
                      {storefrontConfig?.payoutStatus === 'connected'
                        ? storefrontConfig.gatewayModeLabel
                        : 'Built-in gateway ready — owner payout account can be linked later in Studio Settings.'}
                    </span>
                  </p>
                </div>

                <div className="p-3 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-400" />
                      Promo / Discount Code
                    </label>
                    {appliedPromo && (
                      <button
                        type="button"
                        onClick={() => {
                          setAppliedPromo(null);
                          setPromoInput('');
                          setPromoStatus('');
                        }}
                        className="text-[11px] text-zinc-400 hover:text-zinc-200 underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Enter promo code (e.g. VIP20)"
                      maxLength={32}
                      className="flex-1 px-3 py-1.5 bg-[#12151C] border border-zinc-800 rounded-md text-xs font-mono uppercase text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      disabled={checkingPromo}
                      onClick={handleApplyPromoCode}
                      className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 text-xs font-semibold rounded-md transition-colors whitespace-nowrap"
                    >
                      {checkingPromo ? 'Checking...' : 'Apply'}
                    </button>
                  </div>
                  {promoStatus && (
                    <div
                      className={`text-[11px] ${
                        appliedPromo ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {promoStatus}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-[#0B0D11] border border-zinc-800 rounded-md space-y-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-400 tabular-nums">
                    <span>Subtotal</span>
                    <span className="font-mono text-zinc-200">${subtotalUsd.toFixed(2)} USD</span>
                  </div>
                  {discountUsd > 0 && appliedPromo && (
                    <div className="flex items-center justify-between text-emerald-400 tabular-nums">
                      <span>
                        Promo ({appliedPromo.code} · -{appliedPromo.discountPercent}%)
                      </span>
                      <span className="font-mono">-${discountUsd.toFixed(2)} USD</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-zinc-400 tabular-nums">
                    <span>
                      {taxSummary.taxType} ({(taxSummary.taxRate * 100).toFixed(taxSummary.taxRate % 0.01 === 0 ? 0 : 2)}%)
                      {taxSummary.reverseChargeApplied ? ' · B2B Reverse Charge' : ''}
                    </span>
                    <span className="font-mono text-zinc-200">${taxSummary.taxAmountUsd.toFixed(2)} USD</span>
                  </div>
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-sm font-semibold text-zinc-100 tabular-nums">
                    <span>Total Due</span>
                    <span className="font-mono text-amber-400">${taxSummary.totalUsd.toFixed(2)} USD</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-500 tabular-nums">
                    <span>Local Currency Equivalent</span>
                    <span className="font-mono">
                      {taxSummary.localTotal.toLocaleString()} {taxSummary.localCurrency}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-300">
              {errorMessage}
            </div>
          )}
        </div>

        {!completedOrder && cart.length > 0 && (
          <div className="px-6 py-4 border-t border-zinc-800 bg-[#0E1117]">
            <button
              type="button"
              disabled={processing}
              onClick={handleCheckout}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-semibold text-sm rounded-md transition-colors"
            >
              {processing
                ? 'Authorizing & Generating License...'
                : user
                ? `Complete Order · $${taxSummary.totalUsd.toFixed(2)} USD`
                : `Sign In with Google & Pay $${taxSummary.totalUsd.toFixed(2)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
