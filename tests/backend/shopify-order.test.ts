import { describe, expect, test } from 'bun:test';
import {
  buildOrderUpdateAfterPayment,
  buildShippingAddress,
  buildShopifyOrderPayload,
  getPaymentAmount,
  getShippingPrice,
} from '../../lib/services/shopify/shopify-order';
import type { CheckoutPayload } from '../../lib/types/checkout';

const basePayload: CheckoutPayload = {
  locale: 'uk',
  payment_type: 'full',
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
  goods: [
    {
      variant_id: 111,
      name: 'Годинник',
      price: 1200,
      quantity: 1,
      properties: [
        {
          name: 'Текст для гравіювання на коробці',
          value: '1111',
        },
      ],
    },
  ],
  comment: '',
  personal_data_consent: true,
  tracking: {},
  utm: {},
};

describe('Shopify order mapping', () => {
  test('full payment amount equals cart total', () => {
    expect(getPaymentAmount(basePayload)).toBe(1200);
  });

  test('order keeps contact phone without creating Shopify customer', () => {
    const payload = buildShopifyOrderPayload(basePayload, getPaymentAmount(basePayload));

    expect(payload.order.email).toBe('test@example.com');
    expect(payload.order.phone).toBe('0682345729');
    expect(payload.order.customer).toBeUndefined();
    expect(payload.order.shipping_address).toMatchObject({
      first_name: 'Анастасія',
      last_name: 'Зінчук',
      phone: '0682345729',
    });
  });

  test('order additional details only include payment and shipping type', () => {
    const payload = buildShopifyOrderPayload(basePayload, getPaymentAmount(basePayload));

    expect(payload.order.note_attributes).toEqual([
      { name: 'payment_type', value: 'full_payment' },
      { name: 'shipping_type', value: 'ukraine' },
    ]);
  });

  test('custom checkout orders do not add Shopify taxes', () => {
    const payload = buildShopifyOrderPayload(basePayload, getPaymentAmount(basePayload));

    expect(payload.order.tax_exempt).toBe(true);
    expect(payload.order.taxes_included).toBe(false);
  });

  test('passes product engraving properties to Shopify line items', () => {
    const payload = buildShopifyOrderPayload(basePayload, getPaymentAmount(basePayload));
    const lineItems = payload.order.line_items as Array<Record<string, unknown>>;

    expect(lineItems[0].properties).toEqual([
      {
        name: 'Текст для гравіювання на коробці',
        value: '1111',
      },
    ]);
  });

  test('international delivery does not add extra shipping fee', () => {
    const internationalPayload: CheckoutPayload = {
      ...basePayload,
      amount: 1200,
      shipping_type: 'international',
      shipping: {
        type: 'international',
        country: 'Poland',
        intl_city: 'Warsaw',
        address: 'Main street 1',
        shipping_price: 660,
      },
    };
    const payload = buildShopifyOrderPayload(internationalPayload, getPaymentAmount(internationalPayload));

    expect(getPaymentAmount(internationalPayload)).toBe(1200);
    expect(getShippingPrice(internationalPayload)).toBe(0);
    expect(payload.order.shipping_lines).toBeUndefined();
  });

  test('prepayment amount is fixed at 300', () => {
    expect(getPaymentAmount({ ...basePayload, payment_type: 'prepayment' })).toBe(300);
  });

  test('installments payment amount equals cart total', () => {
    expect(getPaymentAmount({ ...basePayload, payment_type: 'installments' })).toBe(1200);
  });

  test('prepayment order starts pending with not_paid_300 tag and no discount before payment', () => {
    const payload = buildShopifyOrderPayload({ ...basePayload, payment_type: 'prepayment' }, 200);
    expect(payload.order.financial_status).toBe('pending');
    expect(payload.order.tags).toBe('not_paid_300');
    expect(payload.order.discount_codes).toBeUndefined();
  });

  test('prepayment after payment keeps financial status unchanged and sets paid tag', () => {
    const update = buildOrderUpdateAfterPayment(123, 300, 'invoice-1', 'prepayment', [
      { name: 'payment_type', value: 'prepayment_300' },
      { name: 'shipping_type', value: 'ukraine' },
    ]);
    expect(update.financial_status).toBeUndefined();
    expect(update.tags).toBe('prepayment_300_paid');
    expect(update.discount_codes).toBeUndefined();
    expect(update.note_attributes).toEqual([
      { name: 'payment_type', value: 'prepayment_300' },
      { name: 'shipping_type', value: 'ukraine' },
    ]);
  });

  test('full payment after payment sets paid status and no prepayment tag', () => {
    const update = buildOrderUpdateAfterPayment(123, 1200, 'invoice-1', 'full', [
      { name: 'payment_type', value: 'full_payment' },
      { name: 'shipping_type', value: 'ukraine' },
    ]);
    expect(update.financial_status).toBe('paid');
    expect(update.tags).toBeUndefined();
    expect(update.note_attributes).toEqual([
      { name: 'payment_type', value: 'full_payment' },
      { name: 'shipping_type', value: 'ukraine' },
    ]);
  });

  test('installments order is marked separately and becomes paid after approval', () => {
    const payload = buildShopifyOrderPayload({ ...basePayload, payment_type: 'installments' }, 1200);
    expect(payload.order.financial_status).toBe('pending');
    expect(payload.order.note_attributes).toEqual([
      { name: 'payment_type', value: 'monobank_parts' },
      { name: 'shipping_type', value: 'ukraine' },
    ]);

    const update = buildOrderUpdateAfterPayment(123, 1200, 'parts-order-1', 'installments', [
      { name: 'payment_type', value: 'monobank_parts' },
      { name: 'shipping_type', value: 'ukraine' },
    ]);
    expect(update.financial_status).toBe('paid');
    expect(update.tags).toBeUndefined();
    expect(update.note_attributes).toEqual([
      { name: 'payment_type', value: 'monobank_parts' },
      { name: 'shipping_type', value: 'ukraine' },
    ]);
  });

  test('Nova Poshta branch maps city and branch separately', () => {
    const address = buildShippingAddress(basePayload);
    expect(address.city).toBe('Київ');
    expect(address.address1).toBe('Відділення: Відділення №12');
    expect(address.address2).toBe('Відділення');
  });

  test('Nova Poshta address delivery maps street/house separately from apartment', () => {
    const address = buildShippingAddress({
      ...basePayload,
      shipping: {
        type: 'ukraine',
        delivery_method: 'address',
        city: 'Львів',
        street: 'Шевченка',
        house: '10',
        apartment: '5',
      },
    });
    expect(address.city).toBe('Львів');
    expect(address.address1).toBe('Шевченка, 10');
    expect(address.address2).toBe('5');
  });
});
