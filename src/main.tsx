import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/fonts';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './app/App';
import { ThemeProvider } from './app/providers/ThemeProvider';
import { ToastProvider } from './components/Toast/Toast';
import { CONTENT } from './content/content.config';

document.title = CONTENT.game.title;

const container = document.getElementById('root');
if (!container) {
  throw new Error('index.html is missing the #root element');
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
);
