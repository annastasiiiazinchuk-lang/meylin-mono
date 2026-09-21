import { env } from '../../config/env';
import type { StoredPaymentMetadata } from '../../types/checkout';
import type { MonobankWebhookBody } from '../../types/monobank';
import { asNumber, asString, parseJsonObject, sha256 } from '../../utils/format';

type GoogleAdsClickIdField = 'gclid' | 'gbraid' | 'wbraid';

type GoogleAdsClickId = {
  field: GoogleAdsClickIdField;
  value: string;
};

type GoogleAdsClickConversion = {
  conversionAction: string;
  conversionDateTime: string;
  conversionValue: number;
  currencyCode: string;
  orderId: string;
  conversionEnvironment: 'WEB';
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  userIdentifiers?: Array<Record<string, string>>;
};

type GoogleAdsUploadRequest = {
  conversions: GoogleAdsClickConversion[];
  partialFailure: boolean;
  validateOnly: boolean;
};

type OAuthTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

export function normalizeGoogleAdsId(value: unknown): string {
  return asString(value).replace(/\D/g, '');
}

function normalizePhone(value: unknown): string {
  const digits = asString(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `38${digits}`;
  return digits;
}

function compactRecord<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    }),
  );
}

export function getGoogleAdsClickId(tracking: Record<string, unknown>): GoogleAdsClickId | null {
  const gclid = asString(tracking.gclid) || extractGclidFromGclAw(asString(tracking.gcl_aw));
  if (gclid) return { field: 'gclid', value: gclid };

  const gbraid = asString(tracking.gbraid);
  if (gbraid) return { field: 'gbraid', value: gbraid };

  const wbraid = asString(tracking.wbraid);
  if (wbraid) return { field: 'wbraid', value: wbraid };

  return null;
}

export function extractGclidFromGclAw(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';

  const parts = raw.split('.');
  return parts.length >= 3 ? parts.slice(2).join('.') : '';
}

export function formatGoogleAdsDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    '-',
    pad(date.getUTCMonth() + 1),
    '-',
    pad(date.getUTCDate()),
    ' ',
    pad(date.getUTCHours()),
    ':',
    pad(date.getUTCMinutes()),
    ':',
    pad(date.getUTCSeconds()),
    '+00:00',
  ].join('');
}

function getWebhookDate(webhookBody: MonobankWebhookBody): Date {
  const record = webhookBody as unknown as Record<string, unknown>;
  const rawDate = asString(record.modifiedDate) || asString(record.createdDate);
  const date = rawDate ? new Date(rawDate) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function getGoogleAdsConversionActionResourceName(): string {
  const explicitResource = asString(env.googleAdsConversionActionResourceName);
  if (explicitResource) return explicitResource;

  const customerId = normalizeGoogleAdsId(env.googleAdsCustomerId);
  const conversionActionId = normalizeGoogleAdsId(env.googleAdsConversionActionId);
  if (!customerId || !conversionActionId) return '';

  return `customers/${customerId}/conversionActions/${conversionActionId}`;
}

export function isGoogleAdsConversionUploadReady(): boolean {
  return Boolean(
    env.googleAdsDeveloperToken &&
    env.googleAdsCustomerId &&
    env.googleAdsClientId &&
    env.googleAdsClientSecret &&
    env.googleAdsRefreshToken &&
    getGoogleAdsConversionActionResourceName(),
  );
}

export function buildGoogleAdsClickConversion(
  payment: StoredPaymentMetadata,
  webhookBody: MonobankWebhookBody,
  conversionAction: string,
): GoogleAdsClickConversion | null {
  const tracking = payment.tracking || {};
  const clickId = getGoogleAdsClickId(tracking);
  if (!clickId) return null;

  const paidAmount =
    asNumber(webhookBody.finalAmount || webhookBody.amount) / 100 ||
    asNumber(payment.amount);
  const orderValue = asNumber(payment.cartTotal) || paidAmount;
  const orderId =
    asString(webhookBody.invoiceId) ||
    asString(payment.reference) ||
    asString(payment.shopifyOrderId);
  const customer = payment.customer || {};
  const hashedEmail = sha256(customer.email);
  const hashedPhone = sha256(normalizePhone(customer.phone));
  const userIdentifiers = [
    hashedEmail ? { hashedEmail } : null,
    hashedPhone ? { hashedPhoneNumber: hashedPhone } : null,
  ].filter((item): item is Record<string, string> => Boolean(item));

  return compactRecord({
    conversionAction,
    conversionDateTime: formatGoogleAdsDateTime(getWebhookDate(webhookBody)),
    conversionValue: orderValue,
    currencyCode: 'UAH',
    orderId,
    conversionEnvironment: 'WEB',
    [clickId.field]: clickId.value,
    userIdentifiers,
  }) as GoogleAdsClickConversion;
}

export function buildGoogleAdsUploadRequest(
  payment: StoredPaymentMetadata,
  webhookBody: MonobankWebhookBody,
  conversionAction = getGoogleAdsConversionActionResourceName(),
): GoogleAdsUploadRequest | null {
  if (!conversionAction) return null;

  const conversion = buildGoogleAdsClickConversion(payment, webhookBody, conversionAction);
  if (!conversion) return null;

  return {
    conversions: [conversion],
    partialFailure: true,
    validateOnly: false,
  };
}

async function getGoogleAdsAccessToken(): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.googleAdsClientId,
      client_secret: env.googleAdsClientSecret,
      refresh_token: env.googleAdsRefreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const text = await response.text();
  const data = parseJsonObject<OAuthTokenResponse>(text, 'Google OAuth');
  if (!response.ok || !data.access_token) {
    throw new Error(`Google OAuth error ${response.status}: ${data.error_description || data.error || text}`);
  }

  return data.access_token;
}

export async function sendGoogleAdsClickConversion(
  payment: StoredPaymentMetadata,
  webhookBody: MonobankWebhookBody,
): Promise<void> {
  if (!isGoogleAdsConversionUploadReady()) return;

  const requestBody = buildGoogleAdsUploadRequest(payment, webhookBody);
  if (!requestBody) {
    console.warn('Google Ads conversion skipped: missing gclid/gbraid/wbraid or conversion action', {
      invoiceId: webhookBody.invoiceId,
      shopifyOrderId: payment.shopifyOrderId,
    });
    return;
  }

  const customerId = normalizeGoogleAdsId(env.googleAdsCustomerId);
  const accessToken = await getGoogleAdsAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'developer-token': env.googleAdsDeveloperToken,
  };
  const loginCustomerId = normalizeGoogleAdsId(env.googleAdsLoginCustomerId);
  if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;

  const response = await fetch(
    `https://googleads.googleapis.com/${env.googleAdsApiVersion}/customers/${customerId}:uploadClickConversions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    },
  );

  const text = await response.text();
  const data = parseJsonObject<Record<string, unknown>>(text, 'Google Ads');
  if (!response.ok || data.partialFailureError) {
    throw new Error(`Google Ads conversion upload error ${response.status}: ${text}`);
  }

  console.log('Google Ads conversion sent:', {
    status: response.status,
    customerId,
    conversionAction: requestBody.conversions[0]?.conversionAction,
    orderId: requestBody.conversions[0]?.orderId,
  });
}
