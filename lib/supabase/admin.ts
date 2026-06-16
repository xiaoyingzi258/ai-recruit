import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from './server'

let adminClientInstance: ReturnType<typeof createClient> | null = null

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // 如果没有配置 service role key，回退到普通 client（但会受 RLS 限制）
  if (!serviceRoleKey || serviceRoleKey === 'your_service_role_key_here') {
    console.warn(
      '[supabase] SUPABASE_SERVICE_ROLE_KEY 未配置，使用普通 client。' +
      '请在 .env.local 中添加该 key 以启用完整的服务端数据库操作。'
    )
    return createServerClient()
  }

  if (adminClientInstance) {
    return adminClientInstance
  }

  adminClientInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )

  return adminClientInstance
}
