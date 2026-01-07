/**
 * Photon Geocoding Service
 *
 * Uses Photon API (hosted by Komoot) for location search.
 * Based on OpenStreetMap data - excellent coverage in Germany.
 * Free, no API key required, GDPR-friendly (German company).
 *
 * API docs: https://photon.komoot.io/
 */

export interface GeocodingResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  type?: string; // OSM type like "hospital", "clinic", etc.
}

export interface SearchOptions {
  /** User's current location for proximity bias */
  proximity?: {
    latitude: number;
    longitude: number;
  };
  /** Language for results (default: 'de' for German) */
  lang?: string;
}

/**
 * Healthcare-related OSM types to prioritize in search results
 * These will be sorted to the top of results
 */
const HEALTHCARE_TYPES = [
  'hospital',
  'clinic',
  'doctors',
  'pharmacy',
  'dentist',
  'nursing_home',
  'healthcare',
];

/**
 * Format address from Photon properties
 */
function formatAddress(props: {
  street?: string;
  housenumber?: string;
  city?: string;
  postcode?: string;
  country?: string;
  state?: string;
}): string {
  const parts: string[] = [];

  // Street + house number
  if (props.street) {
    parts.push(props.housenumber ? `${props.street} ${props.housenumber}` : props.street);
  }

  // Postcode + city
  if (props.city) {
    parts.push(props.postcode ? `${props.postcode} ${props.city}` : props.city);
  }

  // Country (if not Germany, since most users are German)
  if (props.country && props.country !== 'Germany' && props.country !== 'Deutschland') {
    parts.push(props.country);
  }

  return parts.join(', ') || 'Unknown address';
}

/**
 * Search for locations by query string
 * @param query - Search query (address, place name, hospital, etc.)
 * @param options - Optional search options (proximity bias, language)
 * @returns Array of geocoding results
 */
export async function searchLocations(
  query: string,
  options?: SearchOptions
): Promise<GeocodingResult[]> {
  if (!query.trim() || query.length < 3) {
    return [];
  }

  try {
    const encodedQuery = encodeURIComponent(query.trim());

    // Build Photon API URL
    let url = `https://photon.komoot.io/api/?q=${encodedQuery}&limit=5`;

    // Add language preference (German by default for better local results)
    url += `&lang=${options?.lang || 'de'}`;

    // Add proximity bias if user location is provided
    // location_bias_scale: 0.1 = weak, 0.2 = default, 1.0+ = strong
    if (options?.proximity) {
      url += `&lat=${options.proximity.latitude}&lon=${options.proximity.longitude}`;
      url += `&location_bias_scale=0.6`; // Moderate bias toward user's location
    }

    const response = await fetch(url);

    if (!response.ok) {
      console.error('[GeocodingService] Photon API error:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }

    const results = data.features.map((feature: any) => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates || [0, 0];

      return {
        // Create unique ID from coordinates
        id: `${coords[0].toFixed(6)}-${coords[1].toFixed(6)}`,
        // Use name, or street, or city as fallback
        name: props.name || props.street || props.city || 'Unknown',
        address: formatAddress(props),
        // Photon returns [longitude, latitude]
        latitude: coords[1],
        longitude: coords[0],
        // OSM type (hospital, clinic, etc.)
        type: props.osm_value,
      };
    });

    // Sort healthcare-related results to the top
    results.sort((a, b) => {
      const aIsHealthcare = HEALTHCARE_TYPES.includes(a.type || '');
      const bIsHealthcare = HEALTHCARE_TYPES.includes(b.type || '');
      if (aIsHealthcare && !bIsHealthcare) return -1;
      if (!aIsHealthcare && bIsHealthcare) return 1;
      return 0; // preserve original order otherwise
    });

    return results;
  } catch (error) {
    console.error('[GeocodingService] Search failed:', error);
    return [];
  }
}

/**
 * Check if geocoding is available
 * Photon is always available (no API key needed)
 */
export function isGeocodingAvailable(): boolean {
  return true;
}
