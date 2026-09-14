import Link from 'next/link'
import { ArrowUpRight, BarChart3, CalendarClock, CheckCircle2, ClipboardList, MousePointerClick, Plus, ShoppingBag, TriangleAlert, Users, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { computeSetupIssues } from '@/lib/setup-issues'

type ActivityRow = { id: string; business_id: string; kind: 'order' | 'booking' | 'request'; title: string; status: string; created_at: string }

export default async function AdminPage() {
  const supabase = await createClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    businessesResult, visitsResult, actionsResult, ordersCount, bookingsCount, requestsCount,
    setupIssues,
    recentOrders, recentBookings, recentRequests,
  ] = await Promise.all([
    supabase.from('businesses').select('id,name,slug,theme,category,logo_url,status,created_at').neq('status', 'archived').order('created_at', { ascending: false }),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'page_view').gte('created_at', thirtyDaysAgo),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).neq('event_type', 'page_view').gte('created_at', thirtyDaysAgo),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).neq('status', 'cancelled'),
    supabase.from('service_requests').select('*', { count: 'exact', head: true }),
    computeSetupIssues(),
    supabase.from('orders').select('id,business_id,customer_name,status,created_at').order('created_at', { ascending: false }).limit(6),
    supabase.from('appointments').select('id,business_id,customer_name,status,created_at').order('created_at', { ascending: false }).limit(6),
    supabase.from('service_requests').select('id,business_id,customer_name,status,created_at').order('created_at', { ascending: false }).limit(6),
  ])

  const businesses = businessesResult.data ?? []
  const error = businessesResult.error
  const active = businesses.filter((b) => b.status === 'active').length
  const topSetupIssues = setupIssues.slice(0, 5)

  const businessNames = new Map(businesses.map((b) => [b.id, b.name]))
  const activity: ActivityRow[] = [
    ...(recentOrders.data || []).map((r) => ({ id: r.id, business_id: r.business_id, kind: 'order' as const, title: r.customer_name || 'Customer', status: r.status, created_at: r.created_at })),
    ...(recentBookings.data || []).map((r) => ({ id: r.id, business_id: r.business_id, kind: 'booking' as const, title: r.customer_name || 'Customer', status: r.status, created_at: r.created_at })),
    ...(recentRequests.data || []).map((r) => ({ id: r.id, business_id: r.business_id, kind: 'request' as const, title: r.customer_name || 'Customer', status: r.status, created_at: r.created_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6)

  const stats = [
    [Users, 'Businesses', businesses.length], [Zap, 'Active', active],
    [MousePointerClick, 'Visits (30d)', visitsResult.count ?? 0], [BarChart3, 'Customer actions (30d)', actionsResult.count ?? 0],
    [ShoppingBag, 'Orders', ordersCount.count ?? 0], [CalendarClock, 'Bookings', bookingsCount.count ?? 0], [ClipboardList, 'Requests', requestsCount.count ?? 0],
  ] as const

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Workspace overview</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Dashboard</h1><p className="mt-2 text-[#77776f]">Manage every business page from one place.</p></div><Link href="/admin/clients/new" className="flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-semibold text-white"><Plus size={16}/> Add client</Link></div>

    {error ? <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Finish the one-time database setup</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-amber-800">Your login is working, but the Quicklink tables have not been created in Supabase yet. Run <code className="rounded bg-amber-100 px-1">supabase/migrations/202609040001_quicklink_core.sql</code> in Supabase SQL Editor, then refresh.</p></div> : <>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{stats.map(([Icon, label, value]) => <div key={label} className="rounded-2xl border border-[#deded7] bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs text-[#77776f]">{label}</span><Icon size={15} className="text-[#8b6b3d]"/></div><p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p></div>)}</div>

      <div className="mt-6 rounded-2xl border border-[#deded7] bg-white">
        <div className="flex items-center gap-2 border-b px-5 py-4"><TriangleAlert size={16} className="text-[#8b6b3d]"/><h2 className="font-semibold">Attention needed</h2>{setupIssues.length > 0 && <span className="ml-auto text-xs text-[#999991]">{setupIssues.length}</span>}</div>
        {topSetupIssues.length === 0 ? <div className="flex items-center gap-2.5 px-5 py-6 text-sm text-[#46734d]"><CheckCircle2 size={17}/> All active businesses are ready.</div> : <>
          <div className="divide-y">{topSetupIssues.map((issue) => <Link key={issue.businessId} href={issue.href} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#fafaf7]"><span className="min-w-0"><span className="block truncate text-sm font-medium">{issue.businessName}</span><span className="block text-xs text-[#999991]">{issue.label}</span></span><span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#8b6b3d]">{issue.action} <ArrowUpRight size={14}/></span></Link>)}</div>
          {setupIssues.length > topSetupIssues.length && <Link href="/admin/setup-issues" className="flex items-center justify-center gap-1 border-t px-5 py-3 text-sm font-medium text-[#77776f] hover:bg-[#fafaf7]">View all setup issues ({setupIssues.length}) <ArrowUpRight size={14}/></Link>}
        </>}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#deded7] bg-white">
          <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Recently added</h2><p className="mt-1 text-xs text-[#999991]">Your latest client pages</p></div><Link href="/admin/clients" className="flex items-center gap-1 text-sm font-medium">View all <ArrowUpRight size={15}/></Link></div>
          <div className="divide-y">{businesses.slice(0, 5).map((business) => <Link href={`/admin/clients/${business.id}`} key={business.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#fafaf7]"><div className="min-w-0"><p className="truncate font-medium">{business.name}</p><p className="mt-1 truncate text-xs text-[#999991]">/{business.slug} · {business.category || business.theme}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${business.status === 'active' ? 'bg-[#e6f1e7] text-[#46734d]' : 'bg-[#f2e8d8] text-[#8b623d]'}`}>{business.status}</span></Link>)}{businesses.length === 0 && <p className="px-5 py-10 text-center text-sm text-[#77776f]">No clients yet. Add your first Quicklink page.</p>}</div>
        </div>

        <div className="rounded-2xl border border-[#deded7] bg-white">
          <div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Recent activity</h2><p className="mt-1 text-xs text-[#999991]">Across every business</p></div><Link href="/admin/activity" className="flex items-center gap-1 text-sm font-medium">View all <ArrowUpRight size={15}/></Link></div>
          <div className="divide-y">{activity.map((row) => <Link href={`/admin/clients/${row.business_id}`} key={`${row.kind}-${row.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#fafaf7]"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f2f1ea] text-[#77776f]">{row.kind === 'order' ? <ShoppingBag size={14}/> : row.kind === 'booking' ? <CalendarClock size={14}/> : <ClipboardList size={14}/>}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{businessNames.get(row.business_id) || 'Business'}</span><span className="block truncate text-xs capitalize text-[#999991]">{row.title} · {row.kind} · {row.status.replace('_', ' ')}</span></span></Link>)}{activity.length === 0 && <p className="px-5 py-10 text-center text-sm text-[#77776f]">No orders, bookings or requests yet across any business.</p>}</div>
        </div>
      </div>
    </>}
  </div></main>
}
