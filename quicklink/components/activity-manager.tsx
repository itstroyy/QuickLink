'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { ActivityAppointment, ActivityBusiness, ActivityOrder, ActivityRequest } from '@/lib/activity-data'
import type { AppointmentStatus, OrderStatus, ServiceRequest } from '@/lib/types'
import { formatDate, formatDateTime as formatWhen, formatPhone, formatTime } from '@/lib/display-format'

type Activity = {
  ready: boolean
  businesses: ActivityBusiness[]
  orders: ActivityOrder[]
  appointments: ActivityAppointment[]
  requests: ActivityRequest[]
}

const tabs = [
  { key: 'orders', label: 'Orders', statuses: ['new', 'preparing', 'ready', 'completed', 'cancelled'] },
  { key: 'bookings', label: 'Bookings', statuses: ['confirmed', 'completed', 'cancelled'] },
  { key: 'requests', label: 'Service Requests', statuses: ['new', 'contacted', 'in_progress', 'completed', 'cancelled'] },
] as const
type TabKey = typeof tabs[number]['key']
const tableFor: Record<TabKey, string> = { orders: 'orders', bookings: 'appointments', requests: 'service_requests' }

const select = 'form-control'
const HISTORY_PAGE_SIZE = 20

function searchText(row: any) {
  return [row.customer_name, row.customer_phone, row.customer_email, row.business_name, row.service_name, row.notes, row.request_details, ...(row.order_items || []).map((item: any) => item.product_name)].filter(Boolean).join(' ').toLowerCase()
}

// Human-readable date/time, independent of the viewer's browser locale
// (raw ISO/locale strings like "2026-09-14" or "13/09/2026, 15.36.03" are
// hard to scan at a glance).

export default function ActivityManager({ activity }: { activity: Activity }) {
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabKey>('orders')
  const [business, setBusiness] = useState(searchParams.get('business') || '')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [expanded, setExpanded] = useState(false)
  const [orders, setOrders] = useState(activity.orders)
  const [appointments, setAppointments] = useState(activity.appointments)
  const [requests, setRequests] = useState(activity.requests)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')
  const supabase = createClient()

  function matches(row: any) {
    if (business && row.business_id !== business) return false
    if (status && row.status !== status) return false
    if (archiveFilter === 'active' && row.archived) return false
    if (archiveFilter === 'archived' && !row.archived) return false
    if (query.trim() && !searchText(row).includes(query.trim().toLowerCase())) return false
    return true
  }

  const filteredOrders = useMemo(() => orders.filter(matches), [orders, business, status, query, archiveFilter])
  const filteredAppointments = useMemo(() => appointments.filter(matches), [appointments, business, status, query, archiveFilter])
  const filteredRequests = useMemo(() => requests.filter(matches), [requests, business, status, query, archiveFilter])

  const activeList = tab === 'orders' ? filteredOrders : tab === 'bookings' ? filteredAppointments : filteredRequests
  const visibleList = expanded ? activeList : activeList.slice(0, HISTORY_PAGE_SIZE)
  const activeStatuses = tabs.find((t) => t.key === tab)!.statuses

  function changeTab(key: TabKey) { setTab(key); setStatus(''); setExpanded(false) }

  async function orderStatus(id: string, value: OrderStatus) {
    const archived = value === 'completed' || value === 'cancelled'
    const { error } = await supabase.from('orders').update({ status: value, ...(archived ? { archived: true } : {}) }).eq('id', id)
    if (error) setMessage(error.message); else setOrders(orders.map((row) => row.id === id ? { ...row, status: value, archived: archived || row.archived } : row))
  }
  async function appointmentStatus(businessId: string, id: string, value: AppointmentStatus) {
    setBusy(`status-${id}`)
    const response = await fetch('/api/admin/appointments/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, appointmentId: id, status: value }) })
    const result = await response.json()
    setBusy('')
    if (!response.ok) setMessage(result.error || 'Unable to update status.')
    else setAppointments(appointments.map((row) => row.id === id ? { ...row, status: value, archived: value === 'completed' || value === 'cancelled' ? true : row.archived, ...(value === 'cancelled' ? { external_calendar_event_id: null } : {}) } : row))
  }
  async function requestStatus(id: string, value: ServiceRequest['status']) {
    const archived = value === 'completed' || value === 'cancelled'
    const { error } = await supabase.from('service_requests').update({ status: value, ...(archived ? { archived: true } : {}) }).eq('id', id)
    if (error) setMessage(error.message); else setRequests(requests.map((row) => row.id === id ? { ...row, status: value, archived: archived || row.archived } : row))
  }

  async function setArchived(key: TabKey, id: string, archived: boolean) {
    setBusy(`archive-${id}`)
    const { error } = await supabase.from(tableFor[key]).update({ archived }).eq('id', id)
    setBusy('')
    if (error) { setMessage(error.message); return }
    if (key === 'orders') setOrders(orders.map((row) => row.id === id ? { ...row, archived } : row))
    if (key === 'bookings') setAppointments(appointments.map((row) => row.id === id ? { ...row, archived } : row))
    if (key === 'requests') setRequests(requests.map((row) => row.id === id ? { ...row, archived } : row))
  }

  async function removeRow(key: TabKey, businessId: string, id: string) {
    if (!confirm('Permanently delete this record? This cannot be undone.')) return
    setBusy(`delete-${id}`)
    if (key === 'bookings') {
      const response = await fetch('/api/admin/appointments/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, appointmentId: id }) })
      const result = await response.json()
      setBusy('')
      if (!response.ok) { setMessage(result.error || 'Unable to delete.'); return }
      setAppointments(appointments.filter((row) => row.id !== id))
      return
    }
    const { error } = await supabase.from(tableFor[key]).delete().eq('id', id)
    setBusy('')
    if (error) { setMessage(error.message); return }
    if (key === 'orders') setOrders(orders.filter((row) => row.id !== id))
    if (key === 'requests') setRequests(requests.filter((row) => row.id !== id))
  }

  if (!activity.ready) return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Database setup required</h2><p className="mt-2 text-sm text-amber-800">Run the Quicklink migrations in Supabase, then refresh.</p></section>

  return <div className="grid gap-5">
    {message && <p role="status" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}

    <div className="flex flex-wrap gap-2">{tabs.map((item) => <button key={item.key} type="button" onClick={() => changeTab(item.key)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === item.key ? 'bg-[#1d1d1b] text-white' : 'border border-[#d8d6ce] bg-white text-[#1d1d1b]'}`}>{item.label} <span className="opacity-60">({item.key === 'orders' ? filteredOrders.length : item.key === 'bookings' ? filteredAppointments.length : filteredRequests.length})</span></button>)}</div>

    <div className="flex flex-wrap gap-3 rounded-2xl border border-[#deded7] bg-white p-4">
      <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Search</span><input className={select} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, phone, email…"/></label>
      <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Business</span><select className={select} value={business} onChange={(e) => setBusiness(e.target.value)}><option value="">All businesses</option>{activity.businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Status</span><select className={select} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{activeStatuses.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1).replace('_', ' ')}</option>)}</select></label>
      <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Show</span><select className={select} value={archiveFilter} onChange={(e) => setArchiveFilter(e.target.value as typeof archiveFilter)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
    </div>

    <div className="overflow-hidden rounded-xl border bg-white">
      <div className="hidden gap-3 border-b border-[#eeece5] bg-[#fafaf7] px-4 py-2 text-[10px] font-semibold uppercase tracking-[.1em] text-[#999991] md:grid md:grid-cols-[1fr_1.3fr_130px_84px]">
        <span>Customer</span><span>{tab === 'orders' ? 'Order' : tab === 'bookings' ? 'Appointment' : 'Request'}</span><span>Status</span><span className="text-right">Actions</span>
      </div>
      <div className="divide-y">
        {visibleList.length === 0 && <p className="p-7 text-center text-sm text-[#77776f]">Nothing matches these filters.</p>}

        {tab === 'orders' && (visibleList as ActivityOrder[]).map((row) => <Row key={row.id} archived={row.archived}
          customer={<><Detail label="Name" value={row.customer_name}/><Detail label="Phone" value={formatPhone(row.customer_phone)}/></>}
          details={<><Detail label="Business" value={row.business_name}/><Detail label="Items" value={row.order_items?.map((item) => `${item.quantity}× ${item.product_name}`).join(', ') || '—'}/><Detail label="Total" value={`$${(row.total_cents / 100).toFixed(2)}`}/><Detail label="Fulfillment" value={`${row.fulfillment_method === 'delivery' ? 'Delivery' : 'Pickup'}${row.address ? ` · ${row.address}` : ''}`}/>{row.notes && <Detail label="Notes" value={row.notes}/>}<Detail label="Created" value={formatWhen(row.created_at)}/></>}
          status={<Status value={row.status} values={tabs[0].statuses} onChange={(v) => orderStatus(row.id, v as OrderStatus)}/>}
          actions={<RowActions archived={row.archived} busy={busy===`archive-${row.id}`||busy===`delete-${row.id}`} onArchive={() => setArchived('orders', row.id, !row.archived)} onDelete={() => removeRow('orders', row.business_id, row.id)}/>}
        />)}

        {tab === 'bookings' && (visibleList as ActivityAppointment[]).map((row) => <Row key={row.id} archived={row.archived}
          customer={<><Detail label="Name" value={row.customer_name}/><Detail label="Phone" value={formatPhone(row.customer_phone)}/>{row.customer_email && <Detail label="Email" value={row.customer_email}/>}</>}
          details={<><Detail label="Business" value={row.business_name}/><Detail label="Service" value={row.service_name || 'Any service'}/><Detail label="Date" value={formatDate(row.appointment_date)}/><Detail label="Time" value={`${formatTime(row.start_time)}–${formatTime(row.end_time)}`}/>{row.notes && <Detail label="Notes" value={row.notes}/>}<Detail label="Created" value={formatWhen(row.created_at)}/>{row.external_calendar_event_id && <small className="opacity-60">Synced to Google Calendar</small>}</>}
          status={<Status value={row.status} values={tabs[1].statuses} onChange={(v) => appointmentStatus(row.business_id, row.id, v as AppointmentStatus)}/>}
          actions={<RowActions archived={row.archived} busy={busy===`archive-${row.id}`||busy===`delete-${row.id}`} onArchive={() => setArchived('bookings', row.id, !row.archived)} onDelete={() => removeRow('bookings', row.business_id, row.id)}/>}
        />)}

        {tab === 'requests' && (visibleList as ActivityRequest[]).map((row) => <Row key={row.id} archived={row.archived}
          customer={<><Detail label="Name" value={row.customer_name}/><Detail label="Phone" value={formatPhone(row.customer_phone)}/>{row.customer_email && <Detail label="Email" value={row.customer_email}/>}</>}
          details={<><Detail label="Business" value={row.business_name}/>{row.request_details && <Detail label="Requested service" value={row.request_details}/>} {row.address && <Detail label="Address" value={row.address}/>} {row.preferred_date && <Detail label="Preferred date" value={formatDate(row.preferred_date)}/>} {row.notes && <Detail label="Notes" value={row.notes}/>}<Detail label="Created" value={formatWhen(row.created_at)}/></>}
          status={<Status value={row.status} values={tabs[2].statuses} onChange={(v) => requestStatus(row.id, v as ServiceRequest['status'])}/>}
          actions={<RowActions archived={row.archived} busy={busy===`archive-${row.id}`||busy===`delete-${row.id}`} onArchive={() => setArchived('requests', row.id, !row.archived)} onDelete={() => removeRow('requests', row.business_id, row.id)}/>}
        />)}
      </div>
    </div>
    {activeList.length > HISTORY_PAGE_SIZE && <button type="button" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d8d6ce] bg-white px-4 text-sm font-semibold" onClick={() => setExpanded((v) => !v)}>{expanded ? 'Show less' : `View all (${activeList.length})`}</button>}
  </div>
}

// Four logical columns — Customer / Details / Status / Actions — instead of
// one long paragraph per record, so a row can be scanned at a glance.
function Row({ customer, details, status, actions, archived }: { customer: React.ReactNode; details: React.ReactNode; status: React.ReactNode; actions: React.ReactNode; archived: boolean }) {
  return <div className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_1.3fr_130px_84px] md:items-start md:gap-3">
    <div className="grid gap-0.5 [&>small]:block [&>small]:text-xs [&>small]:text-[#77776f]">{archived && <span className="mb-0.5 inline-block w-fit rounded-full bg-[#f0eee7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#77776f]">Archived</span>}{customer}</div>
    <div className="grid gap-0.5 [&>small]:block [&>small]:text-xs [&>small]:text-[#77776f]">{details}</div>
    <div>{status}</div>
    <div className="flex justify-end md:justify-end">{actions}</div>
  </div>
}
function Status({ value, values, onChange }: { value: string; values: readonly string[]; onChange: (value: string) => void }) {
  return <div className="grid gap-1.5"><StatusBadge value={value}/><select className={`${select} text-xs`} aria-label="Status" value={value} onChange={(e) => onChange(e.target.value)}>{values.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1).replace('_', ' ')}</option>)}</select></div>
}
function StatusBadge({value}:{value:string}) { const tone=value==='completed'?'bg-emerald-50 text-emerald-700 ring-emerald-200':value==='cancelled'?'bg-red-50 text-red-700 ring-red-200':value==='preparing'||value==='confirmed'?'bg-amber-50 text-amber-800 ring-amber-200':value==='ready'?'bg-cyan-50 text-cyan-800 ring-cyan-200':'bg-sky-50 text-sky-700 ring-sky-200'; const dot=value==='completed'?'bg-emerald-500':value==='cancelled'?'bg-red-500':value==='preparing'||value==='confirmed'?'bg-amber-500':value==='ready'?'bg-cyan-500':'bg-sky-500'; return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ring-inset ${tone}`}><span className={`size-1.5 rounded-full ${dot}`}/>{value.replaceAll('_',' ')}</span> }
function Detail({ label, value }: { label: string; value: string }) {
  return <small className="block min-w-0"><span className="mr-1 font-semibold text-[#4f4f49]">{label}:</span><span className="break-words">{value}</span></small>
}
function RowActions({ archived, busy, onArchive, onDelete }: { archived: boolean; busy: boolean; onArchive: () => void; onDelete: () => void }) {
  return <div className="flex items-start gap-1.5">
    <button type="button" disabled={busy} onClick={onArchive} className="icon-button" aria-label={archived ? 'Restore' : 'Archive'} title={archived ? 'Restore' : 'Archive'}>{archived ? <ArchiveRestore size={15}/> : <Archive size={15}/>}</button>
    <button type="button" disabled={busy} onClick={onDelete} className="icon-button text-red-600" aria-label="Delete permanently" title="Delete permanently"><Trash2 size={15}/></button>
  </div>
}
