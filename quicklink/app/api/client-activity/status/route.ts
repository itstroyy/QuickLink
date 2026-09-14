import { NextResponse } from 'next/server'
import { verifyClientToken } from '@/lib/client-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyAppointmentStatus } from '@/lib/appointment-status'

const ALLOWED = {
  orders: ['new', 'preparing', 'ready', 'completed', 'cancelled'],
  bookings: ['confirmed', 'completed', 'cancelled'],
  requests: ['new', 'contacted', 'in_progress', 'completed', 'cancelled'],
} as const
const TABLE = { orders: 'orders', bookings: 'appointments', requests: 'service_requests' } as const

// The private Client Activity page can change a status, but it can never
// delete, edit business configuration, or reach another business — every
// mutation here is scoped to the business resolved from the verified token.
export async function POST(request: Request) {
  const { slug, token, type, id, status } = await request.json().catch(() => ({}))
  if (!slug || !token || !type || !id || !status) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const verified = await verifyClientToken(slug, token)
  if (!verified) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 401 })

  const key = type as keyof typeof ALLOWED
  if (!ALLOWED[key] || !(ALLOWED[key] as readonly string[]).includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  if (key === 'orders' && !verified.access.client_activity_show_orders) return NextResponse.json({ error: 'Not enabled for this business.' }, { status: 403 })
  if (key === 'bookings' && !verified.access.client_activity_show_bookings) return NextResponse.json({ error: 'Not enabled for this business.' }, { status: 403 })
  if (key === 'requests' && !verified.access.client_activity_show_service_requests) return NextResponse.json({ error: 'Not enabled for this business.' }, { status: 403 })

  if (key === 'bookings') {
    const result = await applyAppointmentStatus(verified.businessId, id, status)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 })
  const terminal = status === 'completed' || status === 'cancelled'
  const { error } = await admin.from(TABLE[key]).update({ status, ...(terminal ? { archived: true } : {}) }).eq('id', id).eq('business_id', verified.businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
