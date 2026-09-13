import { env } from '../config/env';
import { json } from '../http/responses';
import { createMonobankInvoice } from '../services/monobank/monobank-invoice';
import {
  createMonobankPartsOrder,
  getMonobankPartsCounts,
  isMonobankPartsReady,
} from '../services/monobank/monobank-parts';
import {
  markSitniksOrderSynced,
  markSitniksOrderSyncFailed,
  savePendingPayment,
} from '../services/payments/payment-store';
import {
  createShopifyOrder,
  getCartTotal,
  getPaymentAmount,
} from '../services/shopify/shopify-order';
import { sendSitniksOrder } from '../services/sitniks/sitniks-order';
import { checkoutPayloadSchema } from '../types/checkout';

export async function handleCreateInvoice(request: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = checkoutPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    const isEmailError = parsed.error.issues.some((issue) => issue.path.join('.') === 'customer.email');

    return json({
      error: 'Invalid checkout payload',
      message: isEmailError ? 'Введіть, будь ласка, e-mail' : 'Перевірте дані форми',
      details: parsed.error.flatten(),
    }, 400);
  }

  const body = parsed.data;
  const requestUserAgent = request.headers.get('user-agent') || '';
  const requestPageUrl = request.headers.get('referer') || request.headers.get('origin') || '';
  const requestIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';
  body.tracking = {
    ...(body.tracking || body.utm || {}),
    user_agent: String((body.tracking || body.utm || {}).user_agent || requestUserAgent).trim(),
    page_url: String((body.tracking || body.utm || {}).page_url || requestPageUrl).trim(),
    client_ip_address: String((body.tracking || body.utm || {}).client_ip_address || requestIp).trim(),
  };

  try {
    const amount = getPaymentAmount(body);
    const isInstallments = body.payment_type === 'installments';
    const shopifyOrder = isInstallments ? await createShopifyOrder(body, amount) : null;
    const invoice = isInstallments
      ? await (async () => {
          const partsOrder = await createMonobankPartsOrder(body, shopifyOrder!, amount);
          return {
            invoiceId: partsOrder.orderId,
            invoiceUrl: '',
            reference: partsOrder.reference,
            amount: partsOrder.amount,
            paymentType: 'installments' as const,
            orderId: partsOrder.orderId,
            raw: partsOrder.raw,
          };
        })()
      : await createMonobankInvoice(body, null, amount);
    const cartTotal = getCartTotal(body);

    const savedPayment = await savePendingPayment({
      invoiceId: invoice.invoiceId,
      invoiceUrl: invoice.invoiceUrl,
      reference: invoice.reference,
      amount: invoice.amount,
      paymentType: invoice.paymentType,
      shopifyOrderId: shopifyOrder?.id,
      shopifyOrderName: shopifyOrder?.name,
      body,
      cartTotal,
    });

    if (shopifyOrder) {
      void (async () => {
        try {
          const sitniksOrder = await sendSitniksOrder(body, shopifyOrder);
          if (sitniksOrder?.id) {
            await markSitniksOrderSynced({
              paymentId: savedPayment.id,
              sitniksOrderId: sitniksOrder.id,
              sitniksOrderNumber: sitniksOrder.orderNumber,
            });
          }
        } catch (error) {
          console.error('[Sitniks] Failed to send order:', error);
          await markSitniksOrderSyncFailed(savedPayment.id, error).catch((syncError) => {
            console.error('[Sitniks] Failed to save sync error:', syncError);
          });
        }
      })();
    }

    return json({
      ...invoice,
      paymentFlow: isInstallments ? 'monobank_parts' : 'monobank_invoice',
      message: isInstallments ? 'Запит на Покупку Частинами надіслано у застосунок monobank.' : undefined,
      redirectUrl: isInstallments ? env.redirectUrl : undefined,
      shopifyOrderId: shopifyOrder?.id,
      shopifyOrderName: shopifyOrder?.name,
    });
  } catch (error) {
    console.error('[Orders] Error creating invoice:', error);
    return json({
      error: 'Failed to create invoice',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function handlePaymentOptions(): Promise<Response> {
  return json({
    monobankParts: {
      enabled: isMonobankPartsReady(),
      partsCounts: getMonobankPartsCounts(),
    },
  });
}
