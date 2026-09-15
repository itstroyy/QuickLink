import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBusinessEmail, sendCustomerEmail, transactionEmailHtml } from '@/lib/email'
import { sendBusinessPush } from '@/lib/push'
import { hashRequestManageToken } from '@/lib/request-manage'
import { publicOrigin } from '@/lib/stripe'
import { formatDate, formatPhone } from '@/lib/display-format'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body.preferredDate && (!/^\d{4}-\d{2}-\d{2}$/.test(body.preferredDate) || body.preferredDate < new Date().toISOString().slice(0, 10))) return NextResponse.json({ error: 'Choose today or a future preferred date.' }, { status: 400 })
    const supabase = await createClient()
    const manageToken = randomBytes(32).toString('base64url')
    const { data, error } = await supabase.rpc('submit_service_request_managed', {
      p_business_id: body.businessId, p_name: body.name, p_phone: body.phone, p_email: body.email || '', p_address: body.address || '',
      p_preferred_date: body.preferredDate || null, p_request: body.request || '', p_notes: body.notes || '', p_form_data: {},
      p_manage_token_hash: hashRequestManageToken(manageToken),
    })
    if (error || !data) return NextResponse.json({ error: error?.message || 'Unable to send request.' }, { status: 400 })
    const { data: business } = await supabase.from('businesses').select('name,email,logo_url').eq('id', body.businessId).single()
    const reference = `QR-${String(data).replaceAll('-', '').slice(0, 6).toUpperCase()}`
    const manageUrl = `${publicOrigin(request)}/request/manage/${manageToken}`
    const sections = [{ title: 'Request', rows: [{ label: 'Customer', value: String(body.name || '') }, { label: 'Phone', value: formatPhone(String(body.phone || '')) }, ...(body.preferredDate ? [{ label: 'Preferred date', value: formatDate(body.preferredDate) }] : []), ...(body.request ? [{ label: 'Details', value: String(body.request) }] : [])] }]
    const customerHtml = transactionEmailHtml({ eyebrow: 'Request received', title: `${business?.name || 'The business'} has your request.`, businessName: business?.name || 'Your business', logoUrl: business?.logo_url, reference, intro: 'The business will review your request and contact you with next steps.', sections, cta: { label: 'View request status', url: manageUrl } })
    const ownerHtml = transactionEmailHtml({ eyebrow: 'New request', title: reference, businessName: business?.name || 'Quicklink business', logoUrl: business?.logo_url, sections, cta: { label: 'Open request in Quicklink', url: `${publicOrigin(request)}/dashboard/activity?business=${body.businessId}` } })
    const text = `REQUEST RECEIVED\n${reference}\n${business?.name || ''}\n\nCustomer: ${body.name}\nPhone: ${formatPhone(body.phone)}${body.preferredDate ? `\nPreferred date: ${formatDate(body.preferredDate)}` : ''}${body.request ? `\nRequest: ${body.request}` : ''}\n\nView status: ${manageUrl}`
    const [customerEmail, ownerEmail, push] = await Promise.all([
      sendCustomerEmail({ to: body.email, subject: `Request received — ${business?.name || 'Quicklink'}`, text, html: customerHtml, replyTo: business?.email }),
      sendBusinessEmail(body.businessId, 'request_service', `New request ${reference} — ${body.name}`, text, ownerHtml),
      sendBusinessPush(body.businessId, { title: 'New service request', body: `${body.name} sent a new request`, tag: `request-${data}` }),
    ])
    return NextResponse.json({ ok: true, id: data, reference, manageUrl, emailSent: customerEmail.sent, businessEmailSent: ownerEmail.sent, pushSent: push.sent })
  } catch (error) {
    console.error('[Quicklink service request] invalid request', error)
    return NextResponse.json({ error: 'Invalid service request.' }, { status: 400 })
  }
}
