import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyRefundEvent, failCheckout, fulfillCheckout } from '@/lib/payment-lifecycle'
import { activeStripeMode, requireStripe, stripeModeColumns, syncConnectedAccount } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim()
  const signature = request.headers.get('stripe-signature')
  if (!secret || !signature) return NextResponse.json({ error: 'Webhook configuration is incomplete.' }, { status: 503 })
  let event: Stripe.Event
  try {
    const payload = await request.text()
    event = requireStripe().webhooks.constructEvent(payload, signature, secret)
  } catch (error) {
    console.error('[Quicklink Stripe] Invalid webhook signature', error)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Database service is unavailable.' }, { status: 503 })
  const accountId = typeof event.account === 'string' ? event.account : null
  const inserted = await admin.from('stripe_webhook_events').insert({ event_id: event.id, event_type: event.type, stripe_account_id: accountId })
  if (inserted.error?.code === '23505') {
    const { data: existing } = await admin.from('stripe_webhook_events').select('status').eq('event_id', event.id).maybeSingle()
    if (existing?.status !== 'failed') return NextResponse.json({ received: true, duplicate: true })
    const { data: claimed } = await admin.from('stripe_webhook_events').update({ status: 'processing', error: null, processed_at: null }).eq('event_id', event.id).eq('status', 'failed').select('event_id').maybeSingle()
    if (!claimed) return NextResponse.json({ received: true, duplicate: true })
  }
  if (inserted.error && inserted.error.code !== '23505') return NextResponse.json({ error: 'Could not record webhook.' }, { status: 500 })
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (!accountId) throw new Error('Connected account missing from Checkout event')
        await fulfillCheckout(requireStripe(), event.data.object as Stripe.Checkout.Session, accountId)
        break
      case 'checkout.session.async_payment_failed':
        await failCheckout(event.data.object as Stripe.Checkout.Session, 'failed')
        break
      case 'checkout.session.expired':
        await failCheckout(event.data.object as Stripe.Checkout.Session, 'expired')
        break
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed':
        if (!accountId) throw new Error('Connected account missing from refund event')
        await applyRefundEvent(event.data.object as Stripe.Refund, accountId)
        break
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        const businessId = account.metadata?.quicklink_business_id
        if (businessId) await syncConnectedAccount(businessId, account.id)
        else {
          // Fallback for accounts with no quicklink_business_id metadata
          // (e.g. connected manually). This webhook only ever carries
          // events for the mode matching the server's own active key, so
          // look the account up in that same mode's column — never the
          // other mode's.
          const mode = activeStripeMode()
          if (mode) {
            const column = stripeModeColumns(mode).accountId
            const { data } = await admin.from('business_payment_settings').select('business_id').eq(column, account.id).maybeSingle()
            if (data?.business_id) await syncConnectedAccount(data.business_id, account.id)
          }
        }
        break
      }
    }
    await admin.from('stripe_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString(), error: null }).eq('event_id', event.id)
    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook error'
    console.error('[Quicklink Stripe] Webhook processing failed', { eventId: event.id, type: event.type, accountId, error })
    await admin.from('stripe_webhook_events').update({ status: 'failed', processed_at: new Date().toISOString(), error: message.slice(0, 1000) }).eq('event_id', event.id)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}
