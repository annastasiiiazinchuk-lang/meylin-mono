import { env } from '../config/env';
import { redirect, text } from '../http/responses';
import {
  createShopifyAuthUrl,
  exchangeShopifyCode,
  verifyShopifyHmac,
} from '../services/shopify/shopify-auth';
import { asString, isValidShopDomain } from '../utils/format';

export async function handleShopifyAuth(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const shop = asString(url.searchParams.get('shop')) || env.shopifyStoreDomain;
    if (!isValidShopDomain(shop)) throw new Error('Shop must look like your-store.myshopify.com');

    const auth = createShopifyAuthUrl(shop);
    console.log('Starting Shopify OAuth:', {
      shop,
      clientId: env.shopifyClientId,
      redirectUrl: auth.url,
    });

    return redirect(auth.url, {
      'Set-Cookie': `shopify_oauth_state=${auth.state}; HttpOnly; SameSite=Lax; Path=/`,
    });
  } catch (error) {
    return text(error instanceof Error ? error.message : String(error), 500);
  }
}

export async function handleShopifyAuthCallback(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (!verifyShopifyHmac(url.searchParams)) throw new Error('Invalid Shopify HMAC');

    const shop = asString(url.searchParams.get('shop'));
    const code = asString(url.searchParams.get('code'));
    const result = await exchangeShopifyCode(shop, code);
    console.log('Shopify token received:', {
      shop,
      scopes: result.scope,
      tokenReady: Boolean(result.accessToken),
    });

    return text('Shopify token отримано. Можна повертатися до checkout тесту.');
  } catch (error) {
    console.error(error);
    return text(error instanceof Error ? error.message : String(error), 500);
  }
}
