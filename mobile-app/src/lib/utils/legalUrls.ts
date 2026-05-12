/**
 * Shared utilities for opening Terms of Service and Privacy Policy URLs.
 * Centralizes URL management for consistency across the app.
 */

import { Linking } from 'react-native';
import { getDateLocale } from '@/lib/i18n';

const BASE_URL = 'https://openworkinghours.org';

/**
 * Get the Terms of Service URL for the current locale.
 */
export function getTermsUrl(): string {
  const locale = getDateLocale();
  return locale === 'de'
    ? `${BASE_URL}/de/terms`
    : `${BASE_URL}/terms`;
}

/**
 * Get the Privacy Policy URL for the current locale.
 */
export function getPrivacyUrl(): string {
  const locale = getDateLocale();
  return locale === 'de'
    ? `${BASE_URL}/de/app-privacy-policy`
    : `${BASE_URL}/app-privacy-policy`;
}

/**
 * Get the privacy explainer URL for the current locale.
 */
export function getPrivacyExplainerUrl(): string {
  const locale = getDateLocale();
  return locale === 'de'
    ? `${BASE_URL}/de/privacy`
    : `${BASE_URL}/privacy`;
}

/**
 * Open the Terms of Service in the device browser.
 */
export async function openTermsUrl(): Promise<void> {
  try {
    await Linking.openURL(getTermsUrl());
  } catch (error) {
    console.error('[legalUrls] Failed to open Terms URL:', error);
  }
}

/**
 * Open the Privacy Policy in the device browser.
 */
export async function openPrivacyUrl(): Promise<void> {
  try {
    await Linking.openURL(getPrivacyUrl());
  } catch (error) {
    console.error('[legalUrls] Failed to open Privacy URL:', error);
  }
}

/**
 * Open the privacy explainer in the device browser.
 */
export async function openPrivacyExplainerUrl(): Promise<void> {
  try {
    await Linking.openURL(getPrivacyExplainerUrl());
  } catch (error) {
    console.error('[legalUrls] Failed to open Privacy explainer URL:', error);
  }
}
