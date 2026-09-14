import fs from 'node:fs'
import path from 'node:path'

// This repository currently keeps local server credentials one directory
// above the actual Next.js app. Next only auto-loads env files from the app
// root, so fill missing server-only values from that parent file in local
// development. Inner .env.local values always win, and Vercel/production is
// never affected.
if (process.env.NODE_ENV !== 'production') {
  const parentEnvPath = path.resolve(process.cwd(), '..', '.env.local')
  const allowed = new Set(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'RESEND_API_KEY', 'EMAIL_FROM', 'SUPABASE_SECRET_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'])
  if (fs.existsSync(parentEnvPath)) {
    for (const line of fs.readFileSync(parentEnvPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
      if (!match || !allowed.has(match[1]) || process.env[match[1]]) continue
      let value = match[2]
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      process.env[match[1]] = value
    }
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
