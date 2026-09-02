import { env } from '../../config/env';
import type { CheckoutPayload, PaymentType } from '../../types/checkout';
import { asString, parseJsonObject } from '../../utils/format';

const MONOBANK_API_URL = 'https://api.monobank.ua/api/merchant/invoice/create';

export interface MonobankInvoice {
  invoiceUrl: string;
  invoiceId: string;
  reference: string;
  amount: number;
  paymentType: PaymentType;
}

export async function createMonobankInvoice(
  body: CheckoutPayload,
  shopifyOrder: { id: number; name: string },
  amount: number,
): Promise<MonobankInvoice> {
  if (!env.monoToken) throw new Error('Missing MONO_TOKEN');
  if (!env.webhookUrl) throw new Error('Missing WEBHOOK_URL');
  if (amount <= 0) throw new Error('Amount must be greater than 0');

  const customer = body.customer || {};
  const customerName = `${asString(customer.first_name)} ${asString(customer.last_name)}`.trim() || 'Customer';
  const customerPhone = asString(customer.phone);
  const reference = `shopify-${shopifyOrder.id}-${Date.now()}`;
  const requestBody = {
    amount: Math.round(amount * 100),
    ccy: 980,
    merchantPaymInfo: {
      reference,
      destination: `Order ${shopifyOrder.name}: ${customerName}${customerPhone ? ` (${customerPhone})` : ''}`,
    },
    redirectUrl: env.redirectUrl,
    webHookUrl: env.webhookUrl,
  };

  console.log('Creating monobank invoice:', {
    amount: requestBody.amount,
    paymentType: body.payment_type || 'full',
    redirectUrl: requestBody.redirectUrl,
    webHookUrl: requestBody.webHookUrl,
  });

  const response = await fetch(MONOBANK_API_URL, {
    method: 'POST',
    headers: {
      'X-Token': env.monoToken,
      'Content-Type': 'application/json',
      Accept: '*/*',
    },
    body: JSON.stringify(requestBody),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Monobank error ${response.status}: ${text}`);

  const data = parseJsonObject<{ pageUrl?: string; invoiceId?: string }>(text, 'Monobank');
  if (!data.pageUrl) throw new Error('Monobank response missing pageUrl');
  if (!data.invoiceId) throw new Error('Monobank response missing invoiceId');

  return {
    invoiceUrl: data.pageUrl,
    invoiceId: data.invoiceId,
    reference,
    amount,
    paymentType: body.payment_type === 'prepayment' ? 'prepayment' : 'full',
  };
}
