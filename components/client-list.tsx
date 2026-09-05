'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, Copy, ExternalLink, Pencil, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { themeNames, themePresets } from '@/lib/themes'
import type { Business } from '@/lib/types'

export default function ClientList({ initialBusinesses }: { initialBusinesses: Business[] }) {
  const [businesses, setBusinesses] = useState(initialBusinesses)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [theme, setTheme] = useState('all')
  const [message, setMessage] = useState('')
  const visible = useMemo(() => businesses.filter((business) => {
    const matchesSearch = `${business.name} ${business.slug} ${business.category ?? ''}`.toLowerCase().includes(search.toLowerCase())
    return matchesSearch && (status === 'all' || business.status === status) && (theme === 'all' || business.theme === theme)
  }), [businesses, search, status, theme])

  async function toggleStatus(business: Business) {
    const nextStatus = business.status === 'active' ? 'inactive' : 'active'
    const { error } = await createClient().from('businesses').update({ status: nextStatus }).eq('id', business.id)
    if (error) setMessage(error.message)
    else setBusinesses((current) => current.map((item) => item.id === business.id ? { ...item, status: nextStatus } : item))
  }

  async function archive(business: Business) {
    if (!window.confirm(`Archive ${business.name}? Its public page will become unavailable, but its information will be kept.`)) return
    const { error } = await createClient().from('businesses').update({ status: 'archived' }).eq('id', business.id)
    if (error) setMessage(error.message)
    else setBusinesses((current) => current.filter((item) => item.id !== business.id))
  }

  return <>
    <div className="mt-8 grid gap-3 rounded-2xl border border-[#deded7] bg-white p-4 sm:grid-cols-[1fr_180px_180px]">
      <label className="relative"><Search size={17} className="absolute left-3 top-3.5 text-[#999991]"/><input value={search} onChange={(event) => setSearch(event.target.value)} className="form-control pl-10" placeholder="Search name, slug, or category"/></label>
      <select value={status} onChange={(event) => setStatus(event.target.value)} className="form-control" aria-label="Filter by status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <select value={theme} onChange={(event) => setTheme(event.target.value)} className="form-control" aria-label="Filter by theme"><option value="all">All themes</option>{themeNames.map((name) => <option key={name} value={name}>{themePresets[name].label}</option>)}</select>
    </div>
    {message && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#deded7] bg-white">
      <div className="hidden grid-cols-[1.4fr_1fr_.7fr_.7fr_1fr] gap-4 border-b bg-[#fafaf7] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#999991] lg:grid"><span>Business</span><span>Public URL</span><span>Theme</span><span>Status</span><span className="text-right">Actions</span></div>
      <div className="divide-y divide-[#e9e9e3]">{visible.map((business) => <div key={business.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1.4fr_1fr_.7fr_.7fr_1fr] lg:items-center"><Link href={`/admin/clients/${business.id}`} className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eee9df] font-semibold text-[#8b6b3d]">{business.logo_url ? <img src={business.logo_url} alt="" className="h-full w-full object-cover"/> : business.name.slice(0, 2).toUpperCase()}</span><span><strong className="block text-sm">{business.name}</strong><small className="text-[#999991]">{business.category || 'Business'} · {new Date(business.created_at).toLocaleDateString()}</small></span></Link><a href={`/${business.slug}`} target="_blank" rel="noreferrer" className="truncate text-sm text-[#77776f] hover:text-[#1d1d1b]">/{business.slug}</a><span className="text-sm capitalize text-[#77776f]">{business.theme}</span><button onClick={() => toggleStatus(business)} className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${business.status === 'active' ? 'bg-[#e6f1e7] text-[#46734d]' : 'bg-[#f2e8d8] text-[#8b623d]'}`}>{business.status}</button><div className="flex justify-end gap-1"><Link href={`/${business.slug}`} target="_blank" className="icon-button" aria-label={`View ${business.name}`}><ExternalLink size={16}/></Link><Link href={`/admin/clients/${business.id}/edit`} className="icon-button" aria-label={`Edit ${business.name}`}><Pencil size={16}/></Link><Link href={`/admin/clients/new?duplicate=${business.id}`} className="icon-button" aria-label={`Duplicate ${business.name}`}><Copy size={16}/></Link><button onClick={() => archive(business)} className="icon-button text-red-600" aria-label={`Archive ${business.name}`}><Archive size={16}/></button></div></div>)}{visible.length === 0 && <p className="px-5 py-14 text-center text-sm text-[#77776f]">No clients match those filters.</p>}</div>
    </div>
  </>
}
