/**
 * Mock API responses for E2E testing
 *
 * When TEST_MODE is enabled, AuthService returns these mock responses
 * instead of making real API calls.
 */

import type {
  VerificationCodeResponse,
  VerifyCodeResponse,
  User,
} from '@/lib/auth/auth-types';

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
    createdAt: new Date().toISOString(),
    termsAcceptedVersion: '1.0.0',
    privacyAcceptedVersion: '1.0.0',
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
