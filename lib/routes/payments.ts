import { json } from '../http/responses';
import {
  getPaymentByInvoiceId,
  getPaymentByReference,
} from '../services/payments/payment-store';
import { asNumber, asString } from '../utils/format';

function toTrackingItem(item: unknown, index: number) {
  const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  const itemId = asString(record.code) || asString(record.variant_id) || String(index + 1);
  const itemName = asString(record.name) || asString(record.title) || itemId;

  return {
    item_id: itemId,
    item_name: itemName,
    price: asNumber(record.price),
    quantity: asNumber(record.quantity) || 1,
  };
}

function getTrackingSubset(tracking: unknown) {
  const record = tracking && typeof tracking === 'object' ? tracking as Record<string, unknown> : {};
  const keys = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gclid',
    'gbraid',
    'wbraid',
  ];

  return Object.fromEntries(
    keys
      .map((key) => [key, asString(record[key])] as const)
      .filter(([, value]) => Boolean(value)),
  );
}

export async function handlePaymentStatus(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const invoiceId = url.searchParams.get('invoiceId')?.trim() || '';
  const reference = url.searchParams.get('reference')?.trim() || '';

  if (!invoiceId && !reference) {
    return json({ error: 'Missing invoiceId or reference' }, 400);
  }

  const payment = invoiceId
    ? await getPaymentByInvoiceId(invoiceId)
    : await getPaymentByReference(reference);

  if (!payment) {
    return json({ status: 'NOT_FOUND' }, 404);
  }

  const transactionId = payment.invoiceId || payment.reference;
  const value = asNumber(payment.cartTotal) || asNumber(payment.amount);

  return json({
    status: payment.status,
    invoiceId: payment.invoiceId || '',
    reference: payment.reference,
    transactionId,
    eventId: transactionId ? `mono_${transactionId}` : '',
    orderId: payment.shopifyOrderId ? String(payment.shopifyOrderId) : payment.orderId || '',
    orderName: payment.shopifyOrderName || '',
    currency: payment.currency || 'UAH',
    value,
    amount: asNumber(payment.amount),
    cartTotal: asNumber(payment.cartTotal),
    paymentType: payment.paymentType || '',
    items: (payment.goods || []).map(toTrackingItem),
    tracking: getTrackingSubset(payment.tracking || payment.utm),
  });
}
