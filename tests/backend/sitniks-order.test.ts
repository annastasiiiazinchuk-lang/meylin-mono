import { describe, expect, test } from 'bun:test';
import { env } from '../../lib/config/env';
import {
  buildSitniksPaymentStatusComment,
  buildSitniksNpDelivery,
  buildSitniksOffers,
  buildSitniksOrderPayload,
  buildSitniksPayment,
  buildSitniksReceiptPayload,
  buildSitniksProducts,
  getSitniksPaidStatusId,
  isSitniksReceiptPaymentConfirmed,
} from '../../lib/services/sitniks/sitniks-order';
import type { CheckoutPayload } from '../../lib/types/checkout';

const basePayload: CheckoutPayload = {
  locale: 'uk',
  payment_type: 'prepayment',
  amount: 300,
  cart_total: 1200,
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
      code: 'SKU-1',
      variant_id: 111,
      variant_title: '44 мм',
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
  comment: 'Подзвоніть перед відправкою',
  personal_data_consent: true,
  tracking: {
    utm_source: 'facebook',
    utm_campaign: 'summer',
  },
  utm: {},
};

describe('Sitniks order mapping', () => {
  test('builds minimal order payload with client and Shopify external id', () => {
    const payload = buildSitniksOrderPayload(basePayload, { id: 123, name: '#1001' });

    expect(payload.externalId).toBe('shopify-123');
    expect(payload.client).toEqual({
      fullname: 'Анастасія Зінчук',
      phone: '0682345729',
      email: 'test@example.com',
    });
    expect(payload.clientComment).toBe('Подзвоніть перед відправкою');
    expect(payload.utm).toEqual({ source: 'facebook', campaign: 'summer' });
    expect(String(payload.managerComment)).toContain('Shopify order: #1001');
    expect(String(payload.managerComment)).toContain('Передплата 300 грн');
    expect(String(payload.managerComment)).toContain('Сума товарів: 1200 грн');
    expect(String(payload.managerComment)).toContain('Годинник (44 мм) x 1');
    expect(String(payload.managerComment)).toContain('Текст для гравіювання на коробці: 1111');
    expect(String(payload.managerComment)).toContain('Відділення №12');
    expect(String(payload.managerComment)).toContain('SKU/variant: SKU-1');
    expect(String(payload.managerComment)).not.toContain('Створено з кастомного Shopify checkout');
    expect(String(payload.managerComment)).not.toContain('Статус оплати');
    expect(String(payload.managerComment)).not.toContain('Залишок');
    expect(payload.payment).toBeUndefined();
  });

  test('builds product rows by title without SKU', () => {
    const products = buildSitniksProducts(basePayload);

    expect(products).toEqual([
      {
        title: 'Годинник (44 мм)',
        price: 1200,
        quantity: 1,
        isUpsale: false,
      },
    ]);
  });

  test('does not include deprecated products without a Sitniks offer map', () => {
    const payload = buildSitniksOrderPayload(basePayload, { id: 123, name: '#1001' }, {
      includeProducts: true,
    });

    expect(payload.products).toBeUndefined();
    expect(payload.offers).toBeUndefined();
    expect(String(payload.managerComment)).toContain('Годинник (44 мм) x 1');
  });

  test('can include Sitniks offers from resolved SKU lookup map', () => {
    const payload = buildSitniksOrderPayload(basePayload, { id: 123, name: '#1001' }, {
      includeProducts: true,
      offerMap: {
        'SKU-1': {
          itemId: 777,
          itemType: 'variation',
          warehouseId: 88,
        },
      },
    });

    expect(payload.offers).toEqual([
      {
        itemId: 777,
        itemType: 'variation',
        isUpsale: false,
        title: 'Годинник (44 мм)',
        price: 1200,
        quantity: 1,
        warehouseId: 88,
        notes: 'Текст для гравіювання на коробці: 1111',
      },
    ]);
  });

  test('builds payment block with prepayment amount and order balance', () => {
    const originalSettlementAccountId = env.sitniksSettlementAccountId;
    env.sitniksSettlementAccountId = 11287;

    const payment = buildSitniksPayment(basePayload);

    expect(payment).toEqual({
      settlementAccountId: 11287,
      amount: 300,
      description: 'Передплата 300 грн\nСума замовлення: 1200 грн\nЗалишок/накладний платіж: 900 грн',
    });

    env.sitniksSettlementAccountId = originalSettlementAccountId;
  });

  test('builds Sitniks offers for stock writeoff when product map is configured', () => {
    const originalOfferMap = env.sitniksOfferMap;
    const originalWarehouseId = env.sitniksWarehouseId;

    env.sitniksOfferMap = JSON.stringify({
      'SKU-1': { itemId: 555, itemType: 'variation' },
    });
    env.sitniksWarehouseId = 77;

    const offers = buildSitniksOffers(basePayload);
    const payload = buildSitniksOrderPayload(basePayload, { id: 123, name: '#1001' }, {
      includeProducts: true,
    });

    expect(offers).toEqual([
      {
        itemId: 555,
        itemType: 'variation',
        isUpsale: false,
        title: 'Годинник (44 мм)',
        price: 1200,
        quantity: 1,
        warehouseId: 77,
        notes: 'Текст для гравіювання на коробці: 1111',
      },
    ]);
    expect(payload.offers).toEqual(offers);
    expect(payload.products).toBeUndefined();

    env.sitniksOfferMap = originalOfferMap;
    env.sitniksWarehouseId = originalWarehouseId;
  });

  test('builds Nova Poshta delivery fields for Sitniks', () => {
    const originalNovaPoshtaIntegrationId = env.sitniksNovaPoshtaIntegrationId;
    env.sitniksNovaPoshtaIntegrationId = 99;

    const npDelivery = buildSitniksNpDelivery(basePayload);

    expect(npDelivery).toMatchObject({
      integrationNovaposhtaId: 99,
      serviceType: 'WarehouseWarehouse',
      payerType: 'Recipient',
      cargoType: 'Parcel',
      paymentMethod: 'Cash',
      city: 'Київ',
      cityRef: 'city-ref-kyiv',
      department: 'Відділення №12',
      departmentRef: 'warehouse-ref-12',
      recipientFullname: 'Анастасія Зінчук',
      recipientPhone: '0682345729',
      description: 'Подзвоніть перед відправкою',
    });

    env.sitniksNovaPoshtaIntegrationId = originalNovaPoshtaIntegrationId;
  });

  test('builds Nova Poshta address delivery without department fields', () => {
    const originalNovaPoshtaIntegrationId = env.sitniksNovaPoshtaIntegrationId;
    env.sitniksNovaPoshtaIntegrationId = 99;

    const npDelivery = buildSitniksNpDelivery({
      ...basePayload,
      shipping: {
        ...basePayload.shipping,
        delivery_method: 'address',
        warehouse: '',
        warehouse_ref: '',
        street: 'Хрещатик',
        house: '1',
        apartment: '2',
      },
    });

    expect(npDelivery).toMatchObject({
      serviceType: 'WarehouseDoors',
      city: 'Київ',
      cityRef: 'city-ref-kyiv',
      department: '',
      departmentRef: '',
      street: 'Хрещатик',
      house: '1',
      flat: '2',
    });

    env.sitniksNovaPoshtaIntegrationId = originalNovaPoshtaIntegrationId;
  });

  test('uses a default Nova Poshta description when customer comment is empty', () => {
    const originalNovaPoshtaIntegrationId = env.sitniksNovaPoshtaIntegrationId;
    env.sitniksNovaPoshtaIntegrationId = 99;

    const npDelivery = buildSitniksNpDelivery({
      ...basePayload,
      comment: '',
    });

    expect(npDelivery).toMatchObject({
      description: 'Товари Meylin',
    });

    env.sitniksNovaPoshtaIntegrationId = originalNovaPoshtaIntegrationId;
  });

  test('includes international delivery information in manager comment', () => {
    const payload = buildSitniksOrderPayload({
      ...basePayload,
      payment_type: 'full',
      amount: 1860,
      shipping_type: 'international',
      shipping: {
        type: 'international',
        country: 'Poland',
        intl_city: 'Warsaw',
        address: 'Main street 1',
        apartment: '2',
        postcode: '00-001',
        shipping_price: 660,
      },
    }, { id: 124, name: '#1002' });

    expect(String(payload.managerComment)).toContain('Повна оплата');
    expect(String(payload.managerComment)).toContain('Тип доставки: закордон');
    expect(String(payload.managerComment)).toContain('Доставка: за кордон');
    expect(String(payload.managerComment)).toContain('Країна: Poland');
    expect(String(payload.managerComment)).not.toContain('Вартість доставки: 660 грн');
    expect(String(payload.managerComment)).not.toContain('Вартість доставки: 0 грн');
  });

  test('uses separate paid statuses for full payment and prepayment', () => {
    const originalPaidStatusId = env.sitniksPaidStatusId;
    const originalPrepaymentPaidStatusId = env.sitniksPrepaymentPaidStatusId;
    const originalPartsPaidStatusId = env.sitniksPartsPaidStatusId;

    env.sitniksPaidStatusId = 10;
    env.sitniksPrepaymentPaidStatusId = 20;
    env.sitniksPartsPaidStatusId = 30;

    expect(getSitniksPaidStatusId('full')).toBe(10);
    expect(getSitniksPaidStatusId('prepayment')).toBe(20);
    expect(getSitniksPaidStatusId('installments')).toBe(30);

    env.sitniksPaidStatusId = originalPaidStatusId;
    env.sitniksPrepaymentPaidStatusId = originalPrepaymentPaidStatusId;
    env.sitniksPartsPaidStatusId = originalPartsPaidStatusId;
  });

  test('labels installments orders and payment comments separately', () => {
    const payload = buildSitniksOrderPayload({
      ...basePayload,
      payment_type: 'installments',
      amount: 1200,
    }, { id: 125, name: '#1003' });

    expect(String(payload.managerComment)).toContain('Покупка Частинами monobank');

    const comment = buildSitniksPaymentStatusComment({
      paymentType: 'installments',
      shopifyOrderName: '#1003',
      shopifyOrderId: BigInt(125),
      orderId: '125',
      invoiceId: 'parts-order-1',
      cartTotal: 1200,
    }, {
      invoiceId: 'parts-order-1',
      status: 'success',
      amount: 120000,
      finalAmount: 120000,
    });

    expect(comment).toContain('Оплату Monobank підтверджено: Покупка Частинами monobank');
    expect(comment).toContain('Сплачено онлайн: 1200 грн');
  });

  test('builds payment status comment after Monobank success', () => {
    const comment = buildSitniksPaymentStatusComment({
      paymentType: 'prepayment',
      shopifyOrderName: '#1048',
      shopifyOrderId: BigInt(123),
      orderId: '123',
      invoiceId: 'invoice-old',
      cartTotal: 6000,
    }, {
      invoiceId: 'invoice-new',
      status: 'success',
      amount: 30000,
      finalAmount: 30000,
    });

    expect(comment).toContain('Оплату Monobank підтверджено: Передплата 300 грн');
    expect(comment).toContain('Shopify order: #1048');
    expect(comment).toContain('Invoice: invoice-new');
    expect(comment).toContain('Сплачено онлайн: 300 грн');
    expect(comment).toContain('Залишок: 5700 грн');
  });

  test('builds cashless Sitniks receipt payload for paid Shopify order', () => {
    const originalCashRegisterId = env.sitniksCashRegisterId;
    const originalReceiptPaymentType = env.sitniksReceiptPaymentType;
    env.sitniksCashRegisterId = 456;
    env.sitniksReceiptPaymentType = 'prepayment';

    const payload = buildSitniksReceiptPayload({
      id: 'payment-1',
      orderId: '123',
      amount: 300,
      currency: 'UAH',
      customerName: 'Анастасія Зінчук',
      customerPhone: '0682345729',
      customerEmail: 'test@example.com',
      reference: 'ref-1',
      invoiceId: 'invoice-old',
      pageUrl: null,
      status: 'SUCCESS',
      destination: null,
      goods: [],
      shipping: null,
      utm: null,
      measurements: null,
      comment: null,
      createdReceipt: false,
      shopifyOrderId: BigInt(123),
      shopifyOrderName: '#1048',
      paymentType: 'prepayment',
      cartTotal: 1200,
      tracking: null,
      webhookPayload: null,
      shopifyOrderData: null,
      sitniksOrderId: BigInt(777),
      sitniksOrderNumber: null,
      sitniksSyncStatus: null,
      sitniksSyncError: null,
      sitniksSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      invoiceId: 'invoice-1',
      status: 'success',
      amount: 30000,
      finalAmount: 30000,
    });

    expect(payload).toEqual({
      orderIds: [777],
      paymentType: 'prepayment',
      paymentMethod: 'CASHLESS',
      cashRegisterIntegrationId: 456,
      label: '#1048 - 300 грн',
    });

    env.sitniksCashRegisterId = originalCashRegisterId;
    env.sitniksReceiptPaymentType = originalReceiptPaymentType;
  });

  test('confirms receipt payment only when Monobank paid amount matches expected amount', () => {
    const payment = {
      amount: 300,
      paymentType: 'prepayment',
      cartTotal: 3700,
    };

    expect(isSitniksReceiptPaymentConfirmed(payment, {
      invoiceId: 'invoice-1',
      status: 'success',
      amount: 30000,
      finalAmount: 30000,
    })).toBe(true);

    expect(isSitniksReceiptPaymentConfirmed(payment, {
      invoiceId: 'invoice-1',
      status: 'success',
      amount: 10000,
      finalAmount: 10000,
    })).toBe(false);
  });

  test('confirms full-payment receipt only for the full paid invoice amount', () => {
    const payment = {
      amount: 3700,
      paymentType: 'full',
      cartTotal: 3700,
    };

    expect(isSitniksReceiptPaymentConfirmed(payment, {
      invoiceId: 'invoice-2',
      status: 'success',
      amount: 370000,
      finalAmount: 370000,
    })).toBe(true);

    expect(isSitniksReceiptPaymentConfirmed(payment, {
      invoiceId: 'invoice-2',
      status: 'success',
      amount: 30000,
      finalAmount: 30000,
    })).toBe(false);
  });
});
