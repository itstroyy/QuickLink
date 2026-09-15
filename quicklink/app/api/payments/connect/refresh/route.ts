import { NextResponse } from 'next/server'
import { businessSession } from '@/lib/dashboard/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createConnectedAccountLink, isMissingStripeAccount, logStripeError, resolveOnboardingOrigin, StripeAccountApiVersion, StripeLiveLocalhostError, stripeModeColumns, stripePlatformConfig } from '@/lib/stripe'

export async function GET(request: Request) {
  const businessId = new URL(request.url).searchParams.get('business')
  const session = await businessSession(businessId)
  if (!session.ok) return NextResponse.redirect(new URL('/login', request.url))
  if (!stripePlatformConfig().connectReady) return NextResponse.redirect(new URL(`/dashboard/payments?business=${session.businessId}&stripe=sync-error`, request.url))
  let mode: 'test' | 'live'
  try {
    ;({ mode } = resolveOnboardingOrigin(request))
  } catch (error) {
    if (error instanceof StripeLiveLocalhostError) return NextResponse.redirect(new URL(`/dashboard/payments?business=${session.businessId}&stripe=live-localhost-blocked`, request.url))
    throw error
  }
  // Same mode-scoped column and the same shared link helper as the initial
  // "Connect Stripe" action, so origin/mode/account-selection can't drift
  // between the two entry points. Select '*' (a static literal) rather than
  // a template literal built from stripeModeColumns() — see the matching
  // comment in ../route.ts for why the dynamic form breaks select()'s
  // TypeScript typing.
  const columns = stripeModeColumns(mode)
  const admin = createAdminClient()
  const { data } = admin ? await admin.from('business_payment_settings').select('*').eq('business_id', session.businessId).single() : { data: null }
  const record = data as Record<string, unknown> | null
  const accountId = record?.[columns.accountId] as string | null
  if (!accountId) return NextResponse.redirect(new URL(`/dashboard/payments?business=${session.businessId}&stripe=missing`, request.url))
  const storedApiVersion = record?.[columns.apiVersion] as StripeAccountApiVersion | null | undefined
  const accountApiVersion: StripeAccountApiVersion = storedApiVersion === 'v2' ? 'v2' : 'v1'
  try {
    // This path never creates a new Stripe account, so repeated visits
    // (Stripe's own refresh_url callback, or the user reloading) cannot
    // duplicate one.
    const link = await createConnectedAccountLink(request, session.businessId, accountId, accountApiVersion, 'refresh')
    return NextResponse.redirect(link.url)
  } catch (error) {
    if (error instanceof StripeLiveLocalhostError) return NextResponse.redirect(new URL(`/dashboard/payments?business=${session.businessId}&stripe=live-localhost-blocked`, request.url))
    logStripeError('Could not refresh onboarding link', error, { businessId: session.businessId })
    const state = isMissingStripeAccount(error) ? 'stale' : 'sync-error'
    return NextResponse.redirect(new URL(`/dashboard/payments?business=${session.businessId}&stripe=${state}`, request.url))
  }
}
