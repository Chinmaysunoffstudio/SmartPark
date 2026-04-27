import { createClient } from '@supabase/supabase-js';

const supabaseUrlRaw = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sanitize URL by removing /rest/v1/ suffix if present
const supabaseUrl = supabaseUrlRaw?.replace(/\/rest\/v1\/?$/, '');

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Supabase environment variables are missing. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your settings.';
  console.error(errorMsg);
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
