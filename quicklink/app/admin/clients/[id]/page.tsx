import { notFound } from 'next/navigation'
import { BarChart3, Link2, MousePointerClick } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ClientActions from '@/components/client-actions'
import QrCard from '@/components/qr-card'
import type { Business, BusinessLink } from '@/lib/types'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: business }, { data: links }, views, clicks, events] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('business_links').select('*').eq('business_id', id).order('display_order'),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('business_id', id).eq('event_type', 'page_view'),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('business_id', id).eq('event_type', 'link_click'),
    supabase.from('analytics_events').select('link_id').eq('business_id', id).eq('event_type', 'link_click'),
  ])
  if (!business) notFound()
  const typedBusiness = business as Business
  const typedLinks = (links ?? []) as BusinessLink[]
  const counts = new Map<string, number>()
  for (const event of events.data ?? []) if (event.link_id) counts.set(event.link_id, (counts.get(event.link_id) ?? 0) + 1)
  const mostClickedId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const mostClicked = typedLinks.find((link) => link.id === mostClickedId)?.label ?? 'No clicks yet'
  const domain = process.env.NEXT_PUBLIC_SITE_URL || 'https://quicklinkqr.com'
  const publicUrl = `${domain.replace(/\/$/, '')}/${typedBusiness.slug}`

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-5"><div className="flex items-center gap-4"><div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-[#e8dfd1] text-xl font-semibold text-[#8b6b3d]">{typedBusiness.logo_url ? <img src={typedBusiness.logo_url} alt="" className="h-full w-full object-cover"/> : typedBusiness.name.slice(0, 2).toUpperCase()}</div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6b3d]">{typedBusiness.category || 'Client page'}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{typedBusiness.name}</h1><p className="mt-1 text-sm text-[#77776f]">/{typedBusiness.slug} · <span className="capitalize">{typedBusiness.theme}</span></p></div></div><ClientActions business={typedBusiness}/></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3"><Stat icon={BarChart3} label="Page views" value={views.count ?? 0}/><Stat icon={MousePointerClick} label="Link clicks" value={clicks.count ?? 0}/><Stat icon={Link2} label="Most clicked" value={mostClicked}/></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]"><section className="overflow-hidden rounded-2xl border border-[#deded7] bg-white"><div className="border-b px-5 py-4"><h2 className="font-semibold">Page links</h2><p className="mt-1 text-xs text-[#999991]">Shown in this order on the public page.</p></div><div className="divide-y">{typedLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">{link.label}</p><p className="mt-1 max-w-lg truncate text-xs text-[#999991]">{link.url}</p></div><span className="rounded-full bg-[#f0eee7] px-2.5 py-1 text-xs capitalize text-[#77776f]">{link.type.replace('_', ' ')}</span></div>)}{typedLinks.length === 0 && <p className="px-5 py-12 text-center text-sm text-[#77776f]">No links added yet.</p>}</div></section><QrCard url={publicUrl} name={typedBusiness.name}/></div>
  </div></main>
}

function Stat({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string | number }) { return <div className="rounded-2xl border border-[#deded7] bg-white p-5"><div className="flex items-center gap-2 text-sm text-[#77776f]"><Icon size={16} className="text-[#8b6b3d]"/>{label}</div><p className="mt-4 truncate text-2xl font-semibold">{value}</p></div> }
