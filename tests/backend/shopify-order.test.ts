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
    city_ref: 'city-ref-kyiv',
    warehouse: 'Відділення №12',
    warehouse_ref: 'warehouse-ref-12',
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

  test('order additional details include payment and delivery fields for integrations', () => {
    const payload = buildShopifyOrderPayload(basePayload, getPaymentAmount(basePayload));

    expect(payload.order.note_attributes).toEqual(expect.arrayContaining([
      { name: 'payment_type', value: 'full_payment' },
      { name: 'shipping_type', value: 'ukraine' },
      { name: 'delivery_type', value: 'nova_poshta' },
      { name: 'nova_poshta_delivery_method', value: 'branch' },
      { name: 'nova_poshta_city', value: 'Київ' },
      { name: 'nova_poshta_city_ref', value: 'city-ref-kyiv' },
      { name: 'nova_poshta_warehouse', value: 'Відділення №12' },
      { name: 'nova_poshta_warehouse_ref', value: 'warehouse-ref-12' },
      { name: 'Recipient Name', value: 'Анастасія Зінчук' },
      { name: 'Recipient Phone', value: '0682345729' },
      { name: 'Recipient Email', value: 'test@example.com' },
      { name: 'Delivery Method', value: 'Нова пошта' },
      { name: 'City', value: 'Київ' },
      { name: 'Post Office', value: 'Відділення №12' },
      { name: 'Payment', value: 'Повна оплата Monobank' },
      { name: 'Shipping', value: 'За тарифами перевізника' },
      { name: '_provider', value: 'Нова пошта' },
      { name: '_country', value: 'Ukraine' },
      { name: '_delivery_type', value: 'branch' },
      { name: '_delivery_method', value: 'Відділення / Поштомат' },
      { name: '_delivery_city', value: 'Київ' },
      { name: '_delivery_city_Ref', value: 'city-ref-kyiv' },
      { name: '_delivery_warehouse', value: 'Відділення №12' },
      { name: '_delivery_warehouse_CityRef', value: 'city-ref-kyiv' },
      { name: '_delivery_warehouse_Ref', value: 'warehouse-ref-12' },
      { name: 'Currency rate', value: '1' },
      { name: 'Cash on delivery', value: 'false' },
      { name: 'Checkout id', value: 'cart-token' },
    ]));
  });

  test('custom checkout orders do not add Shopify taxes', () => {
    const payload = buildShopifyOrderPayload(basePayload, getPaymentAmount(basePayload));
    const lineItems = payload.order.line_items as Array<Record<string, unknown>>;

    expect(payload.order.tax_exempt).toBe(true);
    expect(payload.order.taxes_included).toBe(false);
    expect(lineItems[0].taxable).toBe(false);
    expect(lineItems[0].tax_lines).toEqual([]);
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
    const prepaymentPayload = { ...basePayload, payment_type: 'prepayment' as const };
    const payload = buildShopifyOrderPayload(prepaymentPayload, getPaymentAmount(prepaymentPayload));
    const lineItems = payload.order.line_items as Array<Record<string, unknown>>;

    expect(payload.order.financial_status).toBe('pending');
    expect(payload.order.tags).toBe('not_paid_300');
    expect(payload.order.discount_codes).toBeUndefined();
    expect(lineItems[0].taxable).toBe(false);
    expect(lineItems[0].tax_lines).toEqual([]);
    expect(payload.order.note_attributes).toEqual(expect.arrayContaining([
      { name: 'payment_type', value: 'prepayment_300' },
      { name: 'Payment', value: 'Накладений платіж' },
      { name: 'Cash on delivery', value: 'true' },
      { name: 'Partial payment value - Monobank', value: '300 UAH' },
    ]));
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
    expect(payload.order.note_attributes).toEqual(expect.arrayContaining([
      { name: 'payment_type', value: 'monobank_parts' },
      { name: 'shipping_type', value: 'ukraine' },
      { name: 'delivery_type', value: 'nova_poshta' },
      { name: 'nova_poshta_delivery_method', value: 'branch' },
      { name: 'nova_poshta_city', value: 'Київ' },
      { name: 'nova_poshta_city_ref', value: 'city-ref-kyiv' },
      { name: 'nova_poshta_warehouse', value: 'Відділення №12' },
      { name: 'nova_poshta_warehouse_ref', value: 'warehouse-ref-12' },
      { name: 'Payment', value: 'Покупка частинами Monobank' },
      { name: '_delivery_city_Ref', value: 'city-ref-kyiv' },
      { name: '_delivery_warehouse_Ref', value: 'warehouse-ref-12' },
      { name: 'Cash on delivery', value: 'false' },
    ]));

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
