import { env } from './lib/config/env';
import { CORS_HEADERS, json, text } from './lib/http/responses';
import { handleFrontendDebugLog, handleNovaPoshtaDebugPage, handleShopifyOrderDebug } from './lib/routes/debug';
import { handleHealth, handleHealthDb } from './lib/routes/health';
import { handleMonobankPartsReject } from './lib/routes/monobank-parts';
import { handleNovaPoshtaCities, handleNovaPoshtaWarehouses } from './lib/routes/nova-poshta';
import { handleCreateInvoice, handlePaymentOptions } from './lib/routes/orders';
import { handleShopifyAuth, handleShopifyAuthCallback } from './lib/routes/shopify-auth';
import { handleMonobankPartsWebhook, handleMonobankWebhook } from './lib/routes/webhooks';

async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (method === 'GET' && pathname === '/') {
    return text('meylin-mono server');
  }
  if (method === 'GET' && pathname === '/api/health') {
    return handleHealth();
  }
  if (method === 'GET' && pathname === '/api/health/db') {
    return handleHealthDb();
  }
  if (method === 'GET' && pathname === '/api/debug/log') {
    return handleFrontendDebugLog(request);
  }
  if (method === 'GET' && pathname === '/api/debug/shopify-order') {
    return handleShopifyOrderDebug(request);
  }
  if (method === 'GET' && pathname === '/debug/np-test') {
    return handleNovaPoshtaDebugPage();
  }
  if (method === 'GET' && pathname === '/api/np/cities') {
    return handleNovaPoshtaCities(request);
  }
  if (method === 'GET' && pathname === '/api/np/warehouses') {
    return handleNovaPoshtaWarehouses(request);
  }
  if (method === 'GET' && pathname === '/auth') {
    return handleShopifyAuth(request);
  }
  if (method === 'GET' && pathname === '/auth/callback') {
    return handleShopifyAuthCallback(request);
  }
  if (method === 'POST' && pathname === '/api/orders/create-invoice') {
    return handleCreateInvoice(request);
  }
  if (method === 'GET' && pathname === '/api/payment-options') {
    return handlePaymentOptions();
  }
  if (method === 'POST' && pathname === '/api/monobank-parts/reject') {
    return handleMonobankPartsReject(request);
  }
  if (method === 'POST' && pathname === '/api/webhooks/monobank') {
    return handleMonobankWebhook(request);
  }
  if (method === 'POST' && pathname === '/api/webhooks/monobank-parts') {
    return handleMonobankPartsWebhook(request);
  }

  return json({ error: 'Not found' }, 404);
}

const server = Bun.serve({
  port: env.port,
  async fetch(request: Request) {
    const url = new URL(request.url);
    const startedAt = Date.now();
    console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname}`);

    try {
      const response = await route(request);
      console.log(
        `[${new Date().toISOString()}] ${request.method} ${url.pathname} ${response.status} ${Date.now() - startedAt}ms`,
      );
      return response;
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] ${request.method} ${url.pathname} ERROR ${Date.now() - startedAt}ms:`,
        error,
      );
      return json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      }, 500);
    }
  },
});

console.log(`Server is running on http://localhost:${server.port}`);
console.log(`Shopify store: ${env.shopifyStoreDomain || 'not configured'}`);
