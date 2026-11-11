import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../components/Button/Button';
import { LinkButton } from '../components/Button/LinkButton';
import { PageShell } from '../components/PageShell/PageShell';
import { PasswordField } from '../components/TextField/PasswordField';
import { TextField } from '../components/TextField/TextField';
import { PASSWORD_MIN_LENGTH, useAuth, validateUsername } from '../features/auth/authContext';
import { describeAuthError } from '../features/auth/describeAuthError';
import styles from './AuthForm.module.css';

type Availability = 'idle' | 'checking' | 'available' | 'taken';

const CHECK_DELAY_MS = 400;

export function SignupPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checked, setChecked] = useState<{ username: string; available: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  const usernameError = username.length > 0 ? validateUsername(username) : null;
  const passwordError =
    password.length > 0 && password.length < PASSWORD_MIN_LENGTH
      ? `Use at least ${PASSWORD_MIN_LENGTH} characters.`
      : null;

  // Derived, not stored: "checking" until the debounced lookup for this exact username lands.
  const availability: Availability =
    username.length === 0 || usernameError
      ? 'idle'
      : checked?.username === username
        ? checked.available
          ? 'available'
          : 'taken'
        : 'checking';

  useEffect(() => {
    if (username.length === 0 || usernameError) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      auth
        .isUsernameAvailable(username)
        .then((available) => {
          if (!cancelled) setChecked({ username, available });
        })
        .catch(() => undefined);
    }, CHECK_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [auth, username, usernameError]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (usernameError || passwordError) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await auth.signUp(email.trim(), password, username);
      if (result.kind === 'confirm-email') {
        setConfirmEmail(result.email);
      } else {
        await navigate('/home', { replace: true });
      }
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmEmail) {
    return (
      <PageShell centered>
        <div className={styles.card}>
          <h1 className="t-display-md">Check your inbox</h1>
          <p className="t-lead t-secondary">
            We sent a confirmation link to {confirmEmail}. Open it to finish creating your account.
          </p>
          <div>
            <LinkButton to="/login" variant="ghost">
              Back to log in
            </LinkButton>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell centered>
      <form className={styles.card} onSubmit={(event) => void submit(event)} noValidate>
        <h1 className="t-display-md">Create account</h1>
        <TextField
          label="Username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value.toLowerCase())}
          disabled={submitting}
          helper="3 to 20 characters: lower-case letters, numbers and underscore."
          error={usernameError ?? (availability === 'taken' ? 'Taken' : undefined)}
          ok={availability === 'available' ? 'Available' : undefined}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          helper={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          error={passwordError ?? undefined}
        />
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={submitting}
          disabled={availability === 'taken'}
        >
          Create account
        </Button>
        <p className={styles.alt}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </PageShell>
  );
}
