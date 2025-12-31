/**
 * Internationalization (i18n) setup for the mobile app.
 * Uses i18n-js + expo-localization for device language detection.
 *
 * Usage:
 *   import { t, setLocale, getLocale } from '@/lib/i18n';
 *   <Text>{t('calendar.header.title')}</Text>
 */

import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

import { en } from './translations/en';
import { de } from './translations/de';

// Create i18n instance with translations
const i18n = new I18n({
  en,
  de,
});

// Configure i18n
i18n.defaultLocale = 'en';
i18n.enableFallback = true; // Fallback to English for missing translations

// Set locale based on device language (first 2 characters, e.g., 'de-DE' -> 'de')
const deviceLocale = Localization.getLocales()[0]?.languageCode ?? 'en';
i18n.locale = deviceLocale;

/**
 * Translate a key with optional interpolation.
 *
 * @example
 * t('calendar.header.title') // "Planning Calendar"
 * t('common.daysConfirmed', { count: 5 }) // "5/7 days confirmed"
 */
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

/**
 * Set the app locale manually (overrides device setting).
 *
 * @example
 * setLocale('de'); // Switch to German
 */
export function setLocale(locale: 'en' | 'de'): void {
  i18n.locale = locale;
}

/**
 * Get the current locale.
 */
export function getLocale(): string {
  return i18n.locale;
}

/**
 * Get the date-fns locale object for date formatting.
 * Import and use with date-fns format() function.
 */
export function getDateLocale(): 'en' | 'de' {
  const locale = i18n.locale;
  if (locale.startsWith('de')) return 'de';
  return 'en';
}

// Export i18n instance for advanced usage
export { i18n };
