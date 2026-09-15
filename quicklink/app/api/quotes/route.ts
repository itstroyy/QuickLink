import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { businessSession, sameOrigin } from '@/lib/dashboard/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCustomerEmail, transactionEmailHtml } from '@/lib/email'
import { money, publicOrigin, stripeModeColumns, stripeModeForRpc } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    const body = await request.json()
    const session = await businessSession(body.businessId)
    if (!session.ok) return NextResponse.json({ error: 'You do not have access to this business.' }, { status: session.status })
    const amount = Number(body.amountCents)
    if (!body.requestId || !Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) return NextResponse.json({ error: 'Enter a valid quote amount.' }, { status: 400 })
    const expiresAt = body.expiresAt ? new Date(`${body.expiresAt}T23:59:59.999Z`) : null
    if (expiresAt && (Number.isNaN(expiresAt.valueOf()) || expiresAt <= new Date())) return NextResponse.json({ error: 'Choose a future expiration date.' }, { status: 400 })
    const admin = createAdminClient(); if (!admin) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 503 })
    const [{ data: serviceRequest }, { data: settings }, { data: business }] = await Promise.all([
      admin.from('service_requests').select('*').eq('id', body.requestId).eq('business_id', session.businessId).single(),
      admin.from('business_payment_settings').select('*').eq('business_id', session.businessId).single(),
      admin.from('businesses').select('name,email,logo_url').eq('id', session.businessId).single(),
    ])
    if (!serviceRequest) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    // Mode-scoped: an owner testing quotes locally in Stripe test mode must
    // be judged against the test account, never the legacy (live-mirrored)
    // columns — and vice versa in production.
    const columns = stripeModeColumns(stripeModeForRpc())
    const settingsRecord = settings as Record<string, unknown> | null
    if (body.paymentRequired && (!settingsRecord?.[columns.accountId] || !settingsRecord[columns.chargesEnabled] || !settingsRecord[columns.payoutsEnabled])) return NextResponse.json({ error: 'Connect Stripe before sending a quote that requires online payment.' }, { status: 409 })
    const token = randomBytes(32).toString('base64url')
    await admin.from('customer_access_tokens').insert({ business_id: session.businessId, resource_type: 'request', resource_id: serviceRequest.id, token_hash: createHash('sha256').update(token).digest('hex') })
    const { error } = await admin.from('service_requests').update({ status: 'quoted', quote_amount_cents: amount, quote_message: String(body.message || '').slice(0, 2000) || null, quote_notes: String(body.notes || '').slice(0, 2000) || null, quote_expires_at: expiresAt?.toISOString() || null, quote_sent_at: new Date().toISOString(), payment_required: Boolean(body.paymentRequired), payment_status: body.paymentRequired ? 'pending' : 'not_required', currency: settings?.currency || 'usd' }).eq('id', serviceRequest.id).eq('business_id', session.businessId)
    if (error) throw error
    const manageUrl = `${publicOrigin(request)}/request/manage/${token}`
    const reference = `QR-${serviceRequest.id.replaceAll('-', '').slice(0, 6).toUpperCase()}`
    const html = transactionEmailHtml({ eyebrow: 'Quote ready', title: `Your quote from ${business?.name || 'the business'} is ready.`, businessName: business?.name || 'Your business', logoUrl: business?.logo_url, reference, badge: body.paymentRequired ? 'PAYMENT REQUESTED' : 'READY', intro: body.message || 'Review the quote details and choose your next step.', totals: [{ label: 'Quoted amount', value: money(amount, settings?.currency || 'usd'), strong: true }], sections: expiresAt ? [{ title: 'Quote details', rows: [{ label: 'Expires', value: expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }] }] : undefined, cta: { label: body.paymentRequired ? 'Review & pay quote' : 'Review quote', url: manageUrl } })
    const text = `YOUR QUOTE IS READY\n${business?.name || ''}\n${reference}\nQuoted amount: ${money(amount, settings?.currency || 'usd')}\n${body.message || ''}\n\nReview quote: ${manageUrl}`
    const email = await sendCustomerEmail({ to: serviceRequest.customer_email, subject: `Your quote from ${business?.name || 'Quicklink'} is ready`, text, html, replyTo: business?.email })
    return NextResponse.json({ ok: true, manageUrl, emailSent: email.sent })
  } catch (error) {
    console.error('[Quicklink quote] Could not send quote', error)
    return NextResponse.json({ error: 'Unable to send this quote.' }, { status: 500 })
  }
}
