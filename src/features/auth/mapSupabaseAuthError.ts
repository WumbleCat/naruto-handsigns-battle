import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { AuthError } from './authContext';

/** Translates Supabase auth failures into the app's typed errors. */
export function mapSupabaseAuthError(error: SupabaseAuthError): AuthError {
  const code = error.code ?? '';
  const message = error.message;
  if (code === 'invalid_credentials') {
    return new AuthError('invalid-credentials', message);
  }
  if (code === 'user_already_exists' || code === 'email_exists') {
    return new AuthError('email-taken', message);
  }
  if (code === 'weak_password') return new AuthError('weak-password', message);
  if (code === 'email_not_confirmed') return new AuthError('email-not-confirmed', message);
  if (message.includes('Database error saving new user')) {
    // The profiles trigger failed: in practice the username unique constraint.
    return new AuthError('username-taken', message);
  }
  if (error.status === 0 || /fetch|network/i.test(message)) {
    return new AuthError('network', message);
  }
  return new AuthError('unknown', message);
}
