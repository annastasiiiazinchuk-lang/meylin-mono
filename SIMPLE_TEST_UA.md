# Найпростіший тест після рефакторингу

Актуальний backend тепер запускається з `index.ts`, а логіка розкладена по `lib/**`.
`simple-test-server.js` більше не використовується.

## Що потрібно

- Bun
- PostgreSQL або Render database
- ngrok / Cloudflare Tunnel для локального тесту
- Monobank merchant token
- Shopify app з Dev Dashboard
- Nova Poshta API key

## 1. Env

Створи `.env` на основі `.env.example`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/meylin_mono
MONO_TOKEN=твій_monobank_token
WEBHOOK_URL=https://abc-123.ngrok-free.app/api/webhooks/monobank
REDIRECT_URL=https://твій-meylin-магазин.myshopify.com
SHOPIFY_STORE_DOMAIN=твій-meylin-магазин.myshopify.com
SHOPIFY_CLIENT_ID=твій_client_id
SHOPIFY_CLIENT_SECRET=твій_client_secret
NOVA_POSHTA_API_KEY=твій_ключ_нової_пошти
NODE_ENV=development
PORT=3000
```

Для швидкого тесту можна також додати `SHOPIFY_ADMIN_ACCESS_TOKEN`.
Тоді OAuth через `/auth` не потрібен.

## 2. Міграції

```bash
bun install
bunx prisma migrate deploy
bunx prisma generate
```

## 3. Запуск

```bash
bun run index.ts
```

Сервер має відповісти:

```text
Server is running on http://localhost:3000
```

## 4. Shopify OAuth

Якщо `SHOPIFY_ADMIN_ACCESS_TOKEN` не заданий, відкрий:

```text
https://abc-123.ngrok-free.app/auth?shop=твій-meylin-магазин.myshopify.com
```

Після підтвердження має бути:

```text
Shopify token отримано. Можна повертатися до checkout тесту.
```

## 5. Health

```text
https://abc-123.ngrok-free.app/api/health
```

Очікувана відповідь:

```json
{"status":"ok","mode":"refactored-server","shopifyTokenReady":true,"novaPoshtaReady":true}
```

## 6. Shopify сторінка

У frontend-файлі `shopify-custom-checkout-monobank.js` вистав:

```js
const API_BASE_URL = 'https://abc-123.ngrok-free.app';
```

Не додавай `/api/orders/create-invoice`, frontend додає цей шлях сам.

## 7. Що має відбутися

- Backend створює Shopify order.
- Для передплати order створюється з `financial_status: pending` і тегом `not_paid_300`.
- Backend створює Monobank invoice.
- Після успішної оплати webhook знаходить payment у БД.
- Для передплати фінансовий статус не змінюється, тег стає `prepayment_300_paid`.
- Для повної оплати backend додає payment transaction і ставить order у `paid`.
