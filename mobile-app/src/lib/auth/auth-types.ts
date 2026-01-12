/**
 * Authentication types for Open Working Hours mobile app
 * Phase 2: Server-side aggregation with authenticated submissions
 */

export interface AuthState {
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  user: User | null;
  token: string | null;
  expiresAt: Date | null;
}

export interface User {
  userId: string;
  email: string;
  hospitalId: string;
  specialty: string;
  roleLevel: string;
  stateCode?: string;
  createdAt?: string; // ISO 8601 format, optional for backward compatibility
  // GDPR consent fields
  termsAcceptedVersion?: string;
  privacyAcceptedVersion?: string;
  consentAcceptedAt?: string; // ISO 8601 format
}

export type AuthAction =
  | { type: 'SIGN_IN'; payload: { user: User; token: string; expiresAt: Date } }
  | { type: 'SIGN_OUT' }
  | { type: 'RESTORE_TOKEN'; payload: { user: User; token: string; expiresAt: Date } }
  | { type: 'SET_LOADING' };

export interface VerificationCodeResponse {
  success: boolean;
  message: string;
}

export interface VerifyCodeResponse {
  success: boolean;
  message: string;
  email: string;
}

export interface RegisterRequest {
  email: string;
  hospitalId: string;
  specialty: string;
  roleLevel: string;
  stateCode?: string;
  // GDPR consent
  termsVersion?: string;
  privacyVersion?: string;
}

export interface RegisterResponse {
  userId: string;
  email: string;
  hospitalId: string;
  specialty: string;
  roleLevel: string;
  stateCode?: string;
  accessToken: string;
  expiresAt: string; // ISO 8601 format
}

export interface LoginResponse {
  userId: string;
  email: string;
  hospitalId: string;
  specialty: string;
  roleLevel: string;
  stateCode?: string;
  accessToken: string;
  expiresAt: string; // ISO 8601 format
}

export interface MeResponse {
  userId: string;
  email: string;
  hospitalId: string;
  specialty: string;
  roleLevel: string;
  stateCode?: string;
  createdAt: string; // ISO 8601 format
}

export interface UserDataExport {
  exported_at: string; // ISO 8601 format
  profile: {
    user_id: string;
    hospital_id: string;
    specialty: string;
    role_level: string;
    state_code?: string;
    country_code: string;
    created_at?: string;
    terms_accepted_version?: string;
    privacy_accepted_version?: string;
    consent_accepted_at?: string;
  };
  work_events: Array<{
    event_id: string;
    date: string;
    planned_hours: number;
    actual_hours: number;
    source: string;
    submitted_at?: string;
  }>;
}
