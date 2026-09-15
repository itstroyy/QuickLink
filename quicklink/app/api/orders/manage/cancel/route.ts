import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getManagedOrder } from '@/lib/order-manage'
import { createPaymentRefund } from '@/lib/refunds'
import { requireStripe } from '@/lib/stripe'
import { sendCustomerEmail, transactionEmailHtml } from '@/lib/email'
import { orderReference } from '@/lib/order-manage-client'

export async function POST(request: Request) {
  try {
    const { token, confirm } = await request.json()
    if (typeof token !== 'string' || confirm !== 'CANCEL') return NextResponse.json({ error: 'Cancellation confirmation is required.' }, { status: 400 })
    const order = await getManagedOrder(token)
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    const policy = order.policy_snapshot?.order_cancellation_policy || 'new_only'
    const allowed = policy === 'new_confirmed' ? ['new','confirmed'] : policy === 'new_only' ? ['new'] : []
    if (!allowed.includes(order.status) && order.status !== 'pending_payment') return NextResponse.json({ error: 'Contact the business to request cancellation.' }, { status: 409 })
    const admin = createAdminClient(); if (!admin) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 503 })
    let refund = null
    if (order.payment_id && ['paid','deposit_paid','partially_refunded'].includes(order.payment_status)) {
      refund = await createPaymentRefund({ paymentId: order.payment_id, reason: 'Customer cancelled an eligible order' })
      if (!refund.ok) return NextResponse.json({ error: refund.error }, { status: 409 })
    } else if (order.payment_id && order.payment_status === 'pending') {
      const { data: payment } = await admin.from('payments').select('*').eq('id', order.payment_id).single()
      if (payment?.stripe_checkout_session_id) await requireStripe().checkout.sessions.expire(
        payment.stripe_checkout_session_id,
        {},
        { stripeAccount: payment.stripe_account_id },
      ).catch(() => null)
      await admin.from('payments').update({ status: 'expired' }).eq('id', order.payment_id)
    }
    await admin.from('orders').update({ status: 'cancelled', archived: true, payment_status: refund?.ok ? (refund.status === 'succeeded' ? 'refunded' : 'refund_pending') : order.payment_status === 'pending' ? 'failed' : order.payment_status }).eq('id', order.id)
    const refundText = refund?.ok ? ' An eligible refund has been submitted to the original payment method.' : ''
    await sendCustomerEmail({ to: order.customer_email, replyTo: order.business_email, subject: `Order #${orderReference(order.id)} cancelled`, text: `Your order #${orderReference(order.id)} with ${order.business_name} has been cancelled.${refundText}`, html: transactionEmailHtml({ eyebrow: 'Order update', title: 'Order cancelled', businessName: order.business_name, reference: `Order #${orderReference(order.id)}`, badge: refund?.ok ? 'REFUND SUBMITTED' : 'CANCELLED', intro: `Your order has been cancelled.${refundText}` }) })
    return NextResponse.json({ ok: true, status: 'cancelled', refund })
  } catch (error) {
    console.error('[Quicklink order manage] Cancellation failed', error)
    return NextResponse.json({ error: 'Unable to cancel this order.' }, { status: 500 })
  }
}
