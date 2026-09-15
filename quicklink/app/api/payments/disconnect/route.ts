import { NextResponse } from 'next/server'
import { businessSession, sameOrigin } from '@/lib/dashboard/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { activeStripeMode, statusResetFor } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    const body = await request.json()
    const session = await businessSession(body.businessId)
    if (!session.ok) return NextResponse.json({ error: 'You do not have access to this business.' }, { status: session.status })
    if (body.confirm !== 'DISCONNECT') return NextResponse.json({ error: 'Confirmation is required.' }, { status: 400 })
    const mode = activeStripeMode()
    if (!mode) return NextResponse.json({ error: 'Quicklink Stripe is not configured.' }, { status: 503 })
    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 503 })
    const { count } = await admin.from('payments').select('id', { count: 'exact', head: true }).eq('business_id', session.businessId).in('status', ['pending', 'refund_pending'])
    if (count) return NextResponse.json({ error: 'Stripe cannot be disconnected while payments or refunds are pending.' }, { status: 409 })
    const update: Record<string, unknown> = { ...statusResetFor(mode) }
    // order_payment_mode / booking_payment_mode gate real customer checkout
    // (they're read from the live-mirrored legacy columns), so only reset
    // them when disconnecting the LIVE account. Disconnecting a local
    // test-mode account must never change production payment policy.
    if (mode === 'live') {
      update.order_payment_mode = 'pay_later'
      update.booking_payment_mode = 'none'
    }
    const { error } = await admin.from('business_payment_settings').update(update).eq('business_id', session.businessId)
    if (error) throw error
    return NextResponse.json({ ok: true, mode })
  } catch (error) {
    console.error('[Quicklink Stripe] Disconnect failed', error)
    return NextResponse.json({ error: 'Unable to disconnect Stripe.' }, { status: 500 })
  }
}
