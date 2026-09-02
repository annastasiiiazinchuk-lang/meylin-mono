import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import type { CheckoutPayload, PaymentType, StoredPaymentMetadata } from '../../types/checkout';

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
  shopifyOrderId: number;
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
      orderId: String(params.shopifyOrderId),
      reference: params.reference,
      invoiceId: params.invoiceId,
      pageUrl: params.invoiceUrl,
      destination: `Order ${params.shopifyOrderName || params.shopifyOrderId}`,
      goods: toJsonArray(params.body.goods || []),
      shipping: toJson(params.body.shipping),
      utm: toJson(params.body.utm),
      tracking: toJson(tracking),
      comment: params.body.comment || undefined,
      shopifyOrderId: BigInt(params.shopifyOrderId),
      shopifyOrderName: params.shopifyOrderName,
      paymentType: params.paymentType,
      cartTotal: params.cartTotal,
      shopifyOrderData: toJson({
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
      shopifyOrderId: BigInt(params.shopifyOrderId),
      shopifyOrderName: params.shopifyOrderName,
      paymentType: params.paymentType,
      cartTotal: params.cartTotal,
      tracking: toJson(tracking),
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

export function paymentToMetadata(payment: Awaited<ReturnType<typeof getPaymentByInvoiceId>>): StoredPaymentMetadata | null {
  if (!payment?.shopifyOrderId) return null;
  const paymentType: PaymentType = payment.paymentType === 'prepayment'
    ? 'prepayment'
    : payment.paymentType === 'installments'
      ? 'installments'
      : 'full';

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
