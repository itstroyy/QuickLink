import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type SetupIssue = { businessId: string; businessName: string; label: string; action: string; href: string; priority: number }

// Ranks actionable problems per business, most important first, and only
// ever surfaces one issue per business — the dashboard should point at what
// to fix next, not itemize everything technically incomplete about a page.
export async function computeSetupIssues(): Promise<SetupIssue[]> {
  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    businessesResult, productsResult, servicesResult, hoursResult, featuresResult, linksResult,
    membersResult, invitationsResult,
  ] = await Promise.all([
    supabase.from('businesses').select('id,name,logo_url,status').eq('status', 'active'),
    supabase.from('products').select('business_id'),
    supabase.from('services').select('business_id'),
    supabase.from('business_hours').select('business_id'),
    supabase.from('business_features').select('business_id,feature_key,enabled').eq('enabled', true),
    supabase.from('business_links').select('business_id,type'),
    supabase.from('business_members').select('business_id,role'),
    supabase.from('business_invitations').select('business_id,email,expires_at,accepted_at').is('accepted_at', null),
  ])
  const calendarResult = admin ? await admin.from('business_calendar_connections').select('business_id') : { data: [] as { business_id: string }[] }

  const businesses = businessesResult.data ?? []
  const catalogIds = new Set([...(productsResult.data || []), ...(servicesResult.data || [])].map((r) => r.business_id))
  const hoursIds = new Set((hoursResult.data || []).map((r) => r.business_id))
  const bookingIds = new Set((featuresResult.data || []).filter((f) => f.feature_key === 'booking').map((f) => f.business_id))
  const actionIds = new Set((featuresResult.data || []).filter((f) => ['ordering', 'booking', 'request_service'].includes(f.feature_key)).map((f) => f.business_id))
  const reviewLinkIds = new Set((linksResult.data || []).filter((l) => l.type === 'google_review').map((l) => l.business_id))
  const ownerIds = new Set((membersResult.data || []).map((m) => m.business_id))
  const calendarIds = new Set(((calendarResult.data as { business_id: string }[] | null) || []).map((c) => c.business_id))
  const invitationsByBusiness = new Map<string, { email: string; expires_at: string }>()
  for (const invite of invitationsResult.data || []) if (!invitationsByBusiness.has(invite.business_id)) invitationsByBusiness.set(invite.business_id, invite)

  const issues: SetupIssue[] = []
  for (const b of businesses) {
    const invite = invitationsByBusiness.get(b.id)
    const inviteExpired = invite ? new Date(invite.expires_at).getTime() < Date.now() : false
    if (!ownerIds.has(b.id) && invite && inviteExpired) issues.push({ businessId: b.id, businessName: b.name, label: 'Owner invite expired', action: 'Resend invite', href: `/admin/clients/${b.id}/access`, priority: 1 })
    else if (!ownerIds.has(b.id) && invite) issues.push({ businessId: b.id, businessName: b.name, label: 'Owner invite pending', action: 'Manage access', href: `/admin/clients/${b.id}/access`, priority: 2 })
    else if (!ownerIds.has(b.id)) issues.push({ businessId: b.id, businessName: b.name, label: 'No owner assigned', action: 'Invite owner', href: `/admin/clients/${b.id}/access`, priority: 3 })
    else if (!catalogIds.has(b.id)) issues.push({ businessId: b.id, businessName: b.name, label: 'No products or services', action: 'Fix', href: `/admin/clients/${b.id}/edit`, priority: 4 })
    else if (!hoursIds.has(b.id)) issues.push({ businessId: b.id, businessName: b.name, label: 'No business hours', action: 'Fix', href: `/admin/clients/${b.id}/hub`, priority: 5 })
    else if (!actionIds.has(b.id)) issues.push({ businessId: b.id, businessName: b.name, label: 'No primary customer action', action: 'Fix', href: `/admin/clients/${b.id}/edit`, priority: 6 })
    else if (bookingIds.has(b.id) && !calendarIds.has(b.id)) issues.push({ businessId: b.id, businessName: b.name, label: 'Google Calendar not connected', action: 'Connect', href: `/admin/clients/${b.id}`, priority: 7 })
    else if (!b.logo_url) issues.push({ businessId: b.id, businessName: b.name, label: 'No logo', action: 'Fix', href: `/admin/clients/${b.id}/edit`, priority: 8 })
    else if (!reviewLinkIds.has(b.id)) issues.push({ businessId: b.id, businessName: b.name, label: 'No review link', action: 'Fix', href: `/admin/clients/${b.id}/edit`, priority: 9 })
  }
  issues.sort((a, b) => a.priority - b.priority)
  return issues
}
