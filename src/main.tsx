import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Analytics } from "@vercel/analytics/react";
import { AppProvider } from './context/AppContext';
import { ConfirmationProvider } from './context/ConfirmationContext';
import GlobalErrorBoundary from './components/GlobalErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <AppProvider>
        <ConfirmationProvider>
          <App />
        </ConfirmationProvider>
      </AppProvider>
      <Analytics />
    </GlobalErrorBoundary>
  </StrictMode>,
)
