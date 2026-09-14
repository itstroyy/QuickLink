import { NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const session = await requireAdminSession()
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })
  const { businessId } = await request.json().catch(() => ({}))
  if (!businessId) return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 })
  const { error } = await admin.from('business_calendar_connections').delete().eq('business_id', businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
