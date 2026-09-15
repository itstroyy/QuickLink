import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/dashboard/dashboard-shell'
import type { OwnerBusiness } from '@/lib/dashboard/business-context'
import type { Business } from '@/lib/types'

export const metadata: Metadata = { title: 'Dashboard — Quicklink', robots: { index: false, follow: false } }

// Only fetches the business list + admin flag for the nav chrome. Each page
// under /dashboard resolves its own active business from its own
// searchParams (layouts in this Next version don't receive searchParams),
// and every actual query is still enforced by Supabase RLS regardless.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
    businesses = ((data || []) as unknown as Array<{ role: 'owner' | 'manager'; businesses: Business | null }>)
      .filter((row): row is { role: 'owner' | 'manager'; businesses: Business } => Boolean(row.businesses) && row.businesses!.status !== 'archived')
      .map((row) => ({ ...row.businesses, role: row.role }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // Rendered inline (not redirected to a sub-route) — a redirect here would
  // point right back into this same layout and loop.
  if (!businesses.length) {
    return <main className="mx-auto grid min-h-screen max-w-md place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">No business assigned yet</h1>
        <p className="mt-3 text-sm text-[#77776f]">{user.email ? <>The account <strong>{user.email}</strong> isn&apos;t linked to a business yet.</> : 'This account isn’t linked to a business yet.'} Ask your Quicklink administrator to invite this email to a business, then refresh this page.</p>
        <Link href="/login" className="dashboard-secondary mt-6 inline-flex">Back to sign in</Link>
      </div>
    </main>
  }

  return <Suspense fallback={null}><DashboardShell businesses={businesses} isAdmin={isAdmin}>{children}</DashboardShell></Suspense>
}
