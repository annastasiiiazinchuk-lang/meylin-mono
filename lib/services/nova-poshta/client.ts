import { env } from '../../config/env';
import { normalizeSearchText } from '../../utils/format';

const NOVA_POSHTA_TIMEOUT_MS = 12000;
const NOVA_POSHTA_CACHE_TTL_MS = 30 * 60 * 1000;

const cache = new Map<string, { data: unknown[]; createdAt: number }>();

export const POPULAR_NP_CITIES = [
  { ref: '8d5a980d-391c-11dd-90d9-001a92567626', name: 'Київ', area: 'Київська', settlementType: 'місто' },
  { ref: 'db5c88f5-391c-11dd-90d9-001a92567626', name: 'Львів', area: 'Львівська', settlementType: 'місто' },
  { ref: 'db5c88d0-391c-11dd-90d9-001a92567626', name: 'Одеса', area: 'Одеська', settlementType: 'місто' },
  { ref: 'db5c88f0-391c-11dd-90d9-001a92567626', name: 'Дніпро', area: 'Дніпропетровська', settlementType: 'місто' },
  { ref: 'db5c88e0-391c-11dd-90d9-001a92567626', name: 'Харків', area: 'Харківська', settlementType: 'місто' },
];

export function popularCitiesForQuery(query: string) {
  const normalized = query.trim().toLocaleLowerCase('uk-UA');
  return POPULAR_NP_CITIES.filter((city) => city.name.toLocaleLowerCase('uk-UA').startsWith(normalized));
}

export function mapNovaPoshtaCity(city: Record<string, unknown>) {
  return {
    ref: String(city.Ref || city.ref || ''),
    name: String(city.Description || city.name || ''),
    area: String(city.AreaDescription || city.area || ''),
    settlementType: String(city.SettlementTypeDescription || city.settlementType || ''),
  };
}

async function novaPoshtaRequest(modelName: string, calledMethod: string, methodProperties: Record<string, unknown>) {
  if (!env.novaPoshtaApiKey) throw new Error('Missing NOVA_POSHTA_API_KEY');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOVA_POSHTA_TIMEOUT_MS);

  const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    signal: controller.signal,
    body: JSON.stringify({
      apiKey: env.novaPoshtaApiKey,
      modelName,
      calledMethod,
      methodProperties,
    }),
  }).finally(() => clearTimeout(timeoutId));

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok || data.success === false) {
    const message = Array.isArray(data.errors) && data.errors.length > 0 ? data.errors.join('; ') : text;
    throw new Error(`Nova Poshta error: ${message}`);
  }

  return (data.data || []) as unknown[];
}

async function cachedNovaPoshtaRequest(
  cacheKey: string,
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, unknown>,
): Promise<unknown[]> {
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < NOVA_POSHTA_CACHE_TTL_MS) {
    console.log(`Nova Poshta cache hit: ${cacheKey}`);
    return cached.data;
  }

  const startedAt = Date.now();
  try {
    const data = await novaPoshtaRequest(modelName, calledMethod, methodProperties);
    cache.set(cacheKey, { data, createdAt: Date.now() });
    console.log(`Nova Poshta loaded: ${cacheKey} in ${Date.now() - startedAt}ms`);
    return data;
  } catch (error) {
    if (cached) {
      console.warn(`Nova Poshta timeout/error, returning stale cache for ${cacheKey}:`, error);
      return cached.data;
    }
    throw error;
  }
}

export async function searchCities(queryValue: unknown) {
  const query = normalizeSearchText(queryValue);
  if (query.length < 2) return [];

  const popularMatches = popularCitiesForQuery(query);
  if (popularMatches.length > 0) return popularMatches;

  const cities = await cachedNovaPoshtaRequest(`cities:${query.toLocaleLowerCase('uk-UA')}`, 'Address', 'getCities', {
    FindByString: query,
    Limit: '20',
  });

  return cities.map((city) => mapNovaPoshtaCity(city as Record<string, unknown>)).filter((city) => city.ref && city.name);
}

export async function searchWarehouses(params: { city?: string; cityRef?: string; query?: string }) {
  const city = normalizeSearchText(params.city);
  const cityRef = String(params.cityRef || '').trim();
  const query = normalizeSearchText(params.query);
  if (!city && !cityRef) return [];

  const warehouses = await cachedNovaPoshtaRequest(
    `warehouses:${cityRef || city}:${query}`,
    'AddressGeneral',
    'getWarehouses',
    {
      ...(cityRef ? { CityRef: cityRef } : { CityName: city }),
      ...(query ? { FindByString: query } : {}),
      Limit: '50',
    },
  );

  return warehouses.map((warehouse) => {
    const item = warehouse as Record<string, unknown>;
    return {
      ref: String(item.Ref || ''),
      name: String(item.Description || ''),
      number: item.Number,
      cityRef: item.CityRef,
    };
  });
}
