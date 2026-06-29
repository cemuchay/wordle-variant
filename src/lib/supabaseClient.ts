import { createClient } from '@supabase/supabase-js';
import { asyncStorage } from '../utils/storage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: asyncStorage,
    persistSession: true,
    detectSessionInUrl: true
  }
});