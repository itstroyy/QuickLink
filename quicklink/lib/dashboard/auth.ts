import 'server-only'
import { createClient } from '@/lib/supabase/server'

export async function businessSession(businessId: unknown) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { ok: false as const, status: 401 }
  if (typeof businessId !== 'string' || !/^[0-9a-f-]{36}$/i.test(businessId)) return { ok: false as const, status: 400 }
  const { data: allowed, error: permissionError } = await supabase.rpc('can_manage_business', { target_business: businessId })
  if (permissionError || allowed !== true) return { ok: false as const, status: 403 }
  const { data: admin } = await supabase.rpc('is_quicklink_admin')
  return { ok: true as const, supabase, user, businessId, isAdmin: admin === true }
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return !origin || origin === new URL(request.url).origin
}
