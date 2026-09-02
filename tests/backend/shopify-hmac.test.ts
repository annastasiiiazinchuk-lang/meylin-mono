import crypto from 'node:crypto';
import querystring from 'node:querystring';
import { describe, expect, test } from 'bun:test';

describe('Shopify HMAC validation', () => {
  test('validates OAuth callback HMAC', async () => {
    const params = {
      code: 'auth-code',
      shop: 'meylin-test.myshopify.com',
      state: 'state',
      timestamp: '123456',
    };
    const message = querystring.stringify(params);
    const hmac = crypto.createHmac('sha256', 'test-secret').update(message).digest('hex');
    const search = new URLSearchParams({ ...params, hmac });
    const mod = await import('../../lib/services/shopify/shopify-auth');

    expect(mod.getShopifyHmacDebug(search, 'test-secret').ok).toBe(true);
  });
});
