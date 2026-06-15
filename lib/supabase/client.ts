import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

let client: SupabaseClient<Database, 'public'> | null = null

export function createClient(): SupabaseClient<Database, 'public'> {
  if (client) {
    return client
  }
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  client = createSupabaseClient<Database, 'public'>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })
  
  return client
}
