import type { StoredPaymentMetadata } from '../../types/checkout';
import type { MonobankWebhookBody } from '../../types/monobank';
import { sendGa4PurchaseEvent } from './google-analytics';
import { sendMetaPurchaseEvent } from './meta';

export async function sendServerSidePurchaseEvents(
  payment: StoredPaymentMetadata,
  body: MonobankWebhookBody,
): Promise<void> {
  await sendMetaPurchaseEvent(payment, body).catch((error) => {
    console.error('Failed to send Meta Purchase:', error);
  });

  await sendGa4PurchaseEvent(payment, body).catch((error) => {
    console.error('Failed to send Google GA4 Purchase:', error);
  });
}
