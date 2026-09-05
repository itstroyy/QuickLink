import Link from 'next/link'
import { ArrowUpRight, BarChart3, Plus, QrCode, Users, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { logSupabaseError } from '@/lib/supabase/config'

export default async function AdminPage() {
  const supabase = await createClient()
  const [{ data, error }, eventCount] = await Promise.all([
    supabase.from('businesses').select('id,name,slug,theme,status,created_at').neq('status', 'archived').order('created_at', { ascending: false }),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_type', 'link_click'),
  ])
  if (error) logSupabaseError('admin-dashboard-businesses', error)
  if (eventCount.error) logSupabaseError('admin-dashboard-analytics', eventCount.error)
  const businesses = data ?? []
  const active = businesses.filter((business) => business.status === 'active').length
  const stats = [[Users, 'Total clients', businesses.length], [Zap, 'Active pages', active], [QrCode, 'QR pages', businesses.length], [BarChart3, 'Link clicks', eventCount.count ?? 0]] as const

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Workspace overview</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Dashboard</h1><p className="mt-2 text-[#77776f]">Manage every business page from one place.</p></div><Link href="/admin/clients/new" className="flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-semibold text-white"><Plus size={16}/> Add client</Link></div>
    {error ? <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Finish the one-time database setup</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-amber-800">Your login is working, but the Quicklink tables have not been created in Supabase yet. Run <code className="rounded bg-amber-100 px-1">supabase/migrations/202609040001_quicklink_core.sql</code> in Supabase SQL Editor, then refresh.</p></div> : <><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([Icon, label, value]) => <div key={label} className="rounded-2xl border border-[#deded7] bg-white p-5"><div className="flex items-center justify-between"><span className="text-sm text-[#77776f]">{label}</span><Icon size={17} className="text-[#8b6b3d]"/></div><p className="mt-6 text-3xl font-semibold tracking-tight">{value}</p></div>)}</div><div className="mt-8 rounded-2xl border border-[#deded7] bg-white"><div className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-semibold">Recently added</h2><p className="mt-1 text-xs text-[#999991]">Your latest client pages</p></div><Link href="/admin/clients" className="flex items-center gap-1 text-sm font-medium">View all <ArrowUpRight size={15}/></Link></div><div className="divide-y">{businesses.slice(0, 5).map((business) => <Link href={`/admin/clients/${business.id}`} key={business.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#fafaf7]"><div><p className="font-medium">{business.name}</p><p className="mt-1 text-xs text-[#999991]">/{business.slug} · {business.theme}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${business.status === 'active' ? 'bg-[#e6f1e7] text-[#46734d]' : 'bg-[#f2e8d8] text-[#8b623d]'}`}>{business.status}</span></Link>)}{businesses.length === 0 && <p className="px-5 py-10 text-center text-sm text-[#77776f]">No clients yet. Add your first Quicklink page.</p>}</div></div></>}
  </div></main>
}
