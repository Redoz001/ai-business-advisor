import { createClient } from "@supabase/supabase-js";

// =====================================================
// ENV VALIDATION
// =====================================================
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase config missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are defined in your .env file."
  );
}

// =====================================================
// SUPABASE CLIENT
// =====================================================
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});