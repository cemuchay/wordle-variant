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
  const isMigrated = localStorage.getItem('wordle_migrated_v1') === 'true';

  if (isMigrated) {
    // Already migrated: delete auth token to sign out on the old domain safely
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

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

    // Define globally accessible trigger function
    let intervalId: any = null;
    (window as any).triggerMigration = () => {
      if (intervalId) clearInterval(intervalId);
      localStorage.setItem('wordle_migrated_v1', 'true');
      window.location.replace(redirectUrl);
    };

    // Render interactive transfer screen
    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.innerHTML = `
        <div style="background:#030712; color:#ffffff; font-family:'Outfit',system-ui,sans-serif; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:20px; box-sizing:border-box;">
          <div style="font-size: 40px; margin-bottom: 16px;">🧩</div>
          <h1 style="font-size:26px; font-weight:900; letter-spacing:-0.05em; text-transform:uppercase; margin:0 0 12px 0;">We have moved!</h1>
          <p style="color:#9ca3af; font-size:15px; margin:0 0 28px 0; max-width:460px; line-height:1.6;">
            Wordle Variant is now hosted on our custom domain: <strong style="color:#ffffff;">${targetDomain}</strong>.<br/>
            We will securely transfer your game statistics, active streaks, and login session so you don't lose any progress.
          </p>
          <button id="proceed-btn" onclick="window.triggerMigration()" style="padding: 14px 28px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border: none; color: white; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; border-radius: 12px; cursor: pointer; box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3); transition: all 0.2s ease;">
            PROCEED TO NEW SITE
          </button>
          <div id="countdown-text" style="color:#6b7280; font-size:12px; margin-top:16px;">Auto-redirecting in 20 seconds...</div>
        </div>
      `;
    }

    // Initialize the countdown timer
    let secondsLeft = 20;
    intervalId = setInterval(() => {
      secondsLeft--;
      const textElem = document.getElementById('countdown-text');
      if (textElem) {
        textElem.textContent = `Auto-redirecting in ${secondsLeft} second${secondsLeft !== 1 ? 's' : ''}...`;
      }
      if (secondsLeft <= 0) {
        clearInterval(intervalId);
        (window as any).triggerMigration();
      }
    }, 1000);
  }
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
