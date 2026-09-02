import { env } from '../config/env';
import { json } from '../http/responses';
import { rejectMonobankPartsOrder } from '../services/monobank/monobank-parts';
import {
  getPaymentByInvoiceId,
  markPaymentFailed,
} from '../services/payments/payment-store';
import { asString } from '../utils/format';

function getAdminToken(request: Request): string {
  const authorization = request.headers.get('authorization') || '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return request.headers.get('x-admin-token') || '';
}

function isAuthorized(request: Request): boolean {
  return Boolean(env.monoPartsAdminToken && getAdminToken(request) === env.monoPartsAdminToken);
}

export async function handleMonobankPartsReject(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const orderId = asString(body.orderId) || asString(body.order_id);
  if (!orderId) {
    return json({ error: 'Missing orderId' }, 400);
  }

  const result = await rejectMonobankPartsOrder(orderId);
  const payment = await getPaymentByInvoiceId(orderId);
  if (payment) {
    await markPaymentFailed(payment.id, {
      source: 'manual_monobank_parts_reject',
      order_id: orderId,
      result,
    });
  }

  console.log('[Monobank parts] Order rejected manually:', {
    orderId,
    paymentId: payment?.id,
  });

  return json({
    ok: true,
    orderId,
    paymentUpdated: Boolean(payment),
    result,
  });
}
