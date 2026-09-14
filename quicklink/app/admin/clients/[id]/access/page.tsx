import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminAccessManager from '@/components/admin-access-manager'
import type { Business } from '@/lib/types'

// Admin-only (proxy.ts already gates all of /admin to is_quicklink_admin).
// Member emails come from auth.users via the service-role client — RLS
// only exposes business_members' user_id, never a browsable directory of
// every account, so this lookup deliberately stays server-side here.
export default async function ClientAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: business }, { data: memberRows }, { data: invitationRows }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('business_members').select('user_id,role,created_at').eq('business_id', id).order('created_at'),
    supabase.from('business_invitations').select('id,email,role,expires_at,created_at').eq('business_id', id).is('accepted_at', null).order('created_at'),
  ])
  if (!business) notFound()

  const admin = createAdminClient()
  const members = await Promise.all((memberRows || []).map(async (member) => {
    let email = member.user_id
    if (admin) { const { data } = await admin.auth.admin.getUserById(member.user_id); email = data.user?.email || email }
    return { user_id: member.user_id, role: member.role as 'owner' | 'manager', email, created_at: member.created_at }
  }))

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-3xl">
    <Link href={`/admin/clients/${id}`} className="inline-flex items-center gap-2 text-sm text-[#77776f]"><ArrowLeft size={16}/> Back to overview</Link>
    <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Owner access</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{(business as Business).name}</h1><p className="mt-2 text-[#77776f]">Invite, view, revoke and reinvite the business owner or manager accounts that can sign in to /dashboard for this business.</p></div>
    <div className="mt-8"><AdminAccessManager businessId={id} members={members} invitations={(invitationRows || []) as any}/></div>
  </div></main>
}
