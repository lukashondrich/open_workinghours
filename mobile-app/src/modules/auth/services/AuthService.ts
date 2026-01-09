/**
 * AuthService - Backend API calls for authentication
 * Endpoints: /verification/*, /auth/*
 */

import Constants from 'expo-constants';
import type {
  VerificationCodeResponse,
  VerifyCodeResponse,
  RegisterRequest,
  RegisterResponse,
  LoginResponse,
  MeResponse,
  User,
} from '@/lib/auth/auth-types';

const BASE_URL = Constants.expoConfig?.extra?.authBaseUrl || 'http://localhost:8000';

export class AuthService {
  /**
   * Step 1: Request email verification code
   * POST /verification/request
   */
  static async requestVerificationCode(email: string): Promise<VerificationCodeResponse> {
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
    try {
      const response = await fetch(`${BASE_URL}/verification/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
   * Note: Backend doesn't return email, so it must be provided separately
   */
  static async getCurrentUser(token: string, email: string): Promise<User> {
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

      // Backend returns snake_case: user_id, hospital_id, role_level, state_code, created_at
      // Backend doesn't include email, so we use the provided one
      return {
        userId: data.user_id,
        email: email,
        hospitalId: data.hospital_id,
        specialty: data.specialty,
        roleLevel: data.role_level,
        stateCode: data.state_code,
        createdAt: data.created_at, // ISO 8601 format from backend
      };
    } catch (error) {
      console.error('[AuthService] Failed to get current user:', error);
      throw error;
    }
  }
}
