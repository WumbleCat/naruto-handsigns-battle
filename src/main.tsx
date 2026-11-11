import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './app/App';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { ToastProvider } from './components/Toast/Toast';
import { CONTENT } from './content/content.config';
import { modelStore } from './detection/model';
import { AuthProvider } from './features/auth/AuthProvider';

document.title = CONTENT.game.title;
// Fetch the recognition model early so the pre-battle check is settled when the player arrives.
void modelStore.load();

const container = document.getElementById('root');
if (!container) {
  throw new Error('index.html is missing the #root element');
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
