# Product migration audit — before implementation

Marketing demonstrations are not evidence of production functionality.

| Requirement | Current status | Evidence / gap |
|---|---|---|
| Public businesses, permanent URLs/QR, links/themes | IMPLEMENTED | Existing businesses, /[slug], QrCard; retain IDs and destinations |
| Admin authentication / authorization | PARTIALLY IMPLEMENTED | Supabase + quicklink_admins RLS; proxy incorrectly permits RPC failure |
| Owner accounts, business membership | NOT IMPLEMENTED | No membership table, owner login, account onboarding |
| Invitations, assignment, revoke/reinvite | NOT IMPLEMENTED | Only legacy token management |
| Tenant RLS and storage mutation isolation | NOT IMPLEMENTED | Admin-only private access; no owner policies |
| Client dashboard / business switcher | NOT IMPLEMENTED | Legacy token activity view only |
| Business Inbox | PARTIALLY IMPLEMENTED | Real orders/bookings/requests, filters/archive; lacks authenticated owner path, expanded statuses/notes |
| Products/services | PARTIALLY IMPLEMENTED | Real catalog and price snapshots; giant admin inline editors, no owner catalog |
| Offers/gallery/hours | PARTIALLY IMPLEMENTED | Existing tables/actions; needs owner screens, compact hours and safe reordering |
| Public action-first hierarchy | NOT IMPLEMENTED | ClientPage puts social links above ClientModules |
| Industry presets / section ordering | PARTIALLY IMPLEMENTED | Suggested features exist; no controlled shared public-section configuration |
| Client analytics / admin outcomes | PARTIALLY IMPLEMENTED | Real events; no owner reporting, admin link-focused |
| Owner Calendar | PARTIALLY IMPLEMENTED | Working admin OAuth/provider; admin-only guards and return routes |
| Owner push/email settings | PARTIALLY IMPLEMENTED | Existing private-token push and admin settings; needs authenticated owner path |
| Booking safety/timezones | PARTIALLY IMPLEMENTED | Atomic booking RPC, busy ranges, managed tokens; timezone/optional sync checks need review |
| Client profile/appearance/links/settings | NOT IMPLEMENTED | Admin editor only |
| E2E MagicSudz and tenant-isolation verification | NOT IMPLEMENTED | No staging test accounts/project configured in the supplied app env |
| Homepage distinct story progression | PARTIALLY IMPLEMENTED | Hero works; duplicate second phone demo must become Inbox preview |

## Inventory boundaries

Core + 14 customer-hub SQL migrations; business-assets public delivery bucket; service-role-only calendar tokens and push subscriptions; admin allowlist; legacy business_client_access; orders/items, appointments, service requests, historical quote/delivery requests, leads, analytics, catalog/content/settings. Existing public APIs/RPCs must retain feature checks and historical snapshots. Existing push service worker, Resend email and Google OAuth callbacks retained. No billing/Twilio implementation. Environment names retained; no secrets are printed.

## Implementation sequence

Additive membership/config/RLS migration → guarded auth/onboarding → owner dashboard and scoped APIs/editors → public action hierarchy/presets/analytics → reuse Calendar/push → database and UI tests. Homepage repetition corrected with a small isolated component replacement. No production migrations or test records are applied without a verified target.
