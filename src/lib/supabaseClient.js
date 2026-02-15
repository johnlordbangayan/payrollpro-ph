import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    // This tells the client to retry requests if the connection blips
    fetch: (...args) => fetch(...args).catch(err => {
      console.error("Network error detected, retrying...", err);
      return fetch(...args);
    })
  }
});