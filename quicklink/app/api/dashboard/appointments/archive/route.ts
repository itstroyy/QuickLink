import { NextResponse } from 'next/server'
import { businessSession } from '@/lib/dashboard/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Archive/Restore only — never a permanent delete, and never a status
// change (that's /api/dashboard/appointments/status, which also keeps
// Google Calendar in sync). Mirrors /api/client-activity/archive but for an
// authenticated owner/manager/admin session instead of a legacy token.
export async function POST(request: Request) {
  const { businessId, appointmentId, archived } = await request.json().catch(() => ({}))
  if (!businessId || !appointmentId || typeof archived !== 'boolean') return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const session = await businessSession(businessId)
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 })
  const { error } = await admin.from('appointments').update({ archived }).eq('id', appointmentId).eq('business_id', businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
