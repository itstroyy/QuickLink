import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BarChart3, BellRing, CalendarCheck2, CheckCircle2, Circle, CreditCard, Grid2X2, Inbox, Link2, MousePointerClick, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientActions from '@/components/client-actions'
import QrCard from '@/components/qr-card'
import type { Business, BusinessFeature, BusinessLink } from '@/lib/types'

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [
    { data: business }, { data: links }, views, clicks, events, features, notifications, access,
    productsCount, servicesCount, hoursCount, paymentSettings,
    recentOrders, recentBookings, recentRequests,
  ] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('business_links').select('*').eq('business_id', id).order('display_order'),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('business_id', id).eq('event_type', 'page_view'),
    supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('business_id', id).eq('event_type', 'link_click'),
    supabase.from('analytics_events').select('link_id').eq('business_id', id).eq('event_type', 'link_click'),
    supabase.from('business_features').select('*').eq('business_id', id).order('display_order'),
    supabase.from('business_notification_settings').select('notification_email,push_notifications_enabled,email_notifications_enabled,calendar_integration_enabled').eq('business_id', id).maybeSingle(),
    supabase.from('business_client_access').select('client_activity_enabled,client_activity_show_orders,client_activity_show_bookings,client_activity_show_service_requests').eq('business_id', id).maybeSingle(),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('business_id', id),
    supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', id),
    supabase.from('business_hours').select('id', { count: 'exact', head: true }).eq('business_id', id),
    supabase.from('business_payment_settings').select('stripe_account_status,stripe_charges_enabled,stripe_payouts_enabled,order_payment_mode,booking_payment_mode').eq('business_id',id).maybeSingle(),
    supabase.from('orders').select('id,customer_name,status,created_at').eq('business_id', id).order('created_at', { ascending: false }).limit(5),
    supabase.from('appointments').select('id,customer_name,status,created_at').eq('business_id', id).order('created_at', { ascending: false }).limit(5),
    supabase.from('service_requests').select('id,customer_name,status,created_at').eq('business_id', id).order('created_at', { ascending: false }).limit(5),
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
  const paymentsEnabled=Boolean(paymentSettings.data?.stripe_charges_enabled&&paymentSettings.data?.stripe_payouts_enabled)

  const hasCatalog = (productsCount.count || 0) > 0 || (servicesCount.count || 0) > 0
  const hasHours = (hoursCount.count || 0) > 0
  const hasAction = enabledFeatures.some((f) => ['ordering', 'booking', 'request_service'].includes(f.feature_key))
  const setupItems = [
    { done: Boolean(typedBusiness.logo_url), label: 'Logo added' },
    { done: hasCatalog, label: 'Has a product or service' },
    { done: hasHours, label: 'Hours set' },
    { done: hasAction, label: 'A primary action is enabled' },
    { done: typedLinks.length > 0, label: 'At least one link added' },
  ]
  type ActivityRow = { id: string; kind: 'order' | 'booking' | 'request'; title: string; status: string; created_at: string }
  const activity: ActivityRow[] = [
    ...(recentOrders.data || []).map((r) => ({ id: r.id, kind: 'order' as const, title: r.customer_name || 'Customer', status: r.status, created_at: r.created_at })),
    ...(recentBookings.data || []).map((r) => ({ id: r.id, kind: 'booking' as const, title: r.customer_name || 'Customer', status: r.status, created_at: r.created_at })),
    ...(recentRequests.data || []).map((r) => ({ id: r.id, kind: 'request' as const, title: r.customer_name || 'Customer', status: r.status, created_at: r.created_at })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5)

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-5"><div className="flex items-center gap-4"><div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-[#e8dfd1] text-xl font-semibold text-[#8b6b3d]">{typedBusiness.logo_url ? <img src={typedBusiness.logo_url} alt="" className="h-full w-full object-cover"/> : typedBusiness.name.slice(0, 2).toUpperCase()}</div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6b3d]">{typedBusiness.category || 'Client page'}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{typedBusiness.name}</h1><p className="mt-1 text-sm text-[#77776f]">/{typedBusiness.slug} · <span className="capitalize">{typedBusiness.theme}</span></p></div></div><ClientActions business={typedBusiness}/></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3"><Stat icon={BarChart3} label="Page views" value={views.count ?? 0}/><Stat icon={MousePointerClick} label="Link clicks" value={clicks.count ?? 0}/><Stat icon={Link2} label="Most clicked" value={mostClicked}/></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]"><section className="overflow-hidden rounded-2xl border border-[#deded7] bg-white"><div className="border-b px-5 py-4"><h2 className="font-semibold">Page links</h2><p className="mt-1 text-xs text-[#999991]">Shown in this order on the public page.</p></div><div className="divide-y">{typedLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-medium">{link.label}</p><p className="mt-1 max-w-lg truncate text-xs text-[#999991]">{link.url}</p></div><span className="rounded-full bg-[#f0eee7] px-2.5 py-1 text-xs capitalize text-[#77776f]">{link.type.replace('_', ' ')}</span></div>)}{typedLinks.length === 0 && <p className="px-5 py-12 text-center text-sm text-[#77776f]">No links added yet.</p>}</div></section><QrCard url={publicUrl} name={typedBusiness.name}/></div>
    <section className="mt-8 rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6"><h2 className="font-semibold">Configuration</h2><p className="mt-1 text-xs text-[#77776f]">A read-only snapshot of this business setup. Use Manage to make changes.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><ConfigCard icon={Grid2X2} title="Customer features" active={enabledFeatures.length>0} lines={enabledFeatures.length?enabledFeatures.map((feature)=>featureName(feature.feature_key)):['No features enabled']}/><ConfigCard icon={ShieldCheck} title="Private Activity" active={activityItems.length>0} lines={activityItems.length?activityItems:['Not enabled']}/><ConfigCard icon={CreditCard} title="Stripe payments" active={paymentsEnabled} lines={[paymentsEnabled?'Payments and payouts enabled':featureName(paymentSettings.data?.stripe_account_status||'not_connected'),`Orders: ${featureName(paymentSettings.data?.order_payment_mode||'pay_later')}`,`Bookings: ${featureName(paymentSettings.data?.booking_payment_mode||'none')}`]}/><ConfigCard icon={BellRing} title="Notifications" active={pushEnabled&&Boolean(pushCount.count)||emailEnabled} lines={[pushEnabled?(pushCount.count?`${pushCount.count} push ${pushCount.count===1?'device':'devices'} subscribed`:'No push devices subscribed'):'Push disabled',emailEnabled?'Email enabled':'Email disabled']}/><ConfigCard icon={CalendarCheck2} title="Integrations" active={calendarEnabled} lines={[calendarEnabled?'Google Calendar connected':'Google Calendar not connected']}/></div><Link href={`/dashboard/payments?business=${id}`} className="mt-4 inline-flex text-xs font-semibold text-[#8b6b3d]">Manage payment settings →</Link></section>

    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Setup health</h2>
        <div className="mt-4 grid gap-1.5">{setupItems.map((item) => <div key={item.label} className="flex items-center gap-3 rounded-xl px-1 py-1.5 text-sm"><span className={`flex size-5 shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-[#e4f2e8] text-[#2f8a52]' : 'border border-[#d8d6ce] text-transparent'}`}>{item.done && <CheckCircle2 size={13}/>}</span><span className={item.done ? '' : 'text-[#9a988f]'}>{item.label}</span></div>)}</div>
      </section>
      <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Recent activity</h2><Link href={`/admin/activity?business=${id}`} className="text-xs font-semibold text-[#8b6b3d]">See all</Link></div>
        {activity.length === 0
          ? <p className="mt-4 rounded-xl border border-dashed border-[#d8d6ce] p-4 text-center text-xs text-[#9a988f]">No orders, bookings or requests yet.</p>
          : <div className="mt-4 grid gap-1.5">{activity.map((row) => <div key={`${row.kind}-${row.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1.5 text-sm"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#f2f1ea] text-[#77776f]"><Inbox size={13}/></span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{row.title}</span><span className="block text-xs capitalize text-[#9a988f]">{row.kind} · {row.status.replace('_', ' ')}</span></span><span className="shrink-0 text-xs text-[#9a988f]">{new Date(row.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>)}</div>}
      </section>
    </div>
  </div></main>
}

function Stat({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string | number }) { return <div className="rounded-2xl border border-[#deded7] bg-white p-5"><div className="flex items-center gap-2 text-sm text-[#77776f]"><Icon size={16} className="text-[#8b6b3d]"/>{label}</div><p className="mt-4 truncate text-2xl font-semibold">{value}</p></div> }
function ConfigCard({icon:Icon,title,active,lines}:{icon:typeof BellRing;title:string;active:boolean;lines:string[]}) { return <article className="rounded-xl border border-[#e5e2da] bg-[#fafaf7] p-4"><div className="flex items-center gap-2.5"><span className={`grid size-8 place-items-center rounded-lg ${active?'bg-emerald-50 text-emerald-700':'bg-[#eeece6] text-[#8d8b84]'}`}><Icon size={16}/></span><strong className="text-sm">{title}</strong>{active?<CheckCircle2 size={15} className="ml-auto text-emerald-600"/>:<Circle size={15} className="ml-auto text-[#aaa79f]"/>}</div><ul className="mt-3 grid gap-1.5">{lines.map((line)=><li key={line} className="flex items-start gap-2 text-xs text-[#77776f]"><span className={`mt-1 size-1.5 shrink-0 rounded-full ${active?'bg-emerald-500':'bg-[#b9b6ae]'}`}/>{line}</li>)}</ul></article> }
function featureName(key:string) { return key.replaceAll('_',' ').replace(/\b\w/g,(letter)=>letter.toUpperCase()) }
