import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body.website) return NextResponse.json({ ok: true })
    if (!body.businessId || !body.formId) return NextResponse.json({ error: 'Missing form information.' }, { status: 400 })
    const values = ['name', 'phone', 'email', 'message'].map((key) => typeof body[key] === 'string' ? body[key].trim() : '')
    if (!values.some(Boolean)) return NextResponse.json({ error: 'Please add your contact information.' }, { status: 400 })
    if (values[0].length > 100 || values[1].length > 40 || values[2].length > 160 || values[3].length > 1500) return NextResponse.json({ error: 'A field is too long.' }, { status: 400 })
    const supabase = await createClient()
    const { error } = await supabase.from('lead_submissions').insert({ business_id: body.businessId, lead_form_id: body.formId, name: values[0] || null, phone: values[1] || null, email: values[2] || null, message: values[3] || null })
    if (error) { console.error('[Quicklink leads] insert failed', { code: error.code, message: error.message }); return NextResponse.json({ error: 'Unable to send your request.' }, { status: 500 }) }
    await supabase.from('analytics_events').insert({ business_id: body.businessId, event_type: 'lead_submit', metadata: { form_id: body.formId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Quicklink leads] invalid request', error)
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
