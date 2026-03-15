import { createBrowserClient } from '@supabase/ssr'

// Nämä arvot luetaan Vercelin tai paikallisen .env.local -tiedoston ympäristömuuttujista.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey 
  ? createBrowserClient(supabaseUrl, supabaseAnonKey) 
  : null;
