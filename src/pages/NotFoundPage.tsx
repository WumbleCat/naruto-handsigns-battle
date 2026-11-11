import { LinkButton } from '../components/Button/LinkButton';
import { PageShell } from '../components/PageShell/PageShell';
import { useAuth } from '../features/auth/authContext';

export function NotFoundPage() {
  const { status } = useAuth();
  const home = status === 'signed-in' ? '/home' : '/';
  return (
    <PageShell centered>
      <h1 className="t-display-md">This page doesn't exist.</h1>
      <p className="t-lead t-secondary measure">
        The address may be mistyped, or the page moved. Everything you need is one step away.
      </p>
      <div>
        <LinkButton to={home} variant="primary" size="lg">
          Back to home
        </LinkButton>
      </div>
    </PageShell>
  );
}
