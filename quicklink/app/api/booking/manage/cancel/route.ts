import { NextResponse } from 'next/server'
import { getManagedAppointment, hashBookingManageToken } from '@/lib/booking-manage'
import { applyAppointmentStatus } from '@/lib/appointment-status'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()
    if (typeof token !== 'string') return NextResponse.json({ error: 'Invalid manage link.' }, { status: 400 })
    const appointment = await getManagedAppointment(token)
    if (!appointment) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    if (appointment.status === 'cancelled') return NextResponse.json({ ok: true, status: 'cancelled' })
    if (appointment.status === 'completed') return NextResponse.json({ error: 'A completed appointment cannot be cancelled.' }, { status: 409 })
    const result = await applyAppointmentStatus(appointment.business_id, appointment.id, 'cancelled')
    if (!result.ok && result.error === 'Server is not configured.') {
      const supabase = await createClient()
      const fallback = await supabase.rpc('cancel_booking_managed', { p_manage_token_hash: hashBookingManageToken(token) })
      if (fallback.error || fallback.data !== true) return NextResponse.json({ error: fallback.error?.message || 'Unable to cancel this appointment.' }, { status: 400 })
    } else if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true, status: 'cancelled' })
  } catch (error) {
    console.error('[Quicklink booking manage] Cancellation failed', error)
    return NextResponse.json({ error: 'Unable to cancel this appointment.' }, { status: 400 })
  }
}
