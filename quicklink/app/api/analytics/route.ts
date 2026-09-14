import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const allowed = new Set(['page_view','link_click','feature_view','feature_click','lead_submit','promotion_click','call_click','text_click','directions_click','social_click','review_click'])
export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.businessId || !allowed.has(body.eventType)) return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {}
    const supabase = await createClient()
    const payload = { business_id: body.businessId, event_type: body.eventType, link_id: body.linkId || null, visitor_id: typeof body.visitorId === 'string' ? body.visitorId.slice(0, 100) : null, metadata }
    let { error } = await supabase.from('analytics_events').insert(payload)
    if (error?.code === 'PGRST204' && ['page_view','link_click'].includes(body.eventType)) {
      const fallback = await supabase.from('analytics_events').insert({ business_id: body.businessId, event_type: body.eventType, link_id: body.linkId || null })
      error = fallback.error
    }
    if (error) { console.error('[Quicklink analytics] insert failed', { code: error.code, message: error.message }); return NextResponse.json({ error: 'Unable to record event' }, { status: 500 }) }
    return NextResponse.json({ ok: true })
  } catch (error) { console.error('[Quicklink analytics] invalid request', error); return NextResponse.json({ error: 'Invalid request' }, { status: 400 }) }
}
