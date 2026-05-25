import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// ==========================================
// 🚀 DOMAIN MIGRATION & LOCAL STORAGE SYNC
// ==========================================
// Explicitly list the old production domains we want to redirect from.
// This excludes preview environments (Vercel previews and Render's wordle-variant-preview) and local development.
const OLD_PRODUCTION_DOMAINS = ['wordle-variant.vercel.app', 'wordle-variant.onrender.com'];
const targetDomain = 'www.wordle-variant.xyz';

if (OLD_PRODUCTION_DOMAINS.includes(window.location.hostname)) {
  // We are on an old production domain: display transition loader
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="background:#030712; color:#ffffff; font-family:'Outfit',system-ui,sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:20px; box-sizing:border-box;">
        <h1 style="font-size:24px; font-weight:900; letter-spacing:-0.05em; text-transform:uppercase; margin:0 0 12px 0;">We have moved!</h1>
        <p style="color:#9ca3af; font-size:14px; margin:0 0 24px 0; max-width:400px; line-height:1.6;">Transferring your game stats, streaks, and login session securely to the new domain...</p>
        <div style="width:32px; height:32px; border:3px solid #1f2937; border-top-color:#6366f1; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
        <style>
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </div>
    `;
  }

  // 1. Gather essential LocalStorage data to migrate
  const migrationData: Record<string, string> = {};
  
  // Get today's date in Lagos timezone to migrate current game state
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const isAuthToken = key.startsWith('sb-') && key.endsWith('-auth-token');
      const isStats = key === 'wordle-statistics';
      const isTodayGame = key === `wordle-${todayStr}`;
      
      let isUnsyncedGame = false;
      if (key.startsWith('wordle-') && !isTodayGame) {
        try {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (parsed && parsed.needsSync) {
              isUnsyncedGame = true;
            }
          }
        } catch {
          // Ignore parse errors
        }
      }

      if (isAuthToken || isStats || isTodayGame || isUnsyncedGame) {
        const val = localStorage.getItem(key);
        if (val) {
          migrationData[key] = val;
        }
      }
    }
  }

  // 2. Redirect carrying the migration payload
  let redirectUrl = `https://${targetDomain}${window.location.pathname}${window.location.search}`;
  if (Object.keys(migrationData).length > 0) {
    try {
      const serialized = btoa(unescape(encodeURIComponent(JSON.stringify(migrationData))));
      redirectUrl += `#migration=${serialized}`;
    } catch (e) {
      console.error('Failed to serialize migration data:', e);
    }
  }

  // Short delay (800ms) to allow the transition message to be read before moving
  setTimeout(() => {
    window.location.replace(redirectUrl);
  }, 800);
} else {
  // We are on the target domain: check if we arrived with a migration payload
  try {
    if (window.location.hash.startsWith('#migration=')) {
      const base64Data = window.location.hash.split('#migration=')[1];
      if (base64Data) {
        const decodedData = JSON.parse(decodeURIComponent(escape(atob(base64Data))));
        Object.keys(decodedData).forEach((key) => {
          localStorage.setItem(key, decodedData[key]);
        });
        console.log('[Migration] Successfully imported LocalStorage data and session.');
        
        // Clean URL hash so it doesn't trigger again on subsequent reloads
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  } catch (e) {
    console.error('[Migration] Failed to import migration data:', e);
    // Clean URL hash even if parsing failed to prevent repeating failures
    if (window.location.hash.startsWith('#migration=')) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }
}
// ==========================================

import App from './App.tsx'
import { Analytics } from "@vercel/analytics/react";
import { AppProvider } from './context/AppContext';
import { ConfirmationProvider } from './context/ConfirmationContext';
import GlobalErrorBoundary from './components/GlobalErrorBoundary.tsx';
import { logger } from './lib/logger.ts';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Initialize logger early
logger.info('Application starting...');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GlobalErrorBoundary>
        <AppProvider>
          <ConfirmationProvider>
            <App />
          </ConfirmationProvider>
        </AppProvider>
        <Analytics />
      </GlobalErrorBoundary>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
