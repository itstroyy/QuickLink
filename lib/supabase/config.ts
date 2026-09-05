type SupabaseErrorLike = {
  code?: string
  details?: string
  hint?: string
  message?: string
  status?: number
}

function firstDefined(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim()
}

export function getServerSupabaseConfig(caller = 'server') {
  const url = firstDefined(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL)
  const publishableKey = firstDefined(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
  )

  const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !publishableKey && 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'].filter(Boolean)
  if (missing.length > 0) {
    const message = `[Quicklink/Supabase:${caller}] Missing ${missing.join(' and ')}. Add the variables to the Vercel Production environment and redeploy.`
    console.error(message, {
      vercelEnvironment: process.env.VERCEL_ENV ?? 'local',
      hasServerUrlAlias: Boolean(process.env.SUPABASE_URL),
      hasServerKeyAlias: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY),
    })
    throw new Error(message)
  }

  try {
    new URL(url!)
  } catch {
    const message = `[Quicklink/Supabase:${caller}] The configured Supabase URL is invalid.`
    console.error(message, { vercelEnvironment: process.env.VERCEL_ENV ?? 'local' })
    throw new Error(message)
  }

  return { url: url!, publishableKey: publishableKey! }
}

export function logSupabaseError(context: string, error: SupabaseErrorLike, metadata: Record<string, unknown> = {}) {
  console.error(`[Quicklink/Supabase:${context}] ${error.message ?? 'Unknown Supabase error'}`, {
    code: error.code,
    details: error.details,
    hint: error.hint,
    status: error.status,
    ...metadata,
  })
}

export function throwSupabaseError(context: string, error: SupabaseErrorLike, metadata: Record<string, unknown> = {}): never {
  logSupabaseError(context, error, metadata)
  throw new Error(`[Quicklink/Supabase:${context}] ${error.message ?? 'Unknown Supabase error'}`)
}

export function getPublicSiteUrl() {
  const configured = firstDefined(
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ) ?? 'https://quicklinkqr.com'
  const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`
  return withProtocol.replace(/\/$/, '')
}
