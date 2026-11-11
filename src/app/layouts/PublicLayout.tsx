import { Link, Outlet, useLocation } from 'react-router';
import { LinkButton } from '../../components/Button/LinkButton';
import { TopBar } from '../../components/PageShell/PageShell';
import { CONTENT } from '../../content/content.config';
import styles from './layouts.module.css';

/** Landing, log in and sign up: brand plus the two account actions. */
export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <>
      <TopBar
        brand={<Link to="/">{CONTENT.game.title}</Link>}
        end={
          <>
            {pathname !== '/login' ? (
              <Link to="/login" className={styles.textLink}>
                Log in
              </Link>
            ) : null}
            {pathname !== '/signup' ? (
              <LinkButton to="/signup" variant="primary">
                Sign up
              </LinkButton>
            ) : null}
          </>
        }
      />
      <Outlet />
    </>
  );
}
