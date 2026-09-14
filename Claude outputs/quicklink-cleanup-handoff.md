# Quicklink UX cleanup — handoff

## What changed (12 files)

1. `components/inline-business-features.tsx` — "Client Activity access" is now a collapsed `<details>` labeled **"Legacy access (advanced)"** with an explanatory note pointing admins at Owner access instead. Nothing about the underlying `business_client_access` table, tokens, or the public `/client/[slug]/activity` route changed — existing links keep working.
2. `supabase/migrations/202609140002_invite_status_lookup.sql` — new additive migration: `public.my_invitation_status()`, a `security definer` RPC that lets a signed-in (non-admin) user read their own pending/expired/accepted invitation and business name. Always keyed off the verified email on the caller's own session — cannot be used to probe anyone else's invitation.
3. `lib/email.ts` — added `sendInviteEmail()`, a branded HTML+text invite email sent directly via Resend (bypassing Supabase's own unbrandable template), using the exact copy from the brief.
4. `app/api/admin/access/invite/route.ts` — rewritten to use `generateLink({ type: 'invite' })`, falling back to `generateLink({ type: 'magiclink' })` for emails that already have an account (this was the resend bug — `inviteUserByEmail` silently failed in that case). Redirect target is now `/auth/finish` (not `/auth/callback`). If Resend isn't configured, the raw accept link is returned to the admin UI so they can share it by hand.
5. `app/api/admin/access/revoke/route.ts` — added a `newRole` branch for "Change role" (owner ⇄ manager) alongside the existing revoke-member / cancel-invitation actions.
6. `components/admin-access-manager.tsx` — status UX rework: active members show **Owner active / Manager active** (green) with a role dropdown; pending invitations show **Invite pending** (amber) or **Invite expired** (red) distinctly, each expiry-dated; resend/revoke relabeled to match. Falls back to showing a raw accept link inline if an invite's email couldn't be sent.
7. `app/auth/finish/page.tsx` — rewritten with distinct branded states: checking, ready (shows the business name once known), sign-in required, expired, invalid, already-accepted, email-mismatch, revoked/not-found, generic error. No raw Supabase query params or technical messages are shown. Uses the new `my_invitation_status()` RPC.
8. `app/login/page.tsx` + `components/dashboard/owner-login.tsx` — `/login?error=...` (the fallback from `/auth/callback` and `/auth/confirm`) now renders a friendly banner instead of nothing.
9. `app/admin/page.tsx` — "Needs setup" replaced with **"Attention needed"**: one prioritized issue per business (owner invite expired/pending → no owner → no catalog → no hours → no primary action → calendar not connected → no logo → no review link), capped to 5, with a "View all setup issues" link and a compact "All active businesses are ready." success state.
10. `lib/setup-issues.ts` — new shared helper computing that prioritized issue list (used by both the dashboard and the new page below).
11. `app/admin/setup-issues/page.tsx` — new full list page for `[View all setup issues]`.

All files passed a `tsc --noEmit` static check (module-resolution noise from the sandbox's missing `node_modules` filtered out; no real type errors).

## Manual setup required in Supabase (I cannot do this — dashboard-only)

1. **Authentication → URL Configuration → Site URL**: set to `https://quicklink.host` (production).
2. **Authentication → URL Configuration → Additional Redirect URLs**: add both
   - `https://quicklink.host/auth/finish`
   - `http://localhost:3000/auth/finish`
   (Keep any existing entries, e.g. for `/auth/callback` or `/auth/confirm`, if other flows still use them — nothing here needs removing.)
3. **Email Templates**: no Supabase email template change is required for invites going forward — `generateLink()` never sends Supabase's own email, so the "Invite user" template is no longer used by the invite flow. (It's still used only if you ever call `inviteUserByEmail` directly elsewhere, which this code no longer does.) If you want a fallback in case Resend is down, you can leave the default template as-is; it just won't be triggered by `/api/admin/access/invite` anymore.
4. **Environment variables** (`.env.local` for dev, hosting provider for prod):
   - `RESEND_API_KEY` — must be set for the branded invite email to actually send (without it, the admin UI shows the raw accept link to copy/paste).
   - `EMAIL_FROM` — a verified sending address in Resend.
   - `SUPABASE_SECRET_KEY` — already required for `createAdminClient()`; needed for `generateLink`.
   - `NEXT_PUBLIC_SITE_URL` — set to `https://quicklink.host` in production; leave unset (or `http://localhost:3000`) in development, since the code already falls back to `new URL(request.url).origin` when it's not set. Do not hardcode `localhost` anywhere in production env vars.
5. **Exact localhost redirect**: `http://localhost:3000/auth/finish`
6. **Exact production redirect**: `https://quicklink.host/auth/finish`
7. **How to test a fresh invitation safely**:
   - Run the app locally with `RESEND_API_KEY`/`EMAIL_FROM` set (or leave them unset to get the raw link back in the invite API response instead of an email).
   - In Supabase, confirm `http://localhost:3000/auth/finish` is in Additional Redirect URLs.
   - From `/admin/clients/[id]/access`, invite a real test-mailbox address you control.
   - Click the link (or the accept link returned in the response) within 7 days; it should land on `/auth/finish`, show "You're in — welcome to `<Business>`", let you set a password, and land on `/dashboard` showing only that business.
   - Test resend against the same email after the first link — it should now succeed (previously this silently failed).
   - Let a second test invite sit until you can simulate expiry (or edit `expires_at` in `business_invitations` to a past date) and confirm the branded "This invitation has expired" screen appears, not a raw Supabase error.

## Final test — 12-point checklist

1. Admin sends invite — **VERIFIED BY CODE INSPECTION** (`invite/route.ts` upserts `business_invitations` then generates a link).
2. Email contains Quicklink-branded content/redirect — **VERIFIED BY CODE INSPECTION** (`sendInviteEmail`/`inviteEmailHtml` in `lib/email.ts` matches the requested copy exactly; redirect is `/auth/finish`). **REQUIRES LOCAL/STAGING VERIFICATION** for actual Resend delivery/rendering.
3. Owner clicks invite — **REQUIRES LOCAL/STAGING VERIFICATION** (needs a live Supabase project + email).
4. Valid invite reaches Quicklink auth flow — **VERIFIED BY CODE INSPECTION** (`redirectTo` now points at `/auth/finish`, which handles both `?code=` and hash-token shapes). **REQUIRES LOCAL/STAGING VERIFICATION** to confirm Supabase's actual redirect shape against the Additional Redirect URLs config (this was the likely root cause of the original `otp_expired` bug and depends on dashboard settings I can't change).
5. Owner becomes business member — **VERIFIED BY CODE INSPECTION** (`/auth/finish` calls `claim_business_invitations()`, unchanged and already correct).
6. Invitation becomes accepted — **VERIFIED BY CODE INSPECTION** (same RPC sets `accepted_at`).
7. Owner reaches `/dashboard` — **VERIFIED BY CODE INSPECTION** (`/auth/finish` redirects there after password set, or via "Continue to dashboard").
8. Owner sees only assigned business — **VERIFIED BY CODE INSPECTION** (unchanged; enforced by `can_manage_business()` RLS, not touched this pass).
9. Expired invite shows branded error — **VERIFIED BY CODE INSPECTION** (`my_invitation_status()` returns `expired`; `/auth/finish` renders the dedicated panel, no raw params).
10. Resend generates a usable new invite — **VERIFIED BY CODE INSPECTION** (fixed via `generateLink` + `magiclink` fallback, replacing the old silent-failure path on `inviteUserByEmail`). **REQUIRES LOCAL/STAGING VERIFICATION** to confirm end-to-end against a live project.
11. Legacy Client Activity links still work — **VERIFIED BY CODE INSPECTION** (only the admin-editor UI changed — collapsed into "Legacy access"; the `business_client_access` table, `/client/[slug]/activity` page, and `/api/client-activity/*` routes are untouched).
12. Admin dashboard no longer duplicates the full client list under "Needs setup" — **VERIFIED BY CODE INSPECTION** (`app/admin/page.tsx` now shows "Attention needed" capped at 5 prioritized issues, with a success state and a "View all" page for the rest).

## Not done / explicitly out of scope this pass

- Did not delete or disable the legacy Client Activity token system — only demoted its UI, per instruction.
- Did not touch `/auth/callback` or `/auth/confirm` route handlers themselves; they remain as fallbacks for any already-issued links, redirecting failures to the now-friendlier `/login?error=...`.
- "Email mismatch" is defined as a distinct branded state in `/auth/finish` for completeness, but in practice Supabase's generated links always authenticate as the token's own account, so this state is not currently reachable — documenting it here rather than claiming false verification.
- Runtime/staging verification (items 2, 3, 4, 10 above) requires a live Supabase project and email delivery, which isn't available in this environment — flagged rather than assumed.
