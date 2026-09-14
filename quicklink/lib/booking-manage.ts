import 'server-only'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export function hashBookingManageToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function getManagedAppointment(token: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_booking_for_manage', { p_manage_token_hash: hashBookingManageToken(token) })
  if (error) {
    console.error('[Quicklink booking manage] Lookup failed', { error: error.message })
    return null
  }
  const row = data?.[0]
  return row ? { ...row, businesses: { name: row.business_name, slug: row.business_slug } } : null
}
