# Quicklink

Quicklink is one reusable QR landing-page platform for local businesses. Client information lives in Supabase, so adding or editing a client never requires a new page file or redeployment.

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
2. Copy all of `supabase/migrations/202609040001_quicklink_core.sql` into the editor.
3. Click **Run** once.

The migration creates businesses, unlimited links, analytics events, settings, the image-storage bucket, indexes, Row Level Security policies, and four removable demo businesses.

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
