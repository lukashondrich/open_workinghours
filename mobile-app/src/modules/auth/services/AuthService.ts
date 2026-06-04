/**
 * AuthService - Backend API calls for authentication
 * Endpoints: /verification/*, /auth/*
 *
 * Supports TEST_MODE for E2E testing - when enabled, returns mock responses
 * instead of making real API calls.
 */

import Constants from 'expo-constants';
import type {
  VerificationCodeResponse,
  VerifyCodeResponse,
  RegisterRequest,
  RegisterResponse,
  LoginResponse,
  MeResponse,
  ProfileUpdateRequest,
  SocialAuthStartResponse,
  SocialRegisterRequest,
  User,
  UserDataExport,
} from '@/lib/auth/auth-types';
import { mockResponses, isValidTestCode, isTestMode } from '@/lib/testing/mockApi';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '@/lib/auth/consent-types';

const BASE_URL = Constants.expoConfig?.extra?.authBaseUrl || 'http://localhost:8000';

interface BackendUserResponse {
  user_id: string;
  hospital_id: string;
  specialty: string;
  role_level: string;
  state_code?: string | null;
  created_at?: string | null;
  profession?: string | null;
  seniority?: string | null;
  department_group?: string | null;
  specialization_code?: string | null;
  hospital_ref_id?: number | null;
  terms_accepted_version?: string | null;
  privacy_accepted_version?: string | null;
  consent_accepted_at?: string | null;
}

function mapBackendUser(data: BackendUserResponse, email?: string): User {
  return {
    userId: data.user_id,
    email,
    hospitalId: data.hospital_id,
    specialty: data.specialty,
    roleLevel: data.role_level,
    stateCode: data.state_code ?? undefined,
    createdAt: data.created_at ?? undefined,
    profession: data.profession ?? undefined,
    seniority: data.seniority ?? undefined,
    departmentGroup: data.department_group ?? undefined,
    specializationCode: data.specialization_code ?? undefined,
    hospitalRefId: data.hospital_ref_id,
    termsAcceptedVersion: data.terms_accepted_version ?? undefined,
    privacyAcceptedVersion: data.privacy_accepted_version ?? undefined,
    consentAcceptedAt: data.consent_accepted_at ?? undefined,
  };
}

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text();
  if (!text) return fallback;

  try {
    const error = JSON.parse(text);
    return error.detail || fallback;
  } catch {
    return text;
  }
}

export class AuthService {
  /**
   * Step 1: Request email verification code
   * POST /verification/request
   */
  static async requestVerificationCode(email: string): Promise<VerificationCodeResponse> {
    // Test mode: return mock response
    if (isTestMode()) {
      console.log('[AuthService] TEST_MODE: Returning mock verification request');
      return mockResponses.verificationRequest;
    }

    try {
      const response = await fetch(`${BASE_URL}/verification/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send verification code');
      }

      const data = await response.json();
      return {
        success: true,
        message: data.message || 'Verification code sent to your email',
      };
    } catch (error) {
      console.error('[AuthService] Failed to request verification code:', error);
      throw error;
    }
  }

  /**
   * Step 2: Verify email code
   * POST /verification/confirm
   */
  static async verifyCode(email: string, code: string): Promise<VerifyCodeResponse> {
    // Test mode: validate against test code
    if (isTestMode()) {
      console.log('[AuthService] TEST_MODE: Validating test verification code');
      if (!isValidTestCode(code)) {
        throw new Error('Invalid verification code');
      }
      return mockResponses.verificationConfirm(email);
    }

    try {
      const response = await fetch(`${BASE_URL}/verification/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Invalid verification code');
      }

      const data = await response.json();
      // If response is OK (200), verification succeeded
      return {
        success: true,
        message: data.message || 'Email verified successfully',
        email: email.trim().toLowerCase(),
      };
    } catch (error) {
      console.error('[AuthService] Failed to verify code:', error);
      throw error;
    }
  }

  /**
   * Step 3a: Register new user
   * POST /auth/register
   *
   * Requirements:
   * - Email must have been verified via /verification/confirm first
   */
  static async register(request: RegisterRequest): Promise<{
    user: User;
    token: string;
    expiresAt: Date;
  }> {
    // Test mode: return mock user
    if (isTestMode()) {
      console.log('[AuthService] TEST_MODE: Returning mock registration');
      const mockUser = mockResponses.authMe(request.email);
      // Override with actual registration data
      mockUser.hospitalId = request.hospitalId;
      mockUser.specialty = request.specialty;
      mockUser.roleLevel = request.roleLevel;
      mockUser.stateCode = request.stateCode;
      mockUser.hospitalRefId = request.hospitalRefId;
      return {
        user: mockUser,
        token: mockResponses.authRegister.access_token,
        expiresAt: new Date(mockResponses.authRegister.expires_at),
      };
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: request.email.trim().toLowerCase(),
          hospital_id: request.hospitalId,
          specialty: request.specialty,
          role_level: request.roleLevel,
          state_code: request.stateCode,
          // v2 taxonomy fields
          profession: request.profession,
          seniority: request.seniority,
          department_group: request.departmentGroup,
          specialization_code: request.specializationCode,
          hospital_ref_id: request.hospitalRefId,
          // GDPR consent
          terms_version: request.termsVersion,
          privacy_version: request.privacyVersion,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Registration failed');
      }

      const data = await response.json();

      // Backend only returns: access_token, expires_at, user_id
      // Fetch full user info including createdAt from /auth/me
      const userInfo = await this.getCurrentUser(data.access_token, request.email.trim().toLowerCase());

      return {
        user: userInfo,
        token: data.access_token,
        expiresAt: new Date(data.expires_at),
      };
    } catch (error) {
      console.error('[AuthService] Failed to register:', error);
      throw error;
    }
  }

  /**
   * Step 3b: Login existing user
   * POST /auth/login
   *
   * Flow:
   * 1. Request verification code via requestVerificationCode()
   * 2. User receives code via email
   * 3. Call this method with email + code
   */
  static async login(email: string, code: string): Promise<{
    user: User;
    token: string;
    expiresAt: Date;
  }> {
    // Test mode: validate code and return mock user
    if (isTestMode()) {
      console.log('[AuthService] TEST_MODE: Returning mock login');
      if (!isValidTestCode(code)) {
        throw new Error('Invalid verification code');
      }
      return {
        user: mockResponses.authMe(email),
        token: mockResponses.authLogin.access_token,
        expiresAt: new Date(mockResponses.authLogin.expires_at),
      };
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const data = await response.json();

      // Backend returns: access_token, expires_at, user_id
      // Need to fetch full user info from /auth/me
      const userInfo = await this.getCurrentUser(data.access_token, email.trim().toLowerCase());

      return {
        user: userInfo,
        token: data.access_token,
        expiresAt: new Date(data.expires_at),
      };
    } catch (error) {
      console.error('[AuthService] Failed to login:', error);
      throw error;
    }
  }

  /**
   * Get current user information
   * GET /auth/me
   *
   * Requires: Valid JWT token
   * Note: Backend doesn't return email, so it must be provided separately.
   * For social auth users, email is undefined.
   */
  static async getCurrentUser(token: string, email?: string): Promise<User> {
    try {
      const response = await fetch(`${BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please login again.');
        }
        const error = await response.json();
        throw new Error(error.detail || 'Failed to fetch user info');
      }

      const data = await response.json();

      // Backend returns snake_case and does not include email, so keep the known email.
      return mapBackendUser(data, email);
    } catch (error) {
      console.error('[AuthService] Failed to get current user:', error);
      throw error;
    }
  }

  /**
   * Update profile fields (GDPR Art. 16 — right to rectification)
   * PATCH /auth/me/profile
   */
  static async updateProfile(token: string, email: string | undefined, request: ProfileUpdateRequest): Promise<User> {
    // Test mode: return mock user with updated fields
    if (isTestMode()) {
      console.log('[AuthService] TEST_MODE: Returning mock profile update');
      const mockUser = email ? mockResponses.authMe(email) : mockResponses.authMeSocial();
      if (request.profession !== undefined) mockUser.profession = request.profession;
      if (request.seniority !== undefined) mockUser.seniority = request.seniority;
      if (request.stateCode !== undefined) mockUser.stateCode = request.stateCode;
      if (request.departmentGroup !== undefined) mockUser.departmentGroup = request.departmentGroup;
      if (request.hospitalRefId !== undefined) mockUser.hospitalRefId = request.hospitalRefId;
      return mockUser;
    }

    try {
      const body: Record<string, unknown> = {};
      if (request.profession !== undefined) body.profession = request.profession;
      if (request.seniority !== undefined) body.seniority = request.seniority;
      if (request.departmentGroup !== undefined) body.department_group = request.departmentGroup;
      if (request.specializationCode !== undefined) body.specialization_code = request.specializationCode;
      if (request.hospitalRefId !== undefined) body.hospital_ref_id = request.hospitalRefId;
      if (request.stateCode !== undefined) body.state_code = request.stateCode;
      if (request.hospitalId !== undefined) body.hospital_id = request.hospitalId;
      if (request.specialty !== undefined) body.specialty = request.specialty;
      if (request.roleLevel !== undefined) body.role_level = request.roleLevel;

      const response = await fetch(`${BASE_URL}/auth/me/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please login again.');
        }
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update profile');
      }

      const data = await response.json();
      return mapBackendUser(data, email);
    } catch (error) {
      console.error('[AuthService] Failed to update profile:', error);
      throw error;
    }
  }

  /**
   * Update GDPR consent for current Terms and Privacy Policy versions.
   * POST /auth/consent
   */
  static async updateConsent(token: string, email?: string): Promise<User> {
    if (isTestMode()) {
      console.log('[AuthService] TEST_MODE: Returning mock consent update');
      const mockUser = email ? mockResponses.authMe(email) : mockResponses.authMeSocial();
      mockUser.termsAcceptedVersion = CURRENT_TERMS_VERSION;
      mockUser.privacyAcceptedVersion = CURRENT_PRIVACY_VERSION;
      mockUser.consentAcceptedAt = new Date().toISOString();
      return mockUser;
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/consent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          terms_version: CURRENT_TERMS_VERSION,
          privacy_version: CURRENT_PRIVACY_VERSION,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error(await getErrorMessage(response, 'Failed to update consent'));
      }

      return await this.getCurrentUser(token, email);
    } catch (error) {
      console.error('[AuthService] Failed to update consent:', error);
      throw error;
    }
  }

  // ============================================================================
  // SOCIAL AUTH (Sign in with Apple + Google)
  // ============================================================================

  /**
   * Sign in with Apple
   * POST /auth/apple
   */
  static async loginWithApple(identityToken: string): Promise<SocialAuthStartResponse> {
    if (isTestMode()) {
      console.log('[AuthService] TEST_MODE: Returning mock Apple auth');
      return mockResponses.authAppleExistingUser;
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/apple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity_token: identityToken }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Apple authentication failed');
      }

      return response.json();
    } catch (error) {
      console.error('[AuthService] Apple auth failed:', error);
      throw error;
    }
  }

  /**
   * Sign in with Google
   * POST /auth/google
   */
  static async loginWithGoogle(idToken: string): Promise<SocialAuthStartResponse> {
    if (isTestMode()) {
      console.log('[AuthService] TEST_MODE: Returning mock Google auth');
      return mockResponses.authGoogleExistingUser;
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Google authentication failed');
      }

      return response.json();
    } catch (error) {
      console.error('[AuthService] Google auth failed:', error);
      throw error;
    }
  }

  /**
   * Complete social registration for first-time social auth users
   * POST /auth/social/register
   */
  static async completeSocialRegistration(request: SocialRegisterRequest): Promise<{
    user: User;
    token: string;
    expiresAt: Date;
  }> {
    if (isTestMode()) {
      console.log('[AuthService] TEST_MODE: Returning mock social registration');
      const mockUser = mockResponses.authMeSocial();
      mockUser.hospitalId = request.hospitalId;
      mockUser.specialty = request.specialty;
      mockUser.roleLevel = request.roleLevel;
      mockUser.stateCode = request.stateCode;
      mockUser.hospitalRefId = request.hospitalRefId;
      return {
        user: mockUser,
        token: mockResponses.authRegister.access_token,
        expiresAt: new Date(mockResponses.authRegister.expires_at),
      };
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/social/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          social_registration_token: request.socialRegistrationToken,
          hospital_id: request.hospitalId,
          specialty: request.specialty,
          role_level: request.roleLevel,
          state_code: request.stateCode,
          profession: request.profession,
          seniority: request.seniority,
          department_group: request.departmentGroup,
          specialization_code: request.specializationCode,
          hospital_ref_id: request.hospitalRefId,
          terms_version: request.termsVersion,
          privacy_version: request.privacyVersion,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Social registration failed');
      }

      const data = await response.json();

      // Fetch full user info (social users have no email)
      const userInfo = await this.getCurrentUser(data.access_token);

      return {
        user: userInfo,
        token: data.access_token,
        expiresAt: new Date(data.expires_at),
      };
    } catch (error) {
      console.error('[AuthService] Social registration failed:', error);
      throw error;
    }
  }

  /**
   * Export all user data (GDPR Art. 20 - Data Portability)
   * GET /auth/me/export
   */
  static async exportUserData(token: string): Promise<UserDataExport> {
    try {
      const response = await fetch(`${BASE_URL}/auth/me/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please login again.');
        }
        try {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to export data');
        } catch {
          throw new Error(`Failed to export data (${response.status})`);
        }
      }

      return await response.json();
    } catch (error) {
      console.error('[AuthService] Failed to export user data:', error);
      throw error;
    }
  }

  /**
   * Delete user account and all backend data (GDPR Art. 17)
   * DELETE /auth/me
   *
   * Deletes:
   * - User record
   * - WorkEvents (cascade)
   * - FeedbackReports
   * - VerificationRequest
   */
  static async deleteAccount(token: string): Promise<void> {
    try {
      const response = await fetch(`${BASE_URL}/auth/me`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please login again.');
        }
        if (response.status === 403) {
          throw new Error('This account cannot be deleted.');
        }
        // Try to parse JSON error, fallback to status text
        try {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to delete account');
        } catch {
          throw new Error(`Failed to delete account (${response.status})`);
        }
      }
      // 204 No Content - success
    } catch (error) {
      console.error('[AuthService] Failed to delete account:', error);
      throw error;
    }
  }
}
