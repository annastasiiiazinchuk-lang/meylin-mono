import { processMonobankWebhook } from '../services/monobank/monobank-webhook';
import {
  syncShopifyAfterMonobankSuccess,
  syncSitniksAfterMonobankSuccess,
} from '../services/monobank/monobank-webhook';
import {
  getMonobankPartsCallbackOrderId,
  getMonobankPartsCallbackReference,
  isMonobankPartsApproved,
  isMonobankPartsCompleted,
  isMonobankPartsFailed,
  verifyMonobankPartsSignature,
  type MonobankPartsCallbackBody,
} from '../services/monobank/monobank-parts';
import type { MonobankWebhookBody } from '../types/monobank';
import { json } from '../http/responses';
import {
  getPaymentByInvoiceId,
  getPaymentByReference,
  markPaymentFailed,
  markPaymentProcessing,
  markPaymentSuccess,
  paymentToMetadata,
} from '../services/payments/payment-store';
import type { Payment } from '@prisma/client';

export async function handleMonobankWebhook(request: Request): Promise<Response> {
  let body: MonobankWebhookBody;
  try {
    body = await request.json() as MonobankWebhookBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    return await processMonobankWebhook(body);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Webhooks] Error processing Monobank webhook:', errMsg);
    return json({ error: 'Internal server error' }, 500);
  }
}

function buildPartsPaymentWebhookBody(payment: Payment, body: MonobankPartsCallbackBody): MonobankWebhookBody {
  const amount = Math.round((payment.amount || payment.cartTotal || 0) * 100);
  return {
    invoiceId: getMonobankPartsCallbackOrderId(body) || payment.invoiceId || '',
    status: 'success',
    amount,
    finalAmount: amount,
    reference: payment.reference,
    paymentInfo: {
      source: 'monobank_parts',
      partsCallback: body,
    },
  };
}

export async function handleMonobankPartsWebhook(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get('signature');

  if (!verifyMonobankPartsSignature(rawBody, signature)) {
    console.error('[Monobank parts] Invalid callback signature');
    return json({ error: 'Invalid signature' }, 401);
  }

  let body: MonobankPartsCallbackBody;
  try {
    body = JSON.parse(rawBody) as MonobankPartsCallbackBody;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const orderId = getMonobankPartsCallbackOrderId(body);
  const reference = getMonobankPartsCallbackReference(body);
  const payment = orderId
    ? await getPaymentByInvoiceId(orderId)
    : reference
      ? await getPaymentByReference(reference)
      : null;

  if (!payment) {
    console.error('[Monobank parts] Payment mapping not found:', { orderId, reference, body });
    return json({ error: 'Payment mapping not found' }, 404);
  }

  if (isMonobankPartsFailed(body)) {
    await markPaymentFailed(payment.id, body);
    console.log('[Monobank parts] Payment failed:', { paymentId: payment.id, orderId, reference, body });
    return json({ ok: true });
  }

  if (isMonobankPartsCompleted(body)) {
    const webhookBody = buildPartsPaymentWebhookBody(payment, body);
    const updatedPayment = await markPaymentSuccess(payment.id, webhookBody);

    await syncSitniksAfterMonobankSuccess(updatedPayment, webhookBody);

    const metadata = paymentToMetadata(updatedPayment);
    await syncShopifyAfterMonobankSuccess(metadata, webhookBody);

    console.log('[Monobank parts] Completed and synced:', {
      paymentId: payment.id,
      shopifyOrderId: payment.shopifyOrderId?.toString(),
      sitniksOrderId: payment.sitniksOrderId?.toString(),
      orderId,
      reference,
    });

    return json({ ok: true });
  }

  if (!isMonobankPartsApproved(body)) {
    await markPaymentProcessing(payment.id, body);
    console.log('[Monobank parts] Intermediate callback stored:', { paymentId: payment.id, orderId, reference, body });
    return json({ ok: true });
  }

  await markPaymentProcessing(payment.id, body);
  console.log('[Monobank parts] Approved; waiting for manual store decision:', {
    paymentId: payment.id,
    orderId,
    reference,
    state: body.state,
    orderSubState: body.order_sub_state || body.orderSubState,
  });
  return json({ ok: true, status: 'waiting_for_store_decision' });
}
