import { describe, expect, test } from 'bun:test';
import {
  buildGa4PurchasePayload,
  normalizeGaClientId,
  normalizeGaSessionId,
} from '../../lib/services/tracking/google-analytics';
import type { StoredPaymentMetadata } from '../../lib/types/checkout';
import type { MonobankWebhookBody } from '../../lib/types/monobank';

describe('Google Analytics Measurement Protocol', () => {
  test('normalizes GA client and session cookies', () => {
    expect(normalizeGaClientId('GA1.1.123456789.1788445000')).toBe('123456789.1788445000');
    expect(normalizeGaClientId('123456789.1788445000')).toBe('123456789.1788445000');

    expect(normalizeGaSessionId('GS1.1.1788445000.1.1.1788445999.0.0.0')).toBe('1788445000');
    expect(normalizeGaSessionId('GS2.1.s1788445000$o1$g1$t1788445999$j60$l0$h123')).toBe('1788445000');
  });

  test('builds a purchase payload with attribution and ecommerce data', () => {
    const payment: StoredPaymentMetadata = {
      shopifyOrderId: 7243745919168,
      shopifyOrderName: '#1486',
      reference: 'shopify-7243745919168-1788445780803',
      amount: 3990,
      paymentType: 'full',
      customer: {
        first_name: 'Test',
        last_name: 'Customer',
        phone: '+380682345729',
        email: 'test@example.com',
      },
      tracking: {
        ga_client_id: 'GA1.1.123456789.1788445000',
        ga_session_id: 'GS2.1.s1788445000$o1$g1$t1788445999$j60$l0$h123',
        gcl_aw: 'GCL.1788444000.test-gclid-123',
        utm_source: 'google',
        utm_medium: 'cpc',
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

    const payload = buildGa4PurchasePayload(payment, webhookBody);

    expect(payload?.client_id).toBe('123456789.1788445000');
    expect(payload?.events[0]?.name).toBe('purchase');
    expect(payload?.events[0]?.params.transaction_id).toBe('260903EvE3BBYYGZWRi5');
    expect(payload?.events[0]?.params.value).toBe(3990);
    expect(payload?.events[0]?.params.session_id).toBe('1788445000');
    expect(payload?.events[0]?.params.gclid).toBe('test-gclid-123');
    expect(payload?.events[0]?.params.items).toEqual([
      {
        item_id: 'MEYLIN-MIDI-BLK-XL',
        item_name: 'Сукня MEYLIN Midi',
        price: 3990,
        quantity: 1,
      },
    ]);
  });
});
