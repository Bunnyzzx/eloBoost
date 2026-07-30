import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { installGlobalErrorHandlers } from '@/app/globalErrors';
import '@/styles/globals.css';

installGlobalErrorHandlers();

const container = document.getElementById('root');
if (container == null) {
  throw new Error('Elemento #root não encontrado no documento.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
