import { env, PREPAYMENT_AMOUNT, SHOPIFY_API_VERSION } from '../../config/env';
import type { CheckoutPayload, PaymentType } from '../../types/checkout';
import type { ShopifyOrder } from '../../types/shopify';
import { asNumber, asString, parseJsonObject } from '../../utils/format';
import { getShopifyAccessToken } from './shopify-auth';

type ShopifyRequestOptions = {
  method: string;
  body?: string;
  headers?: Record<string, string>;
};

interface ShopifyRestOrder {
  id: number;
  name: string;
  financial_status?: string;
  note_attributes?: Array<{ name?: string; value?: string }>;
  tags?: string;
}

const INTERNATIONAL_DELIVERY_LABEL = 'Міжнародна доставка';
const PAYMENT_STATUS_TAGS = new Set([
  'full_payment_unpaid',
  'full_payment_paid',
  'prepayment_300_unpaid',
  'prepayment_300_paid',
  'monobank_parts_unpaid',
  'monobank_parts_paid',
  'not_paid_300',
]);

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  austria: 'AT',
  австрія: 'AT',
  австрия: 'AT',
  belgium: 'BE',
  бельгія: 'BE',
  бельгия: 'BE',
  canada: 'CA',
  канада: 'CA',
  czechia: 'CZ',
  czech: 'CZ',
  'czech republic': 'CZ',
  чехія: 'CZ',
  чехия: 'CZ',
  france: 'FR',
  франція: 'FR',
  франция: 'FR',
  germany: 'DE',
  німеччина: 'DE',
  германия: 'DE',
  italy: 'IT',
  італія: 'IT',
  италия: 'IT',
  moldova: 'MD',
  молдова: 'MD',
  netherlands: 'NL',
  нідерланди: 'NL',
  нидерланды: 'NL',
  poland: 'PL',
  польща: 'PL',
  польша: 'PL',
  portugal: 'PT',
  португалія: 'PT',
  португалия: 'PT',
  romania: 'RO',
  румунія: 'RO',
  румыния: 'RO',
  slovakia: 'SK',
  словаччина: 'SK',
  словакия: 'SK',
  spain: 'ES',
  іспанія: 'ES',
  испания: 'ES',
  uk: 'GB',
  'united kingdom': 'GB',
  'great britain': 'GB',
  'велика британія': 'GB',
  великобританія: 'GB',
  великобритания: 'GB',
  usa: 'US',
  us: 'US',
  'united states': 'US',
  сша: 'US',
};

function requireShopifyStoreDomain(): string {
  if (!env.shopifyStoreDomain) throw new Error('Missing SHOPIFY_STORE_DOMAIN');
  return env.shopifyStoreDomain;
}

function shopifyUrl(path: string): string {
  return `https://${requireShopifyStoreDomain()}/admin/api/${SHOPIFY_API_VERSION}${path}`;
}

export async function shopifyRequest<T = Record<string, unknown>>(
  path: string,
  options: ShopifyRequestOptions,
): Promise<T> {
  const accessToken = await getShopifyAccessToken();
  const response = await fetch(shopifyUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Shopify error ${response.status}: ${text}`);
  return parseJsonObject<T>(text, 'Shopify');
}

export function getCartTotal(body: CheckoutPayload): number {
  return asNumber(body.cart_total) || asNumber(body.amount);
}

export function getPaymentAmount(body: CheckoutPayload): number {
  if (body.payment_type === 'prepayment') return PREPAYMENT_AMOUNT;
  return asNumber(body.amount) || asNumber(body.cart_total);
}

function normalizePaymentTypeForShopify(paymentType: PaymentType | CheckoutPayload['payment_type']): string {
  if (paymentType === 'prepayment') return 'prepayment_300';
  if (paymentType === 'installments') return 'monobank_parts';
  return 'full_payment';
}

function getUnpaidPaymentTag(paymentType: PaymentType | CheckoutPayload['payment_type']): string {
  if (paymentType === 'prepayment') return 'prepayment_300_unpaid';
  if (paymentType === 'installments') return 'monobank_parts_unpaid';
  return 'full_payment_unpaid';
}

function getPaidPaymentTag(paymentType: PaymentType | CheckoutPayload['payment_type']): string {
  if (paymentType === 'prepayment') return 'prepayment_300_paid';
  if (paymentType === 'installments') return 'monobank_parts_paid';
  return 'full_payment_paid';
}

function getInitialPaymentTags(paymentType: PaymentType | CheckoutPayload['payment_type']): string {
  const unpaidPaymentTag = getUnpaidPaymentTag(paymentType);
  return paymentType === 'prepayment'
    ? `not_paid_300, ${unpaidPaymentTag}`
    : unpaidPaymentTag;
}

function normalizeShopifyTags(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.map(asString).map((tag) => tag.trim()).filter(Boolean);
  }

  return asString(tags)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function withPaymentStatusTag(existingTags: unknown, paymentStatusTag: string): string {
  const tags = normalizeShopifyTags(existingTags)
    .filter((tag) => !PAYMENT_STATUS_TAGS.has(tag));

  return Array.from(new Set([...tags, paymentStatusTag])).join(', ');
}

function customerFullName(body: CheckoutPayload): string {
  const customer = body.customer || {};
  return [asString(customer.first_name), asString(customer.last_name)].filter(Boolean).join(' ').trim();
}

export function isInternationalCheckout(body: CheckoutPayload): boolean {
  const shipping = body.shipping || {};
  return body.shipping_type === 'international' || shipping.type === 'international';
}

function legacyPaymentLabel(body: CheckoutPayload, isInternational = false): string {
  if (isInternational) return 'Monobank';
  if (body.payment_type === 'prepayment') return 'Накладений платіж';
  if (body.payment_type === 'installments') return 'Покупка частинами Monobank';
  return 'Monobank';
}

function legacyDeliveryMethodLabel(deliveryMethod: string): string {
  if (deliveryMethod === 'address') return 'Адресна доставка';
  return 'Відділення / Поштомат';
}

function formatPaymentAttributeAmount(amount: number): string {
  const rounded = Math.round(asNumber(amount) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function buildLegacyUtmValue(body: CheckoutPayload): string {
  const tracking = body.tracking || body.utm || {};
  const keys = [
    'utm_medium',
    'utm_source',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'fbclid',
    'gclid',
    'fbc',
    'fbp',
  ];

  return keys
    .map((key) => {
      const value = asString(tracking[key]);
      return value ? `${key}: ${value}` : '';
    })
    .filter(Boolean)
    .join('; ');
}

function getCountryCode(countryOrCode: string): string {
  const normalized = countryOrCode.trim();
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toUpperCase();
  return COUNTRY_CODE_BY_NAME[normalized.toLowerCase()] || '';
}

export function buildInternationalCheckoutComment(body: CheckoutPayload): string {
  const customer = body.customer || {};
  const shipping = body.shipping || {};
  const country = asString(shipping.country);
  const city = asString(shipping.intl_city) || asString(shipping.city);
  const address = asString(shipping.address);
  const apartment = asString(shipping.apartment);
  const postcode = asString(shipping.postcode);
  const countryCode = getCountryCode(asString(shipping.country_code) || country);
  const customerComment = asString(body.comment);

  return [
    'Тип доставки: закордон',
    'Доставка: за кордон',
    `Delivery Method: ${INTERNATIONAL_DELIVERY_LABEL}`,
    `Recipient Name: ${customerFullName(body)}`,
    `Recipient Phone: ${asString(customer.phone)}`,
    `Recipient Email: ${asString(customer.email)}`,
    countryCode ? `_country-code: ${countryCode}` : '',
    `Country: ${country}`,
    `City: ${city}`,
    `Address: ${address}`,
    `Apartment: ${apartment}`,
    `Zip code: ${postcode}`,
    `Payment: ${legacyPaymentLabel(body, true)}`,
    customerComment ? `Comment: ${customerComment}` : '',
  ].filter((line) => line && !line.endsWith(': ')).join('\n');
}

function buildLegacyIntegrationNoteAttributes(body: CheckoutPayload, paymentAmount: number) {
  const customer = body.customer || {};
  const shipping = body.shipping || {};
  const isInternational = isInternationalCheckout(body);
  const unpaidPaymentTag = getUnpaidPaymentTag(body.payment_type);
  const deliveryMethod = asString(shipping.delivery_method) || 'branch';
  const country = isInternational ? asString(shipping.country) : 'Ukraine';
  const city = isInternational
    ? asString(shipping.intl_city) || asString(shipping.city)
    : asString(shipping.city);
  const warehouse = asString(shipping.warehouse);
  const address = asString(shipping.address);
  const apartment = asString(shipping.apartment);
  const postcode = asString(shipping.postcode);
  const countryCode = isInternational ? getCountryCode(asString(shipping.country_code) || country) : '';
  const cityRef = asString(shipping.city_ref);
  const warehouseRef = asString(shipping.warehouse_ref);
  const cashOnDelivery = body.payment_type === 'prepayment';
  const utm = buildLegacyUtmValue(body);
  const internationalFields = isInternational
    ? [
        { name: '_country-code', value: countryCode },
        { name: 'Country', value: country },
        { name: 'Address', value: address },
        { name: 'Apartment', value: apartment },
        { name: 'Zip code', value: postcode },
        { name: 'Postcode', value: postcode },
        { name: '_delivery_country', value: country },
        { name: '_delivery_country_code', value: countryCode },
        { name: '_delivery_address', value: address },
        { name: '_delivery_apartment', value: apartment },
        { name: '_delivery_postcode', value: postcode },
        { name: '_delivery_zip', value: postcode },
        { name: '_delivery_warehouse_zip', value: postcode },
        { name: '_delivery_warehouse_name', value: warehouse },
        { name: '_delivery_warehouse_address', value: address },
      ]
    : [];

  return [
    { name: 'Recipient Name', value: customerFullName(body) },
    { name: 'Recipient Phone', value: asString(customer.phone) },
    { name: 'Recipient Email', value: asString(customer.email) },
    { name: 'Delivery Method', value: isInternational ? INTERNATIONAL_DELIVERY_LABEL : 'Нова пошта' },
    { name: 'City', value: city },
    { name: 'Post Office', value: warehouse },
    { name: '_zip-code', value: postcode },
    { name: 'Payment', value: legacyPaymentLabel(body, isInternational) },
    { name: 'Comment', value: asString(body.comment) },
    { name: 'Shipping', value: isInternational ? INTERNATIONAL_DELIVERY_LABEL : 'За тарифами перевізника' },
    { name: '_provider', value: isInternational ? INTERNATIONAL_DELIVERY_LABEL : 'Нова пошта' },
    { name: '_country', value: country },
    { name: 'Payment tag', value: unpaidPaymentTag },
    { name: 'payment_tag', value: unpaidPaymentTag },
    { name: 'Payment status tag', value: unpaidPaymentTag },
    { name: 'payment_account_id', value: env.sitniksSettlementAccountId ? String(env.sitniksSettlementAccountId) : '' },
    { name: 'settlement_account_id', value: env.sitniksSettlementAccountId ? String(env.sitniksSettlementAccountId) : '' },
    { name: 'Payment account', value: env.sitniksSettlementAccountTitle },
    { name: 'Settlement Account', value: env.sitniksSettlementAccountTitle },
    { name: '_delivery_type', value: isInternational ? 'international' : deliveryMethod },
    { name: '_delivery_method', value: isInternational ? INTERNATIONAL_DELIVERY_LABEL : legacyDeliveryMethodLabel(deliveryMethod) },
    { name: '_delivery_city', value: city },
    { name: '_delivery_city_Ref', value: cityRef },
    { name: '_delivery_warehouse', value: warehouse },
    { name: '_delivery_warehouse_CityRef', value: cityRef },
    { name: '_delivery_warehouse_Ref', value: warehouseRef },
    ...internationalFields,
    { name: 'UTM', value: utm },
    { name: 'Currency rate', value: '1' },
    { name: 'Cash on delivery', value: cashOnDelivery ? 'true' : 'false' },
    {
      name: 'Partial payment value - Monobank',
      value: body.payment_type === 'prepayment' ? `${paymentAmount || PREPAYMENT_AMOUNT} UAH` : '',
    },
    { name: 'Checkout id', value: asString(body.cart_token) },
  ].filter((attribute) => attribute.value);
}

export function getShippingPrice(body: CheckoutPayload): number {
  void body;
  return 0;
}

export function getOrderIdFromMonobankReference(reference: unknown): number {
  const match = asString(reference).match(/^shopify-(\d+)-/);
  return match ? Number(match[1]) : 0;
}

export function buildShippingAddress(body: CheckoutPayload) {
  const customer = body.customer || {};
  const shipping = body.shipping || {};
  const isInternational = isInternationalCheckout(body);
  const deliveryMethod = asString(shipping.delivery_method);
  const pickupType = deliveryMethod === 'postomat' ? 'Поштомат' : 'Відділення';
  const domesticAddress = deliveryMethod === 'address'
    ? [asString(shipping.street), asString(shipping.house)].filter(Boolean).join(', ')
    : [pickupType, asString(shipping.warehouse)].filter(Boolean).join(': ');
  const domesticAddress2 = deliveryMethod === 'address'
    ? asString(shipping.apartment)
    : pickupType;
  const address1 = isInternational ? asString(shipping.address) : domesticAddress;

  return {
    first_name: asString(customer.first_name),
    last_name: asString(customer.last_name),
    phone: asString(customer.phone),
    address1: address1 || 'Custom checkout',
    address2: isInternational ? asString(shipping.apartment) : domesticAddress2,
    city: isInternational ? asString(shipping.intl_city) || asString(shipping.city) : asString(shipping.city),
    country: isInternational ? asString(shipping.country) : 'Ukraine',
    zip: asString(shipping.postcode),
  };
}

export function buildLineItems(body: CheckoutPayload) {
  return (body.goods || []).map((item) => {
    const variantId = asNumber(item.variant_id);
    const quantity = Math.max(1, Math.round(asNumber(item.quantity) || 1));
    const lineItem: Record<string, unknown> = {
      quantity,
      taxable: false,
      tax_lines: [],
    };

    if (variantId) {
      lineItem.variant_id = variantId;
    } else {
      lineItem.title = asString(item.name) || 'Custom item';
      lineItem.price = String(asNumber(item.price));
    }

    const properties = (item.properties || [])
      .map((property) => ({
        name: asString(property.name),
        value: asString(property.value),
      }))
      .filter((property) => property.name && property.value);
    if (properties.length > 0) {
      lineItem.properties = properties;
    }

    return lineItem;
  });
}

export function buildTrackingNoteAttributes(body: CheckoutPayload) {
  const tracking = body.tracking || body.utm || {};
  const allowedKeys = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gclid',
    'gbraid',
    'wbraid',
    'fbclid',
    'ttclid',
    'msclkid',
    'fbp',
    'fbc',
    'ga_client_id',
    'ga_session_id',
    'landing_page',
    'referrer',
    'page_url',
    'user_agent',
  ];

  return allowedKeys
    .map((key) => ({ name: `tracking_${key}`, value: asString(tracking[key]).slice(0, 255) }))
    .filter((attribute) => attribute.value);
}

export function buildShippingNoteAttributes(body: CheckoutPayload) {
  const shipping = body.shipping || {};
  const isInternational = isInternationalCheckout(body);
  const deliveryMethod = asString(shipping.delivery_method);
  const shippingPrice = 0;

  if (isInternational) {
    return [
      { name: 'delivery_type', value: 'international' },
      { name: 'delivery_price', value: shippingPrice ? String(shippingPrice) : '' },
      { name: 'delivery_country', value: asString(shipping.country) },
      { name: 'delivery_city', value: asString(shipping.intl_city) || asString(shipping.city) },
      { name: 'delivery_address', value: asString(shipping.address) },
      { name: 'delivery_apartment', value: asString(shipping.apartment) },
      { name: 'delivery_postcode', value: asString(shipping.postcode) },
    ].filter((attribute) => attribute.value);
  }

  return [
    { name: 'delivery_type', value: 'nova_poshta' },
    { name: 'nova_poshta_delivery_method', value: deliveryMethod || 'branch' },
    { name: 'nova_poshta_city', value: asString(shipping.city) },
    { name: 'nova_poshta_city_ref', value: asString(shipping.city_ref) },
    { name: 'nova_poshta_warehouse', value: asString(shipping.warehouse) },
    { name: 'nova_poshta_warehouse_ref', value: asString(shipping.warehouse_ref) },
    { name: 'nova_poshta_street', value: asString(shipping.street) },
    { name: 'nova_poshta_house', value: asString(shipping.house) },
    { name: 'nova_poshta_apartment', value: asString(shipping.apartment) },
  ].filter((attribute) => attribute.value);
}

export function buildShopifyOrderPayload(body: CheckoutPayload, paymentAmount: number) {
  const customer = body.customer || {};
  const paymentType = normalizePaymentTypeForShopify(body.payment_type);
  const cartTotal = getCartTotal(body);
  const lineItems = buildLineItems(body);
  const shippingPrice = 0;
  const orderNote = isInternationalCheckout(body)
    ? buildInternationalCheckoutComment(body)
    : asString(body.comment);

  if (lineItems.length === 0) throw new Error('Missing cart goods for Shopify order');

  const order: Record<string, unknown> = {
    email: asString(customer.email),
    phone: asString(customer.phone),
    financial_status: 'pending',
    currency: 'UAH',
    tax_exempt: true,
    taxes_included: false,
    send_receipt: false,
    send_fulfillment_receipt: false,
    inventory_behaviour: 'decrement_obeying_policy',
    note: orderNote,
    note_attributes: [
      { name: 'payment_type', value: paymentType },
      { name: 'shipping_type', value: asString(body.shipping_type) || 'ukraine' },
      { name: 'payment_status', value: 'unpaid' },
      { name: 'Сума', value: formatPaymentAttributeAmount(cartTotal) },
      { name: 'Сплата', value: '0' },
      { name: 'Paid amount', value: '0' },
      ...buildShippingNoteAttributes(body),
      ...buildLegacyIntegrationNoteAttributes(body, paymentAmount),
    ].filter((attribute) => attribute.value),
    shipping_address: buildShippingAddress(body),
    billing_address: buildShippingAddress(body),
    line_items: lineItems,
  };

  if (shippingPrice > 0) {
    order.shipping_lines = [
      {
        title: 'International delivery',
        price: shippingPrice.toFixed(2),
        code: 'international_delivery',
        source: 'custom_checkout',
        tax_lines: [],
      },
    ];
  }

  order.tags = getInitialPaymentTags(body.payment_type);

  return { order, paymentType, prepaymentDiscount: 0, cartTotal };
}

export async function createShopifyOrder(body: CheckoutPayload, paymentAmount: number): Promise<ShopifyRestOrder> {
  const payload = buildShopifyOrderPayload(body, paymentAmount);
  const data = await shopifyRequest<{ order?: ShopifyRestOrder }>('/orders.json', {
    method: 'POST',
    body: JSON.stringify({ order: payload.order }),
  });

  if (!data.order?.id) throw new Error('Shopify response missing order id');
  console.log('Shopify order created:', {
    id: data.order.id,
    name: data.order.name,
    financialStatus: data.order.financial_status,
    paymentType: payload.paymentType,
    prepaymentDiscount: payload.prepaymentDiscount,
  });
  return data.order;
}

export function buildOrderUpdateAfterPayment(
  orderId: number,
  amount: number,
  invoiceId: string,
  paymentType: PaymentType,
  existingNoteAttributes: Array<{ name?: string; value?: string }> = [],
  existingTags: unknown = '',
) {
  const isPrepayment = paymentType === 'prepayment';
  const normalizedPaymentType = normalizePaymentTypeForShopify(paymentType);
  const paidAmount = formatPaymentAttributeAmount(amount);
  const paymentStatus = isPrepayment ? 'partially_paid' : 'paid';
  const paidPaymentTag = getPaidPaymentTag(paymentType);
  const paymentLabel = isPrepayment
    ? 'Передплата Monobank'
    : paymentType === 'installments'
      ? 'Покупка частинами Monobank'
      : 'Monobank';
  const noteAttributeByName = new Map<string, string>();

  for (const attribute of existingNoteAttributes) {
    const name = asString(attribute.name);
    const value = asString(attribute.value);
    if (name && value) noteAttributeByName.set(name, value);
  }

  noteAttributeByName.set('payment_type', normalizedPaymentType);
  noteAttributeByName.set('payment_status', paymentStatus);
  noteAttributeByName.set('payment_tag', paidPaymentTag);
  noteAttributeByName.set('Payment tag', paidPaymentTag);
  noteAttributeByName.set('Payment status tag', paidPaymentTag);
  noteAttributeByName.set('Payment', paymentLabel);
  noteAttributeByName.set('Сплата', paidAmount);
  noteAttributeByName.set('Paid amount', paidAmount);
  noteAttributeByName.set('monobank_paid_amount', paidAmount);
  if (env.sitniksSettlementAccountId > 0) {
    noteAttributeByName.set('payment_account_id', String(env.sitniksSettlementAccountId));
    noteAttributeByName.set('settlement_account_id', String(env.sitniksSettlementAccountId));
  }
  if (env.sitniksSettlementAccountTitle) {
    noteAttributeByName.set('Payment account', env.sitniksSettlementAccountTitle);
    noteAttributeByName.set('Settlement Account', env.sitniksSettlementAccountTitle);
  }
  if (invoiceId) noteAttributeByName.set('monobank_invoice_id', invoiceId);
  if (!noteAttributeByName.has('Сума') && !isPrepayment) {
    noteAttributeByName.set('Сума', paidAmount);
  }

  const orderUpdate: Record<string, unknown> = {
    id: orderId,
    tags: withPaymentStatusTag(existingTags, paidPaymentTag),
    note_attributes: Array.from(noteAttributeByName.entries()).map(([name, value]) => ({ name, value })),
  };

  if (isPrepayment) {
    orderUpdate.financial_status = 'partially_paid';
  } else {
    orderUpdate.financial_status = 'paid';
  }

  return orderUpdate;
}

export async function updateShopifyOrderAfterPayment(
  orderId: number,
  amount: number,
  invoiceId: string,
  paymentType: PaymentType,
): Promise<ShopifyRestOrder | undefined> {
  const currentOrder = await getShopifyOrder(String(orderId)).catch((error) => {
    console.error('Failed to load current Shopify order before payment update:', error);
    return undefined;
  });

  try {
    const transaction = await shopifyRequest<{ transaction?: { id?: number; status?: string; kind?: string } }>(
      `/orders/${orderId}/transactions.json`,
      {
        method: 'POST',
        body: JSON.stringify({
          transaction: {
            kind: 'sale',
            status: 'success',
            amount: Number(amount).toFixed(2),
            currency: 'UAH',
            gateway: paymentType === 'installments' ? 'monobank_parts' : 'monobank',
            source: 'external',
            authorization: asString(invoiceId),
          },
        }),
      },
    );
    console.log('Shopify external payment transaction created:', {
      orderId,
      transactionId: transaction.transaction?.id,
      status: transaction.transaction?.status,
      kind: transaction.transaction?.kind,
      amount,
    });
  } catch (error) {
    console.error('Failed to create Shopify external payment transaction, trying order status update:', error);
  }

  const data = await shopifyRequest<{ order?: ShopifyRestOrder }>(`/orders/${orderId}.json`, {
    method: 'PUT',
    body: JSON.stringify({
      order: buildOrderUpdateAfterPayment(
        orderId,
        amount,
        invoiceId,
        paymentType,
        currentOrder?.note_attributes as Array<{ name?: string; value?: string }> | undefined,
        currentOrder?.tags,
      ),
    }),
  });

  console.log('Shopify order updated after payment:', {
    orderId,
    expectedFinancialStatus: paymentType === 'prepayment' ? 'partially_paid' : 'paid',
    financialStatus: data.order?.financial_status,
    amount,
    invoiceId,
  });

  return data.order;
}

export async function getShopifyOrder(orderId: string): Promise<ShopifyOrder> {
  const data = await shopifyRequest<{ order?: ShopifyOrder }>(`/orders/${orderId}.json`, { method: 'GET' });
  if (!data.order) throw new Error(`Order with ID ${orderId} not found`);
  return data.order;
}

export async function updateShopifyOrderStatus(orderId: number): Promise<ShopifyRestOrder | undefined> {
  return updateShopifyOrderAfterPayment(orderId, 0, '', 'full');
}
