import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getManagedOrder, hashOrderManageToken } from '@/lib/order-manage'

export async function POST(request: Request) {
  try {
    const { token } = await request.json()
    if (typeof token !== 'string') return NextResponse.json({ error: 'Invalid manage link.' }, { status: 400 })
    const order = await getManagedOrder(token)
    if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
    if (order.status !== 'new') return NextResponse.json({ error: 'This order can no longer be cancelled online. Please contact the business.' }, { status: 409 })
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('cancel_order_managed', { p_manage_token_hash: hashOrderManageToken(token) })
    if (error) {
      console.error('[Quicklink order manage] Cancellation failed', { error: error.message })
      return NextResponse.json({ error: 'Unable to cancel this order.' }, { status: 400 })
    }
    if (data !== 'cancelled') return NextResponse.json({ error: 'This order can no longer be cancelled online. Please contact the business.' }, { status: 409 })
    return NextResponse.json({ ok: true, status: 'cancelled' })
  } catch (error) {
    console.error('[Quicklink order manage] Invalid cancellation request', error)
    return NextResponse.json({ error: 'Unable to cancel this order.' }, { status: 400 })
  }
}
