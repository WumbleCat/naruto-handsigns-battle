import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button } from '../components/Button/Button';
import { PageShell } from '../components/PageShell/PageShell';
import { PasswordField } from '../components/TextField/PasswordField';
import { TextField } from '../components/TextField/TextField';
import { useAuth } from '../features/auth/authContext';
import { describeAuthError } from '../features/auth/describeAuthError';
import { safeReturnTo } from '../features/auth/returnTo';
import styles from './AuthForm.module.css';

export function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await auth.signIn(email.trim(), password);
      await navigate(safeReturnTo(location.search), { replace: true });
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell centered>
      <form className={styles.card} onSubmit={(event) => void submit(event)} noValidate>
        <h1 className="t-display-md">Log in</h1>
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
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
        />
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={submitting}>
          Log in
        </Button>
        <p className={styles.alt}>
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </PageShell>
  );
}
