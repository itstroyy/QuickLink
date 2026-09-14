import { NextResponse } from 'next/server'
import { verifyClientToken } from '@/lib/client-access'
import { createAdminClient } from '@/lib/supabase/admin'

const TABLE = { orders: 'orders', bookings: 'appointments', requests: 'service_requests' } as const

// Archive/Restore only — never a permanent delete. Clients must not have
// delete access (see item 7 of the spec); this route simply has no delete op.
export async function POST(request: Request) {
  const { slug, token, type, id, archived } = await request.json().catch(() => ({}))
  if (!slug || !token || !type || !id || typeof archived !== 'boolean') return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const verified = await verifyClientToken(slug, token)
  if (!verified) return NextResponse.json({ error: 'Invalid or expired link.' }, { status: 401 })

  const key = type as keyof typeof TABLE
  if (!TABLE[key]) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  if (key === 'orders' && !verified.access.client_activity_show_orders) return NextResponse.json({ error: 'Not enabled for this business.' }, { status: 403 })
  if (key === 'bookings' && !verified.access.client_activity_show_bookings) return NextResponse.json({ error: 'Not enabled for this business.' }, { status: 403 })
  if (key === 'requests' && !verified.access.client_activity_show_service_requests) return NextResponse.json({ error: 'Not enabled for this business.' }, { status: 403 })

  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 })
  const { error } = await admin.from(TABLE[key]).update({ archived }).eq('id', id).eq('business_id', verified.businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
