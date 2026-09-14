import 'server-only'
import { createClient } from '@/lib/supabase/server'

// The calendar and client-activity API routes use the admin (service-role)
// client, which bypasses Row Level Security entirely — so unlike the
// browser-facing Supabase calls elsewhere in the app, these routes must
// check for a signed-in session themselves before doing anything.
export async function requireAdminSession(): Promise<{ ok: true } | { ok: false; status: number }> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { ok: false, status: 401 }
  const { data: isAdmin, error: adminError } = await supabase.rpc('is_quicklink_admin')
  if (adminError || !isAdmin) return { ok: false, status: 403 }
  return { ok: true }
}
