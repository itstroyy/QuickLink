import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'No business access — Quicklink', robots: { index: false, follow: false } }

// Reached only when a signed-in user is not a Quicklink admin and has no row
// in business_members — e.g. an invitation hasn't been accepted yet, or was
// revoked. Never shows another business's data.
export default async function NoAccessPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return <main className="mx-auto grid min-h-screen max-w-md place-items-center p-6 text-center">
    <div>
      <h1 className="text-2xl font-semibold">No business assigned yet</h1>
      <p className="mt-3 text-sm text-[#77776f]">{user?.email ? <>The account <strong>{user.email}</strong> isn&apos;t linked to a business yet.</> : 'This account isn’t linked to a business yet.'} Ask your Quicklink administrator to invite this email to a business, then refresh this page.</p>
      <Link href="/login" className="dashboard-secondary mt-6 inline-flex">Back to sign in</Link>
    </div>
  </main>
}
