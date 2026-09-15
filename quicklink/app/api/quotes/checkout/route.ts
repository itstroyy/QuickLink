import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getManagedRequest } from '@/lib/request-manage'
import { publicOrigin, requireStripe, stripeModeColumns, stripeModeForRpc } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()
    const quote = typeof token === 'string' ? await getManagedRequest(token) : null
    if (!quote) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
    if (!quote.payment_required || !quote.quote_amount_cents || quote.status !== 'quoted') return NextResponse.json({ error: 'This quote is not available for payment.' }, { status: 409 })
    if (quote.quote_expires_at && new Date(quote.quote_expires_at) <= new Date()) return NextResponse.json({ error: 'This quote has expired. Contact the business for an updated quote.' }, { status: 409 })
    const admin = createAdminClient(); if (!admin) return NextResponse.json({ error: 'Secure payments are temporarily unavailable.' }, { status: 503 })
    // Mode-scoped: gate quote checkout on the same test/live account the
    // currently active secret key can actually charge against.
    const columns = stripeModeColumns(stripeModeForRpc())
    const { data: settingsRow } = await admin.from('business_payment_settings').select('*').eq('business_id', quote.business_id).single()
    const settings = settingsRow as Record<string, unknown> | null
    const connectedAccountId = settings?.[columns.accountId] as string | null | undefined
    if (!connectedAccountId || !settings?.[columns.chargesEnabled] || !settings?.[columns.payoutsEnabled]) return NextResponse.json({ error: 'Secure payments are temporarily unavailable.' }, { status: 409 })
    const idempotencyKey = `quote-${quote.id}`
    let { data: payment } = await admin.from('payments').select('*').eq('idempotency_key', idempotencyKey).maybeSingle()
    if (payment?.stripe_checkout_session_id) {
      const existing = await requireStripe().checkout.sessions.retrieve(payment.stripe_checkout_session_id, {}, { stripeAccount: connectedAccountId })
      if (existing.url && existing.status === 'open') return NextResponse.json({ ok: true, checkoutUrl: existing.url })
    }
    if (!payment) {
      const result = await admin.from('payments').insert({ business_id: quote.business_id, service_request_id: quote.id, kind: 'quote', stripe_account_id: connectedAccountId, currency: quote.currency, amount_due_cents: quote.quote_amount_cents, idempotency_key: idempotencyKey }).select('*').single()
      if (result.error || !result.data) throw result.error || new Error('Could not create quote payment')
      payment = result.data
    }
    if (payment.status === 'failed') {
      await admin.from('payments').update({ status: 'pending' }).eq('id', payment.id)
      await admin.from('service_requests').update({ payment_status: 'pending' }).eq('id', quote.id)
    }
    const manageUrl = `${publicOrigin(request)}/request/manage/${token}`
    try {
    const checkout = await requireStripe().checkout.sessions.create({ mode: 'payment', customer_email: quote.customer_email || undefined, client_reference_id: quote.id, line_items: [{ quantity: 1, price_data: { currency: quote.currency, unit_amount: quote.quote_amount_cents, product_data: { name: `Quote from ${quote.business_name}` } } }], metadata: { quicklink_payment_id: payment.id, quicklink_type: 'quote', quicklink_business_id: quote.business_id, quicklink_record_id: quote.id }, payment_intent_data: { metadata: { quicklink_payment_id: payment.id, quicklink_type: 'quote', quicklink_business_id: quote.business_id, quicklink_record_id: quote.id } }, success_url: `${manageUrl}?checkout=returned`, cancel_url: `${manageUrl}?checkout=cancelled`, expires_at: Math.floor(Date.now()/1000)+30*60 }, { stripeAccount: connectedAccountId, idempotencyKey })
    await admin.from('payments').update({ stripe_checkout_session_id: checkout.id }).eq('id', payment.id)
    return NextResponse.json({ ok: true, checkoutUrl: checkout.url })
    } catch (checkoutError) {
      await Promise.all([admin.from('payments').update({status:'failed'}).eq('id',payment.id),admin.from('service_requests').update({payment_status:'failed'}).eq('id',quote.id)])
      throw checkoutError
    }
  } catch (error) {
    console.error('[Quicklink quote] Checkout failed', { message: error instanceof Error ? error.message : String(error), name: error instanceof Error ? error.name : 'UnknownError' })
    return NextResponse.json({ error: 'Unable to start secure payment.', code: 'QUOTE_CHECKOUT_FAILED' }, { status: 500 })
  }
}
