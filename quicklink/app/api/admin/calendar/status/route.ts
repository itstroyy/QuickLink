import { NextResponse } from 'next/server'
import { businessSession } from '@/lib/dashboard/auth'
import { createAdminClient } from '@/lib/supabase/admin'

// Reports only whether a calendar is connected — never the tokens
// themselves, which stay server-side in business_calendar_connections.
// Available to the platform admin and to the business's own owner/manager
// (businessSession checks can_manage_business, which covers both).
export async function GET(request: Request) {
  const url = new URL(request.url)
  const businessId = url.searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
  const session = await businessSession(businessId)
  if (!session.ok) return NextResponse.json({ error: 'Not signed in.' }, { status: session.status })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ connected: false })
  const { data } = await admin.from('business_calendar_connections').select('business_id,connected_at').eq('business_id', businessId).maybeSingle()
  return NextResponse.json({ connected: Boolean(data), connectedAt: data?.connected_at || null })
}
