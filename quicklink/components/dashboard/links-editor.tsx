'use client'

import { useState } from 'react'
import { GripVertical, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useFeedback } from '@/components/feedback-provider'
import { createClient } from '@/lib/supabase/client'
import { standardLinks } from '@/lib/links'
import type { BusinessLink } from '@/lib/types'

// Compact rows for social/custom links — secondary to the action-first
// public page, but still fully owner-editable (business_links already has
// "Members" RLS policies from 202609140001_business_membership.sql).
export default function LinksEditor({ businessId, links: initial }: { businessId: string; links: BusinessLink[] }) {
  const [links, setLinks] = useState(initial)
  const [busy, setBusy] = useState('')
  const notify = useFeedback()
  const supabase = createClient()

  function addLink() {
    setLinks((rows) => [...rows, { id: crypto.randomUUID(), business_id: businessId, type: 'custom', label: '', url: '', icon: 'custom', display_order: rows.length, enabled: true }])
  }
  function update(id: string, changes: Partial<BusinessLink>) { setLinks((rows) => rows.map((row) => row.id === id ? { ...row, ...changes } : row)) }

  async function save(row: BusinessLink) {
    if (!row.label.trim() || !row.url.trim()) { notify('Add a label and a URL before saving.', 'error'); return }
    setBusy(row.id)
    try {
      const { error } = await supabase.from('business_links').upsert({ ...row, icon: row.icon || row.type })
      if (error) throw error
      notify('Link saved.')
    } catch { notify('Could not save this link. Please try again.', 'error') }
    finally { setBusy('') }
  }

  async function remove(id: string) {
    setBusy(id)
    try {
      const { error } = await supabase.from('business_links').delete().eq('id', id)
      if (error) throw error
      setLinks((rows) => rows.filter((row) => row.id !== id))
      notify('Link removed.')
    } catch { notify('Could not remove this link. Please try again.', 'error') }
    finally { setBusy('') }
  }

  return <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Links &amp; social</h2><p className="mt-1 text-xs text-[#77776f]">Shown below your main actions on the public page, in this order.</p></div><button type="button" onClick={addLink} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#d8d6ce] bg-white px-4 text-sm font-semibold"><Plus size={15}/> Add link</button></div>
    <div className="grid gap-2.5">
      {links.map((row) => <div key={row.id} className="grid items-center gap-2 rounded-xl border border-[#e4e2da] bg-[#fafaf7] p-3 sm:grid-cols-[24px_140px_1fr_1.4fr_auto_auto]">
        <GripVertical size={16} className="hidden text-[#b9b6ae] sm:block"/>
        <select className="form-control" value={row.type} onChange={(event) => { const preset = standardLinks.find((item) => item.type === event.target.value); update(row.id, { type: event.target.value, icon: event.target.value, label: preset ? preset.label : row.label }) }}>
          {standardLinks.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
          <option value="custom">Custom link</option>
        </select>
        <input className="form-control" value={row.label} onChange={(event) => update(row.id, { label: event.target.value })} placeholder="Button label"/>
        <input className="form-control" value={row.url} onChange={(event) => update(row.id, { url: event.target.value })} placeholder="https://…"/>
        <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={row.enabled} onChange={(event) => update(row.id, { enabled: event.target.checked })}/> On</label>
        <div className="flex justify-end gap-1"><button type="button" onClick={() => save(row)} className="icon-button" aria-label="Save link">{busy === row.id ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}</button><button type="button" onClick={() => remove(row.id)} className="icon-button text-red-600" aria-label="Remove link"><Trash2 size={15}/></button></div>
      </div>)}
      {links.length === 0 && <p className="rounded-xl border border-dashed border-[#d8d6ce] px-4 py-7 text-center text-sm text-[#77776f]">No links yet. Select Add link to create the first one.</p>}
    </div>
  </section>
}
