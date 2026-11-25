import { Jurisdiction } from '../types';

export interface LocalizedPaymentMethod {
  id: string;
  label: string;
  rail: string;
  settlementSpeed: string;
  supportedCurrencies: string[];
  category: 'mobile_money' | 'instant_bank' | 'wallet' | 'card' | 'invoice';
}

export const PAYMENT_METHOD_CATALOG: Record<string, LocalizedPaymentMethod> = {
  mtn_momo: {
    id: 'mtn_momo',
    label: 'MTN Mobile Money (MoMo)',
    rail: 'Mobile Money Push',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['UGX', 'RWF', 'GHS', 'XOF', 'XAF', 'ZMW', 'ZAR', 'USD'],
    category: 'mobile_money',
  },
  airtel_money: {
    id: 'airtel_money',
    label: 'Airtel Money',
    rail: 'Mobile Money Push',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['UGX', 'KES', 'TZS', 'RWF', 'ZMW', 'MWK', 'NGN', 'XAF'],
    category: 'mobile_money',
  },
  mpesa_ke: {
    id: 'mpesa_ke',
    label: 'M-Pesa (Safaricom / Vodacom)',
    rail: 'STK Push',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['KES', 'TZS', 'MZN', 'CDF', 'ETB', 'USD'],
    category: 'mobile_money',
  },
  tigo_pesa: {
    id: 'tigo_pesa',
    label: 'Tigo Pesa / Mixx by Yas',
    rail: 'Mobile Wallet',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['TZS', 'RWF', 'GHS'],
    category: 'mobile_money',
  },
  orange_wave: {
    id: 'orange_wave',
    label: 'Orange Money / Wave',
    rail: 'USSD & App Push',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['XOF', 'XAF', 'GNF', 'MAD', 'USD'],
    category: 'mobile_money',
  },
  paystack_ng: {
    id: 'paystack_ng',
    label: 'Paystack / Naira Bank & USSD',
    rail: 'NIP & Verve',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['NGN', 'GHS', 'ZAR', 'KES', 'USD'],
    category: 'instant_bank',
  },
  ozow_za: {
    id: 'ozow_za',
    label: 'Ozow Instant EFT / SnapScan',
    rail: 'South Africa EFT',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['ZAR'],
    category: 'instant_bank',
  },
  sepa_instant: {
    id: 'sepa_instant',
    label: 'SEPA Instant Bank Transfer',
    rail: 'Eurozone IBAN',
    settlementSpeed: '10 Seconds',
    supportedCurrencies: ['EUR'],
    category: 'instant_bank',
  },
  ideal_nl: {
    id: 'ideal_nl',
    label: 'iDEAL Banking',
    rail: 'Dutch Bank Redirect',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['EUR'],
    category: 'instant_bank',
  },
  bancontact_be: {
    id: 'bancontact_be',
    label: 'Bancontact',
    rail: 'Belgian Direct Pay',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['EUR'],
    category: 'instant_bank',
  },
  giropay_de: {
    id: 'giropay_de',
    label: 'Klarna / Sofort / Giropay',
    rail: 'German Direct Bank',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['EUR'],
    category: 'instant_bank',
  },
  cartes_bancaires_fr: {
    id: 'cartes_bancaires_fr',
    label: 'Cartes Bancaires (CB)',
    rail: 'French Domestic Network',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['EUR'],
    category: 'card',
  },
  bizum_es: {
    id: 'bizum_es',
    label: 'Bizum Instant',
    rail: 'Spanish Mobile Bank',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['EUR'],
    category: 'mobile_money',
  },
  multibanco_pt: {
    id: 'multibanco_pt',
    label: 'MB WAY / Multibanco',
    rail: 'Portuguese Bank Ref',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['EUR'],
    category: 'instant_bank',
  },
  blik_pl: {
    id: 'blik_pl',
    label: 'BLIK / Przelewy24',
    rail: 'Polish 6-Digit Code',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['PLN', 'EUR'],
    category: 'instant_bank',
  },
  swish_se: {
    id: 'swish_se',
    label: 'Swish Mobile',
    rail: 'Swedish BankID',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['SEK'],
    category: 'mobile_money',
  },
  vipps_no: {
    id: 'vipps_no',
    label: 'Vipps',
    rail: 'Norwegian Mobile Bank',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['NOK'],
    category: 'mobile_money',
  },
  mobilepay_dk: {
    id: 'mobilepay_dk',
    label: 'MobilePay',
    rail: 'Nordic Wallet',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['DKK', 'EUR'],
    category: 'mobile_money',
  },
  twint_ch: {
    id: 'twint_ch',
    label: 'TWINT',
    rail: 'Swiss QR Banking',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['CHF'],
    category: 'wallet',
  },
  faster_payments_gb: {
    id: 'faster_payments_gb',
    label: 'UK Faster Payments / Open Banking',
    rail: 'Sort Code & Account',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['GBP'],
    category: 'instant_bank',
  },
  ach_us: {
    id: 'ach_us',
    label: 'ACH Direct Debit / FedNow',
    rail: 'US Routing & Account',
    settlementSpeed: 'Same-Day / Instant',
    supportedCurrencies: ['USD'],
    category: 'instant_bank',
  },
  cashapp_us: {
    id: 'cashapp_us',
    label: 'Cash App Pay / Venmo',
    rail: 'US Mobile Wallet',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['USD'],
    category: 'wallet',
  },
  interac_ca: {
    id: 'interac_ca',
    label: 'Interac e-Transfer',
    rail: 'Canadian Bank Push',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['CAD'],
    category: 'instant_bank',
  },
  upi_in: {
    id: 'upi_in',
    label: 'UPI (GPay / PhonePe / Paytm)',
    rail: 'NPCI Real-Time',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['INR'],
    category: 'instant_bank',
  },
  netbanking_in: {
    id: 'netbanking_in',
    label: 'Indian NetBanking & RuPay',
    rail: 'IMPS / Domestic Card',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['INR'],
    category: 'instant_bank',
  },
  pix_br: {
    id: 'pix_br',
    label: 'PIX Instant Payment',
    rail: 'Banco Central QR',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['BRL'],
    category: 'instant_bank',
  },
  boleto_br: {
    id: 'boleto_br',
    label: 'Boleto Bancário',
    rail: 'Brazilian Voucher',
    settlementSpeed: '1-2 Business Days',
    supportedCurrencies: ['BRL'],
    category: 'invoice',
  },
  spei_mx: {
    id: 'spei_mx',
    label: 'SPEI / OXXO Pay',
    rail: 'CLABE / Cash Voucher',
    settlementSpeed: 'Instant / Same-Day',
    supportedCurrencies: ['MXN'],
    category: 'instant_bank',
  },
  paypay_jp: {
    id: 'paypay_jp',
    label: 'PayPay / Konbini / JCB',
    rail: 'Japanese QR & Card',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['JPY'],
    category: 'wallet',
  },
  kakaopay_kr: {
    id: 'kakaopay_kr',
    label: 'KakaoPay / Naver Pay',
    rail: 'Korean Digital Wallet',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['KRW'],
    category: 'wallet',
  },
  alipay_wechat_cn: {
    id: 'alipay_wechat_cn',
    label: 'Alipay / WeChat Pay / UnionPay',
    rail: 'QR & Domestic Network',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['CNY', 'HKD', 'MOP'],
    category: 'wallet',
  },
  paynow_sg: {
    id: 'paynow_sg',
    label: 'PayNow QR / GrabPay',
    rail: 'FAST Singapore',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['SGD'],
    category: 'instant_bank',
  },
  fpx_my: {
    id: 'fpx_my',
    label: 'FPX Banking / Touch n Go',
    rail: 'DuitNow Malaysia',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['MYR'],
    category: 'instant_bank',
  },
  qris_id: {
    id: 'qris_id',
    label: 'QRIS / GoPay / OVO',
    rail: 'BI-FAST Indonesia',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['IDR'],
    category: 'wallet',
  },
  promptpay_th: {
    id: 'promptpay_th',
    label: 'PromptPay QR / TrueMoney',
    rail: 'Thai National QR',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['THB'],
    category: 'instant_bank',
  },
  gcash_ph: {
    id: 'gcash_ph',
    label: 'GCash / Maya',
    rail: 'InstaPay Philippines',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['PHP'],
    category: 'wallet',
  },
  vietqr_vn: {
    id: 'vietqr_vn',
    label: 'MoMo VN / VietQR Napas',
    rail: 'Vietnam Instant QR',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['VND'],
    category: 'wallet',
  },
  payid_au: {
    id: 'payid_au',
    label: 'PayID / NPP / POLi',
    rail: 'Australia/NZ Real-Time',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['AUD', 'NZD'],
    category: 'instant_bank',
  },
  mada_sa: {
    id: 'mada_sa',
    label: 'Mada / Apple Pay GCC',
    rail: 'Middle East Domestic',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR'],
    category: 'card',
  },
  apple_google_pay: {
    id: 'apple_google_pay',
    label: 'Apple Pay / Google Pay',
    rail: 'Tokenized Wallet',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'AED', 'SAR', 'JPY', 'CHF'],
    category: 'wallet',
  },
  card_global: {
    id: 'card_global',
    label: 'Visa / Mastercard / Amex',
    rail: 'Global 3DS Card Network',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['ALL'],
    category: 'card',
  },
  flutterwave: {
    id: 'flutterwave',
    label: 'Flutterwave Multi-Rail',
    rail: 'Pan-African & Global',
    settlementSpeed: '1 Business Day',
    supportedCurrencies: ['UGX', 'KES', 'NGN', 'GHS', 'ZAR', 'TZS', 'RWF', 'USD', 'GBP', 'EUR'],
    category: 'instant_bank',
  },
  stripe: {
    id: 'stripe',
    label: 'Stripe Connect / Express',
    rail: 'Global Payout Rail',
    settlementSpeed: '1-2 Business Days',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'SGD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'MXN', 'BRL', 'AED', 'INR'],
    category: 'instant_bank',
  },
  paypal: {
    id: 'paypal',
    label: 'PayPal Global',
    rail: 'Cross-Border Wallet',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'MXN', 'BRL', 'SGD', 'HKD', 'PLN', 'SEK', 'NOK', 'DKK', 'NZD', 'PHP', 'THB', 'TWD', 'ILS'],
    category: 'wallet',
  },
  bank_transfer: {
    id: 'bank_transfer',
    label: 'Bank Transfer (Local / SWIFT / IBAN)',
    rail: 'Direct Bank Account Settlement',
    settlementSpeed: '1-2 Business Days',
    supportedCurrencies: ['ALL'],
    category: 'invoice',
  },
  mobile_money: {
    id: 'mobile_money',
    label: 'Mobile Money (MTN MoMo / Airtel / M-Pesa)',
    rail: 'Mobile Money Wallet',
    settlementSpeed: 'Instant',
    supportedCurrencies: ['ALL'],
    category: 'mobile_money',
  },
  bank_invoice: {
    id: 'bank_invoice',
    label: 'SWIFT / Local Wire / Proforma Invoice',
    rail: 'B2B Bank Settlement',
    settlementSpeed: '1-3 Business Days',
    supportedCurrencies: ['ALL'],
    category: 'invoice',
  },
  deferred_payout: {
    id: 'deferred_payout',
    label: 'Deferred Payout (Link Account Later)',
    rail: 'Studio Ledger Hold',
    settlementSpeed: 'On Account Link',
    supportedCurrencies: ['ALL'],
    category: 'invoice',
  },
};

const COUNTRY_METHOD_OVERRIDES: Record<string, string[]> = {
  UG: ['mtn_momo', 'airtel_money', 'flutterwave', 'card_global', 'bank_invoice'],
  KE: ['mpesa_ke', 'airtel_money', 'flutterwave', 'card_global', 'bank_invoice'],
  TZ: ['mpesa_ke', 'tigo_pesa', 'airtel_money', 'card_global', 'bank_invoice'],
  RW: ['mtn_momo', 'airtel_money', 'card_global', 'bank_invoice'],
  NG: ['paystack_ng', 'flutterwave', 'card_global', 'bank_invoice'],
  GH: ['mtn_momo', 'flutterwave', 'card_global', 'bank_invoice'],
  ZA: ['ozow_za', 'flutterwave', 'card_global', 'bank_invoice'],
  SN: ['orange_wave', 'card_global', 'bank_invoice'],
  CI: ['orange_wave', 'card_global', 'bank_invoice'],
  CM: ['mtn_momo', 'orange_wave', 'card_global', 'bank_invoice'],
  ZM: ['mtn_momo', 'airtel_money', 'card_global', 'bank_invoice'],
  US: ['card_global', 'apple_google_pay', 'ach_us', 'cashapp_us', 'paypal', 'bank_invoice'],
  CA: ['interac_ca', 'card_global', 'apple_google_pay', 'paypal', 'bank_invoice'],
  GB: ['faster_payments_gb', 'apple_google_pay', 'card_global', 'paypal', 'bank_invoice'],
  DE: ['giropay_de', 'sepa_instant', 'apple_google_pay', 'card_global', 'paypal'],
  NL: ['ideal_nl', 'sepa_instant', 'apple_google_pay', 'card_global', 'paypal'],
  BE: ['bancontact_be', 'sepa_instant', 'card_global', 'paypal'],
  FR: ['cartes_bancaires_fr', 'sepa_instant', 'apple_google_pay', 'card_global', 'paypal'],
  ES: ['bizum_es', 'sepa_instant', 'card_global', 'paypal'],
  PT: ['multibanco_pt', 'sepa_instant', 'card_global', 'paypal'],
  PL: ['blik_pl', 'card_global', 'paypal', 'bank_invoice'],
  SE: ['swish_se', 'card_global', 'paypal', 'bank_invoice'],
  NO: ['vipps_no', 'card_global', 'paypal', 'bank_invoice'],
  DK: ['mobilepay_dk', 'card_global', 'paypal', 'bank_invoice'],
  CH: ['twint_ch', 'apple_google_pay', 'card_global', 'paypal'],
  IN: ['upi_in', 'netbanking_in', 'card_global', 'paypal', 'bank_invoice'],
  BR: ['pix_br', 'boleto_br', 'card_global', 'paypal'],
  MX: ['spei_mx', 'card_global', 'paypal', 'bank_invoice'],
  JP: ['paypay_jp', 'apple_google_pay', 'card_global', 'paypal'],
  KR: ['kakaopay_kr', 'card_global', 'paypal', 'bank_invoice'],
  CN: ['alipay_wechat_cn', 'card_global', 'bank_invoice'],
  HK: ['alipay_wechat_cn', 'apple_google_pay', 'card_global', 'paypal'],
  SG: ['paynow_sg', 'apple_google_pay', 'card_global', 'paypal'],
  MY: ['fpx_my', 'card_global', 'paypal', 'bank_invoice'],
  ID: ['qris_id', 'card_global', 'bank_invoice'],
  TH: ['promptpay_th', 'card_global', 'paypal', 'bank_invoice'],
  PH: ['gcash_ph', 'card_global', 'paypal', 'bank_invoice'],
  VN: ['vietqr_vn', 'card_global', 'bank_invoice'],
  AU: ['payid_au', 'apple_google_pay', 'card_global', 'paypal', 'bank_invoice'],
  NZ: ['payid_au', 'apple_google_pay', 'card_global', 'paypal', 'bank_invoice'],
  SA: ['mada_sa', 'apple_google_pay', 'card_global', 'bank_invoice'],
  AE: ['apple_google_pay', 'card_global', 'bank_invoice'],
};

const CURRENCY_METHOD_FALLBACKS: Record<string, string[]> = {
  USD: ['card_global', 'apple_google_pay', 'ach_us', 'paypal', 'stripe', 'bank_invoice'],
  EUR: ['sepa_instant', 'ideal_nl', 'giropay_de', 'cartes_bancaires_fr', 'apple_google_pay', 'card_global', 'paypal'],
  GBP: ['faster_payments_gb', 'apple_google_pay', 'card_global', 'paypal', 'bank_invoice'],
  UGX: ['mtn_momo', 'airtel_money', 'flutterwave', 'card_global', 'bank_invoice'],
  KES: ['mpesa_ke', 'airtel_money', 'flutterwave', 'card_global', 'bank_invoice'],
  TZS: ['mpesa_ke', 'tigo_pesa', 'airtel_money', 'flutterwave', 'card_global'],
  RWF: ['mtn_momo', 'airtel_money', 'flutterwave', 'card_global'],
  NGN: ['paystack_ng', 'flutterwave', 'card_global', 'bank_invoice'],
  GHS: ['mtn_momo', 'flutterwave', 'card_global', 'bank_invoice'],
  ZAR: ['ozow_za', 'flutterwave', 'card_global', 'bank_invoice'],
  XOF: ['orange_wave', 'mtn_momo', 'card_global', 'bank_invoice'],
  XAF: ['mtn_momo', 'orange_wave', 'card_global', 'bank_invoice'],
  CAD: ['interac_ca', 'apple_google_pay', 'card_global', 'paypal'],
  AUD: ['payid_au', 'apple_google_pay', 'card_global', 'paypal'],
  NZD: ['payid_au', 'apple_google_pay', 'card_global', 'paypal'],
  INR: ['upi_in', 'netbanking_in', 'card_global', 'paypal'],
  BRL: ['pix_br', 'boleto_br', 'card_global', 'paypal'],
  MXN: ['spei_mx', 'card_global', 'paypal'],
  JPY: ['paypay_jp', 'apple_google_pay', 'card_global', 'paypal'],
  KRW: ['kakaopay_kr', 'card_global', 'paypal'],
  CNY: ['alipay_wechat_cn', 'card_global', 'bank_invoice'],
  SGD: ['paynow_sg', 'apple_google_pay', 'card_global', 'paypal'],
  MYR: ['fpx_my', 'card_global', 'paypal'],
  IDR: ['qris_id', 'card_global', 'bank_invoice'],
  THB: ['promptpay_th', 'card_global', 'paypal'],
  PHP: ['gcash_ph', 'card_global', 'paypal'],
  VND: ['vietqr_vn', 'card_global', 'bank_invoice'],
  AED: ['apple_google_pay', 'card_global', 'bank_invoice'],
  SAR: ['mada_sa', 'apple_google_pay', 'card_global', 'bank_invoice'],
  CHF: ['twint_ch', 'apple_google_pay', 'card_global', 'paypal'],
  PLN: ['blik_pl', 'card_global', 'paypal'],
  SEK: ['swish_se', 'card_global', 'paypal'],
  NOK: ['vipps_no', 'card_global', 'paypal'],
  DKK: ['mobilepay_dk', 'card_global', 'paypal'],
};

export const CHECKOUT_CURRENCIES = [
  'LOCAL',
  'USD',
  'UGX',
  'KES',
  'NGN',
  'ZAR',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'INR',
  'BRL',
  'JPY',
  'AED',
];

export const PAYOUT_CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'GBP', label: 'GBP — British Pound (£)' },
  { code: 'UGX', label: 'UGX — Uganda Shilling' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'TZS', label: 'TZS — Tanzanian Shilling' },
  { code: 'RWF', label: 'RWF — Rwandan Franc' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'XOF', label: 'XOF — West African CFA Franc' },
  { code: 'XAF', label: 'XAF — Central African CFA Franc' },
  { code: 'EGP', label: 'EGP — Egyptian Pound' },
  { code: 'MAD', label: 'MAD — Moroccan Dirham' },
  { code: 'ZMW', label: 'ZMW — Zambian Kwacha' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'NZD', label: 'NZD — New Zealand Dollar' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'BRL', label: 'BRL — Brazilian Real' },
  { code: 'MXN', label: 'MXN — Mexican Peso' },
  { code: 'ARS', label: 'ARS — Argentine Peso' },
  { code: 'COP', label: 'COP — Colombian Peso' },
  { code: 'CLP', label: 'CLP — Chilean Peso' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'KRW', label: 'KRW — South Korean Won' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
  { code: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'MYR', label: 'MYR — Malaysian Ringgit' },
  { code: 'IDR', label: 'IDR — Indonesian Rupiah' },
  { code: 'THB', label: 'THB — Thai Baht' },
  { code: 'PHP', label: 'PHP — Philippine Peso' },
  { code: 'VND', label: 'VND — Vietnamese Dong' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SAR', label: 'SAR — Saudi Riyal' },
  { code: 'QAR', label: 'QAR — Qatari Riyal' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'SEK', label: 'SEK — Swedish Krona' },
  { code: 'NOK', label: 'NOK — Norwegian Krone' },
  { code: 'DKK', label: 'DKK — Danish Krone' },
  { code: 'PLN', label: 'PLN — Polish Zloty' },
  { code: 'TRY', label: 'TRY — Turkish Lira' },
];

export function getPaymentMethodsForJurisdiction(
  jurisdiction: Jurisdiction,
  activeCurrency?: string
): LocalizedPaymentMethod[] {
  const baseCountryCode = jurisdiction.code.split('-')[0].toUpperCase();
  const targetCurrency = (activeCurrency || jurisdiction.currency).toUpperCase();

  let ids = COUNTRY_METHOD_OVERRIDES[baseCountryCode];
  if (!ids) {
    ids = CURRENCY_METHOD_FALLBACKS[targetCurrency];
  }
  if (!ids) {
    // Regional fallback if country/currency is exotic
    if (jurisdiction.region === 'Africa') {
      ids = ['mtn_momo', 'orange_wave', 'flutterwave', 'card_global', 'bank_invoice'];
    } else if (jurisdiction.region === 'Europe') {
      ids = ['sepa_instant', 'card_global', 'apple_google_pay', 'paypal', 'bank_invoice'];
    } else {
      ids = ['card_global', 'apple_google_pay', 'paypal', 'bank_invoice'];
    }
  }

  // If buyer explicitly chose a currency different from local currency, prioritize methods supporting that currency
  if (activeCurrency && activeCurrency !== jurisdiction.currency) {
    const currencyIds = CURRENCY_METHOD_FALLBACKS[targetCurrency] || [];
    const combined = Array.from(new Set([...currencyIds, ...ids]));
    return combined
      .map((id) => PAYMENT_METHOD_CATALOG[id])
      .filter((m): m is LocalizedPaymentMethod => Boolean(m));
  }

  return ids
    .map((id) => PAYMENT_METHOD_CATALOG[id])
    .filter((m): m is LocalizedPaymentMethod => Boolean(m));
}

export const ADMIN_PAYOUT_METHODS: Array<{
  id: 'bank' | 'mobile_money';
  payoutRailId: 'bank_transfer' | 'mobile_money';
  label: string;
  description: string;
}> = [
  {
    id: 'bank',
    payoutRailId: 'bank_transfer',
    label: 'Bank Transfer',
    description: 'Local bank transfer, IBAN/SEPA, ACH, or SWIFT wire',
  },
  {
    id: 'mobile_money',
    payoutRailId: 'mobile_money',
    label: 'Mobile Money',
    description: 'MTN MoMo, Airtel Money, M-Pesa, or Orange/Wave wallet',
  },
];

export function getPayoutMethodsForCurrency(
  currency: string,
  jurisdiction?: Jurisdiction
): LocalizedPaymentMethod[] {
  const cur = currency.toUpperCase();
  const baseCountry = jurisdiction ? jurisdiction.code.split('-')[0].toUpperCase() : '';
  const countrySpecific = baseCountry ? COUNTRY_METHOD_OVERRIDES[baseCountry] || [] : [];
  const specificIds = CURRENCY_METHOD_FALLBACKS[cur] || [];
  const allPayoutIds = Array.from(
    new Set([
      'bank_transfer',
      'mobile_money',
      ...countrySpecific.filter((id) => id !== 'card_global'),
      ...specificIds.filter((id) => id !== 'card_global'),
      'stripe',
      'paypal',
      'flutterwave',
      'bank_invoice',
      'deferred_payout',
    ])
  );
  return allPayoutIds
    .map((id) => PAYMENT_METHOD_CATALOG[id])
    .filter((m): m is LocalizedPaymentMethod => Boolean(m));
}

export function getPaymentMethodLabel(id: string): string {
  return PAYMENT_METHOD_CATALOG[id]?.label || id.replace(/_/g, ' ');
}

