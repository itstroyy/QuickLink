import { NextResponse } from 'next/server'
import { businessSession, sameOrigin } from '@/lib/dashboard/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPaymentRefund } from '@/lib/refunds'

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    const body = await request.json()
    if (body.confirm !== 'REFUND') return NextResponse.json({ error: 'Refund confirmation is required.' }, { status: 400 })
    const session = await businessSession(body.businessId)
    if (!session.ok) return NextResponse.json({ error: 'You do not have access to this business.' }, { status: session.status })
    const admin = createAdminClient(); if (!admin) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 503 })
    const { data: payment } = await admin.from('payments').select('business_id').eq('id', body.paymentId).single()
    if (!payment || payment.business_id !== session.businessId) return NextResponse.json({ error: 'Payment not found.' }, { status: 404 })
    const amount = body.amountCents == null ? undefined : Number(body.amountCents)
    const result = await createPaymentRefund({ paymentId: body.paymentId, amountCents: amount, reason: String(body.reason || 'Refund requested by business'), requestedBy: session.user.id })
    return result.ok ? NextResponse.json(result) : NextResponse.json({ error: result.error }, { status: 409 })
  } catch (error) {
    console.error('[Quicklink refund] Refund failed', error)
    return NextResponse.json({ error: 'Unable to issue this refund.' }, { status: 500 })
  }
}
