import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyRefundEvent } from '@/lib/payment-lifecycle'
import { requireStripe } from '@/lib/stripe'

export async function createPaymentRefund(params: { paymentId: string; amountCents?: number; reason: string; requestedBy?: string | null }) {
  const admin = createAdminClient(); if (!admin) return { ok: false as const, error: 'Server configuration is incomplete.' }
  const { data: payment } = await admin.from('payments').select('*').eq('id', params.paymentId).single()
  if (!payment?.stripe_payment_intent_id || !['paid','deposit_paid','partially_refunded'].includes(payment.status)) return { ok: false as const, error: 'This payment is not eligible for a refund.' }
  const refundable = payment.amount_paid_cents - payment.amount_refunded_cents
  const amount = params.amountCents ?? refundable
  if (!Number.isInteger(amount) || amount <= 0 || amount > refundable) return { ok: false as const, error: 'Refund amount exceeds the refundable balance.' }
  // The current refunded snapshot makes transport retries idempotent while
  // still allowing a later, intentional partial refund after this one settles.
  const key = `refund-${payment.id}-${payment.amount_refunded_cents}-${amount}`
  const refund = await requireStripe().refunds.create({ payment_intent: payment.stripe_payment_intent_id, amount, metadata: { quicklink_payment_id: payment.id, quicklink_business_id: payment.business_id, quicklink_reason: params.reason.slice(0, 500) } }, { stripeAccount: payment.stripe_account_id, idempotencyKey: key })
  await admin.from('refunds').upsert({ payment_id: payment.id, business_id: payment.business_id, stripe_refund_id: refund.id, amount_cents: refund.amount, reason: params.reason.slice(0, 500), status: refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' ? 'failed' : refund.status === 'canceled' ? 'cancelled' : 'pending', requested_by: params.requestedBy || null, failure_reason: refund.failure_reason || null }, { onConflict: 'stripe_refund_id' })
  await applyRefundEvent(refund, payment.stripe_account_id)
  return { ok: true as const, refundId: refund.id, status: refund.status, amountCents: refund.amount }
}
