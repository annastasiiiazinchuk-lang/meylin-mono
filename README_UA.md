# Meylin-mono

Повний backend для Render у стилі Мірт: Shopify checkout -> Shopify order -> Monobank invoice / Monobank Частинами -> PostgreSQL mapping -> webhooks -> Sitniks CRM -> optional Meta Conversions API.

## Що всередині

- `render.yaml` створює web service `meylin-mono` і PostgreSQL `meylin-mono-db`.
- `Dockerfile` збирає Bun backend і запускає Prisma migrations перед стартом.
- `/api/health` перевіряє конфіг.
- `/api/health/db` перевіряє базу.
- `/auth` і `/auth/callback` роблять Shopify OAuth.
- `/api/orders/create-invoice` створює Shopify order, Monobank payment і Sitniks order.
- `/api/webhooks/monobank` синхронізує оплату назад у Shopify і Sitniks.
- `/api/webhooks/monobank-parts` обробляє Monobank Частинами.
- `/api/np/cities` і `/api/np/warehouses` проксать Nova Poshta.

## Підключення з нуля

1. Створи новий GitHub repo для `Meylin-mono`.
2. У цій папці виконай:

```bash
git init
git add .
git commit -m "Initial Meylin mono backend"
git branch -M main
git remote add origin https://github.com/USER/REPO.git
git push -u origin main
```

3. У Render відкрий `New` -> `Blueprint`.
4. Обери GitHub repo.
5. Branch: `main`.
6. Blueprint path: `render.yaml`.
7. Натисни `Deploy Blueprint`.

Render сам створить backend і базу. `DATABASE_URL` підставиться автоматично з `meylin-mono-db`.

## Render env

Обов'язково заповнити в Render:

```env
MONO_TOKEN=
WEBHOOK_URL=https://meylin-mono.onrender.com/api/webhooks/monobank
REDIRECT_URL=https://твій-shopify-домен/pages/thank-you
SHOPIFY_STORE_DOMAIN=твій-магазин.myshopify.com
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
NOVA_POSHTA_API_KEY=
SITNIKS_API_TOKEN=
SITNIKS_STATUS_ID=
SITNIKS_PAID_STATUS_ID=
SITNIKS_PREPAYMENT_PAID_STATUS_ID=
SITNIKS_SALES_CHANNEL_ID=
SITNIKS_SETTLEMENT_ACCOUNT_ID=
SITNIKS_WAREHOUSE_ID=
SITNIKS_NOVA_POSHTA_INTEGRATION_ID=
```

Для чеків через Sitniks/Checkbox:

```env
SITNIKS_CASH_REGISTER_ID=
SITNIKS_RECEIPTS_ENABLED=true
SITNIKS_RECEIPT_PAYMENT_TYPE=prepayment
```

Для автосписання товарів:

```env
SITNIKS_OFFER_MAP={"SHOPIFY_SKU":{"itemId":123,"itemType":"variation"}}
```

Для Monobank Частинами:

```env
MONO_PARTS_ENABLED=true
MONO_PARTS_STORE_ID=
MONO_PARTS_SECRET=
MONO_PARTS_RESULT_CALLBACK_URL=https://meylin-mono.onrender.com/api/webhooks/monobank-parts
MONO_PARTS_COUNTS=3
MONO_PARTS_POINT_ID=
MONO_PARTS_ADMIN_TOKEN=
```

Опційно:

```env
SHOPIFY_ADMIN_ACCESS_TOKEN=
META_PIXEL_ID=
META_ACCESS_TOKEN=
META_GRAPH_VERSION=v23.0
```

## Shopify app

У Shopify Dev Dashboard:

```text
Scopes: read_orders,write_orders,write_order_edits,read_products
Redirect URL: https://meylin-mono.onrender.com/auth/callback
```

Після деплою відкрий:

```text
https://meylin-mono.onrender.com/auth?shop=твій-магазин.myshopify.com
```

Якщо токен отримано, backend напише, що можна повертатися до checkout тесту.

## Shopify frontend

У `shopify-custom-checkout-monobank.js` постав:

```js
const API_BASE_URL = 'https://meylin-mono.onrender.com';
```

Потім встав оновлений checkout script/HTML у Shopify.

## Перевірка

```text
https://meylin-mono.onrender.com/api/health
https://meylin-mono.onrender.com/api/health/db
```

Після зміни env на Render роби redeploy.
