import { NextResponse } from 'next/server'
import { verifyClientToken } from '@/lib/client-access'
import { loadClientActivity } from '@/lib/client-activity-data'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const verified = await verifyClientToken(url.searchParams.get('slug') || '', url.searchParams.get('token') || '')
  if (!verified) return NextResponse.json({ error: 'Link not available.' }, { status: 401 })
  return NextResponse.json(await loadClientActivity(verified.businessId, verified.access), {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
