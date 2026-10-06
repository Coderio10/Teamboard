import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,      // keep the session in localStorage
      autoRefreshToken: true,    // renew the short-lived token automatically
      detectSessionInUrl: true,  // pick up the magic-link token on return
    },
  }
);