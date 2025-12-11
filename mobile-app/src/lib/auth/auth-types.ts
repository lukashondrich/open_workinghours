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
}
