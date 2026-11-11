import { createContext, useContext } from 'react';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

export interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
}

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'email-taken'
  | 'username-taken'
  | 'username-invalid'
  | 'weak-password'
  | 'email-not-confirmed'
  | 'not-configured'
  | 'network'
  | 'unknown';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export type SignUpResult = { kind: 'signed-in' } | { kind: 'confirm-email'; email: string };

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  isUsernameAvailable: (username: string) => Promise<boolean>;
  updateUsername: (username: string) => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) throw new Error('useAuth must be used inside <AuthProvider>');
  return state;
}

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function validateUsername(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return '3 to 20 characters: lower-case letters, numbers and underscore.';
  }
  return null;
}

export const PASSWORD_MIN_LENGTH = 8;
