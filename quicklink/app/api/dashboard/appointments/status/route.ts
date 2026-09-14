import { NextResponse } from 'next/server'
import { businessSession } from '@/lib/dashboard/auth'
import { applyAppointmentStatus } from '@/lib/appointment-status'

// Appointments have no direct RLS update policy for business members (see
// 202609140001_business_membership.sql) — status changes go through this
// guarded route so a cancellation always keeps Google Calendar in sync,
// the same rule the admin Activity screen and the legacy Client Activity
// link already follow (lib/appointment-status.ts).
export async function POST(request: Request) {
  const { businessId, appointmentId, status } = await request.json().catch(() => ({}))
  if (!businessId || !appointmentId || !status) return NextResponse.json({ error: 'Missing businessId, appointmentId or status' }, { status: 400 })
  const session = await businessSession(businessId)
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })
  const result = await applyAppointmentStatus(businessId, appointmentId, status)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
