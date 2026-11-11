import { useEffect } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { Button } from '../../components/Button/Button';
import { TopBar } from '../../components/PageShell/PageShell';
import { CONTENT } from '../../content/content.config';
import { useAuth } from '../../features/auth/authContext';
import { flushMatchQueue } from '../../lib/api/matchQueue';
import { supabase } from '../../lib/supabase';
import styles from './layouts.module.css';

const NAV = [
  { to: '/home', label: 'Home' },
  { to: '/practice', label: 'Practice' },
  { to: '/jutsu-book', label: 'Jutsu Book' },
  { to: '/history', label: 'Match History' },
  { to: '/settings', label: 'Settings' },
] as const;

/** Signed-in chrome: brand, primary navigation, the player's name and Log out. */
export function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Retry any match that failed to save last time, once per sign-in.
  useEffect(() => {
    if (!supabase || !user || user.id === 'dev-user') return;
    void flushMatchQueue(supabase, user.id);
  }, [user]);

  const logOut = async () => {
    await signOut();
    await navigate('/', { replace: true });
  };

  return (
    <>
      <TopBar
        brand={<Link to="/home">{CONTENT.game.title}</Link>}
        nav={NAV.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
        end={
          <>
            {user?.username ? <span className={styles.username}>{user.username}</span> : null}
            <Button variant="ghost" onClick={() => void logOut()}>
              Log out
            </Button>
          </>
        }
      />
      <Outlet />
    </>
  );
}
