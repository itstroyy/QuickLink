import { notFound } from 'next/navigation'
import { BarChart3, BellRing, CalendarCheck2, CheckCircle2, Circle, Grid2X2, Link2, MousePointerClick, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientActions from '@/components/client-actions'
import QrCard from '@/components/qr-card'
import type { Business, BusinessFeature, BusinessLink } from '@/lib/types'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: business }, { data: links }, views, clicks, events, features, notifications, access] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('business_links').select('*').eq('business_id', id).order('display_order'),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('business_id', id).eq('event_type', 'page_view'),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('business_id', id).eq('event_type', 'link_click'),
    supabase.from('analytics_events').select('link_id').eq('business_id', id).eq('event_type', 'link_click'),
    supabase.from('business_features').select('*').eq('business_id', id).order('display_order'),
    supabase.from('business_notification_settings').select('notification_email,push_notifications_enabled,email_notifications_enabled,calendar_integration_enabled').eq('business_id', id).maybeSingle(),
    supabase.from('business_client_access').select('client_activity_enabled,client_activity_show_orders,client_activity_show_bookings,client_activity_show_service_requests').eq('business_id', id).maybeSingle(),
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
  const enabledFeatures = ((features.data || []) as BusinessFeature[]).filter((feature) => feature.enabled)
  const admin = createAdminClient()
  const [pushCount, calendarConnection] = admin ? await Promise.all([
    admin.from('business_push_subscriptions').select('*', { count: 'exact', head: true }).eq('business_id', id),
    admin.from('business_calendar_connections').select('business_id').eq('business_id', id).maybeSingle(),
  ]) : [{ count: 0 }, { data: null }]
  const activityItems = access.data?.client_activity_enabled ? [access.data.client_activity_show_bookings&&'Bookings',access.data.client_activity_show_orders&&'Orders',access.data.client_activity_show_service_requests&&'Service requests'].filter(Boolean) as string[] : []
  const pushEnabled = notifications.data?.push_notifications_enabled !== false
  const emailEnabled = Boolean(notifications.data?.email_notifications_enabled && notifications.data?.notification_email)
  const calendarEnabled = Boolean(notifications.data?.calendar_integration_enabled && calendarConnection.data)

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-5"><div className="flex items-center gap-4"><div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-[#e8dfd1] text-xl font-semibold text-[#8b6b3d]">{typedBusiness.logo_url ? <img src={typedBusiness.logo_url} alt="" className="h-full w-full object-cover"/> : typedBusiness.name.slice(0, 2).toUpperCase()}</div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6b3d]">{typedBusiness.category || 'Client page'}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{typedBusiness.name}</h1><p className="mt-1 text-sm text-[#77776f]">/{typedBusiness.slug} · <span className="capitalize">{typedBusiness.theme}</span></p></div></div><ClientActions business={typedBusiness}/></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3"><Stat icon={BarChart3} label="Page views" value={views.count ?? 0}/><Stat icon={MousePointerClick} label="Link clicks" value={clicks.count ?? 0}/><Stat icon={Link2} label="Most clicked" value={mostClicked}/></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]"><section className="overflow-hidden rounded-2xl border border-[#deded7] bg-white"><div className="border-b px-5 py-4"><h2 className="font-semibold">Page links</h2><p className="mt-1 text-xs text-[#999991]">Shown in this order on the public page.</p></div><div className="divide-y">{typedLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">{link.label}</p><p className="mt-1 max-w-lg truncate text-xs text-[#999991]">{link.url}</p></div><span className="rounded-full bg-[#f0eee7] px-2.5 py-1 text-xs capitalize text-[#77776f]">{link.type.replace('_', ' ')}</span></div>)}{typedLinks.length === 0 && <p className="px-5 py-12 text-center text-sm text-[#77776f]">No links added yet.</p>}</div></section><QrCard url={publicUrl} name={typedBusiness.name}/></div>
    <section className="mt-8 rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6"><h2 className="font-semibold">Configuration</h2><p className="mt-1 text-xs text-[#77776f]">A read-only snapshot of this business setup. Use Edit client to make changes.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ConfigCard icon={Grid2X2} title="Customer features" active={enabledFeatures.length>0} lines={enabledFeatures.length?enabledFeatures.map((feature)=>featureName(feature.feature_key)):['No features enabled']}/><ConfigCard icon={ShieldCheck} title="Private Activity" active={activityItems.length>0} lines={activityItems.length?activityItems:['Not enabled']}/><ConfigCard icon={BellRing} title="Notifications" active={pushEnabled&&Boolean(pushCount.count)||emailEnabled} lines={[pushEnabled?(pushCount.count?`${pushCount.count} push ${pushCount.count===1?'device':'devices'} subscribed`:'No push devices subscribed'):'Push disabled',emailEnabled?'Email enabled':'Email disabled']}/><ConfigCard icon={CalendarCheck2} title="Integrations" active={calendarEnabled} lines={[calendarEnabled?'Google Calendar connected':'Google Calendar not connected']}/></div></section>
  </div></main>
}

function Stat({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string | number }) { return <div className="rounded-2xl border border-[#deded7] bg-white p-5"><div className="flex items-center gap-2 text-sm text-[#77776f]"><Icon size={16} className="text-[#8b6b3d]"/>{label}</div><p className="mt-4 truncate text-2xl font-semibold">{value}</p></div> }
function ConfigCard({icon:Icon,title,active,lines}:{icon:typeof BellRing;title:string;active:boolean;lines:string[]}) { return <article className="rounded-xl border border-[#e5e2da] bg-[#fafaf7] p-4"><div className="flex items-center gap-2.5"><span className={`grid size-8 place-items-center rounded-lg ${active?'bg-emerald-50 text-emerald-700':'bg-[#eeece6] text-[#8d8b84]'}`}><Icon size={16}/></span><strong className="text-sm">{title}</strong>{active?<CheckCircle2 size={15} className="ml-auto text-emerald-600"/>:<Circle size={15} className="ml-auto text-[#aaa79f]"/>}</div><ul className="mt-3 grid gap-1.5">{lines.map((line)=><li key={line} className="flex items-start gap-2 text-xs text-[#77776f]"><span className={`mt-1 size-1.5 shrink-0 rounded-full ${active?'bg-emerald-500':'bg-[#b9b6ae]'}`}/>{line}</li>)}</ul></article> }
function featureName(key:string) { return key.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase()) }
