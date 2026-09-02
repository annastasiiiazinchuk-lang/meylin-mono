import { env } from '../config/env';
import { html, json, noContent } from '../http/responses';
import { shopifyRequest } from '../services/shopify/shopify-order';
import { asString } from '../utils/format';

export async function handleFrontendDebugLog(request: Request): Promise<Response> {
  const url = new URL(request.url);
  console.log('FRONTEND DEBUG:', {
    stage: asString(url.searchParams.get('stage')),
    requestId: asString(url.searchParams.get('rid')),
    message: asString(url.searchParams.get('message')),
    value: asString(url.searchParams.get('value')),
    ua: asString(request.headers.get('user-agent')).slice(0, 100),
  });
  return noContent({ 'Cache-Control': 'no-store' });
}

function isAuthorizedDebugRequest(request: Request): boolean {
  const auth = asString(request.headers.get('authorization'));
  const token = auth.replace(/^Bearer\s+/i, '');
  return Boolean(env.shopifyClientSecret && token === env.shopifyClientSecret);
}

function summarizeShopifyOrder(order: Record<string, unknown>) {
  const customer = (order.customer || {}) as Record<string, unknown>;
  const shippingAddress = (order.shipping_address || {}) as Record<string, unknown>;
  const billingAddress = (order.billing_address || {}) as Record<string, unknown>;
  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  const noteAttributes = Array.isArray(order.note_attributes) ? order.note_attributes : [];
  const shippingLines = Array.isArray(order.shipping_lines) ? order.shipping_lines : [];
  const transactions = Array.isArray(order.transactions) ? order.transactions : [];

  return {
    id: order.id,
    name: order.name,
    orderNumber: order.order_number,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    processedAt: order.processed_at,
    sourceName: order.source_name,
    sourceIdentifier: order.source_identifier,
    referringSite: order.referring_site,
    landingSite: order.landing_site,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
    tags: order.tags,
    totalPrice: order.total_price,
    subtotalPrice: order.subtotal_price,
    totalDiscounts: order.total_discounts,
    totalTax: order.total_tax,
    currency: order.currency,
    email: order.email,
    phone: order.phone,
    customer: {
      id: customer.id,
      email: customer.email,
      phone: customer.phone,
      firstName: customer.first_name,
      lastName: customer.last_name,
    },
    shippingAddress: {
      firstName: shippingAddress.first_name,
      lastName: shippingAddress.last_name,
      phone: shippingAddress.phone,
      address1: shippingAddress.address1,
      address2: shippingAddress.address2,
      city: shippingAddress.city,
      province: shippingAddress.province,
      country: shippingAddress.country,
      zip: shippingAddress.zip,
    },
    billingAddress: {
      firstName: billingAddress.first_name,
      lastName: billingAddress.last_name,
      phone: billingAddress.phone,
      address1: billingAddress.address1,
      address2: billingAddress.address2,
      city: billingAddress.city,
      province: billingAddress.province,
      country: billingAddress.country,
      zip: billingAddress.zip,
    },
    note: order.note,
    noteAttributes,
    shippingLines,
    lineItems: lineItems.map((item) => {
      const lineItem = item as Record<string, unknown>;
      return {
        id: lineItem.id,
        productId: lineItem.product_id,
        variantId: lineItem.variant_id,
        title: lineItem.title,
        variantTitle: lineItem.variant_title,
        sku: lineItem.sku,
        vendor: lineItem.vendor,
        quantity: lineItem.quantity,
        price: lineItem.price,
        totalDiscount: lineItem.total_discount,
        fulfillmentStatus: lineItem.fulfillment_status,
      };
    }),
    transactions: transactions.map((transaction) => {
      const row = transaction as Record<string, unknown>;
      return {
        id: row.id,
        kind: row.kind,
        status: row.status,
        amount: row.amount,
        gateway: row.gateway,
        sourceName: row.source_name,
        processedAt: row.processed_at,
      };
    }),
  };
}

export async function handleShopifyOrderDebug(request: Request): Promise<Response> {
  if (!isAuthorizedDebugRequest(request)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const url = new URL(request.url);
  const id = asString(url.searchParams.get('id'));
  const name = asString(url.searchParams.get('name')).replace(/^#/, '');

  if (!id && !name) {
    return json({ error: 'Pass ?id=SHOPIFY_ORDER_ID or ?name=1041' }, 400);
  }

  if (id) {
    const data = await shopifyRequest<{ order?: Record<string, unknown> }>(
      `/orders/${encodeURIComponent(id)}.json?status=any`,
      { method: 'GET' },
    );
    if (!data.order) return json({ error: 'Order not found' }, 404);
    return json({ order: summarizeShopifyOrder(data.order) }, 200, { 'Cache-Control': 'no-store' });
  }

  const data = await shopifyRequest<{ orders?: Array<Record<string, unknown>> }>(
    `/orders.json?status=any&name=${encodeURIComponent(`#${name}`)}&limit=5`,
    { method: 'GET' },
  );
  const orders = data.orders || [];
  return json({
    count: orders.length,
    orders: orders.map(summarizeShopifyOrder),
  }, 200, { 'Cache-Control': 'no-store' });
}

export async function handleNovaPoshtaDebugPage(): Promise<Response> {
  return html(`<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nova Poshta phone test</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 24px; color: #1f2933; }
    input, button { width: 100%; font-size: 18px; padding: 14px; margin: 8px 0; border-radius: 10px; border: 1px solid #ccd4dd; }
    button { background: #3B6D11; color: #fff; border: 0; font-weight: 700; }
    pre { white-space: pre-wrap; background: #f6f8fa; padding: 12px; border-radius: 10px; font-size: 14px; }
    .item { padding: 10px; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <h1>Nova Poshta phone test</h1>
  <p>Це тест напряму з бекенду, без Shopify.</p>
  <input id="query" value="Бро" autocomplete="off">
  <button id="run">Перевірити міста</button>
  <pre id="log">Готово до тесту</pre>
  <div id="results"></div>
  <script>
    const log = document.querySelector('#log');
    const results = document.querySelector('#results');
    const input = document.querySelector('#query');
    const write = (message) => { log.textContent += '\\n' + new Date().toLocaleTimeString('uk-UA') + ' ' + message; };
    async function runTest() {
      const query = input.value.trim();
      results.innerHTML = '';
      log.textContent = 'Start: ' + query + '\\nUA: ' + navigator.userAgent;
      try {
        const url = '/api/np/cities?query=' + encodeURIComponent(query) + '&rid=phone-debug-' + Date.now();
        write('fetch ' + url);
        const response = await fetch(url, { headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' } });
        write('status ' + response.status);
        const text = await response.text();
        write('body starts: ' + text.slice(0, 120));
        const data = text ? JSON.parse(text) : {};
        write('cities count ' + ((data.cities || []).length));
        results.innerHTML = (data.cities || []).map((city) => '<div class="item"><b>' + city.name + '</b><br>' + city.area + ' / ' + city.settlementType + '</div>').join('');
      } catch (error) {
        write('ERROR: ' + (error && error.message ? error.message : String(error)));
      }
    }
    document.querySelector('#run').addEventListener('click', runTest);
    runTest();
  </script>
</body>
</html>`);
}
