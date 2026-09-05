import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logSupabaseError } from '@/lib/supabase/config'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.businessId || !['page_view', 'link_click'].includes(body.eventType)) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase.from('analytics_events').insert({
      business_id: body.businessId,
      event_type: body.eventType,
      link_id: body.linkId || null,
    })
    if (error) {
      logSupabaseError('analytics-insert', error, {
        businessId: body.businessId,
        eventType: body.eventType,
      })
      return NextResponse.json({ error: 'Unable to record event' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Quicklink/Analytics:route] Request failed', error)
    return NextResponse.json({ error: 'Unable to record event' }, { status: 500 })
  }
}
