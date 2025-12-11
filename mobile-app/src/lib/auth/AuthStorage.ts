/**
 * AuthStorage - Secure token and user persistence
 * Uses expo-secure-store for encrypted storage
 */

import * as SecureStore from 'expo-secure-store';
import type { User } from './auth-types';

export class AuthStorage {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly USER_KEY = 'auth_user';
  private static readonly EXPIRES_KEY = 'auth_expires';

  /**
   * Save authentication data securely
   */
  static async saveAuth(token: string, user: User, expiresAt: Date): Promise<void> {
    try {
      await SecureStore.setItemAsync(this.TOKEN_KEY, token);
      await SecureStore.setItemAsync(this.USER_KEY, JSON.stringify(user));
      await SecureStore.setItemAsync(this.EXPIRES_KEY, expiresAt.toISOString());
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
      return await SecureStore.getItemAsync(this.TOKEN_KEY);
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
      const userJson = await SecureStore.getItemAsync(this.USER_KEY);
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
      const expiresAtStr = await SecureStore.getItemAsync(this.EXPIRES_KEY);
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
      await SecureStore.deleteItemAsync(this.TOKEN_KEY);
      await SecureStore.deleteItemAsync(this.USER_KEY);
      await SecureStore.deleteItemAsync(this.EXPIRES_KEY);
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
