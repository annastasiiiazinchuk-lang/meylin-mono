import { describe, expect, test } from 'bun:test';
import {
  normalizeMonobankPartsBaseUrl,
  normalizeSitniksReceiptPaymentType,
  parseNumberList,
} from '../../lib/config/env';

describe('environment helpers', () => {
  test('normalizes Monobank parts base URL from host or full order endpoint', () => {
    expect(normalizeMonobankPartsBaseUrl('https://u2.monobank.com.ua')).toBe('https://u2.monobank.com.ua');
    expect(normalizeMonobankPartsBaseUrl('https://u2.monobank.com.ua/')).toBe('https://u2.monobank.com.ua');
    expect(normalizeMonobankPartsBaseUrl('https://u2.monobank.com.ua/api/order/create'))
      .toBe('https://u2.monobank.com.ua');
    expect(normalizeMonobankPartsBaseUrl('https://u2.monobank.com.ua/api/order/state?x=1'))
      .toBe('https://u2.monobank.com.ua');
  });

  test('parses comma-separated number lists', () => {
    expect(parseNumberList('2,3,4')).toEqual([2, 3, 4]);
    expect(parseNumberList(' 2, 3, 3, nope, 4 ')).toEqual([2, 3, 4]);
  });

  test('normalizes Sitniks receipt payment type', () => {
    expect(normalizeSitniksReceiptPaymentType('afterpayment')).toBe('afterpayment');
    expect(normalizeSitniksReceiptPaymentType('prepayment')).toBe('prepayment');
    expect(normalizeSitniksReceiptPaymentType('anything')).toBe('prepayment');
  });
});
