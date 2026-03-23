import Constants from 'expo-constants';
import type { Hospital } from '@/lib/taxonomy/types';

const BASE_URL = Constants.expoConfig?.extra?.authBaseUrl || 'http://localhost:8000';

export class TaxonomyService {
  /**
   * Search hospitals from the backend dataset.
   * GET /taxonomy/hospitals
   */
  static async searchHospitals(query?: string, state?: string, limit = 50): Promise<Hospital[]> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (state) params.set('state', state);
    params.set('limit', String(limit));

    try {
      const response = await fetch(`${BASE_URL}/taxonomy/hospitals?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to search hospitals');
      }
      return await response.json();
    } catch (error) {
      console.error('[TaxonomyService] Failed to search hospitals:', error);
      return [];
    }
  }
}
