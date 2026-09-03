export const SITNIKS_DEFAULT_STATUS_ID = 13702; // Новий
export const SITNIKS_DEFAULT_PAID_STATUS_ID = 17444; // Оплачено
export const SITNIKS_DEFAULT_PREPAYMENT_PAID_STATUS_ID = 42498; // Чекаємо на оплату після передплати

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  monoToken: process.env.MONO_TOKEN || '',
  webhookUrl: process.env.WEBHOOK_URL || '',
  redirectUrl: process.env.REDIRECT_URL || 'https://example.com',
  monoPartsBaseUrl: normalizeMonobankPartsBaseUrl(
    process.env.MONO_PARTS_BASE_URL || 'https://u2.monobank.com.ua',
  ),
  monoPartsStoreId: process.env.MONO_PARTS_STORE_ID || '',
  monoPartsSecret: process.env.MONO_PARTS_SECRET || '',
  monoPartsResultCallbackUrl: process.env.MONO_PARTS_RESULT_CALLBACK_URL || '',
  monoPartsCount: Number(process.env.MONO_PARTS_COUNT || 0),
  monoPartsCounts: parseNumberList(process.env.MONO_PARTS_COUNTS || process.env.MONO_PARTS_COUNT || '3'),
  monoPartsInvoiceSource: process.env.MONO_PARTS_INVOICE_SOURCE || 'INTERNET',
  monoPartsPointId: process.env.MONO_PARTS_POINT_ID || '',
  monoPartsAdminToken: process.env.MONO_PARTS_ADMIN_TOKEN || '',
  monoPartsAutoConfirm: ['1', 'true', 'yes', 'on'].includes(
    String(process.env.MONO_PARTS_AUTO_CONFIRM || '').toLowerCase(),
  ),
  monoPartsEnabled: ['1', 'true', 'yes', 'on'].includes(
    String(process.env.MONO_PARTS_ENABLED || '').toLowerCase(),
  ),
  shopifyStoreDomain: normalizeShopDomain(
    process.env.SHOPIFY_STORE_DOMAIN || process.env.SHOPIFY_STORE_URL || '',
  ),
  shopifyClientId: process.env.SHOPIFY_CLIENT_ID || '',
  shopifyClientSecret: process.env.SHOPIFY_CLIENT_SECRET || '',
  shopifyAdminAccessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || '',
  shopifyPaymentUpdateDelaySeconds: Number(process.env.SHOPIFY_PAYMENT_UPDATE_DELAY_SECONDS || 0),
  novaPoshtaApiKey: process.env.NOVA_POSHTA_API_KEY || '',
  metaPixelId: process.env.META_PIXEL_ID || '',
  metaAccessToken: process.env.META_ACCESS_TOKEN || '',
  metaGraphVersion: process.env.META_GRAPH_VERSION || 'v23.0',
  ga4MeasurementId: process.env.GA4_MEASUREMENT_ID || '',
  ga4ApiSecret: process.env.GA4_API_SECRET || '',
  sitniksApiBaseUrl: normalizeBaseUrl(process.env.SITNIKS_API_BASE_URL || 'https://crm.sitniks.com'),
  sitniksApiToken: process.env.SITNIKS_API_TOKEN || '',
  sitniksStatusId: Number(process.env.SITNIKS_STATUS_ID || SITNIKS_DEFAULT_STATUS_ID),
  sitniksPaidStatusId: Number(process.env.SITNIKS_PAID_STATUS_ID || SITNIKS_DEFAULT_PAID_STATUS_ID),
  sitniksPrepaymentPaidStatusId: Number(
    process.env.SITNIKS_PREPAYMENT_PAID_STATUS_ID
      || process.env.SITNIKS_PAID_STATUS_ID
      || SITNIKS_DEFAULT_PREPAYMENT_PAID_STATUS_ID,
  ),
  sitniksPartsPaidStatusId: Number(
    process.env.SITNIKS_PARTS_PAID_STATUS_ID
      || process.env.SITNIKS_PAID_STATUS_ID
      || SITNIKS_DEFAULT_PAID_STATUS_ID,
  ),
  sitniksSalesChannelId: Number(process.env.SITNIKS_SALES_CHANNEL_ID || 0),
  sitniksSettlementAccountId: Number(process.env.SITNIKS_SETTLEMENT_ACCOUNT_ID || 0),
  sitniksWarehouseId: Number(process.env.SITNIKS_WAREHOUSE_ID || 0),
  sitniksNovaPoshtaIntegrationId: Number(process.env.SITNIKS_NOVA_POSHTA_INTEGRATION_ID || 0),
  sitniksCashRegisterId: Number(process.env.SITNIKS_CASH_REGISTER_ID || 0),
  sitniksReceiptsEnabled: ['1', 'true', 'yes', 'on'].includes(
    String(process.env.SITNIKS_RECEIPTS_ENABLED || '').toLowerCase(),
  ),
  sitniksReceiptPaymentType: normalizeSitniksReceiptPaymentType(
    process.env.SITNIKS_RECEIPT_PAYMENT_TYPE || 'prepayment',
  ),
  sitniksReceiptVerifyAttempts: Math.max(1, Number(process.env.SITNIKS_RECEIPT_VERIFY_ATTEMPTS || 6)),
  sitniksReceiptVerifyDelayMs: Math.max(500, Number(process.env.SITNIKS_RECEIPT_VERIFY_DELAY_MS || 5000)),
  sitniksOfferMap: process.env.SITNIKS_OFFER_MAP || '',
};

export const PREPAYMENT_AMOUNT = 300;
export const SHOPIFY_SCOPES = 'read_orders,write_orders,write_order_edits,read_products';
export const SHOPIFY_API_VERSION = '2026-01';

export function normalizeShopDomain(value: string): string {
  return value.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, '');
}

export function parseNumberList(value: string): number[] {
  const numbers = value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);

  return Array.from(new Set(numbers));
}

export function normalizeMonobankPartsBaseUrl(value: string): string {
  const normalized = normalizeBaseUrl(value);
  try {
    const url = new URL(normalized);
    if (url.pathname.startsWith('/api/order')) {
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return normalizeBaseUrl(url.toString());
    }
  } catch {
    return normalized;
  }

  return normalized;
}

export function normalizeSitniksReceiptPaymentType(value: string): 'prepayment' | 'afterpayment' {
  return value === 'afterpayment' ? 'afterpayment' : 'prepayment';
}

export function getPublicBaseUrl(): string {
  if (!env.webhookUrl) throw new Error('Missing WEBHOOK_URL');
  const webhookUrl = new URL(env.webhookUrl);
  return `${webhookUrl.protocol}//${webhookUrl.host}`;
}

export function requireEnv(name: keyof typeof env): string {
  const value = env[name];
  if (typeof value !== 'string' || !value) {
    throw new Error(`Missing ${String(name)}`);
  }
  return value;
}
