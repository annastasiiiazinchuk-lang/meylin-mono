# Локальний запуск

Локально backend потребує Bun і PostgreSQL. Якщо не хочеш ставити PostgreSQL вручну, можна підняти його через `docker compose`.

## Варіант A: Docker compose

```bash
cp .env.example .env
docker compose up --build
```

Після запуску:

```text
http://localhost:3000/api/health
http://localhost:3000/api/health/db
```

## Варіант B: Bun напряму

```bash
bun install
bunx prisma migrate deploy
bunx prisma generate
bun run index.ts
```

## Tunnel

Для Shopify і Monobank локальний сервер треба відкрити назовні:

```bash
ngrok http 3000
```

або:

```bash
cloudflared tunnel --url http://localhost:3000
```

У `.env` постав:

```env
WEBHOOK_URL=https://твій-tunnel-url/api/webhooks/monobank
```

У Shopify Dev Dashboard redirect URL:

```text
https://твій-tunnel-url/auth/callback
```

У frontend:

```js
const API_BASE_URL = 'https://твій-tunnel-url';
```
