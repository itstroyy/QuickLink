import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, CalendarClock, CheckCircle2, ClipboardList, CreditCard, Eye, MousePointerClick, Phone, RotateCcw, Send, ShoppingBag, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwnerContext } from '@/lib/dashboard/business-context'

export const metadata: Metadata = { title: 'Analytics — Quicklink', robots: { index: false, follow: false } }

const ranges = { today: 1, '7d': 7, '30d': 30, all: 0 } as const
type Range = keyof typeof ranges

// Outcome-focused, not link-click-focused: orders, order value, bookings,
// requests, primary-action clicks, review clicks, calls and texts sit above
// raw page views. "Order value" is deliberately never labelled Revenue —
// Quicklink doesn't process payment.
export default async function DashboardAnalyticsPage({ searchParams }: { searchParams: Promise<{ business?: string; range?: string }> }) {
  const { business: preferred, range: requestedRange } = await searchParams
  const { business } = await requireOwnerContext(preferred)
  const range: Range = requestedRange && requestedRange in ranges ? (requestedRange as Range) : '30d'
  const since = ranges[range] ? new Date(Date.now() - ranges[range] * 86400000).toISOString() : null
  const supabase = await createClient()

  let eventQuery = supabase.from('analytics_events').select('event_type,visitor_id,metadata,created_at').eq('business_id', business.id)
  if (since) eventQuery = eventQuery.gte('created_at', since)
  let orderQuery = supabase.from('orders').select('total_cents,status,created_at').eq('business_id', business.id)
  if (since) orderQuery = orderQuery.gte('created_at', since)
  let bookingQuery = supabase.from('appointments').select('id,status,total_price_cents,amount_paid_cents,payment_status,created_at').eq('business_id', business.id)
  if (since) bookingQuery = bookingQuery.gte('created_at', since)
  let requestQuery = supabase.from('service_requests').select('id,status,quote_sent_at,quote_accepted_at,payment_status,created_at').eq('business_id', business.id)
  if (since) requestQuery = requestQuery.gte('created_at', since)

  let paymentQuery = supabase.from('payments').select('kind,status,amount_paid_cents,created_at').eq('business_id',business.id)
  let refundQuery = supabase.from('refunds').select('amount_cents,status,created_at').eq('business_id',business.id)
  if(since){paymentQuery=paymentQuery.gte('created_at',since);refundQuery=refundQuery.gte('created_at',since)}
  const [{ data: events }, { data: orders }, { data: bookings }, { data: requests }, {data:features},{data:payments},{data:refunds}] = await Promise.all([eventQuery, orderQuery, bookingQuery, requestQuery,supabase.from('business_features').select('feature_key,enabled').eq('business_id',business.id),paymentQuery,refundQuery])

  const pageViews = (events || []).filter((event) => event.event_type === 'page_view').length
  const uniqueVisitors = new Set((events || []).map((event) => event.visitor_id).filter(Boolean)).size
  const linkClicks = (events || []).filter((event) => event.event_type === 'link_click').length
  const primaryClicks = (events || []).filter((event) => event.event_type === 'feature_click').length
  const reviewClicks = (events || []).filter((event) => event.event_type === 'review_click').length
  const callClicks = (events || []).filter((event) => event.event_type === 'call_click').length
  const textClicks = (events || []).filter((event) => event.event_type === 'text_click').length
  const orderCount = (orders || []).length
  const orderValueCents = (orders || []).filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + (order.total_cents || 0), 0)
  const bookingCount = (bookings || []).filter((booking) => booking.status !== 'cancelled').length
  const requestCount = (requests || []).length
  const enabled=new Set((features||[]).filter(feature=>feature.enabled).map(feature=>feature.feature_key))
  const paidOrders=(payments||[]).filter(payment=>payment.kind==='order'&&['paid','partially_refunded','refunded'].includes(payment.status)).length
  const refundTotal=(refunds||[]).filter(refund=>refund.status==='succeeded').reduce((sum,refund)=>sum+refund.amount_cents,0)
  const bookingValue=(bookings||[]).filter(booking=>booking.status!=='cancelled').reduce((sum,booking)=>sum+(booking.total_price_cents||0),0)
  const deposits=(bookings||[]).filter(booking=>booking.payment_status==='deposit_paid').length
  const quotesSent=(requests||[]).filter(item=>item.quote_sent_at).length
  const quotesAccepted=(requests||[]).filter(item=>item.quote_accepted_at).length
  const quotesPaid=(requests||[]).filter(item=>item.payment_status==='paid').length
  const outcomeMetrics=[
    ...(enabled.has('ordering')?[{icon:ShoppingBag,label:'Orders',value:orderCount},{icon:BarChart3,label:'Order value',value:`$${(orderValueCents/100).toFixed(2)}`},{icon:CreditCard,label:'Paid online',value:paidOrders},...(refundTotal?[{icon:RotateCcw,label:'Refunded',value:`$${(refundTotal/100).toFixed(2)}`}]:[])]:[]),
    ...(enabled.has('booking')?[{icon:CalendarClock,label:'Bookings',value:bookingCount},{icon:BarChart3,label:'Booking value',value:`$${(bookingValue/100).toFixed(2)}`},{icon:CreditCard,label:'Deposits paid',value:deposits}]:[]),
    ...(enabled.has('request_service')?[{icon:ClipboardList,label:'Service requests',value:requestCount},{icon:Send,label:'Quotes sent',value:quotesSent},{icon:CheckCircle2,label:'Quotes accepted',value:quotesAccepted},{icon:CreditCard,label:'Paid quotes',value:quotesPaid}]:[]),
  ]

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">{business.name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Analytics</h1><p className="mt-2 text-[#77776f]">Outcomes first — what customers actually did, not just what they clicked.</p></div>
      <nav className="flex rounded-full border bg-white p-1 text-xs font-semibold">{Object.keys(ranges).map((key) => <Link key={key} href={`/dashboard/analytics?business=${business.id}&range=${key}`} className={`rounded-full px-3 py-2 ${range === key ? 'bg-[#1d1d1b] text-white' : 'text-[#77776f]'}`}>{key === 'all' ? 'All time' : key === 'today' ? 'Today' : `Last ${key}`}</Link>)}</nav>
    </div>

    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{outcomeMetrics.map(metric=><Metric key={metric.label} {...metric}/>)}</div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric icon={MousePointerClick} label="Primary action clicks" value={primaryClicks}/>
      <Metric icon={Star} label="Review clicks" value={reviewClicks}/>
      <Metric icon={Phone} label="Calls & texts" value={callClicks + textClicks}/>
      <Metric icon={Eye} label="Page views" value={pageViews}/>
    </div>
    <p className="mt-4 text-xs text-[#999991]">Also: {uniqueVisitors} unique visitors and {linkClicks} social/custom link clicks in this period.</p>
  </div></main>
}

function Metric({ icon: Icon, label, value }: { icon: typeof ShoppingBag; label: string; value: string | number }) { return <div className="rounded-2xl border border-[#deded7] bg-white p-5"><div className="flex items-center gap-2 text-sm text-[#77776f]"><Icon size={16} className="text-[#8b6b3d]"/>{label}</div><p className="mt-4 text-2xl font-semibold">{value}</p></div> }
