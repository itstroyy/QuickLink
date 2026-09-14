import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check, ExternalLink, PartyPopper } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwnerContext } from '@/lib/dashboard/business-context'
import { defaultPrimaryActionFor, industryOptions, type BusinessIndustry } from '@/lib/section-order'
import type { BusinessPreferences } from '@/lib/types'

export const metadata: Metadata = { title: 'Set up your page — Quicklink', robots: { index: false, follow: false } }

function withBusiness(href: string, businessId: string) { return `${href}?business=${businessId}` }

export default async function DashboardOnboardingPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business: preferred } = await searchParams
  const { business } = await requireOwnerContext(preferred)
  const supabase = await createClient()

  const [preferencesResult, featuresResult, linksResult, productsCount, servicesCount, hoursCount, notifications] = await Promise.all([
    supabase.from('business_preferences').select('*').eq('business_id', business.id).maybeSingle(),
    supabase.from('business_features').select('feature_key,enabled').eq('business_id', business.id),
    supabase.from('business_links').select('type').eq('business_id', business.id),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('business_hours').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('business_notification_settings').select('notification_phone,notification_email').eq('business_id', business.id).maybeSingle(),
  ])

  const preferences = preferencesResult.data as BusinessPreferences | null
  const industry: BusinessIndustry = preferences?.industry || 'general'
  const primaryGroup = defaultPrimaryActionFor(industry)
  const enabledFeatures = new Set((featuresResult.data || []).filter((f) => f.enabled).map((f) => f.feature_key))
  const hasReviewLink = (linksResult.data || []).some((l) => l.type === 'google_review')
  const hasCatalog = (productsCount.count || 0) > 0 || (servicesCount.count || 0) > 0
  const hasHours = (hoursCount.count || 0) > 0
  const hasAction = enabledFeatures.has('ordering') || enabledFeatures.has('booking') || enabledFeatures.has('request_service')
  const hasNotifications = Boolean(notifications.data?.notification_phone || notifications.data?.notification_email)

  const catalogLabel = primaryGroup === 'ordering' ? 'products' : primaryGroup === 'booking' ? 'services' : primaryGroup === 'request_service' ? 'services' : 'products or services'
  const catalogHint = primaryGroup === 'ordering'
    ? 'Add what customers can order, and set pickup or delivery in Page Settings.'
    : primaryGroup === 'booking'
    ? 'Add your bookable services, then turn on Booking and add a gallery of your work.'
    : primaryGroup === 'request_service'
    ? 'Add the services you offer and turn on Request / Quote so customers can reach out.'
    : "Add what you sell or offer — we'll adapt your page around it."

  const steps = [
    { key: 'basics', label: 'Business basics', hint: 'Name, category, phone and description.', done: Boolean(business.category && business.phone), href: withBusiness('/dashboard/more', business.id) },
    { key: 'type', label: 'Business type', hint: 'Sets a smart default layout for your page.', done: industry !== 'general', href: withBusiness('/dashboard/settings', business.id) },
    { key: 'catalog', label: `Add your ${catalogLabel}`, hint: catalogHint, done: hasCatalog, href: withBusiness('/dashboard/catalog', business.id) },
    { key: 'hours', label: 'Set your hours', hint: 'Shown live as "Open now" / "Closed" on your page.', done: hasHours, href: withBusiness('/dashboard/catalog#hours', business.id) },
    { key: 'action', label: 'Turn on a primary action', hint: primaryGroup === 'ordering' ? 'Turn on Ordering.' : primaryGroup === 'booking' ? 'Turn on Booking.' : primaryGroup === 'request_service' ? 'Turn on Request / Quote.' : 'Turn on ordering, booking or requests.', done: hasAction, href: withBusiness('/dashboard/catalog', business.id) },
    { key: 'branding', label: 'Add your logo', hint: 'Shown at the top of your public page.', done: Boolean(business.logo_url), href: withBusiness('/dashboard/more', business.id) },
    { key: 'notifications', label: 'Notifications', hint: "So you don't miss a new order, booking or request.", done: hasNotifications, href: withBusiness('/dashboard/more', business.id) },
    { key: 'reviews', label: 'Add your review link (optional)', hint: 'A button so happy customers can leave a Google review.', href: withBusiness('/dashboard/settings', business.id), done: hasReviewLink, optional: true },
  ]
  const requiredSteps = steps.filter((s) => !s.optional)
  const doneCount = requiredSteps.filter((s) => s.done).length
  const ready = doneCount === requiredSteps.length

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-2xl">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Set up {business.name}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{ready ? "You're ready to launch" : "Let's get your page ready"}</h1>
    <p className="mt-2 text-[#77776f]">{ready ? 'Every essential is in place. Customers can already use your page — the items below are optional polish.' : 'Go in any order, leave anytime — everything here saves as you go, so you can always pick up where you left off.'}</p>

    <div className="mt-6 h-2 overflow-hidden rounded-full bg-[#eee9df]"><div className="h-full rounded-full bg-[#8b6b3d] transition-all" style={{ width: `${Math.round((doneCount / requiredSteps.length) * 100)}%` }}/></div>
    <p className="mt-2 text-xs text-[#999991]">{doneCount} of {requiredSteps.length} essentials complete</p>

    <div className="mt-6 grid gap-2">
      {steps.map((step) => <Link key={step.key} href={step.href} className={`flex items-center gap-4 rounded-2xl border bg-white p-4 transition hover:border-[#8b6b3d] ${step.done ? 'border-[#e4e2d8]' : 'border-[#deded7]'}`}>
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${step.done ? 'bg-[#e4f2e8] text-[#2f8a52]' : 'border border-[#d8d6ce] text-transparent'}`}>{step.done && <Check size={14}/>}</span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="font-semibold">{step.label}</span>{step.optional && <span className="rounded-full bg-[#f0eee7] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#9a988f]">Optional</span>}</span><span className="mt-0.5 block text-xs text-[#77776f]">{step.hint}</span></span>
        <ArrowRight size={16} className="shrink-0 text-[#9a988f]"/>
      </Link>)}
    </div>

    <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-[#deded7] bg-white p-5">
      {ready && <PartyPopper size={20} className="text-[#8b6b3d]"/>}
      <div className="flex-1"><p className="text-sm font-semibold">{ready ? 'Your page is live and ready for customers.' : 'You can enter your dashboard any time — nothing here is required to get in.'}</p></div>
      <Link href={withBusiness('/dashboard', business.id)} className="dashboard-primary inline-flex items-center gap-2">Go to dashboard <ArrowRight size={15}/></Link>
      <a href={`/${business.slug}`} target="_blank" rel="noreferrer" className="dashboard-secondary inline-flex items-center gap-2">Preview my page <ExternalLink size={14}/></a>
    </div>

    {industry !== 'general' && <p className="mt-6 text-center text-xs text-[#9a988f]">Showing steps for {industryOptions.find((o) => o.value === industry)?.label}. Change this any time in Page Settings.</p>}
  </div></main>
}
