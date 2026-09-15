import fs from 'node:fs'
import path from 'node:path'

// This repository currently keeps some local server credentials one
// directory above the actual Next.js app. Next only auto-loads env files
// from the app root (this directory's own .env.local), so fill missing
// server-only values from that parent file in local development. Inner
// .env.local or host-provided values always win. Hosted deployments are
// unaffected because this untracked parent file is absent there.
//
// Stripe keys are deliberately EXCLUDED from this fallback. Silently
// borrowing STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY /
// STRIPE_WEBHOOK_SECRET from the parent folder is what caused local dev to
// run against live Stripe (the parent .env.local holds live keys), which in
// turn made Connect onboarding fail with "Livemode requests must always be
// redirected via HTTPS" when it tried to redirect back to localhost. Add
// sk_test_ / pk_test_ / whsec_ test keys to this app's own .env.local
// instead — see .env.example.
const parentEnvPath = path.resolve(process.cwd(), '..', '.env.local')
const allowed = new Set([
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI',
  'RESEND_API_KEY', 'EMAIL_FROM', 'SUPABASE_SECRET_KEY',
  'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT',
])
if (fs.existsSync(parentEnvPath)) {
  for (const line of fs.readFileSync(parentEnvPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || !allowed.has(match[1]) || process.env[match[1]]) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[match[1]] = value
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
