import { describe, expect, test } from 'bun:test';
import {
  buildGoogleAdsClickConversion,
  buildGoogleAdsUploadRequest,
  extractGclidFromGclAw,
  formatGoogleAdsDateTime,
  getGoogleAdsClickId,
  normalizeGoogleAdsId,
} from '../../lib/services/tracking/google-ads';
import { sha256 } from '../../lib/utils/format';
import type { StoredPaymentMetadata } from '../../lib/types/checkout';
import type { MonobankWebhookBody } from '../../lib/types/monobank';

const payment: StoredPaymentMetadata = {
  shopifyOrderId: 7243745919168,
  shopifyOrderName: '#1486',
  reference: 'checkout-reference-1',
  amount: 3990,
  paymentType: 'full',
  customer: {
    first_name: 'Test',
    last_name: 'Customer',
    phone: '0682345729',
    email: 'TEST@example.com',
  },
  tracking: {
    gcl_aw: 'GCL.1788444000.test-gclid-123',
  },
  cartTotal: 3990,
  goods: [],
};

const webhookBody: MonobankWebhookBody = {
  invoiceId: '260903EvE3BBYYGZWRi5',
  status: 'success',
  amount: 399000,
  finalAmount: 399000,
  modifiedDate: '2026-09-03T14:29:53Z',
};

describe('Google Ads conversion upload payload', () => {
  test('normalizes Google Ads ids', () => {
    expect(normalizeGoogleAdsId('123-456-7890')).toBe('1234567890');
    expect(normalizeGoogleAdsId(' customers/123/conversionActions/456 ')).toBe('123456');
  });

  test('extracts click ids from tracking data', () => {
    expect(extractGclidFromGclAw('GCL.1788444000.test-gclid-123')).toBe('test-gclid-123');
    expect(getGoogleAdsClickId({ gcl_aw: 'GCL.1788444000.test-gclid-123' })).toEqual({
      field: 'gclid',
      value: 'test-gclid-123',
    });
    expect(getGoogleAdsClickId({ gbraid: 'gbraid-1' })).toEqual({
      field: 'gbraid',
      value: 'gbraid-1',
    });
    expect(getGoogleAdsClickId({ wbraid: 'wbraid-1' })).toEqual({
      field: 'wbraid',
      value: 'wbraid-1',
    });
  });

  test('formats conversion date time for Google Ads API', () => {
    expect(formatGoogleAdsDateTime(new Date('2026-09-03T14:29:53Z'))).toBe('2026-09-03 14:29:53+00:00');
  });

  test('builds click conversion with gclid and hashed user identifiers', () => {
    const conversion = buildGoogleAdsClickConversion(
      payment,
      webhookBody,
      'customers/1234567890/conversionActions/555',
    );

    expect(conversion).toMatchObject({
      conversionAction: 'customers/1234567890/conversionActions/555',
      conversionDateTime: '2026-09-03 14:29:53+00:00',
      conversionValue: 3990,
      currencyCode: 'UAH',
      orderId: '260903EvE3BBYYGZWRi5',
      conversionEnvironment: 'WEB',
      gclid: 'test-gclid-123',
    });
    expect(conversion?.userIdentifiers).toEqual([
      { hashedEmail: sha256('test@example.com') },
      { hashedPhoneNumber: sha256('380682345729') },
    ]);
  });

  test('builds upload request only when a click id is present', () => {
    const request = buildGoogleAdsUploadRequest(
      payment,
      webhookBody,
      'customers/1234567890/conversionActions/555',
    );
    const noClickId = buildGoogleAdsUploadRequest(
      { ...payment, tracking: {} },
      webhookBody,
      'customers/1234567890/conversionActions/555',
    );

    expect(request?.partialFailure).toBe(true);
    expect(request?.validateOnly).toBe(false);
    expect(request?.conversions).toHaveLength(1);
    expect(noClickId).toBeNull();
  });
});
