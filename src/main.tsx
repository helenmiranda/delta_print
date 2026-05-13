import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  if (window.self !== window.top) {
    document.body.classList.add('iframe-mode');
  }
} catch (_e) {
  document.body.classList.add('iframe-mode');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
