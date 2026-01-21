/**
 * AuthContext - Global authentication state management
 * Follows calendar-context.tsx pattern
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthState, AuthAction, User } from './auth-types';
import { AuthStorage } from './AuthStorage';
import { BiometricService } from './BiometricService';

interface AuthContextValue {
  state: AuthState;
  signIn: (user: User, token: string, expiresAt: Date) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const initialAuthState: AuthState = {
  status: 'idle',
  user: null,
  token: null,
  expiresAt: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        status: 'loading',
      };

    case 'RESTORE_TOKEN':
      return {
        status: 'authenticated',
        user: action.payload.user,
        token: action.payload.token,
        expiresAt: action.payload.expiresAt,
      };

    case 'SIGN_IN':
      return {
        status: 'authenticated',
        user: action.payload.user,
        token: action.payload.token,
        expiresAt: action.payload.expiresAt,
      };

    case 'SIGN_OUT':
      return {
        status: 'unauthenticated',
        user: null,
        token: null,
        expiresAt: null,
      };

    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialAuthState);
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore auth state on app mount
  useEffect(() => {
    let isMounted = true;

    async function restoreAuth() {
      try {
        dispatch({ type: 'SET_LOADING' });
        const auth = await AuthStorage.restoreAuth();

        if (!isMounted) return;

        if (auth) {
          // Token exists and is valid - check if biometric unlock is enabled
          const biometricEnabled = await BiometricService.isEnabled();

          if (biometricEnabled) {
            // Prompt for biometric authentication
            const biometricSuccess = await BiometricService.authenticate(
              'Unlock Open Working Hours'
            );

            if (!isMounted) return;

            if (biometricSuccess) {
              // Biometric succeeded - restore session
              dispatch({
                type: 'RESTORE_TOKEN',
                payload: {
                  user: auth.user,
                  token: auth.token,
                  expiresAt: auth.expiresAt,
                },
              });
            } else {
              // Biometric failed - require full login
              // Don't clear the token, just don't restore the session
              // User can try again by restarting app or logging in manually
              console.log('[AuthProvider] Biometric failed, showing login');
              dispatch({ type: 'SIGN_OUT' });
            }
          } else {
            // No biometric - just restore
            dispatch({
              type: 'RESTORE_TOKEN',
              payload: {
                user: auth.user,
                token: auth.token,
                expiresAt: auth.expiresAt,
              },
            });
          }
        } else {
          dispatch({ type: 'SIGN_OUT' });
        }
      } catch (error) {
        console.error('[AuthProvider] Failed to restore auth:', error);
        if (isMounted) {
          dispatch({ type: 'SIGN_OUT' });
        }
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    }

    restoreAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (user: User, token: string, expiresAt: Date) => {
    try {
      await AuthStorage.saveAuth(token, user, expiresAt);
      dispatch({
        type: 'SIGN_IN',
        payload: { user, token, expiresAt },
      });
    } catch (error) {
      console.error('[AuthProvider] Failed to sign in:', error);
      throw new Error('Failed to save authentication');
    }
  };

  const signOut = async () => {
    try {
      // "Lock" behavior: Keep token and biometric preference
      // On next app launch:
      // - If biometric enabled → prompt biometric → unlock
      // - If biometric NOT enabled → auto-restore session
      // This reduces friction while still providing security for biometric users
      dispatch({ type: 'SIGN_OUT' });
    } catch (error) {
      console.error('[AuthProvider] Failed to sign out:', error);
      throw new Error('Failed to sign out');
    }
  };

  // Don't render children until auth state is restored
  if (!isHydrated) {
    return null; // Or a loading spinner
  }

  return (
    <AuthContext.Provider value={{ state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
