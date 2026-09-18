import { NextResponse } from 'next/server'
import { businessSession, sameOrigin } from '@/lib/dashboard/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const allowed = {
  order_payment_mode: ['online_required', 'pay_later'], booking_payment_mode: ['full', 'deposit', 'none'],
  deposit_type: ['percent', 'fixed'], booking_refund_policy: ['window', 'non_refundable', 'manual'],
  deposit_refund_policy: ['refundable', 'non_refundable', 'follow_window'], order_cancellation_policy: ['new_only', 'new_confirmed', 'never'],
} as const

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    const body = await request.json()
    const session = await businessSession(body.businessId)
    if (!session.ok) return NextResponse.json({ error: 'You do not have access to this business.' }, { status: session.status })
    const valid = Object.entries(allowed).every(([key, values]) => (values as readonly string[]).includes(body[key]))
    const depositValue = Number(body.deposit_value)
    const windowHours = Number(body.cancellation_window_hours)
    if (!valid || !Number.isInteger(depositValue) || depositValue < 0 || (body.deposit_type === 'percent' && depositValue > 100) || !Number.isInteger(windowHours) || windowHours < 0 || windowHours > 8760) {
      return NextResponse.json({ error: 'Review the payment and cancellation settings.' }, { status: 400 })
    }
    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 503 })
    // Mirror the dashboard UI's guard server-side: never let a business turn
    // on a booking payment mode that would actually try to collect money
    // through a Stripe account that isn't live-ready. (Legacy
    // stripe_charges_enabled/stripe_payouts_enabled always mirror the LIVE
    // account — the same fields the booking/order RPCs gate real checkout
    // on — so this matches what would actually happen to a real customer.)
    if (body.booking_payment_mode === 'full' || body.booking_payment_mode === 'deposit') {
      const { data: readiness } = await admin.from('business_payment_settings').select('stripe_charges_enabled,stripe_payouts_enabled').eq('business_id', session.businessId).single()
      if (!readiness?.stripe_charges_enabled || !readiness?.stripe_payouts_enabled) {
        return NextResponse.json({ error: 'Connect Stripe and finish onboarding before requiring online payment for bookings.' }, { status: 400 })
      }
    }
    const { error } = await admin.from('business_payment_settings').update({
      order_payment_mode: body.order_payment_mode,
      booking_payment_mode: body.booking_payment_mode,
      deposit_type: body.deposit_type,
      deposit_value: depositValue,
      allow_multiple_services: Boolean(body.allow_multiple_services),
      booking_refund_policy: body.booking_refund_policy,
      cancellation_window_hours: windowHours,
      deposit_refund_policy: body.deposit_refund_policy,
      order_cancellation_policy: body.order_cancellation_policy,
    }).eq('business_id', session.businessId)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Quicklink payments] Settings update failed', error)
    return NextResponse.json({ error: 'Unable to save payment settings.' }, { status: 500 })
  }
}
