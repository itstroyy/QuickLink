import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-guard'
import { sendBusinessEmail } from '@/lib/email'

// Dev/admin-only utility to verify Resend is wired up correctly without
// placing a real order. Never touches or returns RESEND_API_KEY.
export async function POST(request: Request) {
  const session = await requireAdminSession()
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })
  const { businessId } = await request.json().catch(() => ({}))
  if (!businessId) return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
  const result = await sendBusinessEmail(businessId, 'order', 'Quicklink test email', 'This is a test notification from Quicklink to confirm Resend is configured correctly.')
  return NextResponse.json(result)
}
