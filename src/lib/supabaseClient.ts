import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { asyncStorage } from '../utils/storage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _supabase: SupabaseClient | null = null;

const getSupabase = (): SupabaseClient => {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: asyncStorage,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _supabase;
};

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});