import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-guard'
import { applyAppointmentStatus } from '@/lib/appointment-status'

export async function POST(request: Request) {
  const session = await requireAdminSession()
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })
  const { businessId, appointmentId, status } = await request.json().catch(() => ({}))
  if (!businessId || !appointmentId || !status) return NextResponse.json({ error: 'Missing businessId, appointmentId or status' }, { status: 400 })
  const result = await applyAppointmentStatus(businessId, appointmentId, status)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
