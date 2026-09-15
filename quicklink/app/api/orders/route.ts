import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashOrderManageToken } from '@/lib/order-manage'
import { notifyUnpaidOrder } from '@/lib/payment-lifecycle'
import { sendBusinessPush } from '@/lib/push'
import { publicOrigin, requireStripe, stripeModeColumns, stripeModeForRpc } from '@/lib/stripe'
import { orderReference } from '@/lib/order-manage-client'
import { orderCustomerSettings, validCustomerEmail } from '@/lib/order-settings'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.businessId || !Array.isArray(body.items) || !body.items.length) return NextResponse.json({ error: 'Add at least one product.' }, { status: 400 })
    const items = body.items.map((item: { productId?: unknown; quantity?: unknown }) => ({ product_id: String(item.productId || ''), quantity: Math.min(99, Math.max(1, Number(item.quantity) || 1)) }))
    const supabase = await createClient()
    // Mode-scoped: readiness and the submit RPC below must both be judged
    // against whichever Stripe account (test or live) the currently active
    // secret key actually talks to.
    const stripeMode = stripeModeForRpc()
    const [{ data: orderingFeature }, { data: paymentRows }] = await Promise.all([
      supabase.from('business_features').select('settings').eq('business_id', body.businessId).eq('feature_key', 'ordering').eq('enabled', true).maybeSingle(),
      supabase.rpc('get_public_payment_config', { p_business_id: body.businessId, p_stripe_mode: stripeMode }),
    ])
    const orderSettings = orderCustomerSettings(orderingFeature?.settings)
    const online = paymentRows?.[0]?.order_payment_mode === 'online_required'
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    const method = body.method === 'delivery' ? 'delivery' : body.method === 'pickup' ? 'pickup' : ''
    if (!orderingFeature || !name) return NextResponse.json({ error: !orderingFeature ? 'Ordering is not available.' : 'Name is required.', code: 'INVALID_ORDER_CUSTOMER' }, { status: 400 })
    if (orderSettings.phone_required && !phone) return NextResponse.json({ error: 'Phone is required.', code: 'INVALID_ORDER_CUSTOMER' }, { status: 400 })
    if ((online || orderSettings.email_required) && !email) return NextResponse.json({ error: online ? 'Email is required for payment receipts and order updates.' : 'Email is required.', code: 'INVALID_ORDER_EMAIL' }, { status: 400 })
    if (email && !validCustomerEmail(email)) return NextResponse.json({ error: 'Enter a valid email address.', code: 'INVALID_ORDER_EMAIL' }, { status: 400 })
    if (!method) return NextResponse.json({ error: 'Choose pickup or delivery.', code: 'INVALID_FULFILLMENT' }, { status: 400 })
    if (orderSettings.address_required && !address) return NextResponse.json({ error: method === 'delivery' ? 'Delivery address is required.' : 'Address is required.', code: 'INVALID_FULFILLMENT' }, { status: 400 })
    const manageToken = randomBytes(32).toString('base64url')
    const { data, error } = await supabase.rpc('submit_quicklink_order_productized', {
      p_business_id: body.businessId, p_customer_name: name, p_customer_phone: phone, p_customer_email: email,
      p_method: method, p_address: address, p_notes: orderSettings.show_notes && typeof body.notes === 'string' ? body.notes : '', p_items: items,
      p_manage_token_hash: hashOrderManageToken(manageToken), p_stripe_mode: stripeMode,
    })
    if (error || !data?.[0]) {
      console.error('[Quicklink orders] submit failed', { code: error?.code, message: error?.message, details: process.env.NODE_ENV === 'development' ? error?.details : undefined, hint: process.env.NODE_ENV === 'development' ? error?.hint : undefined })
      const safeMessages = ['Ordering is not available', 'Name is required', 'Phone is required', 'Choose pickup or delivery', 'Address is required', 'Email is required', 'Enter a valid email address', 'Online ordering is temporarily unavailable while payments are being configured', 'One or more products are unavailable']
      const safe = safeMessages.find((message) => error?.message?.includes(message))
      return NextResponse.json({ error: safe || 'Unable to submit order.', code: 'ORDER_SUBMIT_FAILED' }, { status: 400 })
    }
    const order = data[0]
    const origin = publicOrigin(request)
    const manageUrl = `${origin}/order/manage/${manageToken}`
    if (!order.payment_required) {
      await Promise.all([
        notifyUnpaidOrder(order.order_id, manageUrl),
        sendBusinessPush(body.businessId, { title: 'New order', body: `${body.name} · $${(order.total_cents / 100).toFixed(2)}`, tag: `order-${order.order_id}` }),
      ])
      await supabase.from('analytics_events').insert({ business_id: body.businessId, event_type: 'feature_click', metadata: { feature: 'ordering', conversion: 'order_submit' } })
      return NextResponse.json({ ok: true, paymentRequired: false, orderId: order.order_id, orderReference: orderReference(order.order_id), totalCents: order.total_cents, manageUrl })
    }

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Secure payments are temporarily unavailable.' }, { status: 503 })
    // Mode-scoped: this is the final gate immediately before actually
    // creating a Stripe Checkout Session, so it must read the SAME
    // test/live account the RPC above just validated — never the legacy
    // columns, which only ever mirror the live account. Select '*' (a
    // static literal) rather than a template literal built from
    // stripeModeColumns() — a comma-joined list of runtime `string`-typed
    // column names breaks select()'s TypeScript query parsing (it produces
    // a ParserError type instead of a plain object). The mode-specific
    // fields are still read off the full row below via columns.accountId
    // etc., so behavior is unchanged.
    const columns = stripeModeColumns(stripeMode)
    const [{ data: paymentSettingsRow }, { data: snapshot }] = await Promise.all([
      admin.from('business_payment_settings').select('*').eq('business_id', body.businessId).single(),
      admin.from('orders').select('customer_email,order_items(*)').eq('id', order.order_id).single(),
    ])
    const paymentSettings = paymentSettingsRow as Record<string, unknown> | null
    const connectedAccountId = paymentSettings?.[columns.accountId] as string | null | undefined
    if (!connectedAccountId || !paymentSettings?.[columns.chargesEnabled] || !paymentSettings?.[columns.payoutsEnabled]) return NextResponse.json({ error: 'Online ordering is temporarily unavailable while payments are being configured.' }, { status: 409 })
    const idempotencyKey = `order-${order.order_id}`
    const { data: payment, error: paymentError } = await admin.from('payments').insert({ business_id: body.businessId, order_id: order.order_id, kind: 'order', stripe_account_id: connectedAccountId, currency: order.currency, amount_due_cents: order.total_cents, idempotency_key: idempotencyKey }).select('id').single()
    if (paymentError || !payment) throw paymentError || new Error('Could not create payment record')
    try {
    const checkout = await requireStripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: snapshot?.customer_email || undefined,
      client_reference_id: order.order_id,
      line_items: (snapshot?.order_items || []).map((item: any) => ({ quantity: item.quantity, price_data: { currency: order.currency, unit_amount: item.unit_price_cents, product_data: { name: item.product_name } } })),
      metadata: { quicklink_payment_id: payment.id, quicklink_type: 'order', quicklink_business_id: body.businessId, quicklink_record_id: order.order_id },
      payment_intent_data: { metadata: { quicklink_payment_id: payment.id, quicklink_type: 'order', quicklink_business_id: body.businessId, quicklink_record_id: order.order_id } },
      success_url: `${manageUrl}?checkout=returned`,
      cancel_url: `${manageUrl}?checkout=cancelled`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    }, { stripeAccount: connectedAccountId, idempotencyKey })
    await admin.from('payments').update({ stripe_checkout_session_id: checkout.id }).eq('id', payment.id)
    return NextResponse.json({ ok: true, paymentRequired: true, orderId: order.order_id, orderReference: orderReference(order.order_id), totalCents: order.total_cents, manageUrl, checkoutUrl: checkout.url })
    } catch (checkoutError) {
      await Promise.all([admin.from('payments').update({status:'failed'}).eq('id',payment.id),admin.from('orders').update({status:'payment_failed',payment_status:'failed',payment_expires_at:null}).eq('id',order.order_id)])
      throw checkoutError
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Quicklink orders] invalid request', { message, name: error instanceof Error ? error.name : 'UnknownError' })
    const stripeUnavailable = message === 'Stripe secret key is missing or invalid.'
    return NextResponse.json({ error: stripeUnavailable ? 'Secure payments are temporarily unavailable.' : 'Unable to start this order.', code: stripeUnavailable ? 'STRIPE_NOT_CONFIGURED' : 'ORDER_SUBMIT_FAILED' }, { status: stripeUnavailable ? 503 : 400 })
  }
}
