import { createClient } from '@supabase/supabase-js'
import { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY } from './supabaseConfig'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
    auth: {
    // ✅ THIS IS CRITICAL: Store session in AsyncStorage
    storage: AsyncStorage,
    // ✅ Auto-refresh token before it expires
    autoRefreshToken: true,
    // ✅ Auto-recover session from storage
    persistSession: true,
    // ✅ Detect session changes
    detectSessionInUrl: false,
  },
})