import { NextResponse } from 'next/server'
import { getManagedAppointment } from '@/lib/booking-manage'
import { applyAppointmentStatus } from '@/lib/appointment-status'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPaymentRefund } from '@/lib/refunds'
import { sendCustomerEmail, transactionEmailHtml } from '@/lib/email'

export async function POST(request: Request) {
  try {
    const { token, confirm } = await request.json()
    if (typeof token !== 'string' || confirm !== 'CANCEL') return NextResponse.json({ error: 'Cancellation confirmation is required.' }, { status: 400 })
    const appointment = await getManagedAppointment(token)
    if (!appointment) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 })
    if (appointment.status === 'cancelled') return NextResponse.json({ ok: true, status: 'cancelled' })
    if (['completed','no_show'].includes(appointment.status)) return NextResponse.json({ error: 'This appointment can no longer be cancelled online.' }, { status: 409 })
    const policy = appointment.policy_snapshot || {}
    if (appointment.payment_id && policy.booking_refund_policy === 'manual') return NextResponse.json({ error: 'Contact the business to request cancellation and refund review.' }, { status: 409 })
    const admin = createAdminClient(); if (!admin) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 503 })
    const { data: prefs } = await admin.from('business_preferences').select('timezone').eq('business_id', appointment.business_id).maybeSingle()
    const appointmentAt = zonedDateTimeToUtc(appointment.appointment_date, appointment.start_time, prefs?.timezone || 'America/New_York')
    const hoursBefore = (appointmentAt.getTime() - Date.now()) / 3_600_000
    const inWindow = hoursBefore >= Number(policy.cancellation_window_hours || 24)
    let shouldRefund = appointment.payment_status === 'paid' && policy.booking_refund_policy === 'window' && inWindow
    if (appointment.payment_status === 'deposit_paid') shouldRefund = policy.deposit_refund_policy === 'refundable' || (policy.deposit_refund_policy === 'follow_window' && policy.booking_refund_policy === 'window' && inWindow)
    let refund = null
    if (shouldRefund && appointment.payment_id) {
      refund = await createPaymentRefund({ paymentId: appointment.payment_id, reason: 'Customer cancelled within the business refund policy' })
      if (!refund.ok) return NextResponse.json({ error: refund.error }, { status: 409 })
    }
    const result = await applyAppointmentStatus(appointment.business_id, appointment.id, 'cancelled')
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    const refundText = refund?.ok ? ' An eligible refund has been submitted to the original payment method.' : ''
    await sendCustomerEmail({ to: appointment.customer_email, replyTo: appointment.business_email, subject: `Booking cancelled — ${appointment.business_name}`, text: `Your booking with ${appointment.business_name} on ${appointment.appointment_date} at ${appointment.start_time.slice(0,5)} has been cancelled.${refundText}`, html: transactionEmailHtml({ eyebrow: 'Booking update', title: 'Booking cancelled', businessName: appointment.business_name, badge: refund?.ok ? 'REFUND SUBMITTED' : 'CANCELLED', intro: `Your appointment has been cancelled.${refundText}`, sections: [{ title: 'Booking', rows: [{ label: 'Date', value: appointment.appointment_date }, { label: 'Time', value: appointment.start_time.slice(0,5) }, { label: 'Services', value: appointment.service_name || 'Appointment' }] }] }) })
    return NextResponse.json({ ok: true, status: 'cancelled', refund, refundable: shouldRefund })
  } catch (error) {
    console.error('[Quicklink booking manage] Cancellation failed', error)
    return NextResponse.json({ error: 'Unable to cancel this appointment.' }, { status: 500 })
  }
}

function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [year,month,day] = date.split('-').map(Number); const [hour,minute] = time.slice(0,5).split(':').map(Number)
  const guess = new Date(Date.UTC(year,month-1,day,hour,minute))
  const parts = new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(guess)
  const values = Object.fromEntries(parts.map((part)=>[part.type,part.value]))
  const represented = Date.UTC(Number(values.year),Number(values.month)-1,Number(values.day),Number(values.hour),Number(values.minute))
  return new Date(guess.getTime()-(represented-guess.getTime()))
}
