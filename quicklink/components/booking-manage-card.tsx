'use client'

import { useState } from 'react'
import { CalendarDays, CheckCircle2, Loader2, XCircle } from 'lucide-react'

type ManagedBooking = {
  customerName: string
  businessName: string
  serviceName: string | null
  date: string
  startTime: string
  endTime: string
  status: string
}

export default function BookingManageCard({ token, booking }: { token: string; booking: ManagedBooking }) {
  const [status, setStatus] = useState(booking.status)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function cancel() {
    if (!window.confirm('Cancel this appointment?')) return
    setBusy(true); setError('')
    const response = await fetch('/api/booking/manage/cancel', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
    const result = await response.json()
    setBusy(false)
    if (!response.ok) setError(result.error || 'Unable to cancel this appointment.')
    else setStatus('cancelled')
  }
  const date = new Date(`${booking.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return <main className="min-h-screen bg-[#f6f3ed] px-5 py-12 text-[#1d1d1b]"><section className="mx-auto max-w-lg overflow-hidden rounded-3xl border border-[#ded8cc] bg-white shadow-[0_24px_70px_rgba(38,28,17,.12)]">
    <div className="border-b border-[#e8e2d8] bg-[#1d1d1b] px-6 py-7 text-white"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#d19a6a]">Quicklink appointment</p><h1 className="mt-2 text-2xl font-semibold">Manage your booking</h1></div>
    <div className="p-6 sm:p-8"><div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#f2e8db] text-[#9a6339]"><CalendarDays size={22}/></span><div><h2 className="text-xl font-semibold">{booking.businessName}</h2><p className="mt-1 text-sm text-[#77776f]">For {booking.customerName}</p></div></div>
      <dl className="mt-7 grid gap-3 rounded-2xl bg-[#faf8f3] p-5 text-sm"><div className="flex justify-between gap-4"><dt className="text-[#77776f]">Date</dt><dd className="text-right font-medium">{date}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#77776f]">Time</dt><dd className="font-medium">{formatTime(booking.startTime)}–{formatTime(booking.endTime)}</dd></div>{booking.serviceName&&<div className="flex justify-between gap-4"><dt className="text-[#77776f]">Service</dt><dd className="font-medium">{booking.serviceName}</dd></div>}<div className="flex justify-between gap-4"><dt className="text-[#77776f]">Status</dt><dd className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${status==='cancelled'?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>{status}</dd></div></dl>
      {error&&<p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {status==='cancelled'?<div className="mt-6 flex items-center gap-2 rounded-xl bg-[#faf8f3] px-4 py-3 text-sm font-medium"><CheckCircle2 size={18} className="text-[#9a6339]"/>This appointment has been cancelled.</div>:status==='completed'?<p className="mt-6 text-center text-sm text-[#77776f]">This appointment is complete.</p>:<button type="button" disabled={busy} onClick={cancel} className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-semibold text-red-700 disabled:opacity-50">{busy?<Loader2 size={17} className="animate-spin"/>:<XCircle size={17}/>} {busy?'Cancelling…':'Cancel appointment'}</button>}
    </div>
  </section></main>
}

function formatTime(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
