import { env } from '../../config/env';
import type { StoredPaymentMetadata } from '../../types/checkout';
import type { MonobankWebhookBody } from '../../types/monobank';
import { asNumber, asString } from '../../utils/format';

type Ga4Item = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

type Ga4PurchasePayload = {
  client_id: string;
  user_id?: string;
  timestamp_micros: number;
  events: Array<{
    name: 'purchase';
    params: Record<string, unknown>;
  }>;
};

export function normalizeGaClientId(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';

  if (/^GA\d+\.\d+\./.test(raw)) {
    return raw.split('.').slice(2).join('.');
  }

  return raw;
}

export function normalizeGaSessionId(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';

  const prefixedMatch = raw.match(/(?:^|[.$])s(\d{8,})(?:[$.]|$)/);
  if (prefixedMatch?.[1]) return prefixedMatch[1];

  if (/^GS\d+\.\d+\./.test(raw)) {
    return raw.split('.')[2] || '';
  }

  return raw;
}

function getTrackingValue(tracking: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = asString(tracking[key]);
    if (value) return value;
  }
  return '';
}

function getGclidFromTracking(tracking: Record<string, unknown>): string {
  const explicitGclid = getTrackingValue(tracking, 'gclid');
  if (explicitGclid) return explicitGclid;

  const gclAw = getTrackingValue(tracking, 'gcl_aw');
  if (!gclAw) return '';

  const parts = gclAw.split('.');
  return parts.length >= 3 ? parts.slice(2).join('.') : '';
}

function buildGa4Items(payment: StoredPaymentMetadata): Ga4Item[] {
  const goods = Array.isArray(payment.goods) ? payment.goods : [];

  return goods.map((item, index) => ({
    item_id: String(item.code || item.variant_id || index + 1),
    item_name: asString(item.name || item.title) || String(item.code || item.variant_id || index + 1),
    price: asNumber(item.price),
    quantity: asNumber(item.quantity) || 1,
  }));
}

export function buildGa4PurchasePayload(
  payment: StoredPaymentMetadata,
  webhookBody: MonobankWebhookBody,
): Ga4PurchasePayload | null {
  const tracking = payment.tracking || {};
  const clientId = normalizeGaClientId(getTrackingValue(
    tracking,
    'ga_client_id',
    'ga_cookie',
    'client_id',
  ));

  if (!clientId) return null;

  const sessionId = normalizeGaSessionId(getTrackingValue(
    tracking,
    'ga_session_id',
    'ga4_session_id',
    'ga_session_cookie',
  ));
  const paidAmount =
    asNumber(webhookBody.finalAmount || webhookBody.amount) / 100 ||
    asNumber(payment.amount);
  const orderValue = asNumber(payment.cartTotal) || paidAmount;
  const transactionId =
    asString(webhookBody.invoiceId) ||
    asString(payment.reference) ||
    asString(payment.shopifyOrderId);
  const eventId = transactionId ? `mono_${transactionId}` : '';
  const gclid = getGclidFromTracking(tracking);

  const params: Record<string, unknown> = {
    transaction_id: transactionId,
    currency: 'UAH',
    value: orderValue,
    items: buildGa4Items(payment),
    payment_type: payment.paymentType,
    engagement_time_msec: 1,
    event_id: eventId,
  };

  if (sessionId) params.session_id = sessionId;
  if (gclid) params.gclid = gclid;

  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gbraid', 'wbraid'].forEach((key) => {
    const value = asString(tracking[key]);
    if (value) params[key] = value;
  });

  return {
    client_id: clientId,
    user_id: payment.shopifyOrderId ? String(payment.shopifyOrderId) : undefined,
    timestamp_micros: Date.now() * 1000,
    events: [
      {
        name: 'purchase',
        params,
      },
    ],
  };
}

export async function sendGa4PurchaseEvent(
  payment: StoredPaymentMetadata,
  webhookBody: MonobankWebhookBody,
): Promise<void> {
  if (!env.ga4MeasurementId || !env.ga4ApiSecret) return;

  const payload = buildGa4PurchasePayload(payment, webhookBody);
  if (!payload) {
    console.warn('Google GA4 Purchase skipped: missing GA client_id');
    return;
  }

  const response = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(env.ga4MeasurementId)}&api_secret=${encodeURIComponent(env.ga4ApiSecret)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Google GA4 MP error ${response.status}: ${text}`);
  }

  console.log('Google GA4 Purchase sent:', {
    status: response.status,
    measurementId: env.ga4MeasurementId,
    transactionId: payload.events[0]?.params.transaction_id,
  });
}
