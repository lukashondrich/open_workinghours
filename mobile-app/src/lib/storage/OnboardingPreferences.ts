import { getDatabase } from '@/modules/geofencing/services/Database';

const KEYS = {
  USER_DECLINED_LOCATION_PERMISSION: 'onboarding.user_declined_location_permission',
  USER_DECLINED_LOCATION_PERMISSION_AT: 'onboarding.user_declined_location_permission_at',
  BACKGROUND_PERMISSION_PROMPT_SEEN: 'onboarding.background_permission_prompt_seen',
  NOTIFICATION_PERMISSION_PROMPT_SEEN: 'onboarding.notification_permission_prompt_seen',
  PERMISSION_REPROMPT_COUNT: 'onboarding.permission_reprompt_count',
  LAST_PERMISSION_REPROMPT_AT: 'onboarding.last_permission_reprompt_at',
  PERMISSION_PROMPT_PERMANENTLY_DISMISSED: 'onboarding.permission_prompt_permanently_dismissed',
  CALENDAR_TOOLTIP_SEEN: 'onboarding.calendar_tooltip_seen',
  FAB_TOOLTIP_SEEN: 'onboarding.fab_tooltip_seen',
  BATCH_TOOLTIP_SEEN: 'onboarding.batch_tooltip_seen',
  TRACKED_SESSION_TOOLTIP_SEEN: 'onboarding.tracked_session_tooltip_seen',
} as const;

async function setBoolean(key: string, value: boolean): Promise<void> {
  try {
    const db = await getDatabase();
    await db.setPreference(key, value ? '1' : '0');
  } catch (error) {
    console.error('[OnboardingPreferences] Failed to set boolean preference:', key, error);
  }
}

async function getBoolean(key: string): Promise<boolean> {
  try {
    const db = await getDatabase();
    const value = await db.getPreference(key);
    return value === '1';
  } catch (error) {
    console.error('[OnboardingPreferences] Failed to get boolean preference:', key, error);
    return false;
  }
}

async function setString(key: string, value: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.setPreference(key, value);
  } catch (error) {
    console.error('[OnboardingPreferences] Failed to set string preference:', key, error);
  }
}

async function getString(key: string): Promise<string | null> {
  try {
    const db = await getDatabase();
    return await db.getPreference(key);
  } catch (error) {
    console.error('[OnboardingPreferences] Failed to get string preference:', key, error);
    return null;
  }
}

async function getNumber(key: string): Promise<number> {
  const value = await getString(key);
  const parsed = value === null ? Number.NaN : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class OnboardingPreferences {
  static async setUserDeclinedLocationPermission(value: boolean): Promise<void> {
    await setBoolean(KEYS.USER_DECLINED_LOCATION_PERMISSION, value);
    const existingDeclinedAt = await getString(KEYS.USER_DECLINED_LOCATION_PERMISSION_AT);
    if (value && !existingDeclinedAt) {
      await setString(KEYS.USER_DECLINED_LOCATION_PERMISSION_AT, new Date().toISOString());
    }
  }

  static async hasUserDeclinedLocationPermission(): Promise<boolean> {
    return getBoolean(KEYS.USER_DECLINED_LOCATION_PERMISSION);
  }

  static async getUserDeclinedLocationPermissionAt(): Promise<string | null> {
    return getString(KEYS.USER_DECLINED_LOCATION_PERMISSION_AT);
  }

  static async setBackgroundPermissionPromptSeen(value: boolean): Promise<void> {
    await setBoolean(KEYS.BACKGROUND_PERMISSION_PROMPT_SEEN, value);
  }

  static async hasSeenBackgroundPermissionPrompt(): Promise<boolean> {
    return getBoolean(KEYS.BACKGROUND_PERMISSION_PROMPT_SEEN);
  }

  static async setNotificationPermissionPromptSeen(value: boolean): Promise<void> {
    await setBoolean(KEYS.NOTIFICATION_PERMISSION_PROMPT_SEEN, value);
  }

  static async hasSeenNotificationPermissionPrompt(): Promise<boolean> {
    return getBoolean(KEYS.NOTIFICATION_PERMISSION_PROMPT_SEEN);
  }

  static async getPermissionRePromptCount(): Promise<number> {
    return getNumber(KEYS.PERMISSION_REPROMPT_COUNT);
  }

  static async getLastPermissionRePromptAt(): Promise<string | null> {
    return getString(KEYS.LAST_PERMISSION_REPROMPT_AT);
  }

  static async recordPermissionRePromptShown(now: Date = new Date()): Promise<void> {
    const currentCount = await getNumber(KEYS.PERMISSION_REPROMPT_COUNT);
    await setString(KEYS.PERMISSION_REPROMPT_COUNT, String(currentCount + 1));
    await setString(KEYS.LAST_PERMISSION_REPROMPT_AT, now.toISOString());
  }

  static async setPermissionPromptPermanentlyDismissed(value: boolean): Promise<void> {
    await setBoolean(KEYS.PERMISSION_PROMPT_PERMANENTLY_DISMISSED, value);
  }

  static async hasPermanentlyDismissedPermissionPrompt(): Promise<boolean> {
    return getBoolean(KEYS.PERMISSION_PROMPT_PERMANENTLY_DISMISSED);
  }

  static async setCalendarTooltipSeen(value: boolean): Promise<void> {
    await setBoolean(KEYS.CALENDAR_TOOLTIP_SEEN, value);
  }

  static async hasSeenCalendarTooltip(): Promise<boolean> {
    return getBoolean(KEYS.CALENDAR_TOOLTIP_SEEN);
  }

  static async setFabTooltipSeen(value: boolean): Promise<void> {
    await setBoolean(KEYS.FAB_TOOLTIP_SEEN, value);
  }

  static async hasSeenFabTooltip(): Promise<boolean> {
    return getBoolean(KEYS.FAB_TOOLTIP_SEEN);
  }

  static async setBatchTooltipSeen(value: boolean): Promise<void> {
    await setBoolean(KEYS.BATCH_TOOLTIP_SEEN, value);
  }

  static async hasSeenBatchTooltip(): Promise<boolean> {
    return getBoolean(KEYS.BATCH_TOOLTIP_SEEN);
  }

  static async setTrackedSessionTooltipSeen(value: boolean): Promise<void> {
    await setBoolean(KEYS.TRACKED_SESSION_TOOLTIP_SEEN, value);
  }

  static async hasSeenTrackedSessionTooltip(): Promise<boolean> {
    return getBoolean(KEYS.TRACKED_SESSION_TOOLTIP_SEEN);
  }
}
