import 'server-only'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export function hashOrderManageToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function getManagedOrder(token: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_order_for_manage', { p_manage_token_hash: hashOrderManageToken(token) })
  if (error) {
    console.error('[Quicklink order manage] Lookup failed', { error: error.message })
    return null
  }
  return data?.[0] || null
}
