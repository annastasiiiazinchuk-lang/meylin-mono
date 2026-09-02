import type { Payment } from '@prisma/client';
import { env } from '../../config/env';
import type { CheckoutPayload } from '../../types/checkout';
import type { MonobankWebhookBody } from '../../types/monobank';
import type { ShopifyOrder } from '../../types/shopify';
import { asNumber, asString, parseJsonObject } from '../../utils/format';
import { getCartTotal, getPaymentAmount, getShippingPrice } from '../shopify/shopify-order';

export interface SitniksOrderResponse {
  id?: number;
  orderNumber?: number;
  externalId?: string;
}

type SitniksOfferItemType = 'variation' | 'suit';

interface SitniksOfferMapEntry {
  itemId: number;
  itemType: SitniksOfferItemType;
  warehouseId?: number;
}

interface SitniksProductVariation {
  id?: number;
  sku?: string;
  isActive?: boolean;
}

interface SitniksProductVariationListResponse {
  data?: SitniksProductVariation[];
  count?: number;
}

interface SitniksReceiptEntity {
  id?: number;
  receiptId?: string;
}

interface SitniksReceiptListResponse {
  data?: SitniksReceiptEntity[];
  count?: number;
}

type SitniksOrderPayloadOptions = {
  includeProducts?: boolean;
  includeNpDelivery?: boolean;
  offerMap?: Record<string, SitniksOfferMapEntry>;
};

const variationLookupCache = new Map<string, SitniksOfferMapEntry | null>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fullName(body: CheckoutPayload): string {
  const customer = body.customer || {};
  const name = [asString(customer.first_name), asString(customer.last_name)].filter(Boolean).join(' ');
  return name || asString(customer.phone) || asString(customer.email) || 'Custom checkout customer';
}

function buildGoodsComment(body: CheckoutPayload): string {
  return (body.goods || [])
    .map((item) => {
      const title = asString(item.name) || asString(item.title) || 'Товар';
      const variantTitle = asString(item.variant_title);
      const titleWithVariant = variantTitle ? `${title} (${variantTitle})` : title;
      const sku = asString(item.code) || asString(item.variant_id);
      const quantity = Math.max(1, Math.round(asNumber(item.quantity) || 1));
      const price = asNumber(item.price);
      const properties = (item.properties || [])
        .map((property) => {
          const name = asString(property.name);
          const value = asString(property.value);
          if (!name || !value) return '';
          return `${name}: ${value}`;
        })
        .filter(Boolean);
      const details = [
        `${titleWithVariant} x ${quantity}`,
        price ? `${price} грн` : '',
        sku ? `SKU/variant: ${sku}` : '',
        ...properties,
      ].filter(Boolean);
      return `- ${details.join(', ')}`;
    })
    .join('\n');
}

function getItemDiscountAmount(item: CheckoutPayload['goods'][number]): number {
  const row = item as Record<string, unknown>;
  return asNumber(row.discountAmount)
    || asNumber(row.discount_amount)
    || asNumber(row.total_discount)
    || asNumber(row.line_discount)
    || 0;
}

function buildItemTitle(item: CheckoutPayload['goods'][number]): string {
  const title = asString(item.name) || asString(item.title);
  const variantTitle = asString(item.variant_title);
  return variantTitle ? `${title} (${variantTitle})` : title;
}

function buildItemNotes(item: CheckoutPayload['goods'][number]): string | undefined {
  const properties = (item.properties || [])
    .map((property) => {
      const name = asString(property.name);
      const value = asString(property.value);
      if (!name || !value) return '';
      return `${name}: ${value}`;
    })
    .filter(Boolean);

  return properties.length ? properties.join('\n') : undefined;
}

function parseSitniksOfferMap(): Record<string, SitniksOfferMapEntry> {
  if (!env.sitniksOfferMap) return {};

  try {
    const parsed = JSON.parse(env.sitniksOfferMap) as Record<string, unknown>;
    const result: Record<string, SitniksOfferMapEntry> = {};

    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === 'number') {
        result[key] = { itemId: value, itemType: 'variation' };
        return;
      }

      if (!value || typeof value !== 'object') return;
      const entry = value as Record<string, unknown>;
      const itemId = asNumber(entry.itemId || entry.productVariationId || entry.id);
      const itemType = asString(entry.itemType || entry.type) as SitniksOfferItemType;
      const warehouseId = asNumber(entry.warehouseId);

      if (!itemId || !['variation', 'suit'].includes(itemType)) return;
      result[key] = {
        itemId,
        itemType,
        ...(warehouseId > 0 ? { warehouseId } : {}),
      };
    });

    return result;
  } catch (error) {
    console.warn('[Sitniks] SITNIKS_OFFER_MAP is not valid JSON; products will be sent without stock mapping', error);
    return {};
  }
}

function getSitniksOfferMapEntry(
  item: CheckoutPayload['goods'][number],
  offerMap: Record<string, SitniksOfferMapEntry>,
): SitniksOfferMapEntry | null {
  const keys = [
    asString(item.variant_id),
    asString(item.code),
    buildItemTitle(item),
  ].filter(Boolean);

  for (const key of keys) {
    if (offerMap[key]) return offerMap[key];
  }

  return null;
}

function getItemSku(item: CheckoutPayload['goods'][number]): string {
  return asString(item.code);
}

async function findSitniksVariationBySku(sku: string): Promise<SitniksOfferMapEntry | null> {
  const cacheKey = `${env.sitniksWarehouseId || 'any'}:${sku}`;
  if (variationLookupCache.has(cacheKey)) {
    return variationLookupCache.get(cacheKey) || null;
  }

  const params = new URLSearchParams({
    sku,
    limit: '5',
  });
  if (env.sitniksWarehouseId > 0) {
    params.set('warehouseId', String(env.sitniksWarehouseId));
  }

  try {
    const response = await sitniksRequest<SitniksProductVariationListResponse>(
      `/open-api/products/variations?${params.toString()}`,
      { method: 'GET' },
    );
    const variations = response.data || [];
    const variation = variations.find((item) => asString(item.sku) === sku && item.id)
      || variations.find((item) => item.id);

    const entry = variation?.id
      ? {
          itemId: variation.id,
          itemType: 'variation' as const,
          ...(env.sitniksWarehouseId > 0 ? { warehouseId: env.sitniksWarehouseId } : {}),
        }
      : null;

    variationLookupCache.set(cacheKey, entry);
    return entry;
  } catch (error) {
    console.error('[Sitniks] Failed to resolve product variation by SKU:', { sku, error });
    variationLookupCache.set(cacheKey, null);
    return null;
  }
}

export async function resolveSitniksOfferMap(body: CheckoutPayload): Promise<Record<string, SitniksOfferMapEntry>> {
  const offerMap = parseSitniksOfferMap();
  const skus = Array.from(new Set(
    (body.goods || [])
      .map(getItemSku)
      .filter(Boolean),
  ));

  await Promise.all(skus.map(async (sku) => {
    if (offerMap[sku]) return;
    const entry = await findSitniksVariationBySku(sku);
    if (entry) {
      offerMap[sku] = entry;
    } else {
      console.warn('[Sitniks] Product variation was not found by SKU; item will stay in manager comment only', { sku });
    }
  }));

  return offerMap;
}

export function buildSitniksProducts(body: CheckoutPayload) {
  return (body.goods || [])
    .map((item) => {
      const titleWithVariant = buildItemTitle(item);
      const price = asNumber(item.price);
      const quantity = Math.max(1, Math.round(asNumber(item.quantity) || 1));
      const discountAmount = getItemDiscountAmount(item);

      if (!titleWithVariant || !price) return null;

      return {
        title: titleWithVariant,
        price,
        quantity,
        isUpsale: false,
        ...(discountAmount > 0 ? { discountAmount } : {}),
        ...(env.sitniksWarehouseId > 0 ? { warehouseId: env.sitniksWarehouseId } : {}),
      };
    })
    .filter((item): item is {
      title: string;
      price: number;
      quantity: number;
      isUpsale: boolean;
      discountAmount?: number;
      warehouseId?: number;
    } => Boolean(item));
}

export function buildSitniksOffers(
  body: CheckoutPayload,
  offerMap: Record<string, SitniksOfferMapEntry> = parseSitniksOfferMap(),
) {

  return (body.goods || [])
    .map((item) => {
      const mapEntry = getSitniksOfferMapEntry(item, offerMap);
      if (!mapEntry) return null;

      const title = buildItemTitle(item);
      const price = asNumber(item.price);
      const quantity = Math.max(1, Math.round(asNumber(item.quantity) || 1));
      const discountAmount = getItemDiscountAmount(item);
      const notes = buildItemNotes(item);
      const warehouseId = mapEntry.warehouseId || env.sitniksWarehouseId;

      return {
        itemId: mapEntry.itemId,
        itemType: mapEntry.itemType,
        isUpsale: false,
        title,
        price,
        quantity,
        ...(warehouseId > 0 ? { warehouseId } : {}),
        ...(discountAmount > 0 ? { discountAmount } : {}),
        ...(notes ? { notes } : {}),
      };
    })
    .filter((item): item is {
      itemId: number;
      itemType: SitniksOfferItemType;
      isUpsale: boolean;
      title: string;
      price: number;
      quantity: number;
      warehouseId?: number;
      discountAmount?: number;
      notes?: string;
    } => Boolean(item));
}

export function buildSitniksPayment(body: CheckoutPayload) {
  if (env.sitniksSettlementAccountId <= 0) return null;

  const cartTotal = getCartTotal(body);
  const paymentAmount = getPaymentAmount(body);
  const paymentType = body.payment_type === 'prepayment'
    ? 'Передплата 300 грн'
    : body.payment_type === 'installments'
      ? 'Покупка Частинами monobank'
      : 'Повна оплата';
  const balance = Math.max(0, cartTotal - paymentAmount);

  return {
    settlementAccountId: env.sitniksSettlementAccountId,
    amount: paymentAmount,
    description: [
      paymentType,
      `Сума замовлення: ${cartTotal} грн`,
      balance ? `Залишок/накладний платіж: ${balance} грн` : '',
    ].filter(Boolean).join('\n'),
  };
}

function buildDeliveryComment(body: CheckoutPayload): string {
  const shipping = body.shipping || {};
  const isInternational = body.shipping_type === 'international' || shipping.type === 'international';
  const shippingPrice = getShippingPrice(body);

  if (isInternational) {
    return [
      'Тип доставки: закордон',
      'Доставка: за кордон',
      `Країна: ${asString(shipping.country)}`,
      `Місто: ${asString(shipping.intl_city) || asString(shipping.city)}`,
      `Адреса: ${asString(shipping.address)}`,
      `Квартира/кімната: ${asString(shipping.apartment)}`,
      `Індекс: ${asString(shipping.postcode)}`,
      shippingPrice > 0 ? `Вартість доставки: ${shippingPrice} грн` : '',
    ].filter((line) => !line.endsWith(': ') && !line.endsWith(':  грн')).join('\n');
  }

  const deliveryMethod = asString(shipping.delivery_method) || 'branch';
  const methodLabel: Record<string, string> = {
    branch: 'Відділення',
    postomat: 'Поштомат',
    address: 'Адресна доставка',
  };

  return [
    'Тип доставки: Україна',
    `Доставка: Нова Пошта (${methodLabel[deliveryMethod] || deliveryMethod})`,
    `Місто: ${asString(shipping.city)}`,
    `Відділення/поштомат: ${asString(shipping.warehouse)}`,
    `Вулиця: ${asString(shipping.street)}`,
    `Будинок: ${asString(shipping.house)}`,
    `Квартира: ${asString(shipping.apartment)}`,
  ].filter((line) => !line.endsWith(': ')).join('\n');
}

export function buildSitniksNpDelivery(body: CheckoutPayload) {
  const shipping = body.shipping || {};
  const isInternational = body.shipping_type === 'international' || shipping.type === 'international';
  if (isInternational || env.sitniksNovaPoshtaIntegrationId <= 0) return null;

  const deliveryMethod = asString(shipping.delivery_method) || 'branch';
  const serviceType = deliveryMethod === 'address'
    ? 'WarehouseDoors'
    : deliveryMethod === 'postomat'
      ? 'WarehousePostomat'
      : 'WarehouseWarehouse';
  const customer = body.customer || {};

  return {
    integrationNovaposhtaId: env.sitniksNovaPoshtaIntegrationId,
    price: getShippingPrice(body),
    seatsAmount: 1,
    weight: 0.1,
    serviceType,
    payerType: 'Recipient',
    cargoType: 'Parcel',
    paymentMethod: 'Cash',
    city: asString(shipping.city),
    cityRef: asString(shipping.city_ref),
    department: deliveryMethod === 'address' ? '' : asString(shipping.warehouse),
    departmentRef: deliveryMethod === 'address' ? '' : asString(shipping.warehouse_ref),
    street: asString(shipping.street),
    house: asString(shipping.house),
    flat: asString(shipping.apartment),
    recipientFullname: fullName(body),
    recipientPhone: asString(customer.phone),
    description: asString(body.comment) || 'Товари Meylin',
  };
}

function buildUtm(body: CheckoutPayload) {
  const tracking = body.tracking || body.utm || {};
  const utm = {
    source: asString(tracking.utm_source),
    medium: asString(tracking.utm_medium),
    campaign: asString(tracking.utm_campaign),
    content: asString(tracking.utm_content),
    term: asString(tracking.utm_term),
  };

  return Object.fromEntries(Object.entries(utm).filter(([, value]) => value));
}

export function buildSitniksOrderPayload(
  body: CheckoutPayload,
  shopifyOrder: Pick<ShopifyOrder, 'id' | 'name'>,
  options: SitniksOrderPayloadOptions = {},
) {
  const customer = body.customer || {};
  const cartTotal = getCartTotal(body);
  const paymentType = body.payment_type === 'prepayment'
    ? 'Передплата 300 грн'
    : body.payment_type === 'installments'
      ? 'Покупка Частинами monobank'
      : 'Повна оплата';
  const goodsComment = buildGoodsComment(body);
  const deliveryComment = buildDeliveryComment(body);
  const managerComment = [
    `Shopify order: ${shopifyOrder.name || shopifyOrder.id}`,
    `Варіант оплати: ${paymentType}`,
    `Сума товарів: ${cartTotal} грн`,
    goodsComment ? `Товари:\n${goodsComment}` : '',
    deliveryComment,
  ].filter(Boolean).join('\n');

  const payload: Record<string, unknown> = {
    externalId: `shopify-${shopifyOrder.id}`,
    client: {
      fullname: fullName(body),
      phone: asString(customer.phone),
      email: asString(customer.email),
    },
    clientComment: asString(body.comment),
    managerComment,
  };

  const utm = buildUtm(body);
  if (Object.keys(utm).length > 0) payload.utm = utm;
  if (env.sitniksStatusId > 0) payload.statusId = env.sitniksStatusId;
  if (env.sitniksSalesChannelId > 0) payload.salesChannelId = env.sitniksSalesChannelId;
  const payment = buildSitniksPayment(body);
  if (payment) payload.payment = payment;

  if (options.includeNpDelivery !== false) {
    const npDelivery = buildSitniksNpDelivery(body);
    if (npDelivery) payload.npDelivery = npDelivery;
  }

  if (options.includeProducts) {
    const offers = buildSitniksOffers(body, options.offerMap);
    if (offers.length > 0) {
      payload.offers = offers;
    }
  }

  return payload;
}

async function sitniksRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${env.sitniksApiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${env.sitniksApiToken}`,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Sitniks error ${response.status}: ${text}`);
  }

  return parseJsonObject<T>(text, 'Sitniks');
}

export async function sendSitniksOrder(
  body: CheckoutPayload,
  shopifyOrder: Pick<ShopifyOrder, 'id' | 'name'>,
): Promise<SitniksOrderResponse | null> {
  if (!env.sitniksApiToken) {
    console.warn('[Sitniks] API token is not configured; skipping order sync', {
      shopifyOrderId: shopifyOrder.id,
      shopifyOrderName: shopifyOrder.name,
    });
    return null;
  }

  const attempts = [
    { label: 'full payload', includeProducts: true, includeNpDelivery: true },
    { label: 'without products/offers', includeProducts: false, includeNpDelivery: true },
    { label: 'without Nova Poshta delivery', includeProducts: true, includeNpDelivery: false },
    { label: 'minimal payload', includeProducts: false, includeNpDelivery: false },
  ];
  const offerMap = await resolveSitniksOfferMap(body);

  let lastError: unknown;
  for (const attempt of attempts) {
    const payload = buildSitniksOrderPayload(body, shopifyOrder, { ...attempt, offerMap });
    try {
      const data = await sitniksRequest<SitniksOrderResponse>('/open-api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      console.log('[Sitniks] Order sent:', {
        shopifyOrderId: shopifyOrder.id,
        sitniksOrderId: data.id,
        sitniksOrderNumber: data.orderNumber,
        attempt: attempt.label,
      });
      return data;
    } catch (error) {
      lastError = error;
      console.error(`[Sitniks] Order sync failed with ${attempt.label}:`, error);
    }
  }

  throw lastError;
}

export async function sendSitniksPaymentTransaction(
  payment: Payment,
  webhookBody: MonobankWebhookBody,
): Promise<unknown | null> {
  if (!env.sitniksApiToken || !env.sitniksSettlementAccountId || !payment.sitniksOrderId) {
    return null;
  }

  const paidAmount = asNumber(webhookBody.finalAmount || webhookBody.amount) / 100;
  if (!paidAmount) return null;

  const paymentType = payment.paymentType === 'prepayment'
    ? 'Передплата 300 грн'
    : payment.paymentType === 'installments'
      ? 'Покупка Частинами monobank'
      : 'Повна оплата';
  const comment = [
    `Monobank: ${paymentType}`,
    `Shopify order: ${payment.shopifyOrderName || payment.shopifyOrderId || payment.orderId}`,
    `Invoice: ${webhookBody.invoiceId || payment.invoiceId || ''}`,
    `Сплачено онлайн: ${paidAmount} грн`,
    payment.cartTotal ? `Сума замовлення: ${payment.cartTotal} грн` : '',
    payment.cartTotal ? `Залишок: ${Math.max(0, payment.cartTotal - paidAmount)} грн` : '',
  ].filter(Boolean).join('\n');

  const payload = {
    orderId: Number(payment.sitniksOrderId),
    settlementAccountId: env.sitniksSettlementAccountId,
    amount: paidAmount,
    comment,
  };

  const data = await sitniksRequest('/open-api/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  console.log('[Sitniks] Payment transaction sent:', {
    shopifyOrderId: payment.shopifyOrderId?.toString(),
    sitniksOrderId: payment.sitniksOrderId.toString(),
    amount: paidAmount,
  });

  return data;
}

export function buildSitniksReceiptPayload(
  payment: Payment,
  webhookBody: MonobankWebhookBody,
) {
  if (!payment.sitniksOrderId) return null;

  const paidAmount = asNumber(webhookBody.finalAmount || webhookBody.amount) / 100;
  const label = [
    payment.shopifyOrderName || payment.shopifyOrderId?.toString() || payment.orderId || 'Shopify',
    paidAmount ? `${paidAmount} грн` : '',
  ].filter(Boolean).join(' - ').slice(0, 128);

  return {
    orderIds: [Number(payment.sitniksOrderId)],
    paymentType: env.sitniksReceiptPaymentType,
    paymentMethod: 'CASHLESS' as const,
    cashRegisterIntegrationId: env.sitniksCashRegisterId,
    ...(label ? { label } : {}),
  };
}

async function getSitniksOrderReceipts(orderId: number): Promise<SitniksReceiptListResponse> {
  return sitniksRequest<SitniksReceiptListResponse>(
    `/open-api/orders/${orderId}/receipts?limit=50`,
    { method: 'GET' },
  );
}

function hasSitniksReceipts(receipts: SitniksReceiptListResponse): boolean {
  return (receipts.count || 0) > 0 || (receipts.data || []).length > 0;
}

function getWebhookPaidAmount(webhookBody: MonobankWebhookBody): number {
  return asNumber(webhookBody.finalAmount || webhookBody.amount) / 100;
}

export function isSitniksReceiptPaymentConfirmed(
  payment: Pick<Payment, 'amount' | 'paymentType' | 'cartTotal'>,
  webhookBody: MonobankWebhookBody,
): boolean {
  const paidAmount = getWebhookPaidAmount(webhookBody);
  const expectedAmount = asNumber(payment.amount);
  return paidAmount > 0 && expectedAmount > 0 && Math.abs(paidAmount - expectedAmount) < 0.01;
}

export async function createSitniksReceiptAfterPayment(
  payment: Payment,
  webhookBody: MonobankWebhookBody,
): Promise<unknown | null> {
  if (!env.sitniksApiToken || !env.sitniksReceiptsEnabled || !payment.sitniksOrderId) {
    return null;
  }

  if (!env.sitniksCashRegisterId) {
    console.warn('[Sitniks] Cash register id is not configured; skipping receipt creation', {
      paymentId: payment.id,
      shopifyOrderId: payment.shopifyOrderId?.toString(),
      sitniksOrderId: payment.sitniksOrderId.toString(),
    });
    return null;
  }

  if (!isSitniksReceiptPaymentConfirmed(payment, webhookBody)) {
    const paidAmount = getWebhookPaidAmount(webhookBody);
    throw new Error([
      'Sitniks receipt was not created because Monobank paid amount does not match expected invoice amount',
      `paymentId=${payment.id}`,
      `paymentType=${payment.paymentType || 'full'}`,
      `paidAmount=${paidAmount}`,
      `expectedAmount=${payment.amount}`,
      `cartTotal=${payment.cartTotal || 0}`,
    ].join('; '));
  }

  if (payment.createdReceipt) {
    console.log('[Sitniks] Receipt already marked as created; skipping', {
      paymentId: payment.id,
      shopifyOrderId: payment.shopifyOrderId?.toString(),
      sitniksOrderId: payment.sitniksOrderId.toString(),
    });
    return null;
  }

  const orderId = Number(payment.sitniksOrderId);
  const existingReceipts = await getSitniksOrderReceipts(orderId);

  if (hasSitniksReceipts(existingReceipts)) {
    console.log('[Sitniks] Order already has receipt; skipping receipt creation', {
      paymentId: payment.id,
      shopifyOrderId: payment.shopifyOrderId?.toString(),
      sitniksOrderId: payment.sitniksOrderId.toString(),
      receiptCount: existingReceipts.count,
    });
    return { existing: true, receipts: existingReceipts };
  }

  const payload = buildSitniksReceiptPayload(payment, webhookBody);
  if (!payload) return null;

  const data = await sitniksRequest('/open-api/orders/receipts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  console.log('[Sitniks] Receipt creation request accepted:', {
    paymentId: payment.id,
    shopifyOrderId: payment.shopifyOrderId?.toString(),
    sitniksOrderId: payment.sitniksOrderId.toString(),
    cashRegisterIntegrationId: env.sitniksCashRegisterId,
    paymentType: env.sitniksReceiptPaymentType,
    response: data,
  });

  let latestReceipts: SitniksReceiptListResponse = { data: [], count: 0 };
  for (let attempt = 1; attempt <= env.sitniksReceiptVerifyAttempts; attempt += 1) {
    await delay(env.sitniksReceiptVerifyDelayMs);

    latestReceipts = await getSitniksOrderReceipts(orderId);

    console.log('[Sitniks] Receipt verification attempt:', {
      paymentId: payment.id,
      shopifyOrderId: payment.shopifyOrderId?.toString(),
      sitniksOrderId: payment.sitniksOrderId.toString(),
      attempt,
      attempts: env.sitniksReceiptVerifyAttempts,
      receiptCount: latestReceipts.count,
    });

    if (hasSitniksReceipts(latestReceipts)) {
      console.log('[Sitniks] Receipt created and verified:', {
        paymentId: payment.id,
        shopifyOrderId: payment.shopifyOrderId?.toString(),
        sitniksOrderId: payment.sitniksOrderId.toString(),
        receiptCount: latestReceipts.count,
      });

      return { created: true, response: data, receipts: latestReceipts };
    }
  }

  console.error('[Sitniks] Receipt request was accepted, but no receipt is visible for order:', {
    paymentId: payment.id,
    shopifyOrderId: payment.shopifyOrderId?.toString(),
    sitniksOrderId: payment.sitniksOrderId.toString(),
    cashRegisterIntegrationId: env.sitniksCashRegisterId,
    paymentType: env.sitniksReceiptPaymentType,
    response: data,
    receipts: latestReceipts,
  });

  throw new Error([
    'Sitniks receipt request was accepted, but no receipt is visible for order',
    `paymentId=${payment.id}`,
    `shopifyOrderId=${payment.shopifyOrderId?.toString() || ''}`,
    `sitniksOrderId=${payment.sitniksOrderId.toString()}`,
    `cashRegisterIntegrationId=${env.sitniksCashRegisterId}`,
    `paymentType=${env.sitniksReceiptPaymentType}`,
    `receiptCount=${latestReceipts.count || 0}`,
  ].join('; '));
}

export function getSitniksPaidStatusId(paymentType: Payment['paymentType']): number {
  if (paymentType === 'prepayment') {
    return env.sitniksPrepaymentPaidStatusId || env.sitniksPaidStatusId;
  }
  if (paymentType === 'installments') {
    return env.sitniksPartsPaidStatusId || env.sitniksPaidStatusId;
  }

  return env.sitniksPaidStatusId;
}

export function buildSitniksPaymentStatusComment(
  payment: Pick<Payment, 'paymentType' | 'shopifyOrderName' | 'shopifyOrderId' | 'orderId' | 'invoiceId' | 'cartTotal'>,
  webhookBody: MonobankWebhookBody,
): string {
  const paidAmount = asNumber(webhookBody.finalAmount || webhookBody.amount) / 100;
  const paymentType = payment.paymentType === 'prepayment'
    ? 'Передплата 300 грн'
    : payment.paymentType === 'installments'
      ? 'Покупка Частинами monobank'
      : 'Повна оплата';
  const balance = payment.cartTotal ? Math.max(0, payment.cartTotal - paidAmount) : 0;

  return [
    `Оплату Monobank підтверджено: ${paymentType}`,
    `Shopify order: ${payment.shopifyOrderName || payment.shopifyOrderId || payment.orderId}`,
    `Invoice: ${webhookBody.invoiceId || payment.invoiceId || ''}`,
    `Сплачено онлайн: ${paidAmount} грн`,
    payment.cartTotal ? `Сума замовлення: ${payment.cartTotal} грн` : '',
    payment.cartTotal ? `Залишок: ${balance} грн` : '',
  ].filter(Boolean).join('\n');
}

export async function updateSitniksPaymentStatus(
  payment: Payment,
  webhookBody: MonobankWebhookBody,
): Promise<unknown | null> {
  if (!env.sitniksApiToken || !payment.sitniksOrderId) {
    return null;
  }

  const statusId = getSitniksPaidStatusId(payment.paymentType);
  console.log('[Sitniks] Payment status selected:', {
    paymentId: payment.id,
    paymentType: payment.paymentType,
    statusId,
  });

  if (!statusId) {
    console.warn('[Sitniks] Paid status id is not configured; skipping status update', {
      paymentId: payment.id,
      shopifyOrderId: payment.shopifyOrderId?.toString(),
      sitniksOrderId: payment.sitniksOrderId.toString(),
      paymentType: payment.paymentType,
    });
    return null;
  }

  const orderId = Number(payment.sitniksOrderId);
  const data = await sitniksRequest(`/open-api/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ statusId }),
  });

  console.log('[Sitniks] Payment status updated:', {
    paymentId: payment.id,
    shopifyOrderId: payment.shopifyOrderId?.toString(),
    sitniksOrderId: payment.sitniksOrderId.toString(),
    statusId,
    comment: buildSitniksPaymentStatusComment(payment, webhookBody),
  });

  return data;
}
