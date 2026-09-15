import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CalendarClock, Check, CircleAlert, ClipboardList, ExternalLink, Plus, ShoppingBag, Tag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwnerContext } from '@/lib/dashboard/business-context'
import type { BusinessPreferences } from '@/lib/types'
import type { BusinessIndustry } from '@/lib/section-order'

export const metadata: Metadata = { title: 'Home — Quicklink', robots: { index: false, follow: false } }

function withBusiness(href: string, businessId: string, showParam: boolean) { return showParam ? `${href}?business=${businessId}` : href }

type ActivityRow = { id: string; kind: 'order' | 'booking' | 'request'; title: string; status: string; created_at: string }

export default async function DashboardHomePage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business: preferred } = await searchParams
  const { business, businesses } = await requireOwnerContext(preferred)
  const supabase = await createClient()
  const showParam = businesses.length > 1

  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const [
    ordersToday, requestsToday, bookingsToday,
    productsCount, servicesCount, hoursCount, features, links, preferencesResult,
    recentOrders, recentBookings, recentRequests,
  ] = await Promise.all([
    supabase.from('orders').select('total_cents,status').eq('business_id', business.id).gte('created_at', startOfToday.toISOString()),
    supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('status', 'new'),
    supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('business_id', business.id).eq('appointment_date', startOfToday.toISOString().slice(0, 10)).neq('status', 'cancelled'),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('business_hours').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
    supabase.from('business_features').select('feature_key,enabled').eq('business_id', business.id),
    supabase.from('business_links').select('type').eq('business_id', business.id),
    supabase.from('business_preferences').select('industry').eq('business_id', business.id).maybeSingle(),
    supabase.from('orders').select('id,customer_name,status,created_at').eq('business_id', business.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('appointments').select('id,customer_name,status,created_at').eq('business_id', business.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('service_requests').select('id,customer_name,status,created_at').eq('business_id', business.id).order('created_at', { ascending: false }).limit(5),
  ])

  const newOrders = (ordersToday.data || []).filter((row) => row.status === 'new')
  const orderValueCents = (ordersToday.data || []).reduce((sum, row) => sum + (row.total_cents || 0), 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const enabledFeatures = new Set((features.data || []).filter((f) => f.enabled).map((f) => f.feature_key))
  const hasReviewLink = (links.data || []).some((l) => l.type === 'google_review')
  const hasCatalog = (productsCount.count || 0) > 0 || (servicesCount.count || 0) > 0
  const hasAction = enabledFeatures.has('ordering') || enabledFeatures.has('booking') || enabledFeatures.has('request_service')
  const hasHours = (hoursCount.count || 0) > 0
  const industry = ((preferencesResult.data as Pick<BusinessPreferences, 'industry'> | null)?.industry || 'general') as BusinessIndustry
  const isBrandNew = !hasCatalog && (newOrders.length + (requestsToday.count ?? 0) + (bookingsToday.count ?? 0)) === 0

  // Show a stat/quick action when it fits the business type OR the owner has
  // explicitly turned that feature on — never hide something they enabled,
  // but don't clutter a retail dashboard with booking modules it never uses.
  const orderingRelevant = enabledFeatures.has('ordering')
  const bookingRelevant = enabledFeatures.has('booking')
  const requestRelevant = enabledFeatures.has('request_service')

  const stats: Array<{ icon: typeof ShoppingBag; label: string; value: number }> = []
  if (orderingRelevant) stats.push({ icon: ShoppingBag, label: 'New orders', value: newOrders.length })
  if (requestRelevant) stats.push({ icon: ClipboardList, label: 'New requests', value: requestsToday.count ?? 0 })
  if (bookingRelevant) stats.push({ icon: CalendarClock, label: "Today's bookings", value: bookingsToday.count ?? 0 })
  const statsGridClass = stats.length === 1 ? 'sm:grid-cols-1' : stats.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'

  const quickActions: Array<{ href: string; icon: typeof Plus; label: string }> = []
  if (orderingRelevant) quickActions.push({ href: withBusiness('/dashboard/catalog#products', business.id, showParam), icon: Plus, label: 'Add product' })
  if (bookingRelevant) { quickActions.push({ href: withBusiness('/dashboard/catalog#services', business.id, showParam), icon: Plus, label: 'Add service' }); quickActions.push({ href: withBusiness('/dashboard/integrations', business.id, showParam), icon: CalendarClock, label: 'Manage availability' }) }
  if (requestRelevant) quickActions.push({ href: withBusiness('/dashboard/catalog#services', business.id, showParam), icon: Plus, label: 'Add service/package' })
  if (!orderingRelevant && !bookingRelevant && !requestRelevant) quickActions.push({ href: withBusiness('/dashboard/catalog#products', business.id, showParam), icon: Plus, label: 'Add product' }, { href: withBusiness('/dashboard/catalog#services', business.id, showParam), icon: Plus, label: 'Add service' })
  quickActions.push({ href: withBusiness('/dashboard/catalog#offers', business.id, showParam), icon: Tag, label: 'Create offer' })
  if (!bookingRelevant) quickActions.push({ href: withBusiness('/dashboard/integrations', business.id, showParam), icon: CalendarClock, label: 'Edit hours' })

  const setupItems = [
    { done: Boolean(business.logo_url), label: 'Add your logo', href: withBusiness('/dashboard/more', business.id, showParam) },
    { done: hasCatalog, label: 'Add a product or service', href: withBusiness('/dashboard/catalog', business.id, showParam) },
    { done: hasHours, label: 'Set your hours', href: withBusiness('/dashboard/integrations', business.id, showParam) },
    { done: hasAction, label: 'Turn on ordering, booking or requests', href: withBusiness('/dashboard/catalog', business.id, showParam) },
    { done: Boolean(industry) && industry !== 'general', label: 'Confirm your business type', href: withBusiness('/dashboard/settings', business.id, showParam) },
    { done: hasReviewLink, label: 'Add your Google review link', href: withBusiness('/dashboard/settings', business.id, showParam) },
  ]
  const remainingSetup = setupItems.filter((item) => !item.done)

  const activity: ActivityRow[] = [
    ...(orderingRelevant ? recentOrders.data || [] : []).map((r) => ({ id: r.id, kind: 'order' as const, title: r.customer_name || 'Customer', status: r.status, created_at: r.created_at })),
    ...(bookingRelevant ? recentBookings.data || [] : []).map((r) => ({ id: r.id, kind: 'booking' as const, title: r.customer_name || 'Customer', status: r.status, created_at: r.created_at })),
    ...(requestRelevant ? recentRequests.data || [] : []).map((r) => ({ id: r.id, kind: 'request' as const, title: r.customer_name || 'Customer', status: r.status, created_at: r.created_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-4xl">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">{greeting}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{business.name}</h1>
    <p className="mt-2 text-[#77776f]">{isBrandNew ? "Let's get your page ready for customers." : 'What needs your attention today.'}</p>
    {isBrandNew && <Link href={withBusiness('/dashboard/onboarding', business.id, showParam)} className="mt-4 flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-semibold text-white sm:w-fit">Start guided setup <ArrowRight size={16}/></Link>}

    {!isBrandNew && <>
      {stats.length>0&&<div className={`mt-7 grid gap-3 ${statsGridClass}`}>
        {stats.map((stat) => <Stat key={stat.label} icon={stat.icon} label={stat.label} value={stat.value}/>)}
      </div>}
      {orderValueCents > 0 && orderingRelevant && <p className="mt-3 text-sm text-[#77776f]">Today&apos;s order value so far: <strong className="text-[#1d1d1b]">${(orderValueCents / 100).toFixed(2)}</strong></p>}
    </>}

    {remainingSetup.length > 0 && <section className="mt-8 rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
      <div className="flex items-center gap-2"><CircleAlert size={16} className="text-[#8b6b3d]"/><h2 className="font-semibold">Finish setting up your page</h2></div>
      <p className="mt-1 text-xs text-[#77776f]">{remainingSetup.length} thing{remainingSetup.length === 1 ? '' : 's'} left before your page is fully ready.</p>
      <div className="mt-4 grid gap-1.5">
        {setupItems.map((item) => <Link key={item.label} href={item.href} className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${item.done ? 'text-[#9a988f]' : 'text-[#1d1d1b] hover:bg-[#fafaf7]'}`}>
          <span className={`flex size-5 shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-[#e4f2e8] text-[#2f8a52]' : 'border border-[#d8d6ce]'}`}>{item.done && <Check size={12}/>}</span>
          <span className={item.done ? 'line-through' : ''}>{item.label}</span>
        </Link>)}
      </div>
    </section>}

    <section className="mt-6 rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
      <h2 className="font-semibold">Quick actions</h2>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {quickActions.map((action) => <QuickAction key={action.label} href={action.href} icon={action.icon} label={action.label}/>)}
        <a href={`/${business.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-xl border border-[#d8d6ce] bg-[#fafaf7] px-4 py-3 text-sm font-semibold"><ExternalLink size={16} className="text-[#8b6b3d]"/> View page</a>
      </div>
    </section>

    <section className="mt-6 rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Link href={withBusiness('/dashboard/activity', business.id, showParam)} className="text-xs font-semibold text-[#8b6b3d]">See all</Link></div>
      {activity.length === 0
        ? <p className="mt-4 rounded-xl border border-dashed border-[#d8d6ce] p-4 text-center text-xs text-[#9a988f]">No orders, bookings or requests yet. Once customers start using your page, they'll show up here.</p>
        : <div className="mt-4 grid gap-1.5">{activity.map((row) => <div key={`${row.kind}-${row.id}`} className="flex items-center gap-3 rounded-xl px-1 py-2 text-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f2f1ea] text-[#77776f]">{row.kind === 'order' ? <ShoppingBag size={14}/> : row.kind === 'booking' ? <CalendarClock size={14}/> : <ClipboardList size={14}/>}</span>
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{row.title}</span><span className="block text-xs capitalize text-[#9a988f]">{row.kind} · {row.status.replace('_', ' ')}</span></span>
            <span className="shrink-0 text-xs text-[#9a988f]">{new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          </div>)}</div>}
    </section>
  </div></main>
}

function Stat({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: number }) {
  return <div className="rounded-2xl border border-[#deded7] bg-white p-5"><div className="flex items-center gap-2 text-sm text-[#77776f]"><Icon size={16} className="text-[#8b6b3d]"/>{label}</div><p className="mt-4 text-2xl font-semibold">{value}</p></div>
}
function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof Plus; label: string }) {
  return <Link href={href} className="flex items-center gap-2.5 rounded-xl border border-[#d8d6ce] bg-[#fafaf7] px-4 py-3 text-sm font-semibold"><Icon size={16} className="text-[#8b6b3d]"/> {label}</Link>
}
