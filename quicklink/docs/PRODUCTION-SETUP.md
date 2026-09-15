# Quicklink production setup

This checklist covers the external configuration required by the productized order, booking, quote, email, calendar, push, and Stripe Connect flows. Never commit real secret values.

## Runtime requirements

- Node.js 22.x (the version declared in `package.json`)
- pnpm 9.15.9 through Corepack
- the repository root for commands is the nested `quicklink` directory

Run:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm run build
```

## Supabase

Apply every SQL file in `supabase/migrations` once, in filename order. Existing installations should apply only migrations newer than the last recorded deployment; for this release the new migration is:

```text
supabase/migrations/202609140004_productization_payments.sql
```

It is additive. It must be applied before deploying the matching application code because the new APIs depend on its functions and columns. Do not reset the database and do not alter existing business IDs or slugs.

Confirm that these Vercel variables point to the production Supabase project:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

The Supabase secret key is server-only. Keep RLS enabled. Public status pages use narrowly scoped, hashed bearer tokens and security-definer read functions; raw tokens are never stored in the database.

## Stripe Connect platform

Quicklink uses connected accounts where each local business is the merchant. Accounts use Stripe-hosted requirement collection and the full Stripe Dashboard. Direct charges are created on the connected account, so payment records, refunds, disputes, and payouts belong to that business. Quicklink currently sets no application fee.

1. In the Stripe Dashboard, enable Connect for the Quicklink platform in test mode first.
2. Complete the platform profile, branding, public business details, support details, and required Connect platform information.
3. Under Connect settings, review the account onboarding branding and platform name shown to connected businesses.
4. Copy the platform test secret key to `STRIPE_SECRET_KEY` in the Vercel Preview environment. The optional browser-safe test publishable key goes in `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
5. Deploy the preview, sign in as an owner, open **Settings → Payments**, and select **Connect Stripe**. Quicklink creates the connected-account relationship and sends the owner through a single-use Stripe-hosted Account Link. No business keys or bank details pass through Quicklink.
6. Create an event destination for `https://quicklink.host/api/stripe/webhook`. Configure it to receive events from connected accounts, because Quicklink uses direct charges. Subscribe to:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `refund.created`
   - `refund.updated`
   - `refund.failed`
   - `account.updated`
7. Copy that endpoint's signing secret to `STRIPE_WEBHOOK_SECRET`. The signing secret is distinct from the API secret key.
8. For local webhook testing, use the Stripe CLI to forward Connect events to `http://localhost:3000/api/stripe/webhook` and temporarily use the CLI-provided `whsec_...` value locally.
9. Exercise all acceptance flows in test mode. Only after they pass should you repeat the key and webhook setup in Stripe live mode and Vercel Production. Test and live connected accounts, event destinations, API keys, and signing secrets are separate.

Account Links use the generated `return_url` and `refresh_url` under `NEXT_PUBLIC_SITE_URL`; no OAuth redirect URI is required for this hosted-onboarding architecture. Set the site URL to the canonical production origin so Stripe never returns an owner to a preview or localhost URL.

## Resend, Calendar, and push

Configure these server variables as applicable:

```text
RESEND_API_KEY
EMAIL_FROM
EMAIL_REPLY_TO
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

- Verify the sending domain in Resend. `EMAIL_FROM` must use a verified sender. Set `EMAIL_REPLY_TO` to a monitored support address.
- In Google Cloud, add `https://quicklink.host/api/admin/calendar/callback` as the production OAuth redirect URI and set `GOOGLE_REDIRECT_URI` to the same value.
- Keep all Google and VAPID private values server-only.
- Email, push, and Calendar errors are isolated from the core transaction. Review Vercel logs and the booking `integration_error` field when an optional integration fails.

## Vercel

Set the following for Production and, with test values, Preview:

```text
NEXT_PUBLIC_SITE_URL=https://quicklink.host
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_CONTACT_PHONE
NEXT_PUBLIC_CONTACT_EMAIL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RESEND_API_KEY
EMAIL_FROM
EMAIL_REPLY_TO
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=https://quicklink.host/api/admin/calendar/callback
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Use environment-specific Stripe keys. After changing any `NEXT_PUBLIC_` value, redeploy. Confirm `quicklink.host` is attached to the production project and is the value used by `NEXT_PUBLIC_SITE_URL`.

## Test-mode release gate

Before enabling live keys, verify with at least two connected test businesses:

- connected-account onboarding, incomplete onboarding, reconnect, and safe disconnect;
- paid retail order plus failed/expired Checkout;
- full-payment booking and deposit booking, including an abandoned hold releasing after 30 minutes;
- overlapping multi-service availability and Calendar busy-time blocking;
- request confirmation, quote acceptance, paid quote, and expired quote;
- eligible customer cancellation, ineligible cancellation, full refund, and partial refund;
- webhook signature rejection, duplicate delivery, and retry after a recorded processing failure;
- customer and owner HTML/plain-text emails and hosted Stripe receipt links;
- cross-tenant attempts by a second owner against payments, refunds, orders, bookings, requests, and settings.

Do not treat a Checkout return URL as proof of payment. Verify that only signed webhook processing changes the payment to Paid and activates the related order, booking, or quote.

## Deployment order

1. Back up the production Supabase database and confirm the target project.
2. Apply `202609140004_productization_payments.sql` in Supabase.
3. Add or update all Vercel variables, initially using Stripe test-mode values.
4. Deploy to Vercel Preview and run the full test-mode release gate.
5. Configure the production connected-account webhook and verify a signed test delivery.
6. Promote the tested commit to Production while still using test-mode Stripe if a final production smoke test is desired.
7. Switch Production to live Stripe keys and the live webhook signing secret, then redeploy.
8. Connect each real business through its **Payments** page; do not copy test connected-account IDs into live settings.
9. Run one low-value live transaction with a consenting internal business, verify the webhook, email, inbox state, receipt, payout ownership, cancellation/refund behavior, and then refund it.
10. Monitor Vercel, Stripe event deliveries, Resend, and Supabase logs during the first rollout.
