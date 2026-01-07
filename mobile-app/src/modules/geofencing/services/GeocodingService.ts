/**
 * Mapbox Geocoding Service
 *
 * Uses Mapbox Geocoding API to search for locations by address.
 * Free tier: 100k requests/month
 */

// Note: Store this in .env file as EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

export interface GeocodingResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

export interface SearchOptions {
  /** User's current location for proximity bias */
  proximity?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Search for locations by query string
 * @param query - Search query (address, place name, etc.)
 * @param options - Optional search options (proximity bias)
 * @returns Array of geocoding results
 */
export async function searchLocations(
  query: string,
  options?: SearchOptions
): Promise<GeocodingResult[]> {
  if (!query.trim() || query.length < 3) {
    return [];
  }

  // If no API key configured, return empty (fallback to manual placement)
  if (!MAPBOX_ACCESS_TOKEN) {
    console.warn('[GeocodingService] No Mapbox access token configured');
    return [];
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim());

    // Build URL with broader types and optional proximity
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?` +
      `access_token=${MAPBOX_ACCESS_TOKEN}&` +
      `types=address,poi,place,locality,neighborhood&` +
      `limit=5`;

    // Add proximity bias if user location is provided
    if (options?.proximity) {
      url += `&proximity=${options.proximity.longitude},${options.proximity.latitude}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
      console.error('[GeocodingService] API error:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }

    return data.features.map((feature: any) => ({
      id: feature.id,
      name: feature.text || feature.place_name?.split(',')[0] || 'Unknown',
      address: feature.place_name || '',
      latitude: feature.center[1],
      longitude: feature.center[0],
    }));
  } catch (error) {
    console.error('[GeocodingService] Search failed:', error);
    return [];
  }
}

/**
 * Check if Mapbox is configured
 */
export function isGeocodingAvailable(): boolean {
  return !!MAPBOX_ACCESS_TOKEN;
}
