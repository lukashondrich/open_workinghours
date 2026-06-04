/**
 * Mock API responses for E2E testing
 *
 * When TEST_MODE is enabled, services return mock responses
 * instead of making real API calls. This eliminates flakiness from:
 * - Network latency
 * - External API availability (Photon geocoding)
 * - Animation timing variance
 */

import Constants from 'expo-constants';
import type {
  VerificationCodeResponse,
  VerifyCodeResponse,
  SocialAuthStartResponse,
  User,
} from '@/lib/auth/auth-types';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/auth/consent-types';
import type { GeocodingResult } from '@/modules/geofencing/services/GeocodingService';

/**
 * Check if TEST_MODE is enabled (for E2E testing)
 * Set via app.json → app.config.js → Constants.expoConfig.extra.TEST_MODE
 */
export const isTestMode = (): boolean => {
  return Constants.expoConfig?.extra?.TEST_MODE === true;
};

// Test user data
export const TEST_USER_EMAIL = 'e2e-test@openworkinghours.org';
export const TEST_VERIFICATION_CODE = '123456';

// Mock responses
export const mockResponses = {
  /**
   * POST /verification/request
   */
  verificationRequest: {
    success: true,
    message: 'Verification code sent to your email',
  } as VerificationCodeResponse,

  /**
   * POST /verification/confirm
   */
  verificationConfirm: (email: string): VerifyCodeResponse => ({
    success: true,
    message: 'Email verified successfully',
    email: email.toLowerCase().trim(),
  }),

  /**
   * POST /auth/register
   */
  authRegister: {
    access_token: 'mock-jwt-token-e2e-testing-12345',
    user_id: 'mock-user-id-e2e-67890',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  },

  /**
   * POST /auth/login
   */
  authLogin: {
    access_token: 'mock-jwt-token-e2e-testing-12345',
    user_id: 'mock-user-id-e2e-67890',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },

  /**
   * GET /auth/me
   */
  authMe: (email: string): User => ({
    userId: 'mock-user-id-e2e-67890',
    email: email.toLowerCase().trim(),
    hospitalId: 'E2E Test Hospital',
    specialty: 'Internal Medicine',
    roleLevel: 'Resident',
    stateCode: 'BY',
    // v2 taxonomy fields
    profession: 'physician',
    seniority: 'assistenzarzt',
    departmentGroup: 'innere_medizin',
    hospitalRefId: 6, // Sana Klinik München (BY)
    // 30 days ago so dashboard's "Last 14 Days" chart shows historical data
    // (DashboardDataService treats days before createdAt as isPreAccount=true → zeroed).
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    termsAcceptedVersion: CURRENT_TERMS_VERSION,
    privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
    consentAcceptedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  }),

  /**
   * POST /auth/apple — existing user
   */
  authAppleExistingUser: {
    status: 'authenticated',
    access_token: 'mock-jwt-token-e2e-apple-12345',
    token_type: 'bearer',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    user_id: 'mock-user-id-apple-67890',
  } as SocialAuthStartResponse,

  /**
   * POST /auth/apple — new user
   */
  authAppleNewUser: {
    status: 'registration_required',
    social_registration_token: 'mock-social-registration-token-apple',
  } as SocialAuthStartResponse,

  /**
   * POST /auth/google — existing user
   */
  authGoogleExistingUser: {
    status: 'authenticated',
    access_token: 'mock-jwt-token-e2e-google-12345',
    token_type: 'bearer',
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    user_id: 'mock-user-id-google-67890',
  } as SocialAuthStartResponse,

  /**
   * POST /auth/google — new user
   */
  authGoogleNewUser: {
    status: 'registration_required',
    social_registration_token: 'mock-social-registration-token-google',
  } as SocialAuthStartResponse,

  /**
   * GET /auth/me — social auth user (no email)
   */
  authMeSocial: (): User => ({
    userId: 'mock-user-id-social-67890',
    hospitalId: 'E2E Test Hospital',
    specialty: 'Internal Medicine',
    roleLevel: 'Resident',
    stateCode: 'BY',
    profession: 'physician',
    seniority: 'assistenzarzt',
    departmentGroup: 'innere_medizin',
    hospitalRefId: 6,
    createdAt: new Date().toISOString(),
    termsAcceptedVersion: CURRENT_TERMS_VERSION,
    privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
    consentAcceptedAt: new Date().toISOString(),
  }),

  /**
   * GET /auth/me/export
   */
  authExport: (email: string) => ({
    user: {
      user_id: 'mock-user-id-e2e-67890',
      email: email.toLowerCase().trim(),
      hospital_id: 'E2E Test Hospital',
      specialty: 'Internal Medicine',
      role_level: 'Resident',
      state_code: 'BY',
      created_at: new Date().toISOString(),
    },
    work_events: [],
    exported_at: new Date().toISOString(),
  }),
};

/**
 * Validate test verification code
 */
export function isValidTestCode(code: string): boolean {
  return code.trim() === TEST_VERIFICATION_CODE;
}

/**
 * Mock geocoding result for location setup wizard
 * Uses Charité hospital in Berlin - a well-known healthcare location
 */
export const mockGeocodingResult: GeocodingResult = {
  id: '13.378400-52.525300',
  name: 'Charité – Universitätsmedizin Berlin',
  address: 'Charitéplatz 1, 10117 Berlin',
  latitude: 52.5253,
  longitude: 13.3784,
  type: 'hospital',
};
