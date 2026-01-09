/**
 * ConsentStorage - Persist consent records
 * Uses SecureStore for consistency with AuthStorage
 */

import * as SecureStore from 'expo-secure-store';
import type { ConsentRecord } from './consent-types';

export class ConsentStorage {
  private static readonly CONSENT_KEY = 'user_consent';

  /**
   * Save consent record
   */
  static async save(record: ConsentRecord): Promise<void> {
    try {
      await SecureStore.setItemAsync(this.CONSENT_KEY, JSON.stringify(record));
    } catch (error) {
      console.error('[ConsentStorage] Failed to save consent:', error);
      throw new Error('Failed to save consent record');
    }
  }

  /**
   * Retrieve consent record
   */
  static async get(): Promise<ConsentRecord | null> {
    try {
      const data = await SecureStore.getItemAsync(this.CONSENT_KEY);
      if (!data) return null;
      return JSON.parse(data) as ConsentRecord;
    } catch (error) {
      console.error('[ConsentStorage] Failed to get consent:', error);
      return null;
    }
  }

  /**
   * Clear consent record (used on sign out)
   */
  static async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.CONSENT_KEY);
    } catch (error) {
      console.error('[ConsentStorage] Failed to clear consent:', error);
    }
  }
}
