import { PREPAYMENT_AMOUNT, env } from '../../config/env';
import { json } from '../../http/responses';
import type { MonobankWebhookBody } from '../../types/monobank';
import { asNumber } from '../../utils/format';
import {
  getPaymentByInvoiceId,
  markPaymentFailed,
  markPaymentSuccess,
  markPaymentReceiptCreated,
  markSitniksPaymentSynced,
  markSitniksPaymentSyncFailed,
  paymentToMetadata,
} from '../payments/payment-store';
import { getOrderIdFromMonobankReference, updateShopifyOrderAfterPayment } from '../shopify/shopify-order';
import {
  createSitniksReceiptAfterPayment,
  sendSitniksPaymentTransaction,
  updateSitniksPaymentStatus,
} from '../sitniks/sitniks-order';
import { sendGa4PurchaseEvent } from '../tracking/google-analytics';
import { sendMetaPurchaseEvent } from '../tracking/meta';

function getPaidAmount(body: MonobankWebhookBody): number {
  return asNumber(body.finalAmount || body.amount) / 100;
}

export function isMonobankWebhookAmountConfirmed(expectedAmount: number, body: MonobankWebhookBody): boolean {
  const paidAmount = getPaidAmount(body);
  return paidAmount > 0 && expectedAmount > 0 && Math.abs(paidAmount - expectedAmount) < 0.01;
}

export async function syncShopifyAfterMonobankSuccess(
  payment: Awaited<ReturnType<typeof paymentToMetadata>>,
  body: MonobankWebhookBody,
) {
  if (!payment?.shopifyOrderId) return;

  await updateShopifyOrderAfterPayment(
    payment.shopifyOrderId,
    payment.amount,
    body.invoiceId,
    payment.paymentType,
  );
}

export async function syncSitniksAfterMonobankSuccess(
  updatedPayment: Awaited<ReturnType<typeof markPaymentSuccess>> | undefined,
  body: MonobankWebhookBody,
) {
  if (!updatedPayment) return;

  const errors: unknown[] = [];
  let didSync = false;

  try {
    const statusUpdate = await updateSitniksPaymentStatus(updatedPayment, body);
    didSync = didSync || Boolean(statusUpdate);
  } catch (error) {
    errors.push(error);
    console.error('[Sitniks] Failed to update payment status after Monobank success:', error);
  }

  try {
    const transaction = await sendSitniksPaymentTransaction(updatedPayment, body);
    didSync = didSync || Boolean(transaction);
  } catch (error) {
    errors.push(error);
    console.error('[Sitniks] Failed to send payment transaction after Monobank success:', error);
  }

  try {
    const receipt = await createSitniksReceiptAfterPayment(updatedPayment, body);
    if (receipt) {
      didSync = true;
      await markPaymentReceiptCreated(updatedPayment.id);
    }
  } catch (error) {
    errors.push(error);
    console.error('[Sitniks] Failed to create receipt after Monobank success:', error);
  }

  if (didSync) {
    await markSitniksPaymentSynced(updatedPayment.id);
  }

  if (errors.length > 0) {
    const errorMessage = errors
      .map((error) => (error instanceof Error ? error.message : String(error)))
      .join('\n');
    await markSitniksPaymentSyncFailed(updatedPayment.id, errorMessage).catch((syncError) => {
      console.error('[Sitniks] Failed to save payment sync error:', syncError);
    });
  }
}

export async function processMonobankWebhook(body: MonobankWebhookBody): Promise<Response> {
  console.log('Monobank webhook:', body);

  if (body.status !== 'success' || !body.invoiceId) {
    return json({ ok: true });
  }

  const storedPayment = await getPaymentByInvoiceId(body.invoiceId);
  const fallbackPayment = {
    shopifyOrderId: getOrderIdFromMonobankReference(body.reference),
    amount: getPaidAmount(body),
    paymentType: asNumber(body.finalAmount || body.amount) === PREPAYMENT_AMOUNT * 100 ? 'prepayment' as const : 'full' as const,
    customer: {},
    tracking: {},
    cartTotal: getPaidAmount(body),
    reference: body.reference || '',
  };
  const payment = paymentToMetadata(storedPayment) || fallbackPayment;

  if (!payment.shopifyOrderId) {
    console.error('Shopify order id not found for invoice:', body.invoiceId);
    return json({ error: 'Shopify order id not found' }, 404);
  }

  try {
    console.log('Payment mapping resolved:', {
      invoiceId: body.invoiceId,
      shopifyOrderId: payment.shopifyOrderId,
      paymentType: payment.paymentType,
      amount: payment.amount,
    });

    if (storedPayment && !isMonobankWebhookAmountConfirmed(storedPayment.amount, body)) {
      const paidAmount = getPaidAmount(body);
      console.error('Monobank success amount mismatch; payment sync skipped:', {
        invoiceId: body.invoiceId,
        shopifyOrderId: payment.shopifyOrderId,
        paymentType: payment.paymentType,
        expectedAmount: storedPayment.amount,
        paidAmount,
      });
      await markPaymentFailed(storedPayment.id, {
        source: 'monobank_amount_mismatch',
        expectedAmount: storedPayment.amount,
        paidAmount,
        webhookPayload: body,
      });
      return json({
        ok: true,
        skipped: 'amount_mismatch',
      });
    }

    let updatedPayment: Awaited<ReturnType<typeof markPaymentSuccess>> | undefined;
    if (storedPayment) {
      updatedPayment = await markPaymentSuccess(storedPayment.id, body);
    }

    await syncSitniksAfterMonobankSuccess(updatedPayment, body);

    if (env.shopifyPaymentUpdateDelaySeconds > 0) {
      const delayMs = env.shopifyPaymentUpdateDelaySeconds * 1000;
      console.log('Delaying Shopify payment update:', {
        invoiceId: body.invoiceId,
        shopifyOrderId: payment.shopifyOrderId,
        delaySeconds: env.shopifyPaymentUpdateDelaySeconds,
      });
      setTimeout(() => {
        syncShopifyAfterMonobankSuccess(payment, body).catch((error) => {
          console.error('Delayed Monobank success sync failed:', error);
        });
      }, delayMs);
    } else {
      await syncShopifyAfterMonobankSuccess(payment, body);
    }

    await sendMetaPurchaseEvent(payment, body).catch((error) => {
      console.error('Failed to send Meta Purchase:', error);
    });

    await sendGa4PurchaseEvent(payment, body).catch((error) => {
      console.error('Failed to send Google GA4 Purchase:', error);
    });

    return json({ ok: true });
  } catch (error) {
    console.error('Failed to process successful Monobank payment:', error);
    return json({
      error: 'Failed to process successful Monobank payment',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}
