/**
 * AuthStorage - Secure token and user persistence
 * Uses expo-secure-store for encrypted storage
 * Falls back to AsyncStorage on simulator without keychain entitlements
 */

import * as SecureStore from 'expo-secure-store';
import type { User } from './auth-types';

// In-memory fallback when SecureStore is unavailable (unsigned simulator builds)
let useMemoryFallback = false;
const memoryStore: Record<string, string> = {};

export class AuthStorage {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly USER_KEY = 'auth_user';
  private static readonly EXPIRES_KEY = 'auth_expires';
  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAY_MS = 500;

  private static async getItem(key: string): Promise<string | null> {
    if (useMemoryFallback) {
      return memoryStore[key] ?? null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      console.warn('[AuthStorage] SecureStore unavailable, using in-memory fallback');
      useMemoryFallback = true;
      return memoryStore[key] ?? null;
    }
  }

  private static async setItem(key: string, value: string): Promise<void> {
    if (useMemoryFallback) {
      memoryStore[key] = value;
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      console.warn('[AuthStorage] SecureStore unavailable, using in-memory fallback');
      useMemoryFallback = true;
      memoryStore[key] = value;
    }
  }

  private static async deleteItem(key: string): Promise<void> {
    if (useMemoryFallback) {
      delete memoryStore[key];
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      useMemoryFallback = true;
      delete memoryStore[key];
    }
  }

  private static async retryGetItem(key: string): Promise<string | null> {
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.getItem(key);
      } catch (error) {
        if (attempt < this.MAX_RETRIES) {
          console.warn(`[AuthStorage] Keychain read failed (attempt ${attempt + 1}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
        } else {
          throw error;
        }
      }
    }
    return null;
  }

  /**
   * Save authentication data securely
   */
  static async saveAuth(token: string, user: User, expiresAt: Date): Promise<void> {
    try {
      await this.setItem(this.TOKEN_KEY, token);
      await this.setItem(this.USER_KEY, JSON.stringify(user));
      await this.setItem(this.EXPIRES_KEY, expiresAt.toISOString());
    } catch (error) {
      console.error('[AuthStorage] Failed to save auth data:', error);
      throw new Error('Failed to save authentication data');
    }
  }

  /**
   * Retrieve JWT token
   */
  static async getToken(): Promise<string | null> {
    try {
      return await this.retryGetItem(this.TOKEN_KEY);
    } catch (error) {
      console.error('[AuthStorage] Failed to get token:', error);
      return null;
    }
  }

  /**
   * Retrieve user data
   */
  static async getUser(): Promise<User | null> {
    try {
      const userJson = await this.retryGetItem(this.USER_KEY);
      if (!userJson) return null;
      return JSON.parse(userJson) as User;
    } catch (error) {
      console.error('[AuthStorage] Failed to get user:', error);
      return null;
    }
  }

  /**
   * Retrieve expiry date
   */
  static async getExpiresAt(): Promise<Date | null> {
    try {
      const expiresAtStr = await this.retryGetItem(this.EXPIRES_KEY);
      if (!expiresAtStr) return null;
      return new Date(expiresAtStr);
    } catch (error) {
      console.error('[AuthStorage] Failed to get expiresAt:', error);
      return null;
    }
  }

  /**
   * Clear all authentication data
   */
  static async clearAuth(): Promise<void> {
    try {
      await this.deleteItem(this.TOKEN_KEY);
      await this.deleteItem(this.USER_KEY);
      await this.deleteItem(this.EXPIRES_KEY);
    } catch (error) {
      console.error('[AuthStorage] Failed to clear auth data:', error);
      throw new Error('Failed to clear authentication data');
    }
  }

  /**
   * Check if stored token is still valid
   */
  static async isTokenValid(): Promise<boolean> {
    try {
      const token = await this.getToken();
      const expiresAt = await this.getExpiresAt();

      if (!token || !expiresAt) {
        return false;
      }

      // Check if token has expired (with 5-minute buffer)
      const now = new Date();
      const expiryWithBuffer = new Date(expiresAt.getTime() - 5 * 60 * 1000);

      return now < expiryWithBuffer;
    } catch (error) {
      console.error('[AuthStorage] Failed to check token validity:', error);
      return false;
    }
  }

  /**
   * Restore full auth state from storage
   */
  static async restoreAuth(): Promise<{
    token: string;
    user: User;
    expiresAt: Date;
  } | null> {
    try {
      const token = await this.getToken();
      const user = await this.getUser();
      const expiresAt = await this.getExpiresAt();

      if (!token || !user || !expiresAt) {
        return null;
      }

      // Check validity
      const isValid = await this.isTokenValid();
      if (!isValid) {
        // Token expired, clear everything
        await this.clearAuth();
        return null;
      }

      return { token, user, expiresAt };
    } catch (error) {
      console.error('[AuthStorage] Failed to restore auth:', error);
      return null;
    }
  }
}
