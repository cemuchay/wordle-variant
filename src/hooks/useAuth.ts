import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session, User } from '@supabase/supabase-js';
import { useApp } from '../context/AppContext';
import { safeLocalStorage } from '../utils/storage';
import {
  clearTrustedDeviceStamp,
  getTrustedDeviceStamp,
  saveTrustedDeviceStamp,
} from '../utils/trustedDevice';

let sharedSessionPromise: Promise<{ data: { session: Session | null }; error: unknown }> | null = null;
let sharedSessionResolvedAt = 0;

/**
 * Deduplicates concurrent `supabase.auth.getSession()` calls during app boot.
 */
export function getSharedAuthSession(): Promise<{ data: { session: Session | null }; error: unknown }> {
  const now = Date.now();
  if (sharedSessionPromise && now - sharedSessionResolvedAt < 2000) {
    return sharedSessionPromise;
  }
  sharedSessionResolvedAt = now;
  sharedSessionPromise = supabase.auth.getSession().finally(() => {
    setTimeout(() => {
      sharedSessionPromise = null;
    }, 2000);
  });
  return sharedSessionPromise;
}

export const useAuth = () => {
  const [trustedStamp] = useState(() => getTrustedDeviceStamp());

  const [user, setUser] = useState<User | null>(() => {
    if (trustedStamp) {
      return (trustedStamp.user as unknown as User) ?? null;
    }
    return null;
  });

  // If device is trusted (<24h), do NOT block initial render on auth loading
  const [loading, setLoading] = useState<boolean>(() => !trustedStamp);
  const [isRevalidatingAuth, setIsRevalidatingAuth] = useState<boolean>(() => Boolean(trustedStamp));

  useEffect(() => {
    let isMounted = true;

    const updateUserIfChanged = (nextUser: User | null) => {
      if (!isMounted) return;
      setUser((prev) =>
        prev?.id === nextUser?.id && prev?.updated_at === nextUser?.updated_at
          ? (prev ?? nextUser)
          : nextUser,
      );
      saveTrustedDeviceStamp({
        isAuthenticated: Boolean(nextUser),
        user: nextUser
          ? {
              id: nextUser.id,
              email: nextUser.email,
              user_metadata: nextUser.user_metadata,
              app_metadata: nextUser.app_metadata,
              aud: nextUser.aud,
              created_at: nextUser.created_at,
              updated_at: nextUser.updated_at,
            }
          : null,
      });
    };

    // 1. Check active sessions on load (deduplicated across boot hooks)
    getSharedAuthSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        updateUserIfChanged(session?.user ?? null);
        setLoading(false);
        setIsRevalidatingAuth(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
        setIsRevalidatingAuth(false);
      });

    // 2. Listen for auth changes (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      updateUserIfChanged(session?.user ?? null);
      setLoading(false);
      setIsRevalidatingAuth(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const { triggerToast } = useApp();

  const signInWithProvider = async (provider: 'google' | 'apple' | 'facebook') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      console.error(`${provider} Login error:`, error.message);
      triggerToast(error.message);
    }
    return { error };
  };

  const signInWithGoogle = async () => {
    return signInWithProvider('google');
  };

  const signInWithEmail = async (email: string, pass: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) {
      console.error("Email Login error:", error.message);
      triggerToast(error.message);
    } else {
      triggerToast("Signed in successfully!");
    }
    return { data, error };
  };

  const signOut = async () => {
    try {
      await supabase.removeAllChannels();
    } catch (e) {
      console.warn("Presence cleanup during signout failed:", e);
    }
    clearTrustedDeviceStamp();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout error:", error.message);
      triggerToast("Error signing out");
    } else {
      // Clear localStorage that starts with wordle or variant_daily_config
      safeLocalStorage.getAllKeys().forEach(key => {
        if (key.startsWith('wordle') || key.startsWith('variant_daily_config_')) {
          safeLocalStorage.removeItem(key);
        }
      });
      triggerToast("Signed out successfully");
    }
  };

  return {
    user,
    loading,
    isTrustedBoot: Boolean(trustedStamp),
    isRevalidatingAuth,
    signInWithGoogle,
    signInWithProvider,
    signInWithEmail,
    signOut,
  };
};