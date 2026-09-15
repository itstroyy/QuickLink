import 'server-only'

// The one place Quicklink hardcodes its production domain. Used only as a
// last-resort fallback below — never as the default ahead of an actual
// request origin or a correctly-configured NEXT_PUBLIC_SITE_URL.
const PRODUCTION_APP_URL = 'https://quicklink.host'

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

/**
 * Resolves Quicklink's own base URL — the origin used to build a link that
 * gets embedded somewhere disconnected from the current request (an
 * invite/magic-link email, an order or booking receipt, a Stripe Connect
 * redirect), where there's no browser location to read from.
 *
 * "Are we running locally" is decided from the REQUEST's own origin, not
 * from NEXT_PUBLIC_SITE_URL. That matters in both directions:
 *   - A real local `next dev` request always gets a localhost link, even
 *     if NEXT_PUBLIC_SITE_URL happens to be set to the production domain
 *     locally (e.g. for testing live-mode Stripe against HTTPS).
 *   - A real production/deployed request can NEVER get a localhost link,
 *     even if NEXT_PUBLIC_SITE_URL was accidentally left set to
 *     http://localhost:3000 in that environment (for example by copying
 *     .env.local's contents into Vercel without editing it) — this is
 *     exactly the bug that sent owner-invite emails to
 *     http://localhost:3000/#access_token=... in production. Once we know
 *     the request itself isn't local, a localhost-valued env var is
 *     ignored rather than trusted.
 *
 * Outside of a local request, NEXT_PUBLIC_SITE_URL is used when it's set
 * (and isn't itself pointing at localhost), then the request's own origin,
 * then finally the hardcoded production domain — localhost is never a
 * possible result once the request isn't local.
 */
export function resolveAppBaseUrl(request?: Request): string {
  const requestOrigin = request ? new URL(request.url).origin.replace(/\/$/, '') : null
  if (requestOrigin && isLocalHostname(new URL(requestOrigin).hostname)) return requestOrigin

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '')
  if (configured) {
    try {
      if (!isLocalHostname(new URL(configured).hostname)) return configured
    } catch {
      // Malformed NEXT_PUBLIC_SITE_URL — fall through rather than throw.
    }
  }
  return requestOrigin || PRODUCTION_APP_URL
}
