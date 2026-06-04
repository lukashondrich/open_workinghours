/**
 * Authentication types for Open Working Hours mobile app
 * Phase 2: Server-side aggregation with authenticated submissions
 */

export interface AuthState {
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'locked';
  user: User | null;
  token: string | null;
  expiresAt: Date | null;
}

export interface User {
  userId: string;
  email?: string;  // Optional — social auth users have no stored email
  hospitalId: string;
  specialty: string;
  roleLevel: string;
  stateCode?: string;
  createdAt?: string; // ISO 8601 format, optional for backward compatibility
  // v2 taxonomy fields
  profession?: string;
  seniority?: string;
  departmentGroup?: string;
  specializationCode?: string;
  hospitalRefId?: number | null;
  // GDPR consent fields
  termsAcceptedVersion?: string;
  privacyAcceptedVersion?: string;
  consentAcceptedAt?: string; // ISO 8601 format
}

export type AuthAction =
  | { type: 'SIGN_IN'; payload: { user: User; token: string; expiresAt: Date } }
  | { type: 'SIGN_OUT' }
  | { type: 'RESTORE_TOKEN'; payload: { user: User; token: string; expiresAt: Date } }
  | { type: 'SET_LOADING' }
  | { type: 'SET_LOCKED'; payload: { user: User; token: string; expiresAt: Date } }
  | { type: 'UNLOCK' };

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
  // v2 taxonomy fields
  profession?: string;
  seniority?: string;
  departmentGroup?: string;
  specializationCode?: string;
  hospitalRefId?: number | null;
  // GDPR consent
  termsVersion?: string;
  privacyVersion?: string;
}

export interface ProfileUpdateRequest {
  profession?: string;
  seniority?: string;
  departmentGroup?: string;
  specializationCode?: string;
  hospitalRefId?: number | null;
  stateCode?: string;
  hospitalId?: string;
  specialty?: string;
  roleLevel?: string;
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

// Social auth types
export interface SocialAuthStartResponse {
  status: 'authenticated' | 'registration_required';
  access_token?: string;
  token_type?: string;
  expires_at?: string;
  user_id?: string;
  user?: {
    user_id: string;
    hospital_id: string;
    specialty: string;
    role_level: string;
    state_code?: string;
    created_at: string;
    profession?: string;
    seniority?: string;
    department_group?: string;
    specialization_code?: string;
    hospital_ref_id?: number | null;
    terms_accepted_version?: string;
    privacy_accepted_version?: string;
    consent_accepted_at?: string;
  };
  social_registration_token?: string;
}

export interface SocialRegisterRequest {
  socialRegistrationToken: string;
  hospitalId: string;
  specialty: string;
  roleLevel: string;
  stateCode?: string;
  profession?: string;
  seniority?: string;
  departmentGroup?: string;
  specializationCode?: string;
  hospitalRefId?: number | null;
  termsVersion?: string;
  privacyVersion?: string;
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
