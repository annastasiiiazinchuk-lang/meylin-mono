import { describe, expect, test } from 'bun:test';
import { env } from '../../lib/config/env';
import {
  buildMonobankPartsCreatePayload,
  buildMonobankPartsSignature,
  isMonobankPartsApproved,
  isMonobankPartsCompleted,
  isMonobankPartsFailed,
  isMonobankPartsReady,
  verifyMonobankPartsSignature,
} from '../../lib/services/monobank/monobank-parts';
import type { CheckoutPayload } from '../../lib/types/checkout';

const payload: CheckoutPayload = {
  locale: 'uk',
  payment_type: 'installments',
  installments_parts_count: 3,
  amount: 1200,
  cart_total: 1200,
  cart_token: 'cart-token',
  customer: {
    first_name: 'Анастасія',
    last_name: 'Зінчук',
    phone: '0682345729',
    email: 'test@example.com',
  },
  shipping_type: 'ukraine',
  shipping: {
    type: 'ukraine',
    delivery_method: 'branch',
    city: 'Київ',
    warehouse: 'Відділення №12',
  },
  goods: [{
    code: 'SKU-1',
    variant_id: '111',
    variant_title: '134-140',
    name: 'Сукня',
    title: 'Сукня',
    price: 1200,
    quantity: 1,
    properties: [],
  }],
  comment: '',
  personal_data_consent: true,
  tracking: {},
  utm: {},
};

describe('Monobank parts integration', () => {
  test('readiness requires enabled flag, store id and secret', () => {
    const originalEnabled = env.monoPartsEnabled;
    const originalStoreId = env.monoPartsStoreId;
    const originalSecret = env.monoPartsSecret;

    env.monoPartsEnabled = true;
    env.monoPartsStoreId = 'store-1';
    env.monoPartsSecret = 'secret';
    expect(isMonobankPartsReady()).toBe(true);

    env.monoPartsSecret = '';
    expect(isMonobankPartsReady()).toBe(false);

    env.monoPartsEnabled = originalEnabled;
    env.monoPartsStoreId = originalStoreId;
    env.monoPartsSecret = originalSecret;
  });

  test('builds create payload from checkout data and optional parts count', () => {
    const originalCount = env.monoPartsCount;
    const originalCounts = env.monoPartsCounts;
    const originalCallback = env.monoPartsResultCallbackUrl;
    const originalSource = env.monoPartsInvoiceSource;
    const originalPointId = env.monoPartsPointId;
    env.monoPartsCount = 4;
    env.monoPartsCounts = [2, 3, 4];
    env.monoPartsResultCallbackUrl = 'https://example.com/callback';
    env.monoPartsInvoiceSource = 'INTERNET';
    env.monoPartsPointId = 'POINT-1';

    const request = buildMonobankPartsCreatePayload(payload, { id: 123, name: '#1001' }, 1200);

    expect(request).toMatchObject({
      client_phone: '+380682345729',
      total_sum: 1200,
      result_callback: 'https://example.com/callback',
      invoice: {
        number: '1001',
        source: 'INTERNET',
        point_id: 'POINT-1',
      },
      available_programs: [{
        type: 'payment_installments',
        available_parts_count: [3],
      }],
      products: [{
        name: 'Сукня',
        count: 1,
        sum: 1200,
        code: 'SKU-1',
      }],
    });
    expect((request.invoice as { date?: string }).date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(String(request.store_order_id)).toStartWith('shopify-parts-123-');

    env.monoPartsCount = originalCount;
    env.monoPartsCounts = originalCounts;
    env.monoPartsResultCallbackUrl = originalCallback;
    env.monoPartsInvoiceSource = originalSource;
    env.monoPartsPointId = originalPointId;
  });

  test('signs and verifies callback payloads with HMAC-SHA256 base64', () => {
    const originalStoreId = env.monoPartsStoreId;
    const originalSecret = env.monoPartsSecret;
    env.monoPartsStoreId = 'store-1';
    env.monoPartsSecret = 'secret';

    const rawBody = JSON.stringify({ order_id: 'parts-1', state: 'IN_PROCESS' });
    const signature = buildMonobankPartsSignature(rawBody);

    expect(verifyMonobankPartsSignature(rawBody, signature)).toBe(true);
    expect(verifyMonobankPartsSignature(rawBody, `${signature}x`)).toBe(false);

    env.monoPartsStoreId = originalStoreId;
    env.monoPartsSecret = originalSecret;
  });

  test('recognizes approved and failed callback statuses', () => {
    expect(isMonobankPartsApproved({
      state: 'IN_PROCESS',
      order_sub_state: 'WAITING_FOR_STORE_CONFIRM',
    })).toBe(true);
    expect(isMonobankPartsCompleted({ state: 'SUCCESS' })).toBe(true);
    expect(isMonobankPartsFailed({ state: 'FAIL', order_sub_state: 'REJECTED_BY_CLIENT' })).toBe(true);
    expect(isMonobankPartsFailed({ state: 'IN_PROCESS', order_sub_state: 'REJECTED' })).toBe(true);
  });
});
