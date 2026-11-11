import { Navigate, Outlet, useLocation } from 'react-router';
import { Spinner } from '../../components/Spinner/Spinner';
import { useAuth } from './authContext';

function SessionCheck() {
  return (
    <div
      style={{
        flex: '1 1 auto',
        display: 'grid',
        placeItems: 'center',
        minHeight: '60vh',
        color: 'var(--text-muted)',
      }}
    >
      <Spinner size={28} label="Checking your session" />
    </div>
  );
}

/** Wraps protected routes: waits for the session, redirects to /login with a return path. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <SessionCheck />;
  if (status === 'signed-out') {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <Outlet />;
}

/** Wraps landing, login and signup: a signed-in player goes straight to Home. */
export function RedirectIfSignedIn() {
  const { status } = useAuth();
  if (status === 'loading') return <SessionCheck />;
  if (status === 'signed-in') return <Navigate to="/home" replace />;
  return <Outlet />;
}
