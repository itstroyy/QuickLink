import 'server-only'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

let stripeClient: Stripe | null = null

export type StripePlatformConfig = {
  mode: 'test' | 'live' | 'invalid' | 'unconfigured'
  secretKeyConfigured: boolean
  publishableKeyConfigured: boolean
  webhookSecretConfigured: boolean
  connectReady: boolean
  paymentsReady: boolean
  missing: string[]
}

export type SafeStripeError = {
  type: string
  code?: string
  message: string
  requestId?: string
  status?: number
}

export function stripePlatformConfig(): StripePlatformConfig {
  const secret = process.env.STRIPE_SECRET_KEY?.trim() || ''
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || ''
  const webhook = process.env.STRIPE_WEBHOOK_SECRET?.trim() || ''
  const secretMode = secret.startsWith('sk_test_') ? 'test' : secret.startsWith('sk_live_') ? 'live' : secret ? 'invalid' : 'unconfigured'
  const publishableMode = publishable.startsWith('pk_test_') ? 'test' : publishable.startsWith('pk_live_') ? 'live' : null
  const secretKeyConfigured = secretMode === 'test' || secretMode === 'live'
  const publishableKeyConfigured = publishableMode === secretMode
  const webhookSecretConfigured = webhook.startsWith('whsec_')
  const missing = [
    !secretKeyConfigured && 'STRIPE_SECRET_KEY',
    !publishableKeyConfigured && 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    !webhookSecretConfigured && 'STRIPE_WEBHOOK_SECRET',
  ].filter(Boolean) as string[]
  return {
    mode: secretMode,
    secretKeyConfigured,
    publishableKeyConfigured,
    webhookSecretConfigured,
    connectReady: secretKeyConfigured,
    paymentsReady: secretKeyConfigured && publishableKeyConfigured && webhookSecretConfigured,
    missing,
  }
}

export function getStripe(): Stripe | null {
  const config = stripePlatformConfig()
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key || !config.secretKeyConfigured) return null
  if (!stripeClient) stripeClient = new Stripe(key, { appInfo: { name: 'Quicklink', version: '1.0.0' } })
  return stripeClient
}

export function requireStripe(): Stripe {
  const stripe = getStripe()
  if (!stripe) throw new Error('Stripe secret key is missing or invalid.')
  return stripe
}

export function publicOrigin(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  const requested = request ? new URL(request.url).origin.replace(/\/$/, '') : null
  if (requested) {
    const hostname = new URL(requested).hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return requested
  }
  return configured || requested || 'https://quicklink.host'
}

export function safeStripeError(error: unknown): SafeStripeError {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : null
  const raw = value?.raw && typeof value.raw === 'object' ? value.raw as Record<string, unknown> : null
  const text = (candidate: unknown) => typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined
  const number = (candidate: unknown) => typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : undefined
  return {
    type: text(value?.rawType) || text(raw?.type) || text(value?.type) || text(value?.name) || 'UnknownError',
    code: text(value?.code) || text(raw?.code),
    message: error instanceof Error ? error.message : text(value?.message) || 'Unknown Stripe error.',
    requestId: text(value?.requestId) || text(raw?.requestId),
    status: number(value?.statusCode) || number(raw?.statusCode),
  }
}

export function logStripeError(context: string, error: unknown, fields: Record<string, string | number | boolean | null> = {}) {
  console.error(`[Quicklink Stripe] ${context}`, { ...fields, ...safeStripeError(error) })
}

export function isMissingStripeAccount(error: unknown) {
  const details = safeStripeError(error)
  return details.code === 'resource_missing' || details.status === 404
}

// --- Test/live connected-account separation -----------------------------
//
// A Stripe secret key only ever talks to accounts created under the same
// mode ("The provided key 'sk_test_...' does not have access to account
// 'acct_...' (or that account does not exist)" is Stripe's way of saying a
// test key was pointed at a live-mode account, or vice versa). So the app
// must never store one shared "the" connected account per business — it
// stores one per Stripe mode, and only ever reads/writes the column set
// matching the currently active key.

export type StripeMode = 'test' | 'live'
export type StripeAccountStatus = 'not_connected' | 'onboarding' | 'restricted' | 'enabled' | 'disconnected'
// Which Stripe API created a given stored connected account. Stripe no
// longer allows creating NEW accounts with Accounts v1 (stripe.accounts.create) —
// new accounts must go through POST /v2/core/accounts — but every account
// created before that change keeps working fine under v1 forever, and its
// hosted-onboarding Account Link must keep using the matching v1/v2 flavor
// (see createConnectedAccountLink below). A missing/null value means 'v1':
// every account stored before this column existed was created that way.
export type StripeAccountApiVersion = 'v1' | 'v2'

export type StripeModeColumns = {
  accountId: string
  detailsSubmitted: string
  chargesEnabled: string
  payoutsEnabled: string
  accountStatus: string
  connectedAt: string
  apiVersion: string
}

export function stripeModeColumns(mode: StripeMode): StripeModeColumns {
  const prefix = mode === 'live' ? 'stripe_live_' : 'stripe_test_'
  return {
    accountId: `${prefix}account_id`,
    detailsSubmitted: `${prefix}details_submitted`,
    chargesEnabled: `${prefix}charges_enabled`,
    payoutsEnabled: `${prefix}payouts_enabled`,
    accountStatus: `${prefix}account_status`,
    connectedAt: `${prefix}connected_at`,
    apiVersion: `${prefix}account_api`,
  }
}

/** The mode-scoped reset applied when a stale/deleted account is cleared or Stripe is disconnected. */
export function statusResetFor(mode: StripeMode): Record<string, unknown> {
  const c = stripeModeColumns(mode)
  return {
    [c.accountId]: null,
    [c.detailsSubmitted]: false,
    [c.chargesEnabled]: false,
    [c.payoutsEnabled]: false,
    [c.accountStatus]: 'not_connected',
    [c.connectedAt]: null,
    [c.apiVersion]: null,
  }
}

/** The Stripe mode of the currently active secret key, or null when unconfigured/invalid. */
export function activeStripeMode(): StripeMode | null {
  const mode = stripePlatformConfig().mode
  return mode === 'test' || mode === 'live' ? mode : null
}

/**
 * The mode to pass as p_stripe_mode to the public-readiness/checkout RPCs
 * (get_public_payment_config, submit_quicklink_order_productized,
 * submit_booking_productized) and to select as the mode whose
 * stripeModeColumns() a route should read before creating a Checkout
 * Session. Every one of those RPCs defaults its own p_stripe_mode to
 * 'live' when it isn't passed at all, so an unconfigured/invalid key here
 * falling back to 'live' can never make production checkout look more
 * ready than it is — it can only make an unconfigured server correctly
 * report "not ready" against the live account, same as before mode-aware
 * readiness existed.
 */
export function stripeModeForRpc(): StripeMode {
  return activeStripeMode() ?? 'live'
}

// --- Accounts v1/v2 capability compatibility mapping ---------------------
//
// Accounts v2 has no charges_enabled / payouts_enabled / details_submitted
// fields — capability state lives under configuration.merchant.capabilities
// (e.g. card_payments.status, stripe_balance.payouts.status) and a
// requirements hash. BUT Stripe's v1/v2 interop guarantees that fetching
// ANY account (v1- or v2-created) through the v1 endpoint — exactly what
// stripe.accounts.retrieve() below does — always returns it "structured as
// a v1 Account", i.e. with charges_enabled/payouts_enabled/details_submitted
// populated correctly regardless of which API created it. So the rest of
// Quicklink (this file, the checkout/booking SQL functions, the dashboard)
// keeps using that one normalized v1-shaped status — this function is the
// single place that reads it off a Stripe.Account, so if that interop
// guarantee ever changes, only this function needs to change.
export type NormalizedAccountCapability = {
  detailsSubmitted: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  status: StripeAccountStatus
}

export function normalizeAccountCapability(account: Stripe.Account): NormalizedAccountCapability {
  const detailsSubmitted = Boolean(account.details_submitted)
  const chargesEnabled = Boolean(account.charges_enabled)
  const payoutsEnabled = Boolean(account.payouts_enabled)
  const status: StripeAccountStatus = chargesEnabled && payoutsEnabled
    ? 'enabled'
    : detailsSubmitted ? 'restricted' : 'onboarding'
  return { detailsSubmitted, chargesEnabled, payoutsEnabled, status }
}

// --- Stripe Connect onboarding origin resolution -----------------------
//
// Connect Account Links are mode-sensitive: a *live* accountLink refuses a
// non-HTTPS return_url/refresh_url ("Livemode requests must always be
// redirected via HTTPS"), while a *test* accountLink is happy to redirect
// back to http://localhost. The Stripe mode here is never guessed from
// NODE_ENV or a flag — it is read strictly from the active secret key via
// stripePlatformConfig().

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

function httpsSiteUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' ? url.origin : null
  } catch {
    return null
  }
}

export class StripeLiveLocalhostError extends Error {
  code = 'STRIPE_LIVE_LOCALHOST_BLOCKED' as const
  constructor() {
    super('Live Stripe Connect onboarding requires HTTPS. Use the deployed Quicklink site or switch to Stripe test mode locally.')
    this.name = 'StripeLiveLocalhostError'
  }
}

export type OnboardingOrigin = { origin: string; mode: StripeMode }

/**
 * Resolves the origin Connect onboarding links should redirect back to, and
 * enforces the live/localhost rule. Throws StripeLiveLocalhostError instead
 * of ever handing Stripe a live-mode localhost URL — callers should check
 * for that error *before* creating anything at Stripe, not just before
 * building the Account Link.
 */
export function resolveOnboardingOrigin(request: Request): OnboardingOrigin {
  const config = stripePlatformConfig()
  const mode: StripeMode = config.mode === 'live' ? 'live' : 'test'
  const requestOrigin = new URL(request.url).origin.replace(/\/$/, '')
  const requestIsLocal = isLocalHostname(new URL(requestOrigin).hostname)

  if (mode === 'live') {
    if (requestIsLocal) throw new StripeLiveLocalhostError()
    return { origin: httpsSiteUrl() || 'https://quicklink.host', mode }
  }

  // Test mode: always reflect the current origin (localhost during `next
  // dev`, the preview/deployed origin otherwise) so Stripe's hosted
  // onboarding returns the user to wherever they actually started.
  return { origin: requestOrigin, mode }
}

function logOnboardingAttempt(kind: 'initial' | 'refresh', mode: StripeMode, origin: string, accountApiVersion: StripeAccountApiVersion) {
  if (process.env.NODE_ENV !== 'development') return
  // Safe to log: mode, origin and which Accounts API the account was
  // created with — never STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET or any
  // part of them.
  console.log('[Quicklink Stripe] Connect onboarding', { kind, mode, origin, accountApiVersion })
}

/**
 * The single place that creates a Stripe Connect Account Link. Both the
 * initial "Connect Stripe" action and "Continue Stripe setup" (and Stripe's
 * own refresh_url callback) call this exact function, so their origin/mode
 * handling cannot drift apart.
 *
 * accountApiVersion picks the matching Account Link flavor: accounts
 * created under Accounts v1 (every account stored before this migration,
 * including any existing live account) keep using the v1 Account Links
 * endpoint (POST /v1/account_links) forever; accounts created going
 * forward via POST /v2/core/accounts use the v2 Account Links endpoint
 * (POST /v2/core/account_links), which understands v2 "configurations"
 * the v1 endpoint doesn't. accountId must already be the account for the
 * *currently active* mode — see stripeModeColumns().
 */
export async function createConnectedAccountLink(request: Request, businessId: string, accountId: string, accountApiVersion: StripeAccountApiVersion, kind: 'initial' | 'refresh' = 'initial'): Promise<{ url: string }> {
  const { origin, mode } = resolveOnboardingOrigin(request)
  logOnboardingAttempt(kind, mode, origin, accountApiVersion)
  const stripe = requireStripe()
  const refresh_url = `${origin}/api/payments/connect/refresh?business=${encodeURIComponent(businessId)}`
  const return_url = `${origin}/api/payments/connect/return?business=${encodeURIComponent(businessId)}`
  if (accountApiVersion === 'v2') {
    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['merchant'],
          collection_options: { fields: 'eventually_due', future_requirements: 'include' },
          return_url,
          refresh_url,
        },
      },
    })
    return { url: link.url }
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url,
    return_url,
    type: 'account_onboarding',
    collection_options: { fields: 'eventually_due', future_requirements: 'include' },
  })
  return { url: link.url }
}

export function stripeMode(): StripePlatformConfig['mode'] {
  return stripePlatformConfig().mode
}

/**
 * Creates a NEW Stripe Connect connected account for a business, via
 * Accounts v2 (POST /v2/core/accounts) — Stripe no longer accepts new
 * connected-account creation through Accounts v1. This is only ever called
 * for a business/mode that has no stored account yet; an existing account
 * (v1 or v2) is always reused, never recreated.
 *
 * Configuration mirrors what the previous v1 `controller` object did, so
 * the architecture is unchanged: direct charges, Stripe-hosted full
 * Dashboard access, Stripe collects payment fees directly from the
 * connected account (no Quicklink application fee), and Stripe — not
 * Quicklink — is liable for the account's negative balances and
 * responsible for collecting KYC/onboarding requirements.
 *   v1 controller.fees.payer: 'account'         -> v2 defaults.responsibilities.fees_collector: 'stripe'
 *   v1 controller.losses.payments: 'stripe'      -> v2 defaults.responsibilities.losses_collector: 'stripe'
 *   v1 controller.requirement_collection: 'stripe' -> v2 requirements_collector is derived automatically
 *                                                     from losses_collector + dashboard (both point to 'stripe' here)
 *   v1 controller.stripe_dashboard.type: 'full'  -> v2 dashboard: 'full'
 * The `merchant` configuration with `card_payments` requested is what
 * actually lets the account accept payments — Accounts v2 has no implicit
 * "give it payments capability" like v1's bare controller object did, so
 * this must be requested explicitly.
 *
 * Accounts v2 also requires `identity.country` to be set on the account
 * before `configuration.merchant` can be requested at all (Stripe rejects
 * the create call with "The field identity.country is required before
 * setting configuration.merchant" otherwise) — v1 had no equivalent
 * up-front requirement. Quicklink currently supports only U.S. connected
 * businesses, so this is fixed to 'us' at creation time rather than left
 * for onboarding to choose; it is not read back or changed afterwards.
 */
export async function createConnectedAccountV2(params: {
  contactEmail?: string | null
  displayName: string
  metadata: Record<string, string>
  idempotencyKey: string
}) {
  const stripe = requireStripe()
  const account = await stripe.v2.core.accounts.create({
    contact_email: params.contactEmail || undefined,
    display_name: params.displayName,
    dashboard: 'full',
    identity: {
      // Required before configuration.merchant can be set (see doc comment
      // above). Quicklink is U.S.-only for connected businesses today.
      country: 'us',
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
    },
    defaults: {
      responsibilities: {
        fees_collector: 'stripe',
        losses_collector: 'stripe',
      },
    },
    metadata: params.metadata,
    include: ['configuration.merchant', 'requirements'],
  }, { idempotencyKey: params.idempotencyKey })
  return account
}

/**
 * Refreshes a business's connected-account capability flags from Stripe,
 * always into the column set matching the currently active key's mode
 * (test vs live) — never the other one. If accountId isn't passed, it's
 * looked up from that same mode-scoped column, so this can't accidentally
 * read/write a different mode's account. Uses the v1 accounts.retrieve
 * endpoint deliberately — per Stripe's v1/v2 interop guarantee this
 * returns a v1-shaped Account (with charges_enabled/payouts_enabled/
 * details_submitted populated) for a v2-created account too, so this one
 * call keeps working unchanged for both.
 */
export async function syncConnectedAccount(businessId: string, accountId?: string | null) {
  const admin = createAdminClient()
  const stripe = getStripe()
  const mode = activeStripeMode()
  if (!admin || !stripe || !mode) return null
  const columns = stripeModeColumns(mode)
  let resolved = accountId
  if (!resolved) {
    // '*' (a static literal), not the single dynamic column name — kept
    // consistent with the other mode-scoped selects in this codebase, all
    // of which read '*' and then pick the mode-specific field off the full
    // row in TypeScript rather than asking select() to parse a
    // runtime-built column list.
    const { data } = await admin.from('business_payment_settings').select('*').eq('business_id', businessId).maybeSingle()
    resolved = (data as Record<string, unknown> | null)?.[columns.accountId] as string | null || null
  }
  if (!resolved) return null
  const account = await stripe.accounts.retrieve(resolved)
  if ('deleted' in account && account.deleted) return null
  const capability = normalizeAccountCapability(account)
  const update: Record<string, unknown> = {
    [columns.accountId]: account.id,
    [columns.detailsSubmitted]: capability.detailsSubmitted,
    [columns.chargesEnabled]: capability.chargesEnabled,
    [columns.payoutsEnabled]: capability.payoutsEnabled,
    [columns.accountStatus]: capability.status,
    [columns.connectedAt]: new Date((account.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
  }
  const { error } = await admin.from('business_payment_settings').update(update).eq('business_id', businessId)
  if (error) throw new Error(`Unable to store connected-account status (${error.code || 'database error'}).`)
  return { account, mode, ...update }
}

export async function paymentReceipt(stripe: Stripe, accountId: string, paymentIntentId: string | null) {
  if (!paymentIntentId) return { chargeId: null, receiptUrl: null }
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] }, { stripeAccount: accountId })
    const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null
    return { chargeId: charge?.id || null, receiptUrl: charge?.receipt_url || null }
  } catch (error) {
    console.error('[Quicklink Stripe] Could not retrieve payment receipt', { accountId, paymentIntentId, message: error instanceof Error ? error.message : String(error) })
    return { chargeId: null, receiptUrl: null }
  }
}

export function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
}
