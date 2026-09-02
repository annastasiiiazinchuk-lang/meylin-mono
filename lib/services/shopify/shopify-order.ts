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
}

type ShopifyGraphqlUserError = {
  field?: string[];
  message: string;
};

type ShopifyGraphqlResponse<T> = {
  data?: T;
  errors?: { message: string }[];
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

async function shopifyGraphqlRequest<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const accessToken = await getShopifyAccessToken();
  const response = await fetch(shopifyUrl('/graphql.json'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Shopify GraphQL error ${response.status}: ${text}`);

  const parsed = parseJsonObject<ShopifyGraphqlResponse<T>>(text, 'Shopify GraphQL');
  if (parsed.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${parsed.errors.map((error) => error.message).join('; ')}`);
  }
  if (!parsed.data) throw new Error('Shopify GraphQL response missing data');
  return parsed.data;
}

function throwOnUserErrors(action: string, userErrors?: ShopifyGraphqlUserError[]) {
  if (userErrors?.length) {
    throw new Error(`${action}: ${userErrors.map((error) => error.message).join('; ')}`);
  }
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
  const isInternational = body.shipping_type === 'international' || shipping.type === 'international';
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
    const lineItem: Record<string, unknown> = { quantity };

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
  const isInternational = body.shipping_type === 'international' || shipping.type === 'international';
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
    { name: 'nova_poshta_warehouse', value: asString(shipping.warehouse) },
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
    note: asString(body.comment),
    note_attributes: [
      { name: 'payment_type', value: paymentType },
      { name: 'shipping_type', value: asString(body.shipping_type) || 'ukraine' },
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

  if (paymentType === 'prepayment_300') order.tags = 'not_paid_300';

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
) {
  const isPrepayment = paymentType === 'prepayment';
  const normalizedPaymentType = normalizePaymentTypeForShopify(paymentType);
  const noteAttributeByName = new Map<string, string>();

  for (const attribute of existingNoteAttributes) {
    const name = asString(attribute.name);
    const value = asString(attribute.value);
    if (name && value) noteAttributeByName.set(name, value);
  }

  noteAttributeByName.set('payment_type', normalizedPaymentType);

  const orderUpdate: Record<string, unknown> = {
    id: orderId,
    note_attributes: Array.from(noteAttributeByName.entries()).map(([name, value]) => ({ name, value })),
  };

  if (isPrepayment) {
    orderUpdate.tags = 'prepayment_300_paid';
  } else {
    orderUpdate.financial_status = 'paid';
  }

  return orderUpdate;
}

async function applyPaidPrepaymentDiscount(orderId: number, amount: number): Promise<void> {
  if (Math.round(amount) !== PREPAYMENT_AMOUNT) {
    console.log('Skipping prepayment discount because paid amount is not exactly prepayment amount:', {
      orderId,
      amount,
      expectedAmount: PREPAYMENT_AMOUNT,
    });
    return;
  }

  const orderGid = `gid://shopify/Order/${orderId}`;
  const beginData = await shopifyGraphqlRequest<{
    orderEditBegin: {
      calculatedOrder?: {
        id: string;
        lineItems: {
          edges: Array<{ node: { id: string; quantity: number } }>;
        };
      };
      userErrors: ShopifyGraphqlUserError[];
    };
  }>(
    `mutation BeginOrderEdit($id: ID!) {
      orderEditBegin(id: $id) {
        calculatedOrder {
          id
          lineItems(first: 50) {
            edges {
              node {
                id
                quantity
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { id: orderGid },
  );

  throwOnUserErrors('Shopify order edit begin failed', beginData.orderEditBegin.userErrors);
  const calculatedOrder = beginData.orderEditBegin.calculatedOrder;
  const firstLineItemId = calculatedOrder?.lineItems.edges[0]?.node.id;
  if (!calculatedOrder?.id || !firstLineItemId) {
    throw new Error(`Shopify order edit failed: order ${orderId} has no editable line items`);
  }

  const discountData = await shopifyGraphqlRequest<{
    orderEditAddLineItemDiscount: {
      calculatedLineItem?: { id: string };
      userErrors: ShopifyGraphqlUserError[];
    };
  }>(
    `mutation AddPrepaymentDiscount($id: ID!, $lineItemId: ID!, $discount: OrderEditAppliedDiscountInput!) {
      orderEditAddLineItemDiscount(id: $id, lineItemId: $lineItemId, discount: $discount) {
        calculatedLineItem {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    {
      id: calculatedOrder.id,
      lineItemId: firstLineItemId,
      discount: {
        fixedValue: {
          amount: PREPAYMENT_AMOUNT.toFixed(2),
          currencyCode: 'UAH',
        },
        description: 'prepayment_300_paid',
      },
    },
  );

  throwOnUserErrors(
    'Shopify prepayment discount failed',
    discountData.orderEditAddLineItemDiscount.userErrors,
  );

  const commitData = await shopifyGraphqlRequest<{
    orderEditCommit: {
      order?: { id: string };
      userErrors: ShopifyGraphqlUserError[];
    };
  }>(
    `mutation CommitOrderEdit($id: ID!) {
      orderEditCommit(id: $id, notifyCustomer: false, staffNote: "Prepayment 300 UAH paid via monobank") {
        order {
          id
        }
        userErrors {
          field
          message
        }
      }
    }`,
    { id: calculatedOrder.id },
  );

  throwOnUserErrors('Shopify order edit commit failed', commitData.orderEditCommit.userErrors);
  console.log('Shopify prepayment discount applied through order edit:', {
    orderId,
    amount: PREPAYMENT_AMOUNT,
  });
}

export async function updateShopifyOrderAfterPayment(
  orderId: number,
  amount: number,
  invoiceId: string,
  paymentType: PaymentType,
): Promise<ShopifyRestOrder | undefined> {
  const isPrepayment = paymentType === 'prepayment';
  const currentOrder = await getShopifyOrder(String(orderId)).catch((error) => {
    console.error('Failed to load current Shopify order before payment update:', error);
    return undefined;
  });

  if (!isPrepayment) {
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
  } else {
    console.log('Prepayment received: Shopify financial status will stay unchanged.');
  }

  if (isPrepayment) {
    await applyPaidPrepaymentDiscount(orderId, amount);
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
      ),
    }),
  });

  console.log('Shopify order updated after payment:', {
    orderId,
    expectedFinancialStatus: isPrepayment ? 'unchanged' : 'paid',
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
