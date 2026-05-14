import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';
import { useApp } from '../context/AppContext';

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

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) console.error("Login error:", error.message);
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Logout error:", error.message);
      triggerToast("Error signing out");
    } else {
      // Clear localStorage that starts with wordle
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('wordle')) {
          localStorage.removeItem(key);
        }
      });
      triggerToast("Signed out successfully");
    }
  };

  return { user, loading, signInWithGoogle, signOut };
};