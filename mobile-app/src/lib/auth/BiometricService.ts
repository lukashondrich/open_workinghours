/**
 * BiometricService - Face ID / Touch ID authentication utilities
 *
 * Uses expo-local-authentication for native biometric authentication.
 * Biometric data never leaves the device - handled by iOS/Android at OS level.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';

export class BiometricService {
  /**
   * Check if device has biometric hardware (Face ID, Touch ID, fingerprint scanner)
   */
  static async isAvailable(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      return hasHardware;
    } catch (error) {
      console.error('[BiometricService] Failed to check hardware:', error);
      return false;
    }
  }

  /**
   * Check if user has enrolled biometrics (Face ID configured, fingerprint registered, etc.)
   */
  static async isEnrolled(): Promise<boolean> {
    try {
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return isEnrolled;
    } catch (error) {
      console.error('[BiometricService] Failed to check enrollment:', error);
      return false;
    }
  }

  /**
   * Get biometric type for display purposes
   * Returns localized string like "Face ID", "Touch ID", or "Biometrics"
   */
  static async getBiometricType(): Promise<string> {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        return 'Iris';
      }

      return 'Biometrics';
    } catch (error) {
      console.error('[BiometricService] Failed to get biometric type:', error);
      return 'Biometrics';
    }
  }

  /**
   * Prompt user to authenticate with biometrics
   *
   * @param reason - The reason shown to the user (e.g., "Unlock Open Working Hours")
   * @returns true if authentication succeeded, false otherwise
   */
  static async authenticate(reason?: string): Promise<boolean> {
    const prompt = reason || 'Authenticate to continue';

    try {
      // First attempt: biometric only (no passcode fallback)
      const biometricResult = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });

      if (biometricResult.success) {
        return true;
      }

      // User explicitly cancelled — don't show passcode
      if (biometricResult.error === 'user_cancel' || biometricResult.error === 'system_cancel') {
        console.log('[BiometricService] User cancelled biometric prompt');
        return false;
      }

      // Biometric failed for other reason — fall back to passcode
      console.log('[BiometricService] Biometric failed, falling back to passcode:', biometricResult.error);
      const fallbackResult = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (fallbackResult.success) {
        return true;
      }

      if (fallbackResult.error) {
        console.log('[BiometricService] Fallback auth failed:', fallbackResult.error);
      }

      return false;
    } catch (error) {
      console.error('[BiometricService] Authentication error:', error);
      return false;
    }
  }

  /**
   * Authenticate using device passcode only (skip biometric)
   * Used when user explicitly chooses "Use device passcode" option on Lock Screen
   *
   * @param reason - The reason shown to the user
   * @returns true if authentication succeeded, false otherwise
   */
  static async authenticateWithPasscodeOnly(reason?: string): Promise<boolean> {
    const prompt = reason || 'Enter passcode';

    try {
      // On iOS, this will show the passcode prompt directly
      // disableDeviceFallback: false allows passcode as the primary method
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: prompt,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return true;
      }

      if (result.error) {
        console.log('[BiometricService] Passcode auth failed:', result.error);
      }

      return false;
    } catch (error) {
      console.error('[BiometricService] Passcode auth error:', error);
      return false;
    }
  }

  /**
   * Check if user has enabled biometric unlock in app settings
   */
  static async isEnabled(): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      return value === 'true';
    } catch (error) {
      console.error('[BiometricService] Failed to read enabled state:', error);
      return false;
    }
  }

  /**
   * Enable or disable biometric unlock
   *
   * When enabling, this should be called AFTER successful biometric authentication
   * to confirm the user can actually use biometrics.
   */
  static async setEnabled(enabled: boolean): Promise<void> {
    try {
      if (enabled) {
        await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');
      } else {
        await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      }
    } catch (error) {
      console.error('[BiometricService] Failed to set enabled state:', error);
      throw new Error('Failed to save biometric preference');
    }
  }

  /**
   * Clear biometric settings (called on sign out)
   */
  static async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    } catch (error) {
      console.error('[BiometricService] Failed to clear settings:', error);
    }
  }

  /**
   * Check if biometrics are ready to use (hardware + enrolled + enabled)
   */
  static async isReady(): Promise<boolean> {
    const [available, enrolled, enabled] = await Promise.all([
      this.isAvailable(),
      this.isEnrolled(),
      this.isEnabled(),
    ]);

    return available && enrolled && enabled;
  }
}
