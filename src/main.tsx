import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Analytics } from '@vercel/analytics/react'
import { AppProvider } from './context/AppContext'
import { ConfirmationProvider } from './context/ConfirmationContext'
import GlobalErrorBoundary from './components/GlobalErrorBoundary.tsx'
import { logger } from './lib/logger.ts'
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { safeLocalStorage, safeSessionStorage } from './utils/storage'

// Install global storage overrides to catch security and storage full errors globally
try {
  Object.defineProperty(window, 'localStorage', { value: safeLocalStorage, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { value: safeSessionStorage, configurable: true });
} catch (e) {
  console.warn('Failed to redefine window storage objects:', e);
}

// ==========================================
// 🚀 DOMAIN MIGRATION & LOCAL STORAGE SYNC
// ==========================================
// Explicitly list the old production domains we want to redirect from.
// This excludes preview environments (Vercel previews and Render's wordle-variant-preview) and local development.
const OLD_PRODUCTION_DOMAINS = ['wordle-variant.vercel.app', 'wordle-variant.onrender.com'];
const targetDomain = 'www.wordle-variant.xyz';

try {
  if (OLD_PRODUCTION_DOMAINS.includes(window.location.hostname)) {
    const isMigrated = safeLocalStorage.getItem('wordle_migrated_v1') === 'true';

    if (isMigrated) {
      // Already migrated: delete auth token to sign out on the old domain safely
      const keysToRemove: string[] = [];
      for (let i = 0; i < safeLocalStorage.length; i++) {
        const key = safeLocalStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => safeLocalStorage.removeItem(key));

      // Redirect directly without migration payload (to avoid overwriting new progress)
      window.location.replace(`https://${targetDomain}${window.location.pathname}${window.location.search}`);
    } else {
      // First time migrating: Gather data
      const migrationData: Record<string, string> = {};
      
      // Get today's date in Lagos timezone to migrate current game state
      const todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Lagos",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      for (let i = 0; i < safeLocalStorage.length; i++) {
        const key = safeLocalStorage.key(i);
        if (key) {
          const isAuthToken = key.startsWith('sb-') && key.endsWith('-auth-token');
          const isStats = key === 'wordle-statistics';
          const isTodayGame = key === `wordle-${todayStr}`;
          
          let isUnsyncedGame = false;
          if (key.startsWith('wordle-') && !isTodayGame) {
            try {
              const val = safeLocalStorage.getItem(key);
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
            const val = safeLocalStorage.getItem(key);
            if (val) {
              migrationData[key] = val;
            }
          }
        }
      }

      // Build redirect URL carrying the migration payload
      let redirectUrl = `https://${targetDomain}${window.location.pathname}${window.location.search}`;
      if (Object.keys(migrationData).length > 0) {
        try {
          const serialized = btoa(unescape(encodeURIComponent(JSON.stringify(migrationData))));
          redirectUrl += `#migration=${serialized}`;
        } catch (e) {
          console.error('Failed to serialize migration data:', e);
        }
      }

      // Mark as migrated in LocalStorage immediately before redirect
      safeLocalStorage.setItem('wordle_migrated_v1', 'true');

      // Render loading transition screen
      const rootElement = document.getElementById('root');
      if (rootElement) {
        rootElement.innerHTML = `
          <div style="background:#030712; color:#ffffff; font-family:'Outfit',system-ui,sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:20px; box-sizing:border-box;">
            <div style="font-size: 32px; margin-bottom: 12px;">🧩</div>
            <h1 style="font-size:24px; font-weight:900; letter-spacing:-0.05em; text-transform:uppercase; margin:0 0 12px 0;">We have moved!</h1>
            <p style="color:#9ca3af; font-size:14px; margin:0 0 24px 0; max-width:400px; line-height:1.6;">Transferring your game stats, streaks, and login session securely to the new domain...</p>
            <div style="width:32px; height:32px; border:3px solid #1f2937; border-top-color:#6366f1; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
            <style>
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </div>
        `;
      }

      // Redirect after 800ms
      setTimeout(() => {
        window.location.replace(redirectUrl);
      }, 800);
    }
  } else {
    // We are on the target domain: check if we arrived with a migration payload
    try {
      if (window.location.hash.startsWith('#migration=')) {
        const base64Data = window.location.hash.split('#migration=')[1];
        if (base64Data) {
          const decodedData = JSON.parse(decodeURIComponent(escape(atob(base64Data))));
          Object.keys(decodedData).forEach((key) => {
            safeLocalStorage.setItem(key, decodedData[key]);
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
} catch (err) {
  console.error('[Boot/Migration] Fatal exception caught in redirect block:', err);
}

  // ==========================================
  // Mount the React Application (only on the new domain)
  // ==========================================
  logger.info('Application starting...');

  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        logger.error('Query Error:', error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        logger.error('Mutation Error:', error);
      },
    }),
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
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </StrictMode>
  );

