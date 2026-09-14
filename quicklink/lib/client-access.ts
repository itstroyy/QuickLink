import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BusinessClientAccess } from '@/lib/types'

const defaultAccess = (businessId: string): BusinessClientAccess => ({ business_id: businessId, client_activity_enabled: false, client_activity_show_orders: true, client_activity_show_bookings: true, client_activity_show_service_requests: true, activity_access_token: '' })

// Used by the admin client-editor pages, which already have an
// authenticated (RLS-protected) Supabase client from the request — reading
// through it here means this doesn't silently fall back to defaults if
// SUPABASE_SECRET_KEY happens to be unset. Pass that page's own `supabase`
// client in (see app/admin/clients/[id]/{page,edit/page}.tsx).
export async function getClientAccess(supabase: { from: (table: string) => any }, businessId: string): Promise<BusinessClientAccess> {
  const { data, error } = await supabase.from('business_client_access').select('*').eq('business_id', businessId).maybeSingle()
  if (error) console.error('[Quicklink client-access] Could not load admin settings', { businessId, error: error.message })
  return (data as BusinessClientAccess) || defaultAccess(businessId)
}

// Verifies a private Client Activity link. Returns null for anything that
// doesn't check out — wrong token, disabled access, unknown business slug —
// with no distinction in the response, so a guess can't be narrowed down.
// This one MUST stay on the admin (service-role) client — it runs with no
// Supabase auth session (public route, token-gated instead), and
// business_client_access has no RLS policy granting anon/public read.
export async function verifyClientToken(slug: string, token: string): Promise<{ businessId: string; businessName: string; access: BusinessClientAccess } | null> {
  if (!slug || !token) return null
  const admin = createAdminClient()
  if (!admin) { console.error('[Quicklink client-access] SUPABASE_SECRET_KEY is not set — private Client Activity links cannot be verified.'); return null }

  const { data: business } = await admin.from('businesses').select('id,name,slug,status').eq('slug', slug).maybeSingle()
  if (!business || business.status === 'archived') return null

  const { data: access } = await admin.from('business_client_access').select('*').eq('business_id', business.id).maybeSingle()
  if (!access || !access.client_activity_enabled || access.activity_access_token !== token) return null

  return { businessId: business.id, businessName: business.name, access: access as BusinessClientAccess }
}
