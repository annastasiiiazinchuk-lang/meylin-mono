import { env } from '../config/env';
import { json } from '../http/responses';
import { prisma } from '../prisma';
import { hasShopifyToken } from '../services/shopify/shopify-auth';

export async function handleHealth(): Promise<Response> {
  let shopifyTokenReady = false;
  let shopifyTokenError: string | undefined;

  try {
    shopifyTokenReady = await hasShopifyToken();
  } catch (error) {
    shopifyTokenError = error instanceof Error ? error.message : String(error);
  }

  return json({
    status: 'ok',
    mode: 'refactored-server',
    shopifyTokenReady,
    ...(shopifyTokenError ? { shopifyTokenError } : {}),
    novaPoshtaReady: Boolean(env.novaPoshtaApiKey),
    metaReady: Boolean(env.metaPixelId && env.metaAccessToken),
    ga4ServerReady: Boolean(env.ga4MeasurementId && env.ga4ApiSecret),
    sitniksReady: Boolean(env.sitniksApiToken),
    monobankPartsReady: Boolean(env.monoPartsEnabled && env.monoPartsStoreId && env.monoPartsSecret),
  });
}

export async function handleHealthDb(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    return json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, 503);
  }
}
