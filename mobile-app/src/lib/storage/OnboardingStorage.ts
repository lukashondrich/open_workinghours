/**
 * OnboardingStorage - Persist onboarding/tooltip seen flags
 * Uses SecureStore for consistency with other storage services
 */

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  HAS_SEEN_CONFIRM_TOOLTIP: 'onboarding_confirm_tooltip_seen',
} as const;

export class OnboardingStorage {
  /**
   * Check if user has seen the confirm tooltip
   */
  static async hasSeenConfirmTooltip(): Promise<boolean> {
    try {
      const value = await SecureStore.getItemAsync(KEYS.HAS_SEEN_CONFIRM_TOOLTIP);
      return value === 'true';
    } catch (error) {
      console.error('[OnboardingStorage] Failed to get confirm tooltip flag:', error);
      return false;
    }
  }

  /**
   * Mark the confirm tooltip as seen
   */
  static async setConfirmTooltipSeen(): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEYS.HAS_SEEN_CONFIRM_TOOLTIP, 'true');
    } catch (error) {
      console.error('[OnboardingStorage] Failed to set confirm tooltip flag:', error);
    }
  }

  /**
   * Clear all onboarding flags (for testing or reset)
   */
  static async clearAll(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(KEYS.HAS_SEEN_CONFIRM_TOOLTIP);
    } catch (error) {
      console.error('[OnboardingStorage] Failed to clear onboarding flags:', error);
    }
  }
}
