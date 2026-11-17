import { Link, Outlet } from 'react-router';
import { TopBar } from '../components/PageShell/PageShell';
import { CONTENT } from '../content/content.config';
import layoutStyles from '../app/layouts/layouts.module.css';

/** The online duel pages share the brand bar and a way back to the single-player game. */
export function DuelLayout() {
  return (
    <>
      <TopBar
        brand={<Link to="/">{CONTENT.game.title}</Link>}
        nav={
          <Link to="/duel" className={layoutStyles.textLink}>
            Online duel
          </Link>
        }
        end={
          <Link to="/home" className={layoutStyles.textLink}>
            Single player
          </Link>
        }
      />
      <Outlet />
    </>
  );
}
