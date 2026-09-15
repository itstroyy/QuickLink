import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getManagedRequest } from '@/lib/request-manage'

export async function POST(request: Request) {
  const { token } = await request.json().catch(() => ({ token: null }))
  const quote = typeof token === 'string' ? await getManagedRequest(token) : null
  if (!quote) return NextResponse.json({ error: 'Quote not found.' }, { status: 404 })
  if (quote.payment_required || quote.status !== 'quoted') return NextResponse.json({ error: 'This quote cannot be accepted here.' }, { status: 409 })
  if (quote.quote_expires_at && new Date(quote.quote_expires_at) <= new Date()) return NextResponse.json({ error: 'This quote has expired.' }, { status: 409 })
  const admin = createAdminClient(); if (!admin) return NextResponse.json({ error: 'Server configuration is incomplete.' }, { status: 503 })
  const { error } = await admin.from('service_requests').update({ status: 'accepted', quote_accepted_at: new Date().toISOString() }).eq('id', quote.id).eq('status', 'quoted')
  return error ? NextResponse.json({ error: 'Unable to accept quote.' }, { status: 500 }) : NextResponse.json({ ok: true })
}
