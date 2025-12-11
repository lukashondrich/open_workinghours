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
          dispatch({
            type: 'RESTORE_TOKEN',
            payload: {
              user: auth.user,
              token: auth.token,
              expiresAt: auth.expiresAt,
            },
          });
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
      await AuthStorage.clearAuth();
      dispatch({ type: 'SIGN_OUT' });
    } catch (error) {
      console.error('[AuthProvider] Failed to sign out:', error);
      throw new Error('Failed to clear authentication');
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
