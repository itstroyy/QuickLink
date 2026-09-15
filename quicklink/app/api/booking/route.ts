import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashBookingManageToken } from '@/lib/booking-manage'
import { notifyConfirmedBooking, syncConfirmedBookingCalendar } from '@/lib/payment-lifecycle'
import { sendBusinessPush } from '@/lib/push'
import { formatDate, formatTime } from '@/lib/display-format'
import { publicOrigin, requireStripe, stripeModeColumns, stripeModeForRpc } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds : body.serviceId ? [body.serviceId] : []
    if (!body.businessId || !body.date || !body.time || !body.name || !body.phone || !serviceIds.length) return NextResponse.json({ error: 'Missing required booking details.' }, { status: 400 })
    const supabase = await createClient()
    // Mode-scoped: the readiness this RPC enforces, and the Stripe account
    // used for checkout below, must both come from whichever account (test
    // or live) the currently active secret key actually talks to.
    const stripeMode = stripeModeForRpc()
    const manageToken = randomBytes(32).toString('base64url')
    const { data, error } = await supabase.rpc('submit_booking_productized', {
      p_business_id: body.businessId, p_service_ids: serviceIds, p_date: body.date, p_start_time: body.time,
      p_name: body.name, p_phone: body.phone, p_email: body.email || null, p_notes: body.notes || null,
      p_manage_token_hash: hashBookingManageToken(manageToken), p_stripe_mode: stripeMode,
    })
    if (error || !data?.[0]) {
      console.error('[Quicklink booking] submit failed', error)
      return NextResponse.json({ error: error?.message || 'Unable to book that time.' }, { status: 400 })
    }
    const appointment = data[0]
    const manageUrl = `${publicOrigin(request)}/booking/manage/${manageToken}`
    if (!appointment.payment_required) {
      await Promise.all([
        notifyConfirmedBooking(appointment.appointment_id, manageUrl),
        sendBusinessPush(body.businessId, { title: 'New booking', body: `${body.name} · ${formatDate(body.date)} at ${formatTime(appointment.start_time)}`, tag: `booking-${appointment.appointment_id}` }),
        syncConfirmedBookingCalendar(appointment.appointment_id),
      ])
      await supabase.from('analytics_events').insert({ business_id: body.businessId, event_type: 'feature_click', metadata: { feature: 'booking', conversion: 'booking_submit' } })
      return NextResponse.json({ ok: true, paymentRequired: false, appointmentId: appointment.appointment_id, startTime: appointment.start_time, endTime: appointment.end_time, totalPriceCents: appointment.total_price_cents, amountDueCents: 0, manageUrl })
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Secure payments are temporarily unavailable.' }, { status: 503 })
    // Mode-scoped, matching the same account the RPC above just validated.
    // Select '*' (a static literal), not a template literal built from
    // stripeModeColumns() — see the matching comment in
    // app/api/orders/route.ts for why the dynamic form breaks select()'s
    // TypeScript typing.
    const columns = stripeModeColumns(stripeMode)
    const [{ data: paymentSettingsRow }, { data: snapshot }] = await Promise.all([
      admin.from('business_payment_settings').select('*').eq('business_id', body.businessId).single(),
      admin.from('appointments').select('customer_email,booking_services(*)').eq('id', appointment.appointment_id).single(),
    ])
    const paymentSettings = paymentSettingsRow as Record<string, unknown> | null
    const connectedAccountId = paymentSettings?.[columns.accountId] as string | null | undefined
    if (!connectedAccountId || !paymentSettings?.[columns.chargesEnabled] || !paymentSettings?.[columns.payoutsEnabled]) return NextResponse.json({ error: 'Online booking is temporarily unavailable while payments are being configured.' }, { status: 409 })
    const idempotencyKey = `booking-${appointment.appointment_id}`
    const { data: payment, error: paymentError } = await admin.from('payments').insert({ business_id: body.businessId, appointment_id: appointment.appointment_id, kind: 'booking', stripe_account_id: connectedAccountId, currency: appointment.currency, amount_due_cents: appointment.amount_due_cents, idempotency_key: idempotencyKey, metadata: { total_price_cents: appointment.total_price_cents } }).select('id').single()
    if (paymentError || !payment) throw paymentError || new Error('Could not create payment record')
    try {
    const checkout = await requireStripe().checkout.sessions.create({
      mode: 'payment', customer_email: snapshot?.customer_email || undefined, client_reference_id: appointment.appointment_id,
      line_items: [{ quantity: 1, price_data: { currency: appointment.currency, unit_amount: appointment.amount_due_cents, product_data: { name: appointment.amount_due_cents < appointment.total_price_cents ? `Booking deposit — ${(snapshot?.booking_services || []).map((s: any) => s.service_name).join(', ')}` : `Booking — ${(snapshot?.booking_services || []).map((s: any) => s.service_name).join(', ')}` } } }],
      metadata: { quicklink_payment_id: payment.id, quicklink_type: 'booking', quicklink_business_id: body.businessId, quicklink_record_id: appointment.appointment_id },
      payment_intent_data: { metadata: { quicklink_payment_id: payment.id, quicklink_type: 'booking', quicklink_business_id: body.businessId, quicklink_record_id: appointment.appointment_id } },
      success_url: `${manageUrl}?checkout=returned`, cancel_url: `${manageUrl}?checkout=cancelled`, expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    }, { stripeAccount: connectedAccountId, idempotencyKey })
    await admin.from('payments').update({ stripe_checkout_session_id: checkout.id }).eq('id', payment.id)
    return NextResponse.json({ ok: true, paymentRequired: true, appointmentId: appointment.appointment_id, startTime: appointment.start_time, endTime: appointment.end_time, totalPriceCents: appointment.total_price_cents, amountDueCents: appointment.amount_due_cents, manageUrl, checkoutUrl: checkout.url })
    } catch (checkoutError) {
      await Promise.all([admin.from('payments').update({status:'failed'}).eq('id',payment.id),admin.from('appointments').update({status:'payment_failed',payment_status:'failed',hold_expires_at:null}).eq('id',appointment.appointment_id)])
      throw checkoutError
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Quicklink booking] invalid request', { message, name: error instanceof Error ? error.name : 'UnknownError' })
    const stripeUnavailable = message === 'Stripe secret key is missing or invalid.'
    return NextResponse.json({ error: stripeUnavailable ? 'Secure payments are temporarily unavailable.' : 'Unable to start this booking.', code: stripeUnavailable ? 'STRIPE_NOT_CONFIGURED' : 'BOOKING_SUBMIT_FAILED' }, { status: stripeUnavailable ? 503 : 400 })
  }
}
