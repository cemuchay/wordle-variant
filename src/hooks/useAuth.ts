import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useApp } from '../context/AppContext';
import { safeLocalStorage } from '../utils/storage';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check active sessions on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen for auth changes (login, logout, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout error:", error.message);
      triggerToast("Error signing out");
    } else {
      // Clear localStorage that starts with wordle
      safeLocalStorage.getAllKeys().forEach(key => {
        if (key.startsWith('wordle')) {
          safeLocalStorage.removeItem(key);
        }
      });
      triggerToast("Signed out successfully");
    }
  };

  return { user, loading, signInWithGoogle, signInWithProvider, signInWithEmail, signOut };
};