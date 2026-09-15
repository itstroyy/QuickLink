import { NextResponse } from 'next/server'
import { businessSession, sameOrigin } from '@/lib/dashboard/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createConnectedAccountLink, createConnectedAccountV2, isMissingStripeAccount, logStripeError, requireStripe, resolveOnboardingOrigin, safeStripeError, statusResetFor, StripeAccountApiVersion, StripeLiveLocalhostError, stripeModeColumns, stripePlatformConfig, syncConnectedAccount } from '@/lib/stripe'

function connectFailure(error: unknown) {
  const details = safeStripeError(error)
  const platformIncomplete = details.message.toLowerCase().includes('complete your platform profile')
  const code = platformIncomplete ? 'STRIPE_CONNECT_PLATFORM_INCOMPLETE' : 'STRIPE_CONNECT_FAILED'
  const message = process.env.NODE_ENV === 'development'
    ? `Stripe onboarding failed: ${details.message}`
    : platformIncomplete
      ? 'Quicklink must finish its Stripe Connect platform profile before live businesses can connect.'
      : 'Unable to start Stripe onboarding. Please try again.'
  return NextResponse.json({
    error: message,
    code,
    ...(process.env.NODE_ENV === 'development' ? { stripe: details } : {}),
  }, { status: platformIncomplete ? 503 : details.status && details.status >= 400 && details.status < 500 ? 400 : 500 })
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
    const body = await request.json()
    const session = await businessSession(body.businessId)
    if (!session.ok) return NextResponse.json({ error: 'You do not have access to this business.' }, { status: session.status })
    if (!stripePlatformConfig().connectReady) return NextResponse.json({ error: 'Quicklink Stripe is not configured. Add a valid STRIPE_SECRET_KEY on the server.', code: 'STRIPE_NOT_CONFIGURED' }, { status: 503 })
    // Fail fast on live-key-from-localhost before touching Stripe at all
    // (account creation below would otherwise still hit the live API).
    const { mode } = resolveOnboardingOrigin(request)
    const columns = stripeModeColumns(mode)
    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Payments cannot be configured until the server key is added.' }, { status: 503 })
    const stripe = requireStripe()
    // Select the full row with a static '*' rather than building the column
    // list from stripeModeColumns() as a template literal: supabase-js's
    // select() parses its query STRING at the type level, and a template
    // literal built from runtime `string`-typed interpolations (not string
    // literals) produces a phantom ParserError type instead of a plain
    // object type. Selecting '*' is a static literal, so it type-checks
    // cleanly, and the mode-specific fields are still just read off the
    // full row below via columns.accountId / columns.apiVersion.
    const [{ data: business, error: businessError }, { data: initialSettings, error: settingsError }] = await Promise.all([
      admin.from('businesses').select('id,name,email').eq('id', session.businessId).single(),
      admin.from('business_payment_settings').select('*').eq('business_id', session.businessId).maybeSingle(),
    ])
    if (businessError || !business) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
    if (settingsError) throw new Error(`Unable to read payment settings (${settingsError.code || 'database error'}).`)
    let settings = initialSettings as Record<string, unknown> | null
    if (!settings) {
      const { error: initializeError } = await admin.from('business_payment_settings').upsert({ business_id: session.businessId }, { onConflict: 'business_id', ignoreDuplicates: true })
      if (initializeError) throw new Error(`Unable to initialize payment settings (${initializeError.code || 'database error'}).`)
      const { data, error: reloadError } = await admin.from('business_payment_settings').select('*').eq('business_id', session.businessId).single()
      if (reloadError || !data) throw new Error(`Unable to reload payment settings (${reloadError?.code || 'database error'}).`)
      settings = data as Record<string, unknown>
    }
    // Mode-scoped: a business connected in live mode and a business (or the
    // same business) connected in test mode never share this lookup, so a
    // test key can never be pointed at a live-mode-only account or vice versa.
    let accountId = settings[columns.accountId] as string | null
    // A missing value means the account was created before this column
    // existed, i.e. via Accounts v1 — never assumed to be v2.
    const storedApiVersion = settings[columns.apiVersion] as StripeAccountApiVersion | null | undefined
    let accountApiVersion: StripeAccountApiVersion = storedApiVersion === 'v2' ? 'v2' : 'v1'
    if (accountId) {
      try {
        const existing = await stripe.accounts.retrieve(accountId)
        if ('deleted' in existing && existing.deleted) throw Object.assign(new Error('The stored Stripe connected account was deleted.'), { code: 'resource_missing', statusCode: 404 })
      } catch (error) {
        if (!isMissingStripeAccount(error)) throw error
        logStripeError(`Stored ${mode} connected account is stale; clearing it`, error, { businessId: session.businessId })
        const { data, error: clearError } = await admin.from('business_payment_settings').update(statusResetFor(mode)).eq('business_id', session.businessId).select('updated_at').single()
        if (clearError || !data) throw new Error(`Unable to clear the stale connected account (${clearError?.code || 'database error'}).`)
        accountId = null
        settings = { ...settings, [columns.accountId]: null, [columns.apiVersion]: null, updated_at: data.updated_at }
      }
    }
    // Reusing an existing accountId here (rather than always creating) is
    // also what keeps repeated "Continue Stripe setup" clicks from ever
    // creating a duplicate Stripe account — and what keeps this from ever
    // recreating (or touching) an existing v1 account, live included.
    if (!accountId) {
      const account = await createConnectedAccountV2({
        contactEmail: business.email,
        displayName: business.name,
        metadata: { quicklink_business_id: session.businessId, quicklink_business_name: business.name, quicklink_stripe_mode: mode },
        idempotencyKey: `quicklink-connect-v2-${mode}-${session.businessId}-${new Date(settings.updated_at as string).getTime()}`,
      })
      accountId = account.id
      accountApiVersion = 'v2'
      const { data: stored, error: storeError } = await admin.from('business_payment_settings').update({
        [columns.accountId]: account.id,
        [columns.apiVersion]: 'v2',
        [columns.accountStatus]: 'onboarding',
        [columns.connectedAt]: new Date().toISOString(),
      }).eq('business_id', session.businessId).select('business_id').single()
      if (storeError || !stored) throw new Error(`Unable to store the connected account (${storeError?.code || 'database error'}).`)
    }
    await syncConnectedAccount(session.businessId, accountId)
    const link = await createConnectedAccountLink(request, session.businessId, accountId, accountApiVersion, 'initial')
    return NextResponse.json({ ok: true, url: link.url })
  } catch (error) {
    if (error instanceof StripeLiveLocalhostError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    logStripeError('Connect onboarding failed', error)
    return connectFailure(error)
  }
}
