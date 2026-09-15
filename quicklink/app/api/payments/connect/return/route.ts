import { NextResponse } from 'next/server'
import { businessSession } from '@/lib/dashboard/auth'
import { isMissingStripeAccount, logStripeError, syncConnectedAccount } from '@/lib/stripe'

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get('business')
  const session = await businessSession(businessId)
  if (!session.ok) return NextResponse.redirect(new URL('/login', request.url))
  try {
    await syncConnectedAccount(session.businessId)
    return NextResponse.redirect(new URL(`/dashboard/payments?business=${session.businessId}&stripe=returned`, request.url))
  } catch (error) {
    logStripeError('Could not sync returned account', error, { businessId: session.businessId })
    const state = isMissingStripeAccount(error) ? 'stale' : 'sync-error'
    return NextResponse.redirect(new URL(`/dashboard/payments?business=${session.businessId}&stripe=${state}`, request.url))
  }
}
