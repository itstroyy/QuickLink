import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendBusinessEmail } from '@/lib/email'
import { getCalendarProvider } from '@/lib/calendar'
import { sendBusinessPush } from '@/lib/push'
import { formatDate, formatTime } from '@/lib/display-format'
import { randomBytes } from 'node:crypto'
import { hashBookingManageToken } from '@/lib/booking-manage'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.businessId || !body.date || !body.time || !body.name || !body.phone) {
      return NextResponse.json({ error: 'Missing required booking details.' }, { status: 400 })
    }
    const supabase = await createClient()
    const manageToken = randomBytes(32).toString('base64url')
    // Save to Supabase first. Email and Calendar are both optional and must
    // never prevent — or appear to prevent — this booking from succeeding.
    const { data, error } = await supabase.rpc('submit_booking_managed', {
      p_business_id: body.businessId,
      p_service_id: body.serviceId || null,
      p_date: body.date,
      p_start_time: body.time,
      p_name: body.name,
      p_phone: body.phone,
      p_email: body.email || null,
      p_notes: body.notes || null,
      p_manage_token_hash: hashBookingManageToken(manageToken),
    })
    if (error || !data?.[0]) {
      console.error('[Quicklink booking] submit failed', error)
      return NextResponse.json({ error: error?.message || 'Unable to book that time.' }, { status: 400 })
    }
    const appointment = data[0]
    const admin = createAdminClient()
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
    const manageUrl = `${origin}/booking/manage/${manageToken}`

    const emailBody = `New Quicklink Booking\n\nCustomer: ${body.name}\nPhone: ${body.phone}\n${body.email ? `Email: ${body.email}\n` : ''}${body.serviceName ? `Service: ${body.serviceName}\n` : ''}Date: ${body.date}\nTime: ${appointment.start_time}\n${body.notes ? `Notes: ${body.notes}\n` : ''}Quicklink booking ID: ${appointment.appointment_id}`
    const [email, push] = await Promise.all([
      sendBusinessEmail(body.businessId, 'booking', `New booking — ${body.name}`, emailBody),
      sendBusinessPush(body.businessId, { title: 'New booking', body: `${body.name}${body.serviceName ? ` · ${body.serviceName}` : ''} · ${formatDate(body.date)} at ${formatTime(appointment.start_time)}`, tag: `booking-${appointment.appointment_id}` }),
    ])

    // Google Calendar sync is entirely optional — if nothing is connected,
    // getCalendarProvider() returns null and the booking above already
    // succeeded regardless.
    let calendarEventId: string | null = null
    const provider = await getCalendarProvider(body.businessId)
    if (provider) {
      const startISO = `${body.date}T${appointment.start_time.slice(0, 5)}:00`
      const endISO = `${body.date}T${appointment.end_time.slice(0, 5)}:00`
      const description = [
        `Customer: ${body.name}`, `Phone: ${body.phone}`, body.email ? `Email: ${body.email}` : null,
        body.notes ? `Notes: ${body.notes}` : null, `Duration: ${appointment.start_time.slice(0, 5)}–${appointment.end_time.slice(0, 5)}`,
        `Quicklink booking ID: ${appointment.appointment_id}`,
      ].filter(Boolean).join('\n')
      calendarEventId = await provider.createEvent({ summary: `${body.serviceName ? `${body.serviceName} — ` : ''}${body.name}`, description, startISO, endISO })
      if (calendarEventId) {
        if (admin) await admin.from('appointments').update({ external_calendar_event_id: calendarEventId }).eq('id', appointment.appointment_id)
      }
    }

    await supabase.from('analytics_events').insert({ business_id: body.businessId, event_type: 'feature_click', metadata: { feature: 'booking', conversion: 'booking_submit' } })
    return NextResponse.json({ ok: true, appointmentId: appointment.appointment_id, startTime: appointment.start_time, endTime: appointment.end_time, manageUrl, emailSent: email.sent, pushSent: push.sent, calendarSynced: Boolean(calendarEventId) })
  } catch (error) {
    console.error('[Quicklink booking] invalid request', error)
    return NextResponse.json({ error: 'Invalid booking request.' }, { status: 400 })
  }
}
