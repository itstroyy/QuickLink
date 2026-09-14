'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore } from 'lucide-react'
import { formatDate, formatDateTime, formatPhone, formatTime } from '@/lib/display-format'
import type { Appointment, BusinessClientAccess, CustomerOrder, ServiceRequest } from '@/lib/types'

const tabs = [
  { key: 'orders', label: 'Orders', statuses: ['new', 'preparing', 'ready', 'completed', 'cancelled'], show: (a: BusinessClientAccess) => a.client_activity_show_orders },
  { key: 'bookings', label: 'Bookings', statuses: ['confirmed', 'completed', 'cancelled'], show: (a: BusinessClientAccess) => a.client_activity_show_bookings },
  { key: 'requests', label: 'Service Requests', statuses: ['new', 'contacted', 'in_progress', 'completed', 'cancelled'], show: (a: BusinessClientAccess) => a.client_activity_show_service_requests },
] as const
type TabKey = typeof tabs[number]['key']
const select = 'form-control'
const PAGE_SIZE = 20

export default function ClientActivityManager({ slug, token, access, initialOrders, initialAppointments, initialRequests }: { slug: string; token: string; access: BusinessClientAccess; initialOrders: CustomerOrder[]; initialAppointments: Appointment[]; initialRequests: ServiceRequest[] }) {
  const availableTabs = tabs.filter((item) => item.show(access))
  const [tab, setTab] = useState<TabKey>(availableTabs[0]?.key || 'orders')
  const [status, setStatus] = useState(''); const [query, setQuery] = useState(''); const [archiveFilter, setArchiveFilter] = useState<'active'|'archived'|'all'>('active'); const [expanded, setExpanded] = useState(false)
  const [orders, setOrders] = useState(initialOrders); const [appointments, setAppointments] = useState(initialAppointments); const [requests, setRequests] = useState(initialRequests)
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(''); const [lastUpdated, setLastUpdated] = useState<Date|null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/client-activity/feed?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json()
      setOrders(data.orders || []); setAppointments(data.appointments || []); setRequests(data.requests || []); setLastUpdated(new Date())
    } catch { /* Retain the last good view during brief network failures. */ }
  }, [slug, token])

  useEffect(() => {
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 8000)
    const onVisibility = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility) }
  }, [refresh])

  function searchText(row: any) { return [row.customer_name, row.customer_phone, row.customer_email, row.notes, row.request_details].filter(Boolean).join(' ').toLowerCase() }
  function matches(row: any) { return !(status && row.status !== status) && !(archiveFilter === 'active' && row.archived) && !(archiveFilter === 'archived' && !row.archived) && !(query.trim() && !searchText(row).includes(query.trim().toLowerCase())) }
  const filteredOrders = useMemo(() => orders.filter(matches), [orders, status, query, archiveFilter])
  const filteredAppointments = useMemo(() => appointments.filter(matches), [appointments, status, query, archiveFilter])
  const filteredRequests = useMemo(() => requests.filter(matches), [requests, status, query, archiveFilter])
  const activeList = tab === 'orders' ? filteredOrders : tab === 'bookings' ? filteredAppointments : filteredRequests
  const visibleList = expanded ? activeList : activeList.slice(0, PAGE_SIZE)
  const activeStatuses = tabs.find((item) => item.key === tab)!.statuses

  function changeTab(key: TabKey) { setTab(key); setStatus(''); setExpanded(false) }
  async function updateStatus(id: string, value: string) { setBusy(`status-${id}`); const response = await fetch('/api/client-activity/status', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({slug,token,type:tab,id,status:value}) }); const result=await response.json(); setBusy(''); if(!response.ok){setMessage(result.error||'Unable to update status.');return} await refresh() }
  async function setArchived(id: string, archived: boolean) { setBusy(`archive-${id}`); const response=await fetch('/api/client-activity/archive',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug,token,type:tab,id,archived})});const result=await response.json();setBusy('');if(!response.ok){setMessage(result.error||'Unable to update.');return}await refresh() }

  if (!availableTabs.length) return <p className="rounded-xl border border-dashed p-7 text-center text-sm text-[#77776f]">No activity types are enabled for this link yet.</p>
  return <div className="grid gap-5">
    {message && <p role="status" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
    <div className="flex flex-wrap items-center gap-2">{availableTabs.map((item)=><button key={item.key} type="button" onClick={()=>changeTab(item.key)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab===item.key?'bg-[#1d1d1b] text-white':'border border-[#d8d6ce] bg-white'}`}>{item.label} <span className="opacity-60">({item.key==='orders'?filteredOrders.length:item.key==='bookings'?filteredAppointments.length:filteredRequests.length})</span></button>)}<span className="ml-auto text-[11px] text-[#999991]">Live updates{lastUpdated ? ` · ${lastUpdated.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}` : ''}</span></div>
    <div className="flex flex-wrap gap-3 rounded-2xl border border-[#deded7] bg-white p-4"><Field label="Search"><input className={select} value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Name or phone…"/></Field><Field label="Status"><select className={select} value={status} onChange={(e)=>setStatus(e.target.value)}><option value="">All statuses</option>{activeStatuses.map((value)=><option key={value} value={value}>{pretty(value)}</option>)}</select></Field><Field label="Show"><select className={select} value={archiveFilter} onChange={(e)=>setArchiveFilter(e.target.value as typeof archiveFilter)}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></Field></div>
    <div className="divide-y overflow-hidden rounded-xl border bg-white">
      {!visibleList.length && <p className="p-7 text-center text-sm text-[#77776f]">Nothing matches these filters.</p>}
      {tab==='orders'&&(visibleList as CustomerOrder[]).map((row)=><ActivityRow key={row.id} archived={row.archived} customer={<><Detail label="Name" value={row.customer_name}/><Detail label="Phone" value={formatPhone(row.customer_phone)}/></>} details={<><Detail label="Fulfillment" value={pretty(row.fulfillment_method)}/><Detail label="Items" value={row.order_items?.map((item)=>`${item.quantity}× ${item.product_name}`).join(', ')||'—'}/><Detail label="Total" value={`$${(row.total_cents/100).toFixed(2)}`}/>{row.address&&<Detail label="Address" value={row.address}/>} {row.notes&&<Detail label="Notes" value={row.notes}/>}<Detail label="Created" value={formatDateTime(row.created_at)}/></>}><Status value={row.status} values={tabs[0].statuses} onChange={(v)=>updateStatus(row.id,v)}/><ArchiveButton row={row} busy={busy} onClick={()=>setArchived(row.id,!row.archived)}/></ActivityRow>)}
      {tab==='bookings'&&(visibleList as Appointment[]).map((row)=><ActivityRow key={row.id} archived={row.archived} customer={<><Detail label="Name" value={row.customer_name}/><Detail label="Phone" value={formatPhone(row.customer_phone)}/></>} details={<><Detail label="Service" value={row.service_name||'Any service'}/><Detail label="Date" value={formatDate(row.appointment_date)}/><Detail label="Time" value={`${formatTime(row.start_time)}–${formatTime(row.end_time)}`}/>{row.notes&&<Detail label="Notes" value={row.notes}/>}<Detail label="Created" value={formatDateTime(row.created_at)}/></>}><Status value={row.status} values={tabs[1].statuses} onChange={(v)=>updateStatus(row.id,v)}/><ArchiveButton row={row} busy={busy} onClick={()=>setArchived(row.id,!row.archived)}/></ActivityRow>)}
      {tab==='requests'&&(visibleList as ServiceRequest[]).map((row)=><ActivityRow key={row.id} archived={row.archived} customer={<><Detail label="Name" value={row.customer_name}/><Detail label="Phone" value={formatPhone(row.customer_phone)}/>{row.customer_email&&<Detail label="Email" value={row.customer_email}/>}</>} details={<>{row.request_details&&<Detail label="Request" value={row.request_details}/>} {row.address&&<Detail label="Address" value={row.address}/>} {row.preferred_date&&<Detail label="Preferred date" value={formatDate(row.preferred_date)}/>} {row.notes&&<Detail label="Notes" value={row.notes}/>}<Detail label="Created" value={formatDateTime(row.created_at)}/></>}><Status value={row.status} values={tabs[2].statuses} onChange={(v)=>updateStatus(row.id,v)}/><ArchiveButton row={row} busy={busy} onClick={()=>setArchived(row.id,!row.archived)}/></ActivityRow>)}
    </div>
    {activeList.length>PAGE_SIZE&&<button type="button" className="min-h-10 rounded-xl border bg-white px-4 text-sm font-semibold" onClick={()=>setExpanded(!expanded)}>{expanded?'Show less':`View all (${activeList.length})`}</button>}
  </div>
}

function pretty(value:string){return value[0].toUpperCase()+value.slice(1).replaceAll('_',' ')}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>{label}</span>{children}</label>}
function Detail({label,value}:{label:string;value:string}){return <small className="block min-w-0 text-xs text-[#77776f]"><span className="mr-1 font-semibold text-[#4f4f49]">{label}:</span><span className="break-words">{value}</span></small>}
function ActivityRow({archived,customer,details,children}:{archived:boolean;customer:React.ReactNode;details:React.ReactNode;children:React.ReactNode}){return <div className="grid gap-3 p-4 md:grid-cols-[1fr_1.5fr_150px_auto]"><div>{archived&&<span className="mb-1 inline-block rounded-full bg-[#f0eee7] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#77776f]">Archived</span>}{customer}</div><div>{details}</div>{children}</div>}
function Status({value,values,onChange}:{value:string;values:readonly string[];onChange:(value:string)=>void}){return <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Status</span><StatusBadge value={value}/><select className={select} value={value} onChange={(e)=>onChange(e.target.value)}>{values.map((item)=><option key={item} value={item}>{pretty(item)}</option>)}</select></label>}
function StatusBadge({value}:{value:string}){const tone=value==='completed'?'bg-emerald-50 text-emerald-700 ring-emerald-200':value==='cancelled'?'bg-red-50 text-red-700 ring-red-200':value==='preparing'||value==='confirmed'?'bg-amber-50 text-amber-800 ring-amber-200':value==='ready'?'bg-cyan-50 text-cyan-800 ring-cyan-200':'bg-sky-50 text-sky-700 ring-sky-200';const dot=value==='completed'?'bg-emerald-500':value==='cancelled'?'bg-red-500':value==='preparing'||value==='confirmed'?'bg-amber-500':value==='ready'?'bg-cyan-500':'bg-sky-500';return <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ring-inset ${tone}`}><span className={`size-1.5 rounded-full ${dot}`}/>{value.replaceAll('_',' ')}</span>}
function ArchiveButton({row,busy,onClick}:{row:{id:string;archived:boolean};busy:string;onClick:()=>void}){return <button type="button" disabled={busy===`archive-${row.id}`} onClick={onClick} className="icon-button" aria-label={row.archived?'Restore':'Archive'}>{row.archived?<ArchiveRestore size={15}/>:<Archive size={15}/>}</button>}
