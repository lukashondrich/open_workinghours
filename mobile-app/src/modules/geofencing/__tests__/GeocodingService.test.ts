import { searchLocations } from '../services/GeocodingService';

describe('GeocodingService', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        features: [
          {
            properties: {
              name: 'Test Hospital',
              city: 'Berlin',
              country: 'Germany',
              osm_value: 'hospital',
            },
            geometry: {
              coordinates: [13.404954, 52.520008],
            },
          },
        ],
      }),
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rounds Photon proximity coordinates to 2 decimals', async () => {
    await searchLocations('Charite Berlin', {
      proximity: {
        latitude: 52.516275,
        longitude: 13.377704,
      },
      lang: 'de',
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url.searchParams.get('lat')).toBe('52.52');
    expect(url.searchParams.get('lon')).toBe('13.38');
  });
});
