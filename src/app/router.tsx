import { createBrowserRouter, createMemoryRouter, type RouteObject } from 'react-router';
import { RedirectIfSignedIn, RequireAuth } from '../features/auth/guards';
import { DEV_TOOLS_ENABLED } from '../lib/env';
import { BattlePage } from '../pages/BattlePage';
import { HistoryPage } from '../pages/HistoryPage';
import { HomePage } from '../pages/HomePage';
import { JutsuBookPage } from '../pages/JutsuBookPage';
import { LandingPage } from '../pages/LandingPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlayPage } from '../pages/PlayPage';
import { PracticeJutsuPage } from '../pages/PracticeJutsuPage';
import { PracticePage } from '../pages/PracticePage';
import { ResultsPage } from '../pages/ResultsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SignupPage } from '../pages/SignupPage';
import { RecorderPage } from '../pages/dev/RecorderPage';
import { StyleguidePage } from '../pages/dev/StyleguidePage';
import { AppLayout } from './layouts/AppLayout';
import { PlayLayout } from './layouts/PlayLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { RootLayout } from './layouts/RootLayout';

const devRoutes: RouteObject[] = DEV_TOOLS_ENABLED
  ? [
      {
        path: 'dev',
        children: [
          { path: 'styleguide', element: <StyleguidePage /> },
          { path: 'recorder', element: <RecorderPage /> },
        ],
      },
    ]
  : [];

/** Route table from docs/DESIGN.md section 4. */
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        element: <RedirectIfSignedIn />,
        children: [
          {
            element: <PublicLayout />,
            children: [
              { index: true, element: <LandingPage /> },
              { path: 'login', element: <LoginPage /> },
              { path: 'signup', element: <SignupPage /> },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: 'home', element: <HomePage /> },
              { path: 'practice', element: <PracticePage /> },
              { path: 'practice/:jutsuId', element: <PracticeJutsuPage /> },
              { path: 'jutsu-book', element: <JutsuBookPage /> },
              { path: 'history', element: <HistoryPage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
        ],
      },
      {
        path: 'play',
        element: <PlayLayout />,
        children: [
          {
            element: <AppLayout />,
            children: [{ index: true, element: <PlayPage /> }],
          },
          { path: 'battle', element: <BattlePage /> },
          { path: 'results', element: <ResultsPage /> },
        ],
      },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

/** For tests: same routes, in-memory history. */
export function createTestRouter(initialEntries: string[]) {
  return createMemoryRouter(routes, { initialEntries });
}
