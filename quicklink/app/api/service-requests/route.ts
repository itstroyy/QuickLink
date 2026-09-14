import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBusinessEmail } from '@/lib/email'
import { sendBusinessPush } from '@/lib/push'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body.preferredDate && (!/^\d{4}-\d{2}-\d{2}$/.test(body.preferredDate) || body.preferredDate < new Date().toISOString().slice(0, 10))) {
      return NextResponse.json({ error: 'Choose today or a future preferred date.' }, { status: 400 })
    }
    const supabase = await createClient()
    // Save first — email is best-effort and must never block or fail this response.
    const { data, error } = await supabase.rpc('submit_service_request', {
      p_business_id: body.businessId,
      p_name: body.name,
      p_phone: body.phone,
      p_email: body.email || '',
      p_address: body.address || '',
      p_preferred_date: body.preferredDate || null,
      p_request: body.request || '',
      p_notes: body.notes || '',
      p_form_data: {},
    })
    if (error) {
      console.error('[Quicklink service request] submit failed', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    const emailBody = `New Quicklink Service Request\n\nCustomer: ${body.name}\nPhone: ${body.phone}${body.email ? `\nEmail: ${body.email}` : ''}${body.address ? `\nAddress: ${body.address}` : ''}${body.preferredDate ? `\nPreferred date: ${body.preferredDate}` : ''}${body.request ? `\n\nRequest:\n${body.request}` : ''}${body.notes ? `\n\nNotes: ${body.notes}` : ''}`
    const [email, push] = await Promise.all([
      sendBusinessEmail(body.businessId, 'request_service', `New service request — ${body.name}`, emailBody),
      sendBusinessPush(body.businessId, { title: 'New Quicklink service request', body: `${body.name} sent a new request`, tag: `request-${data}` }),
    ])
    return NextResponse.json({ ok: true, id: data, emailSent: email.sent, pushSent: push.sent })
  } catch (error) {
    console.error('[Quicklink service request] invalid request', error)
    return NextResponse.json({ error: 'Invalid service request.' }, { status: 400 })
  }
}
