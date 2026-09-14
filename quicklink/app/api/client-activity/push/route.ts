import { NextResponse } from 'next/server'
import { verifyClientToken } from '@/lib/client-access'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPushPublicConfig } from '@/lib/push'

async function verifiedBody(request: Request) {
  const body = await request.json()
  return { body, verified: await verifyClientToken(String(body.slug || ''), String(body.token || '')) }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const verified = await verifyClientToken(url.searchParams.get('slug') || '', url.searchParams.get('token') || '')
  if (!verified) return NextResponse.json({ error: 'Link not available.' }, { status: 401 })
  return NextResponse.json(getPushPublicConfig(), { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: Request) {
  const { body, verified } = await verifiedBody(request)
  if (!verified) return NextResponse.json({ error: 'Link not available.' }, { status: 401 })
  const subscription = body.subscription
  if (!subscription?.endpoint?.startsWith('https://') || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return NextResponse.json({ error: 'Invalid push subscription.' }, { status: 400 })
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Push notifications are not configured.' }, { status: 503 })
  const { data: existing } = await admin.from('business_push_subscriptions').select('business_id').eq('endpoint', subscription.endpoint).maybeSingle()
  if (existing && existing.business_id !== verified.businessId) return NextResponse.json({ error: 'That device subscription belongs to another business.' }, { status: 409 })
  const { error } = await admin.from('business_push_subscriptions').upsert({ business_id: verified.businessId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, user_agent: request.headers.get('user-agent'), last_seen_at: new Date().toISOString() }, { onConflict: 'endpoint' })
  if (error) { console.error('[Quicklink push] Subscription save failed', { businessId: verified.businessId, error: error.message }); return NextResponse.json({ error: 'Unable to enable notifications.' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { body, verified } = await verifiedBody(request)
  if (!verified) return NextResponse.json({ error: 'Link not available.' }, { status: 401 })
  const admin = createAdminClient()
  if (admin && body.endpoint) await admin.from('business_push_subscriptions').delete().eq('business_id', verified.businessId).eq('endpoint', body.endpoint)
  return NextResponse.json({ ok: true })
}
