import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBusinessEmail } from '@/lib/email'
import { sendBusinessPush } from '@/lib/push'
import { randomBytes } from 'node:crypto'
import { hashOrderManageToken } from '@/lib/order-manage'
import { formatDateTime, formatPhone } from '@/lib/display-format'
import { orderReference } from '@/lib/order-manage-client'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.businessId || !Array.isArray(body.items) || !body.items.length) return NextResponse.json({ error: 'Add at least one product.' }, { status: 400 })
    const items = body.items.map((item: { productId?: unknown; quantity?: unknown }) => ({ product_id: String(item.productId || ''), quantity: Math.min(99, Math.max(1, Number(item.quantity) || 1)) }))
    const supabase = await createClient()
    const manageToken = randomBytes(32).toString('base64url')
    // Save to Supabase first — the order is complete once this succeeds.
    // Everything after this point (email) must never affect this response.
    const { data, error } = await supabase.rpc('submit_quicklink_order_managed', { p_business_id: body.businessId, p_customer_name: body.name, p_customer_phone: body.phone, p_method: body.method, p_address: body.address || '', p_notes: body.notes || '', p_items: items, p_manage_token_hash: hashOrderManageToken(manageToken) })
    if (error || !data?.[0]) { console.error('[Quicklink orders] submit failed', error); return NextResponse.json({ error: error?.message || 'Unable to submit order.' }, { status: 400 }) }
    const summary = body.items.map((item: { name?: string; quantity?: number }) => `${item.quantity}x ${String(item.name || 'Item')}`).join('\n')
    const total = `$${(data[0].total_cents / 100).toFixed(2)}`
    const createdAt = new Date().toISOString()
    const emailBody = `New Quicklink Order\n\nOrder: ${orderReference(data[0].order_id)}\nCustomer: ${body.name}\nPhone: ${formatPhone(body.phone)}\nCreated: ${formatDateTime(createdAt)}\n\nItems:\n${summary}\n\nFulfillment: ${body.method === 'delivery' ? 'Delivery' : 'Pickup'}\n${body.address ? `Address: ${body.address}\n` : ''}${body.notes ? `Notes: ${body.notes}\n` : ''}\nTotal: ${total}`
    const [email, push] = await Promise.all([
      sendBusinessEmail(body.businessId, 'order', 'New Quicklink order', emailBody),
      sendBusinessPush(body.businessId, { title: 'Quicklink', body: `New order from ${body.name}\n${total} · ${body.items.reduce((sum: number, item: { quantity?: number }) => sum + (Number(item.quantity) || 0), 0)} items`, tag: `order-${data[0].order_id}` }),
    ])
    await supabase.from('analytics_events').insert({ business_id: body.businessId, event_type: 'feature_click', metadata: { feature: 'ordering', conversion: 'order_submit' } })
    const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
    return NextResponse.json({ ok: true, orderId: data[0].order_id, orderReference: orderReference(data[0].order_id), totalCents: data[0].total_cents, manageUrl: `${origin}/order/manage/${manageToken}`, emailSent: email.sent, pushSent: push.sent })
  } catch (error) { console.error('[Quicklink orders] invalid request', error); return NextResponse.json({ error: 'Invalid order.' }, { status: 400 }) }
}
