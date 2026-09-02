import crypto from 'node:crypto';
import querystring from 'node:querystring';
import { env, getPublicBaseUrl, SHOPIFY_SCOPES } from '../../config/env';
import { prisma } from '../../prisma';
import { isValidShopDomain, parseJsonObject } from '../../utils/format';

export interface ShopifyHmacDebug {
  ok: boolean;
  reason: 'ok' | 'missing_hmac' | 'missing_secret' | 'digest_mismatch';
  hmacLength: number;
  digestLength: number;
  hmacStart?: string;
  digestStart?: string;
  messageKeys: string[];
}

export function getShopifyHmacDebug(
  queryParams: URLSearchParams,
  secret = env.shopifyClientSecret,
): ShopifyHmacDebug {
  const hmac = queryParams.get('hmac');
  if (!hmac || !secret) {
    return {
      ok: false,
      reason: !hmac ? 'missing_hmac' : 'missing_secret',
      hmacLength: hmac ? hmac.length : 0,
      digestLength: 0,
      messageKeys: [],
    };
  }

  const params: Record<string, string> = {};
  for (const [key, value] of queryParams.entries()) {
    if (key !== 'hmac' && key !== 'signature') params[key] = value;
  }

  const messageKeys = Object.keys(params).sort();
  const message = querystring.stringify(
    messageKeys.reduce<Record<string, string>>((sortedParams, key) => {
      sortedParams[key] = params[key];
      return sortedParams;
    }, {}),
  );

  const digest = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  const ok = digest.length === hmac.length && crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  return {
    ok,
    reason: ok ? 'ok' : 'digest_mismatch',
    hmacLength: hmac.length,
    digestLength: digest.length,
    hmacStart: hmac.slice(0, 8),
    digestStart: digest.slice(0, 8),
    messageKeys,
  };
}

export function verifyShopifyHmac(queryParams: URLSearchParams): boolean {
  return getShopifyHmacDebug(queryParams).ok;
}

export function createShopifyAuthUrl(shop: string): { url: string; state: string } {
  if (!env.shopifyClientId || !env.shopifyClientSecret) {
    throw new Error('Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET');
  }
  if (!env.webhookUrl) throw new Error('Missing WEBHOOK_URL');
  if (!isValidShopDomain(shop)) throw new Error('Shop must look like your-store.myshopify.com');

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `${getPublicBaseUrl()}/auth/callback`;
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set('client_id', env.shopifyClientId);
  authUrl.searchParams.set('scope', SHOPIFY_SCOPES);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);

  return { url: authUrl.toString(), state };
}

export async function exchangeShopifyCode(shop: string, code: string): Promise<{ accessToken: string; scope?: string }> {
  if (!env.shopifyClientId || !env.shopifyClientSecret) {
    throw new Error('Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET');
  }
  if (!isValidShopDomain(shop)) throw new Error('Invalid shop');
  if (!code) throw new Error('Missing code');

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.shopifyClientId,
      client_secret: env.shopifyClientSecret,
      code,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Shopify token exchange failed ${response.status}: ${text}`);
  }

  const data = parseJsonObject<{ access_token?: string; scope?: string }>(text, 'Shopify token exchange');
  if (!response.ok || !data.access_token) {
    throw new Error(`Shopify token exchange failed ${response.status}: ${text}`);
  }

  await saveShopifyToken(shop, data.access_token, data.scope);
  return { accessToken: data.access_token, scope: data.scope };
}

export async function saveShopifyToken(shop: string, accessToken: string, scope?: string): Promise<void> {
  await prisma.shopifyToken.upsert({
    where: { shop },
    create: { shop, accessToken, scope },
    update: { accessToken, scope },
  });
}

export async function getShopifyAccessToken(): Promise<string> {
  if (env.shopifyAdminAccessToken) return env.shopifyAdminAccessToken;

  const shop = env.shopifyStoreDomain;
  if (!shop) throw new Error('Missing SHOPIFY_STORE_DOMAIN');

  const token = await prisma.shopifyToken.findUnique({ where: { shop } });
  if (!token?.accessToken) {
    throw new Error('Missing Shopify Admin token. Open /auth?shop=your-store.myshopify.com first.');
  }

  return token.accessToken;
}

export async function hasShopifyToken(): Promise<boolean> {
  if (env.shopifyAdminAccessToken) return true;
  if (!env.shopifyStoreDomain) return false;
  const count = await prisma.shopifyToken.count({ where: { shop: env.shopifyStoreDomain } });
  return count > 0;
}

export function clearTokenCache(): void {
  // Kept for compatibility with old imports. Tokens now live in DB/env, not process memory.
}
