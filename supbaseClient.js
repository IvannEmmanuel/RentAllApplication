import { createClient } from '@supabase/supabase-js'
import { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } from './supabaseConfig'

export const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)