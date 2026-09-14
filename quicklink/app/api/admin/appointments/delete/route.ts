import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCalendarProvider } from '@/lib/calendar'

// Permanent delete for a booking. Admin-only (see components/activity-manager.tsx
// and lib/appointment-status.ts's calendar-sync comment) — the private
// Client Activity page never calls this route.
export async function POST(request: Request) {
  const session = await requireAdminSession()
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })
  const { businessId, appointmentId } = await request.json().catch(() => ({}))
  if (!businessId || !appointmentId) return NextResponse.json({ error: 'Missing businessId or appointmentId' }, { status: 400 })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 })

  const { data: appointment } = await admin.from('appointments').select('external_calendar_event_id').eq('id', appointmentId).eq('business_id', businessId).maybeSingle()
  if (appointment?.external_calendar_event_id) {
    try { const provider = await getCalendarProvider(businessId); if (provider) await provider.deleteEvent(appointment.external_calendar_event_id) }
    catch (error) { console.error('[Quicklink calendar] Failed to remove calendar event for deleted booking', error) }
  }

  const { error } = await admin.from('appointments').delete().eq('id', appointmentId).eq('business_id', businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
