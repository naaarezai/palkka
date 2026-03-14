import { createClient } from '@supabase/supabase-js'

// Nämä arvot luetaan Vercelin tai paikallisen .env.local -tiedoston ympäristömuuttujista.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = typeof window !== 'undefined' && supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
