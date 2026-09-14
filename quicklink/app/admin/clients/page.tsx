import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ClientList from '@/components/client-list'
import type { Business } from '@/lib/types'

export default async function ClientsPage() {
  const supabase = await createClient()
  const [{ data, error }, membersResult, invitationsResult] = await Promise.all([
    supabase.from('businesses').select('*').neq('status', 'archived').order('created_at', { ascending: false }),
    supabase.from('business_members').select('business_id'),
    supabase.from('business_invitations').select('business_id,accepted_at,expires_at'),
  ])

  const members = (membersResult.data || []) as Array<{ business_id: string }>
  const invitations = (invitationsResult.data || []) as Array<{ business_id: string; accepted_at: string | null; expires_at: string }>
  const accessByBusiness = new Map<string, 'owner' | 'pending' | 'expired' | 'none'>()
  for (const member of members) accessByBusiness.set(member.business_id, 'owner')
  for (const invite of invitations) {
    if (accessByBusiness.has(invite.business_id)) continue
    if (invite.accepted_at) continue
    const expired = new Date(invite.expires_at).getTime() < Date.now()
    const current = accessByBusiness.get(invite.business_id)
    if (!expired) accessByBusiness.set(invite.business_id, 'pending')
    else if (current !== 'pending') accessByBusiness.set(invite.business_id, 'expired')
  }

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Client library</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Clients</h1><p className="mt-2 text-[#77776f]">Search, update, duplicate, or pause any Quicklink page.</p></div><Link href="/admin/clients/new" className="flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-semibold text-white"><Plus size={16}/> Add client</Link></div>
    {error ? <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Database setup required</h2><p className="mt-2 text-sm leading-6 text-amber-800">Run the Quicklink migration in Supabase SQL Editor, then refresh this page. Details are in the project README.</p></div> : <ClientList initialBusinesses={(data ?? []) as Business[]} accessByBusiness={Object.fromEntries(accessByBusiness)}/>}
  </div></main>
}
