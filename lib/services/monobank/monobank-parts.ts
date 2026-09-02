import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, getPublicBaseUrl } from '../../config/env';
import type { CheckoutPayload } from '../../types/checkout';
import { asNumber, asString, parseJsonObject } from '../../utils/format';

const MONO_PARTS_CREATE_PATH = '/api/order/create';
const MONO_PARTS_CONFIRM_PATH = '/api/order/confirm';
const MONO_PARTS_REJECT_PATH = '/api/order/reject';
const MONO_PARTS_STATE_PATH = '/api/order/state';

export interface MonobankPartsOrder {
  orderId: string;
  reference: string;
  amount: number;
  raw: Record<string, unknown>;
}

export interface MonobankPartsCallbackBody {
  order_id?: string;
  orderId?: string;
  store_order_id?: string;
  storeOrderId?: string;
  state?: string;
  order_sub_state?: string;
  orderSubState?: string;
  [key: string]: unknown;
}

export function isMonobankPartsReady(): boolean {
  return Boolean(env.monoPartsEnabled && env.monoPartsStoreId && env.monoPartsSecret);
}

function requireMonobankPartsEnv() {
  if (!env.monoPartsStoreId) throw new Error('Missing MONO_PARTS_STORE_ID');
  if (!env.monoPartsSecret) throw new Error('Missing MONO_PARTS_SECRET');
}

export function buildMonobankPartsSignature(rawBody: string): string {
  requireMonobankPartsEnv();
  return createHmac('sha256', env.monoPartsSecret).update(rawBody).digest('base64');
}

export function verifyMonobankPartsSignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !env.monoPartsSecret) return false;
  const expected = buildMonobankPartsSignature(rawBody);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function normalizePhone(phone: unknown): string {
  const digits = asString(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('380')) return `+${digits}`;
  if (digits.startsWith('0')) return `+38${digits}`;
  return digits.startsWith('+') ? digits : `+${digits}`;
}

function maskPhone(phone: unknown): string {
  const value = asString(phone);
  if (value.length <= 6) return value ? '***' : '';
  return `${value.slice(0, 4)}***${value.slice(-3)}`;
}

function callbackUrl(): string {
  if (env.monoPartsResultCallbackUrl) return env.monoPartsResultCallbackUrl;
  return `${getPublicBaseUrl()}/api/webhooks/monobank-parts`;
}

export function getMonobankPartsCounts(): number[] {
  if (env.monoPartsCounts.length) return env.monoPartsCounts;
  if (env.monoPartsCount > 0) return [env.monoPartsCount];
  return [3];
}

function getSelectedPartsCount(body: CheckoutPayload): number {
  const availableCounts = getMonobankPartsCounts();
  const requestedCount = Math.trunc(asNumber(body.installments_parts_count));
  if (availableCounts.includes(requestedCount)) return requestedCount;
  return availableCounts[0] || 3;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildMonobankPartsProducts(body: CheckoutPayload, amount: number): Array<Record<string, unknown>> {
  const goods = body.goods || [];
  const products = goods
    .map((item, index) => {
      const quantity = Math.max(1, Math.trunc(asNumber(item.quantity) || 1));
      const price = roundMoney(asNumber(item.price) || amount / Math.max(1, goods.length || 1));
      const name = asString(item.name) || asString(item.title) || asString(item.variant_title) || `Товар ${index + 1}`;
      const code = asString(item.code) || asString(item.variant_id);

      return {
        name,
        count: quantity,
        sum: price,
        code: code || undefined,
      };
    })
    .filter((item) => asNumber(item.sum) > 0);

  if (products.length) return products;

  return [{
    name: `Замовлення ${asString(body.cart_token) || 'Shopify'}`,
    count: 1,
    sum: roundMoney(amount),
  }];
}

function buildInvoiceNumber(shopifyOrder: { id: number; name: string }): string {
  return (asString(shopifyOrder.name) || `SHOPIFY-${shopifyOrder.id}`)
    .replace(/^#/, '')
    .slice(0, 64);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildMonobankPartsCreatePayload(
  body: CheckoutPayload,
  shopifyOrder: { id: number; name: string },
  amount: number,
) {
  const customer = body.customer || {};
  const reference = `shopify-parts-${shopifyOrder.id}-${Date.now()}`;
  const partsCount = getSelectedPartsCount(body);
  const payload: Record<string, unknown> = {
    store_order_id: reference,
    client_phone: normalizePhone(customer.phone),
    total_sum: amount,
    invoice: {
      number: buildInvoiceNumber(shopifyOrder),
      date: todayIsoDate(),
      source: env.monoPartsInvoiceSource,
      ...(env.monoPartsPointId ? { point_id: env.monoPartsPointId } : {}),
    },
    available_programs: [{
      type: 'payment_installments',
      available_parts_count: [partsCount],
    }],
    products: buildMonobankPartsProducts(body, amount),
    result_callback: callbackUrl(),
  };

  return payload;
}

async function monobankPartsRequest<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  requireMonobankPartsEnv();
  const rawBody = JSON.stringify(payload);
  const response = await fetch(`${env.monoPartsBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'store-id': env.monoPartsStoreId,
      signature: buildMonobankPartsSignature(rawBody),
    },
    body: rawBody,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Monobank parts error ${response.status}: ${text}`);
  }

  return parseJsonObject<T>(text || '{}', 'Monobank parts');
}

function getPartsOrderId(data: Record<string, unknown>): string {
  return asString(data.order_id) || asString(data.orderId) || asString(data.id);
}

function getPayloadPartsCount(payload: Record<string, unknown>): number {
  const programs = Array.isArray(payload.available_programs) ? payload.available_programs : [];
  const firstProgram = programs[0] as Record<string, unknown> | undefined;
  const counts = Array.isArray(firstProgram?.available_parts_count) ? firstProgram.available_parts_count : [];
  return asNumber(counts[0]);
}

export async function createMonobankPartsOrder(
  body: CheckoutPayload,
  shopifyOrder: { id: number; name: string },
  amount: number,
): Promise<MonobankPartsOrder> {
  if (!isMonobankPartsReady()) {
    throw new Error('Monobank parts is not configured');
  }
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const payload = buildMonobankPartsCreatePayload(body, shopifyOrder, amount);
  const data = await monobankPartsRequest<Record<string, unknown>>(MONO_PARTS_CREATE_PATH, payload);
  const orderId = getPartsOrderId(data);
  if (!orderId) throw new Error('Monobank parts response missing order id');

  console.log('[Monobank parts] Order created:', {
    shopifyOrderId: shopifyOrder.id,
    shopifyOrderName: shopifyOrder.name,
    orderId,
    storeOrderId: payload.store_order_id,
    clientPhone: maskPhone(payload.client_phone),
    baseUrl: env.monoPartsBaseUrl,
    partsCount: getPayloadPartsCount(payload),
    amount,
  });

  return {
    orderId,
    reference: asString(payload.store_order_id),
    amount,
    raw: data,
  };
}

export function getMonobankPartsCallbackOrderId(body: MonobankPartsCallbackBody): string {
  return asString(body.order_id) || asString(body.orderId);
}

export function getMonobankPartsCallbackReference(body: MonobankPartsCallbackBody): string {
  return asString(body.store_order_id) || asString(body.storeOrderId);
}

export function isMonobankPartsApproved(body: MonobankPartsCallbackBody): boolean {
  const state = asString(body.state).toUpperCase();
  const subState = (asString(body.order_sub_state) || asString(body.orderSubState)).toUpperCase();
  return state === 'IN_PROCESS' && subState === 'WAITING_FOR_STORE_CONFIRM';
}

export function isMonobankPartsCompleted(body: MonobankPartsCallbackBody): boolean {
  const state = asString(body.state).toUpperCase();
  return ['SUCCESS', 'DONE', 'COMPLETED'].includes(state);
}

export function isMonobankPartsFailed(body: MonobankPartsCallbackBody): boolean {
  const state = asString(body.state).toUpperCase();
  const subState = (asString(body.order_sub_state) || asString(body.orderSubState)).toUpperCase();
  return ['FAIL', 'FAILED', 'REJECTED', 'CANCELED', 'CANCELLED'].includes(state)
    || ['FAIL', 'FAILED', 'REJECTED', 'CANCELED', 'CANCELLED'].includes(subState);
}

export function buildMonobankPartsWebhookAmount(paymentAmount: unknown): number {
  return asNumber(paymentAmount) || 0;
}

export async function confirmMonobankPartsOrder(orderId: string): Promise<unknown> {
  if (!orderId) throw new Error('Missing Monobank parts order id');
  const data = await monobankPartsRequest(MONO_PARTS_CONFIRM_PATH, { order_id: orderId });
  console.log('[Monobank parts] Order confirmed:', { orderId });
  return data;
}

export async function rejectMonobankPartsOrder(orderId: string): Promise<unknown> {
  if (!orderId) throw new Error('Missing Monobank parts order id');
  const data = await monobankPartsRequest(MONO_PARTS_REJECT_PATH, { order_id: orderId });
  console.log('[Monobank parts] Order rejected:', { orderId });
  return data;
}

export async function getMonobankPartsOrderState(orderId: string): Promise<unknown> {
  if (!orderId) throw new Error('Missing Monobank parts order id');
  return monobankPartsRequest(MONO_PARTS_STATE_PATH, { order_id: orderId });
}
