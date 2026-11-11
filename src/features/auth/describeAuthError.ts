import { AuthError, PASSWORD_MIN_LENGTH } from './authContext';

/** Turns an auth failure into one sentence that says what happened and what to do. */
export function describeAuthError(error: unknown): string {
  if (error instanceof AuthError) {
    switch (error.code) {
      case 'invalid-credentials':
        return 'Email or password is incorrect.';
      case 'email-taken':
        return 'An account with this email already exists. Log in instead.';
      case 'username-taken':
        return 'That username is taken.';
      case 'username-invalid':
        return '3 to 20 characters: lower-case letters, numbers and underscore.';
      case 'weak-password':
        return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
      case 'email-not-confirmed':
        return 'Confirm your email first. Check your inbox for the link.';
      case 'network':
        return "You're offline. Try again when you're connected.";
      case 'not-configured':
        return error.message;
      default:
        return 'Something went wrong. Try again.';
    }
  }
  return 'Something went wrong. Try again.';
}
