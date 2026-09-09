import { describe, expect, test } from 'bun:test';
import { buildMetaPurchasePayload, normalizeMetaPhone } from '../../lib/services/tracking/meta';
import { sha256 } from '../../lib/utils/format';
import type { StoredPaymentMetadata } from '../../lib/types/checkout';
import type { MonobankWebhookBody } from '../../lib/types/monobank';

describe('Meta Conversions API purchase payload', () => {
  test('normalizes phone before hashing', () => {
    expect(normalizeMetaPhone('+380 68 234 57 29')).toBe('380682345729');
    expect(normalizeMetaPhone('0682345729')).toBe('380682345729');
  });

  test('builds website purchase event with hashed user data and ecommerce data', () => {
    const payment: StoredPaymentMetadata = {
      shopifyOrderId: 7243745919168,
      shopifyOrderName: '#1486',
      reference: 'shopify-7243745919168-1788445780803',
      amount: 3990,
      paymentType: 'full',
      customer: {
        first_name: 'Test',
        last_name: 'Customer',
        phone: '+380 68 234 57 29',
        email: 'TEST@example.com',
      },
      tracking: {
        page_url: 'https://www.meylindresses.com/pages/checkkout',
        user_agent: 'Mozilla/5.0',
        client_ip_address: '203.0.113.10',
        fbp: 'fb.1.1788445000.123',
        fbc: 'fb.1.1788445000.click',
      },
      cartTotal: 3990,
      goods: [
        {
          code: 'MEYLIN-MIDI-BLK-XL',
          name: 'Сукня MEYLIN Midi',
          price: 3990,
          quantity: 1,
        },
      ],
    };
    const webhookBody: MonobankWebhookBody = {
      invoiceId: '260903EvE3BBYYGZWRi5',
      status: 'success',
      amount: 399000,
      finalAmount: 399000,
    };

    const event = buildMetaPurchasePayload(payment, webhookBody).data[0] as Record<string, unknown>;
    const userData = event.user_data as Record<string, unknown>;
    const customData = event.custom_data as Record<string, unknown>;

    expect(event.event_name).toBe('Purchase');
    expect(event.action_source).toBe('website');
    expect(event.event_source_url).toBe('https://www.meylindresses.com/pages/checkkout');
    expect(userData.em).toBe(sha256('test@example.com'));
    expect(userData.ph).toBe(sha256('380682345729'));
    expect(userData.client_user_agent).toBe('Mozilla/5.0');
    expect(userData.client_ip_address).toBe('203.0.113.10');
    expect(customData.currency).toBe('UAH');
    expect(customData.value).toBe(3990);
    expect(customData.order_id).toBe('#1486');
    expect(customData.content_ids).toEqual(['MEYLIN-MIDI-BLK-XL']);
  });
});
