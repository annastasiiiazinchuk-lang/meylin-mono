import { jsonOrJsonp } from '../http/responses';
import { searchCities, searchWarehouses } from '../services/nova-poshta/client';
import { asString } from '../utils/format';

export async function handleNovaPoshtaCities(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') || '';
    const requestId = asString(url.searchParams.get('rid'));
    console.log(`Nova Poshta cities request: rid="${requestId}" query="${query}"`);
    return jsonOrJsonp(request, { cities: await searchCities(query) });
  } catch (error) {
    console.error('Nova Poshta cities error:', error);
    return jsonOrJsonp(request, {
      error: 'Failed to load Nova Poshta cities',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function handleNovaPoshtaWarehouses(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const city = asString(url.searchParams.get('city'));
    const cityRef = asString(url.searchParams.get('cityRef'));
    const query = asString(url.searchParams.get('query'));
    const requestId = asString(url.searchParams.get('rid'));
    console.log(`Nova Poshta warehouses request: rid="${requestId}" city="${city}" cityRef="${cityRef}" query="${query}"`);
    return jsonOrJsonp(request, { warehouses: await searchWarehouses({ city, cityRef, query }) });
  } catch (error) {
    console.error('Nova Poshta warehouses error:', error);
    return jsonOrJsonp(request, {
      error: 'Failed to load Nova Poshta warehouses',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}
