# Motion and interaction polish — handoff

## Scope and location

Implemented in the production-feature application at `quicklink/`, not the older application at repository root. This is the motion / micro-interaction / homepage request; it is not the entire account and multi-tenant evolution described in the background attachments. Pre-existing root logo/icon changes were left intact.

## What changed

- Shared 160–240 ms motion, visible keyboard focus, press feedback, short success/status effects, and native accordion expansion where supported.
- Removed continuous public-page background drift and the homepage's scroll-driven morph / looping illustration. No new motion dependency or scroll handler.
- Global reduced-motion rules disable animations and transitions, including skeleton animation. Programmatic public-section scrolling also respects the preference.
- Marketing reveals run once as a section enters view. Content remains visible without JavaScript and motion never gates actions.
- Interactive fictional Book / Order / Request businesses in the hero and demonstration section. Selection, confirmation and matching activity preview work locally, without any database writes or invented production metrics. Keyboard focus follows step changes. No automatic rotation.
- Homepage positioning now describes a customer hub. The demonstration QR links to the same homepage's demo, rather than assuming a production demo-business slug exists.
- Shared accessible, dismissible success/error feedback persists across navigation. Business/settings saves, product saves/uploads, private-link copying, promo copying, public sharing and activity changes use it.
- QR generation reserves space with a loading skeleton, offers retry after failure, disables unavailable downloads, says “Copied”, and reports that a download started. Browsers cannot confirm that a user actually saved a downloaded file.
- Business saves show real operation stages (saving / uploading logo / uploading cover / saving links and settings). Upload progress is indeterminate; no fabricated percentages.
- Admin and legacy activity status/archive controls disable while a mutation is pending, handle failures and confirm changes after server success. Status badges animate briefly. Empty filters offer a clear-filters action.
- Business disabling has an explicit confirmation. Existing archive/delete confirmations remain. Product mutation controls have pending/error/success feedback.
- Google Calendar distinguishes checking, connected, disconnected, connecting, disconnecting and connection-check failure with retry. Existing OAuth endpoints remain in use.
- Admin navigation has a short entrance transition and a route loading skeleton; live preview colors transition without delaying typing.

## Compatibility and architecture inventory

No new URLs/API endpoints, database migrations, tables, columns, policies, dependencies, environment variables, credentials or external setup. `app/admin/loading.tsx` is a loading boundary, not a new route.

Existing public `/[slug]`, admin routes, order/booking management token routes, and legacy `/client/[slug]/activity` remain. Business IDs, slugs, QR destinations, API payload conventions and transaction/status semantics remain in use. This work did not reset, seed or migrate Supabase, or submit any production orders/bookings/requests.

The nested application contains the original core migration and 14 customer-hub migrations, with business profiles/links, features, services, promotions, hours, announcements, gallery, leads, products, orders/items, appointments, requests, client access, email/calendar settings and push records. Existing admin guard, Supabase RLS, business-assets storage, Calendar OAuth/provider code, push/email helpers and analytics endpoint were inspected as compatibility boundaries and not redesigned. Analytics event definitions/calculations were not changed.

Client accounts, invitation flows, tenant memberships, industry presets, public section reordering and new authorization policies were not introduced in this pass. The existing private Client Activity link remains the client management path. No new drag/drop or modal system was added solely for animation.

## Verification

- Separate TypeScript check: `tsc --noEmit` passed. This matters because the existing Next config skips build-time type validation.
- Production compiler: `next build --webpack` passed; all 34 static pages generated and existing dynamic routes compiled.
- Browser: Book, Order and Request demos completed with success and matching activity preview; mobile menu opens/closes; keyboard Enter works and focus follows the new demo step.
- Browser layout checks: 375 × 812, 390 × 844 and 430 × 932, plus desktop. No document horizontal overflow at these mobile widths.
- Reduced-motion behavior was checked in the source/CSS; OS preference emulation was not available in this browser tool.
- Git diff whitespace check passed. No lint script/tool is configured in this application.

## Limitations and next step

Default Turbopack build repeatedly failed locally while spawning its PostCSS Node worker (`EPERM`, resolving `C:\Users\dawin`, worker reports Node 20.10.0). The supported webpack build works using the bundled Node runtime. No package/build setting was changed to hide this environment problem. From the nested app, use `npm run build -- --webpack` with a supported Node runtime until the local Turbopack worker issue is resolved; deployment's default compiler still needs verification.

Authenticated admin/legacy activity writes, live image uploads, QR downloads in the private admin screen, Calendar OAuth and real customer transaction flows were not exercised against production accounts. Perform those checks in staging before rollout. This pass does not certify the background brief's full multi-tenant migration acceptance scenario.

Review the local homepage, then stage this visual/interaction patch and verify the private mutation flows. No production deployment was performed.
