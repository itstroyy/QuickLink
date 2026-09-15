import 'server-only'
import { createHash } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

export function hashRequestManageToken(token: string) { return createHash('sha256').update(token).digest('hex') }
export async function getManagedRequest(token: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return null
  const { data, error } = await (await createClient()).rpc('get_request_for_manage', { p_manage_token_hash: hashRequestManageToken(token) })
  if (error) { console.error('[Quicklink request manage] Lookup failed', error); return null }
  return data?.[0] || null
}
