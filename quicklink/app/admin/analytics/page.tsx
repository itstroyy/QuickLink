import Link from 'next/link'
import { BarChart3, Eye, MousePointerClick, Target, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

const ranges = { today: 1, '7d': 7, '30d': 30, all: 0 } as const
type Range = keyof typeof ranges

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const requested = (await searchParams).range
  const range: Range = requested && requested in ranges ? requested as Range : '30d'
  const since = ranges[range] ? new Date(Date.now() - ranges[range] * 86400000).toISOString() : null
  const supabase = await createClient()
  let eventQuery = supabase.from('analytics_events').select('business_id,event_type,link_id,visitor_id,created_at')
  if (since) eventQuery = eventQuery.gte('created_at', since)
  const [{ data: businesses, error }, { data: events }] = await Promise.all([
    supabase.from('businesses').select('id,name,slug,status').neq('status', 'archived').order('name'), eventQuery,
  ])
  const totals = new Map<string, { views: number; actions: number; leads: number; visitors: Set<string> }>()
  for (const event of events ?? []) {
    const current = totals.get(event.business_id) ?? { views: 0, actions: 0, leads: 0, visitors: new Set<string>() }
    if (event.event_type === 'page_view') current.views += 1
    else { current.actions += 1; if (event.event_type === 'lead_submit') current.leads += 1 }
    if (event.visitor_id) current.visitors.add(event.visitor_id)
    totals.set(event.business_id, current)
  }
  const totalViews = [...totals.values()].reduce((sum, item) => sum + item.views, 0)
  const totalActions = [...totals.values()].reduce((sum, item) => sum + item.actions, 0)
  const totalLeads = [...totals.values()].reduce((sum, item) => sum + item.leads, 0)
  const uniqueVisitors = new Set((events ?? []).map((event) => event.visitor_id).filter(Boolean)).size
  const conversion = totalViews ? Math.round((totalActions / totalViews) * 1000) / 10 : 0

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Privacy-conscious insights</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Analytics</h1><p className="mt-2 text-[#77776f]">Real visits, actions, leads and anonymous unique visitors.</p></div><nav className="flex rounded-full border bg-white p-1 text-xs font-semibold">{Object.keys(ranges).map((key) => <Link key={key} href={`/admin/analytics?range=${key}`} className={`rounded-full px-3 py-2 ${range === key ? 'bg-[#1d1d1b] text-white' : 'text-[#77776f]'}`}>{key === 'all' ? 'All time' : key === 'today' ? 'Today' : `Last ${key}`}</Link>)}</nav></div>{error ? <p className="mt-8 rounded-xl bg-amber-50 p-5 text-sm text-amber-800">Run both Supabase migrations to enable analytics.</p> : <><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><Metric icon={Eye} label="Page views" value={totalViews}/><Metric icon={Users} label="Unique visitors" value={uniqueVisitors}/><Metric icon={MousePointerClick} label="Customer actions" value={totalActions}/><Metric icon={Target} label="Action rate" value={`${conversion}%`}/><Metric icon={BarChart3} label="Leads" value={totalLeads}/></div><div className="mt-6 overflow-hidden rounded-2xl border border-[#deded7] bg-white"><div className="grid grid-cols-[1fr_auto_auto_auto] gap-5 border-b bg-[#fafaf7] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#999991]"><span>Client</span><span>Visits</span><span>Actions</span><span>Leads</span></div><div className="divide-y">{(businesses ?? []).map((business) => { const total = totals.get(business.id) ?? { views: 0, actions: 0, leads: 0, visitors: new Set() }; return <Link href={`/admin/clients/${business.id}`} key={business.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-8 px-5 py-4 hover:bg-[#fafaf7]"><span><strong className="block text-sm">{business.name}</strong><small className="text-[#999991]">/{business.slug}</small></span><span className="self-center text-sm">{total.views}</span><span className="self-center text-sm">{total.actions}</span><span className="self-center text-sm">{total.leads}</span></Link> })}</div></div></>}</div></main>
}

function Metric({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string | number }) { return <div className="rounded-2xl border border-[#deded7] bg-white p-5"><div className="flex items-center gap-2 text-sm text-[#77776f]"><Icon size={16} className="text-[#8b6b3d]"/>{label}</div><p className="mt-5 text-3xl font-semibold">{value}</p></div> }
