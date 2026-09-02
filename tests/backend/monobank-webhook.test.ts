import { describe, expect, test } from 'bun:test';
import { isMonobankWebhookAmountConfirmed } from '../../lib/services/monobank/monobank-webhook';

describe('Monobank webhook processing', () => {
  test('confirms successful webhook amount only when it matches expected invoice amount', () => {
    expect(isMonobankWebhookAmountConfirmed(300, {
      invoiceId: 'invoice-1',
      status: 'success',
      amount: 30000,
      finalAmount: 30000,
    })).toBe(true);

    expect(isMonobankWebhookAmountConfirmed(3700, {
      invoiceId: 'invoice-2',
      status: 'success',
      amount: 370000,
      finalAmount: 370000,
    })).toBe(true);

    expect(isMonobankWebhookAmountConfirmed(3700, {
      invoiceId: 'invoice-3',
      status: 'success',
      amount: 30000,
      finalAmount: 30000,
    })).toBe(false);
  });
});
