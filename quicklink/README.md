# Quicklink

Quicklink is one reusable QR landing-page platform for local businesses. Client information lives in Supabase, so adding or editing a client never requires a new page file or redeployment.

For the current production migration, Stripe Connect, webhook, Vercel, Resend, Calendar, and release checklist, see [`docs/PRODUCTION-SETUP.md`](docs/PRODUCTION-SETUP.md).

## One-time setup

### 1. Connect Supabase

1. Open your project at [Supabase](https://supabase.com/dashboard).
2. Open **Project Settings → API**.
3. Copy `.env.example` to `.env.local`.
4. Add your project URL and publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_SITE_URL=https://quicklinkqr.com
```

The publishable key is safe for the browser when Row Level Security is enabled. Never add a secret/service-role key to a `NEXT_PUBLIC_` variable or commit it to Git.

### 2. Create the database

1. In Supabase, open **SQL Editor → New query**.
2. Copy all of `supabase/migrations/202609040001_quicklink_core.sql` into the editor and run it.
3. Copy all of `supabase/migrations/202609130001_customer_hub_phase1.sql` into a new query and run it.
4. Copy all of `supabase/migrations/202609130002_orders_delivery_quotes.sql` into a new query and run it.
5. Copy all of `supabase/migrations/202609130003_request_service.sql` into a new query and run it.
6. Copy all of `supabase/migrations/202609130004_booking.sql` into a new query and run it.

The first migration creates the core platform. The Phase 1 migration adds per-business feature controls, services, offers, hours, announcements, galleries, lead forms/submissions, richer analytics, indexes and Row Level Security. It preserves every existing business, URL and link.

### 3. Create the administrator

1. Open **Authentication → Users**.
2. Choose **Add user → Create new user**.
3. Enter your email and a strong password.
4. In **Authentication → Providers → Email**, turn off public new-user signup because Quicklink currently treats any authenticated account as an administrator.
5. Visit `/admin/login` directly.

There are intentionally no credentials stored in this repository. Supabase Auth protects the admin routes through `proxy.ts`.

### 4. Add your contact number

```env
NEXT_PUBLIC_CONTACT_PHONE=+15551234567
NEXT_PUBLIC_CONTACT_EMAIL=optional@example.com
```

Use international phone format. The homepage shows Call and Text buttons when a number is configured.

## Daily workflow

1. Sign in at `/admin/login`.
2. Select **Add client**.
3. Enter branding, contact details, links, images, and theme options while checking the live phone preview.
4. Create the client.
5. Open the client detail screen to copy the public URL or download PNG/SVG QR codes.
6. Edit the client later; the same public URL and QR code immediately use the updated information.

### Customer hub (Phase 1)

Open a client and choose **Customer hub**. From there the administrator can:

- apply an industry suggestion without publishing unwanted features;
- enable only the modules the business needs and choose one primary module;
- manage services, prices, durations, offers, hours and announcements;
- upload gallery images through the existing `business-assets` bucket;
- publish a lead form and manage incoming leads as New, Contacted or Closed;
- review analytics for today, 7 days, 30 days or all time.

No client login or client-facing dashboard is created. The Phase 1 migration copies the currently existing Supabase users into `quicklink_admins`, then Row Level Security rejects every future authenticated user who is not explicitly on that allowlist. Keep public Supabase email signup disabled as a second layer of protection.

The original Phase 1 block requires no additional environment variables. Booking, calendar sync, reorder, text lists, loyalty/referrals and AI features remain intentionally reserved for later migrations.

### Orders and service requests

The current editor adds Order Now plus one configurable Request Service module. Request Service can be renamed for delivery, quotes, catering, detailing, cleaning, or another request type. Products, SMS settings, orders and service requests are managed directly inside the existing client editor. The third migration safely moves legacy delivery and quote submissions into the unified request inbox.

Customer submissions do not require an account. Database functions validate enabled modules, calculate product totals from database prices, and save records before notification is attempted.

For owner SMS notifications, configure these server-only variables locally and in Vercel:

```env
SUPABASE_SECRET_KEY=your-supabase-secret-key
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+15551234567
```

Never prefix these variables with `NEXT_PUBLIC_`. Without Twilio, submissions still save and the API reports that the SMS was skipped — the specific reason (missing credentials, unverified trial number, invalid phone format, etc.) is always written to the server console.

### Booking

Booking is a fourth configurable module, alongside Order Now and Request Service. Enable it from the client editor's Business Features panel, set a custom button title, buffer time and minimum notice, and choose the notification phone/SMS toggle in SMS Notifications. Services and weekly hours (including closed days) are managed from **Services & hours**, linked from the client detail page and from the Booking settings panel — the same services and hours also power the public booking flow's available times.

The public flow is Service → Date → Available time → Name → Phone → optional email/notes → Confirm. Double-booking is prevented at the database level. Booking works fully without Google Calendar; after confirming, customers get "Add to calendar" links for Google Calendar, Outlook and a downloadable .ics file for Apple/other calendars. The `appointments` table reserves an `external_calendar_event_id` column so two-way calendar sync can be added later without a schema change.

Client pages can be enabled, disabled, duplicated, or archived from the dashboard. Archive is a recoverable soft delete in the database.

## Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy with Vercel

1. Import the repository into Vercel.
2. Add every variable from `.env.local` under **Project Settings → Environment Variables**.
3. Deploy.
4. Add `quicklinkqr.com` under **Project Settings → Domains** and follow Vercel’s DNS instructions.

Business changes made through the admin dashboard do not require another deployment. Only platform code or `NEXT_PUBLIC_` environment changes do.

### Owner accounts and the business dashboard

1. In Supabase, open **SQL Editor → New query**, paste all of `supabase/migrations/202609140001_business_membership.sql`, and run it once. It's additive — no existing business, order, booking or request is touched — and adds `business_members`, `business_invitations`, `business_preferences`, owner-scoped Row Level Security policies, and widens the `orders`/`appointments`/`service_requests` status values to match the Business Inbox.
2. Open a business in **Admin → Clients → (business) → Owner access** and invite the owner's email. If they don't have a Quicklink account yet, Supabase sends them an invite email; if they already do, access applies automatically the next time they sign in.
3. The owner signs in at `/login` (password, a one-time email link, or password reset) and lands on `/dashboard` — Home, Activity (the Business Inbox: orders + bookings + service requests, one place), Catalog (products, services, offers, hours, gallery, notifications, Google Calendar), Analytics (outcomes: orders, order value, bookings, requests, primary-action/review/call/text clicks), and More (business profile, appearance, links).
4. An owner only ever sees the business or businesses they're a member of (`can_manage_business`, enforced by RLS on every table, not just in the UI). The platform admin allowlist (`quicklink_admins`) continues to see and manage everything from `/admin`.
5. The legacy private **Client Activity** link (`/client/[slug]/activity?token=...`) keeps working unchanged — it's a separate, older access path that doesn't require an account, and revoking it is independent of `business_members`.
