import { describe, expect, test } from 'bun:test';
import {
  mapNovaPoshtaCity,
  popularCitiesForQuery,
} from '../../lib/services/nova-poshta/client';

describe('Nova Poshta helpers', () => {
  test('maps Nova Poshta city response', () => {
    expect(mapNovaPoshtaCity({
      Ref: 'city-ref',
      Description: 'Київ',
      AreaDescription: 'Київська',
      SettlementTypeDescription: 'місто',
    })).toEqual({
      ref: 'city-ref',
      name: 'Київ',
      area: 'Київська',
      settlementType: 'місто',
    });
  });

  test('finds popular city by prefix', () => {
    expect(popularCitiesForQuery('Ки').map((city) => city.name)).toContain('Київ');
  });
});
