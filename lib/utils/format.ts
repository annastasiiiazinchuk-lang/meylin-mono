import crypto from 'node:crypto';

export function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeSearchText(value: unknown): string {
  const text = asString(value);
  if (!text) return '';
  return text.charAt(0).toLocaleUpperCase('uk-UA') + text.slice(1);
}

export function sha256(value: unknown): string {
  const text = asString(value).trim().toLowerCase();
  if (!text) return '';
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

export function parseJsonObject<T = Record<string, unknown>>(text: string, source: string): T {
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${source} returned invalid JSON: ${text.slice(0, 200)}`);
  }
}
