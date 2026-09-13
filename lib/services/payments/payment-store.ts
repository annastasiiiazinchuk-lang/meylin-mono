import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import type { CheckoutPayload, PaymentType, StoredPaymentMetadata } from '../../types/checkout';
import { asNumber, asString } from '../../utils/format';

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toJsonArray(value: unknown[]): Prisma.InputJsonValue[] {
  return value
    .map((item) => toJson(item))
    .filter((item): item is Prisma.InputJsonValue => item !== undefined);
}

export async function savePendingPayment(params: {
  invoiceId: string;
  invoiceUrl: string;
  reference: string;
  amount: number;
  paymentType: PaymentType;
  shopifyOrderId?: number;
  shopifyOrderName?: string;
  body: CheckoutPayload;
  cartTotal: number;
}) {
  const customer = params.body.customer || {};
  const customerName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
  const tracking = params.body.tracking || params.body.utm || {};

  return prisma.payment.upsert({
    where: { reference: params.reference },
    create: {
      amount: params.amount,
      customerName,
      customerPhone: customer.phone || '',
      customerEmail: customer.email || '',
      orderId: params.shopifyOrderId ? String(params.shopifyOrderId) : params.reference,
      reference: params.reference,
      invoiceId: params.invoiceId,
      pageUrl: params.invoiceUrl,
      destination: params.shopifyOrderId
        ? `Order ${params.shopifyOrderName || params.shopifyOrderId}`
        : `Checkout ${params.reference}`,
      goods: toJsonArray(params.body.goods || []),
      shipping: toJson(params.body.shipping),
      utm: toJson(params.body.utm),
      tracking: toJson(tracking),
      comment: params.body.comment || undefined,
      shopifyOrderId: params.shopifyOrderId ? BigInt(params.shopifyOrderId) : undefined,
      shopifyOrderName: params.shopifyOrderName,
      paymentType: params.paymentType,
      cartTotal: params.cartTotal,
      shopifyOrderData: toJson({
        checkoutPayload: params.body,
        customer,
        tracking,
        locale: params.body.locale,
        personalDataConsent: params.body.personal_data_consent,
      }),
    },
    update: {
      amount: params.amount,
      invoiceId: params.invoiceId,
      pageUrl: params.invoiceUrl,
      shopifyOrderId: params.shopifyOrderId ? BigInt(params.shopifyOrderId) : undefined,
      shopifyOrderName: params.shopifyOrderName,
      paymentType: params.paymentType,
      cartTotal: params.cartTotal,
      tracking: toJson(tracking),
    },
  });
}

export async function markShopifyOrderCreated(params: {
  paymentId: string;
  shopifyOrderId: number;
  shopifyOrderName?: string;
}) {
  return prisma.payment.update({
    where: { id: params.paymentId },
    data: {
      orderId: String(params.shopifyOrderId),
      shopifyOrderId: BigInt(params.shopifyOrderId),
      shopifyOrderName: params.shopifyOrderName,
    },
  });
}

export async function getPaymentByInvoiceId(invoiceId: string) {
  return prisma.payment.findFirst({ where: { invoiceId } });
}

export async function getPaymentByReference(reference: string) {
  return prisma.payment.findUnique({ where: { reference } });
}

export async function markPaymentProcessing(id: string, webhookPayload: unknown) {
  return prisma.payment.update({
    where: { id },
    data: {
      status: 'PROCESSING',
      webhookPayload: toJson(webhookPayload),
    },
  });
}

export async function markPaymentFailed(id: string, webhookPayload: unknown) {
  return prisma.payment.update({
    where: { id },
    data: {
      status: 'FAILED',
      webhookPayload: toJson(webhookPayload),
    },
  });
}

export async function markSitniksOrderSynced(params: {
  paymentId: string;
  sitniksOrderId?: number;
  sitniksOrderNumber?: number | string;
}) {
  return prisma.payment.update({
    where: { id: params.paymentId },
    data: {
      sitniksOrderId: params.sitniksOrderId ? BigInt(params.sitniksOrderId) : undefined,
      sitniksOrderNumber: params.sitniksOrderNumber ? String(params.sitniksOrderNumber) : undefined,
      sitniksSyncStatus: 'ORDER_SENT',
      sitniksSyncError: null,
      sitniksSyncedAt: new Date(),
    },
  });
}

export async function markSitniksOrderSyncFailed(paymentId: string, error: unknown) {
  return prisma.payment.update({
    where: { id: paymentId },
    data: {
      sitniksSyncStatus: 'ORDER_FAILED',
      sitniksSyncError: error instanceof Error ? error.message : String(error),
      sitniksSyncedAt: new Date(),
    },
  });
}

export async function markSitniksPaymentSynced(paymentId: string) {
  return prisma.payment.update({
    where: { id: paymentId },
    data: {
      sitniksSyncStatus: 'PAYMENT_SENT',
      sitniksSyncError: null,
      sitniksSyncedAt: new Date(),
    },
  });
}

export async function markSitniksPaymentSyncFailed(paymentId: string, error: unknown) {
  return prisma.payment.update({
    where: { id: paymentId },
    data: {
      sitniksSyncStatus: 'PAYMENT_FAILED',
      sitniksSyncError: error instanceof Error ? error.message : String(error),
      sitniksSyncedAt: new Date(),
    },
  });
}

export async function markPaymentReceiptCreated(paymentId: string) {
  return prisma.payment.update({
    where: { id: paymentId },
    data: {
      createdReceipt: true,
    },
  });
}

export async function markPaymentSuccess(id: string, webhookPayload: unknown) {
  return prisma.payment.update({
    where: { id },
    data: {
      status: 'SUCCESS',
      webhookPayload: toJson(webhookPayload),
    },
  });
}

function paymentKind(paymentType: unknown): PaymentType {
  if (paymentType === 'prepayment') return 'prepayment';
  if (paymentType === 'installments') return 'installments';
  return 'full';
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function paymentToCheckoutPayload(payment: Awaited<ReturnType<typeof getPaymentByInvoiceId>>): CheckoutPayload | null {
  if (!payment) return null;

  const orderData = readRecord(payment.shopifyOrderData);
  const storedPayload = readRecord(orderData.checkoutPayload);
  const customer = readRecord(storedPayload.customer || orderData.customer);
  const shipping = readRecord(storedPayload.shipping || payment.shipping);
  const shippingType = asString(storedPayload.shipping_type || shipping.type);
  const tracking = readRecord(payment.tracking || orderData.tracking || payment.utm);

  return {
    ...(storedPayload as Partial<CheckoutPayload>),
    locale: asString(storedPayload.locale || orderData.locale),
    payment_type: paymentKind(payment.paymentType),
    amount: asNumber(payment.amount),
    cart_total: asNumber(payment.cartTotal) || asNumber(payment.amount),
    cart_token: asString(storedPayload.cart_token),
    customer: {
      first_name: asString(customer.first_name) || payment.customerName.split(' ')[0] || '',
      last_name: asString(customer.last_name) || payment.customerName.split(' ').slice(1).join(' '),
      phone: asString(customer.phone) || payment.customerPhone,
      email: asString(customer.email) || payment.customerEmail,
    },
    shipping_type: shippingType === 'international' ? 'international' : 'ukraine',
    shipping: shipping as CheckoutPayload['shipping'],
    goods: Array.isArray(payment.goods) ? payment.goods as CheckoutPayload['goods'] : [],
    comment: payment.comment || asString(storedPayload.comment),
    personal_data_consent: Boolean(storedPayload.personal_data_consent || orderData.personalDataConsent),
    tracking,
    utm: readRecord(payment.utm),
  };
}

export function paymentToMetadata(payment: Awaited<ReturnType<typeof getPaymentByInvoiceId>>): StoredPaymentMetadata | null {
  if (!payment?.shopifyOrderId) return null;
  const paymentType = paymentKind(payment.paymentType);

  return {
    shopifyOrderId: Number(payment.shopifyOrderId),
    shopifyOrderName: payment.shopifyOrderName || undefined,
    reference: payment.reference,
    amount: payment.amount,
    paymentType,
    customer: {
      first_name: payment.customerName.split(' ')[0] || '',
      last_name: payment.customerName.split(' ').slice(1).join(' '),
      phone: payment.customerPhone,
      email: payment.customerEmail,
    },
    tracking: (payment.tracking || payment.utm || {}) as Record<string, unknown>,
    cartTotal: payment.cartTotal || payment.amount,
    goods: payment.goods as CheckoutPayload['goods'],
  };
}
