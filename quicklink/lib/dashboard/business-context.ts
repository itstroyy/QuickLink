import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Business } from '@/lib/types'

export type OwnerRole = 'owner' | 'manager' | 'admin'
export type OwnerBusiness = Business & { role: OwnerRole }

// Every /dashboard page calls this with its own searchParams.business (Next
// layouts don't receive searchParams, so the active business is resolved
// per-page, not once in the layout). Access itself is still enforced by
// Supabase RLS (can_manage_business) on every query — this only decides
// which business's data a page asks for and redirects if the signed-in user
// genuinely has none.
export async function requireOwnerContext(preferredBusinessId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: isAdminData } = await supabase.rpc('is_quicklink_admin')
  const isAdmin = isAdminData === true

  let businesses: OwnerBusiness[] = []
  if (isAdmin) {
    const { data } = await supabase.from('businesses').select('*').neq('status', 'archived').order('name')
    businesses = ((data || []) as Business[]).map((business) => ({ ...business, role: 'admin' as const }))
  } else {
    const { data } = await supabase.from('business_members').select('role,businesses(*)').eq('user_id', user.id)
    businesses = ((data || []) as Array<{ role: OwnerRole; businesses: Business | null }>)
      .filter((row): row is { role: OwnerRole; businesses: Business } => Boolean(row.businesses) && row.businesses!.status !== 'archived')
      .map((row) => ({ ...row.businesses, role: row.role }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  if (!businesses.length) redirect('/dashboard/no-access')

  const business = businesses.find((item) => item.id === preferredBusinessId) || businesses[0]
  return { user, isAdmin, businesses, business }
}
