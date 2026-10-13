// Global tokens and base styles first, so component styles cascade over them.
import './styles/index.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// Production HTML is prerendered (see scripts/prerender.mjs): hydrate it.
// The dev server serves the bare template, so render from scratch there.
if (container.firstElementChild) hydrateRoot(container, app);
else createRoot(container).render(app);
