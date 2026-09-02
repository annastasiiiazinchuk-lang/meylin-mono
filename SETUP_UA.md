# Shopify + Monobank: production setup

Backend приймає дані з кастомної Shopify checkout-сторінки, створює Shopify order, створює Monobank invoice і обробляє webhook після оплати.

## Що працює

- Повна оплата: після успішного webhook order переходить у `paid`.
- Передплата: order створюється з `pending` і тегом `not_paid_300`; після оплати 300 грн фінансовий статус не змінюється, тег стає `prepayment_300_paid`.
- Nova Poshta міста/відділення йдуть через backend.
- Payment mapping зберігається у PostgreSQL, тому webhook не губиться після рестарту.
- Shopify OAuth token зберігається у PostgreSQL або береться з `SHOPIFY_ADMIN_ACCESS_TOKEN`.

## 1. Render

Проєкт деплоїться як і зараз через `render.yaml`.

Render створює:

- web service `meylin-mono`
- PostgreSQL database `meylin-mono-db`

У web service додай env:

```env
MONO_TOKEN=...
WEBHOOK_URL=https://твій-render-домен.onrender.com/api/webhooks/monobank
REDIRECT_URL=https://твій-shopify-домен
SHOPIFY_STORE_DOMAIN=твій-meylin-магазин.myshopify.com
SHOPIFY_CLIENT_ID=...
SHOPIFY_CLIENT_SECRET=...
NOVA_POSHTA_API_KEY=...
```

Для Sitniks CRM:

```env
SITNIKS_API_BASE_URL=https://crm.sitniks.com
SITNIKS_API_TOKEN=...
SITNIKS_STATUS_ID=...
SITNIKS_PAID_STATUS_ID=...
SITNIKS_PREPAYMENT_PAID_STATUS_ID=...
SITNIKS_SALES_CHANNEL_ID=...
SITNIKS_SETTLEMENT_ACCOUNT_ID=...
SITNIKS_WAREHOUSE_ID=...
SITNIKS_NOVA_POSHTA_INTEGRATION_ID=...
SITNIKS_CASH_REGISTER_ID=...
SITNIKS_RECEIPTS_ENABLED=true
SITNIKS_RECEIPT_PAYMENT_TYPE=prepayment
SITNIKS_RECEIPT_VERIFY_ATTEMPTS=6
SITNIKS_RECEIPT_VERIFY_DELAY_MS=5000
SITNIKS_OFFER_MAP={"SHOPIFY_SKU":{"itemId":123,"itemType":"variation"}}
```

`SITNIKS_OFFER_MAP` потрібен для автосписання товарів: ключем може бути Shopify SKU або `variant_id`, а `itemId` має бути ID товару/варіації в Sitniks. `itemType` зазвичай `variation`, для комплектів - `suit`.

`SITNIKS_CASH_REGISTER_ID` - ID Checkbox/касової інтеграції з `GET /open-api/integrations/cash-register?type=checkbox`. Якщо `SITNIKS_RECEIPTS_ENABLED=true`, чек створюється через Sitniks тільки після успішної онлайн-оплати. `SITNIKS_RECEIPT_PAYMENT_TYPE` може бути `prepayment` або `afterpayment`; за замовчуванням використовується `prepayment`.

Опційно:

```env
SHOPIFY_ADMIN_ACCESS_TOKEN=...
META_PIXEL_ID=...
META_ACCESS_TOKEN=...
META_GRAPH_VERSION=v23.0
```

`DATABASE_URL` Render підставляє сам з бази.

## 2. Shopify app

У Shopify Dev Dashboard:

- scopes: `read_orders,write_orders,write_order_edits,read_products`
- redirect URL: `https://твій-render-домен.onrender.com/auth/callback`

Після деплою відкрий:

```text
https://твій-render-домен.onrender.com/auth?shop=твій-meylin-магазин.myshopify.com
```

Якщо все добре, побачиш:

```text
Shopify token отримано. Можна повертатися до checkout тесту.
```

## 3. Health

```text
https://твій-render-домен.onrender.com/api/health
https://твій-render-домен.onrender.com/api/health/db
```

## 4. Shopify frontend

У `shopify-custom-checkout-monobank.js` вистав:

```js
const API_BASE_URL = 'https://твій-render-домен.onrender.com';
```

Frontend має відправляти замовлення на:

```text
POST /api/orders/create-invoice
```

## 5. Важливо

Після зміни env на Render зроби redeploy.
Після зміни Shopify redirect URL потрібно заново пройти `/auth?...`, якщо токен ще не отриманий.
