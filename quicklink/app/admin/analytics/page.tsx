import Link from 'next/link'
import { BarChart3, Eye, MousePointerClick } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const [{ data: businesses, error }, { data: events }] = await Promise.all([
    supabase.from('businesses').select('id,name,slug,status').neq('status', 'archived').order('name'),
    supabase.from('analytics_events').select('business_id,event_type,link_id'),
  ])
  const totals = new Map<string, { views: number; clicks: number }>()
  for (const event of events ?? []) { const current = totals.get(event.business_id) ?? { views: 0, clicks: 0 }; if (event.event_type === 'page_view') current.views += 1; else current.clicks += 1; totals.set(event.business_id, current) }
  const totalViews = [...totals.values()].reduce((sum, item) => sum + item.views, 0)
  const totalClicks = [...totals.values()].reduce((sum, item) => sum + item.clicks, 0)

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Privacy-conscious insights</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Analytics</h1><p className="mt-2 text-[#77776f]">Simple page-view and button-click totals—no personal customer profiles.</p>{error ? <p className="mt-8 rounded-xl bg-amber-50 p-5 text-sm text-amber-800">Run the Supabase migration to enable analytics.</p> : <><div className="mt-8 grid gap-4 sm:grid-cols-2"><Metric icon={Eye} label="Total page views" value={totalViews}/><Metric icon={MousePointerClick} label="Total link clicks" value={totalClicks}/></div><div className="mt-6 overflow-hidden rounded-2xl border border-[#deded7] bg-white"><div className="grid grid-cols-[1fr_auto_auto] gap-5 border-b bg-[#fafaf7] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#999991]"><span>Client</span><span>Views</span><span>Clicks</span></div><div className="divide-y">{(businesses ?? []).map((business) => { const total = totals.get(business.id) ?? { views: 0, clicks: 0 }; return <Link href={`/admin/clients/${business.id}`} key={business.id} className="grid grid-cols-[1fr_auto_auto] gap-8 px-5 py-4 hover:bg-[#fafaf7]"><span><strong className="block text-sm">{business.name}</strong><small className="text-[#999991]">/{business.slug}</small></span><span className="self-center text-sm">{total.views}</span><span className="self-center text-sm">{total.clicks}</span></Link> })}</div></div></>}</div></main>
}

function Metric({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: number }) { return <div className="rounded-2xl border border-[#deded7] bg-white p-6"><div className="flex items-center gap-2 text-sm text-[#77776f]"><Icon size={17} className="text-[#8b6b3d]"/>{label}</div><p className="mt-5 text-4xl font-semibold">{value}</p></div> }
