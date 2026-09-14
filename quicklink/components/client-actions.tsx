'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, BarChart3, CalendarClock, ChevronDown, Eye, Inbox, KeyRound, Loader2, Pencil, Power } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useFeedback } from '@/components/feedback-provider'
import type { Business } from '@/lib/types'

// Activity and Analytics already live in the admin sidebar as global
// destinations; duplicating them here just repeats sidebar nav. They're
// still one click away for this specific business via the "More" menu below
// (and Recent activity further down this page already links to Activity
// filtered to this business).
export default function ClientActions({ business }: { business: Business }) {
  const router = useRouter()
  const notify = useFeedback()
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    function onOutside(event: MouseEvent) { if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false) }
    function onEscape(event: KeyboardEvent) { if (event.key === 'Escape') setMoreOpen(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape)
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEscape) }
  }, [moreOpen])

  async function update(archive = false) {
    if (pending.current) return
    const status = archive ? 'archived' : business.status === 'active' ? 'inactive' : 'active'
    if ((archive || status === 'inactive') && !window.confirm(archive ? `Archive ${business.name}? The page will become unavailable, but its data will be kept.` : `Disable ${business.name}? Customers will no longer be able to use this page until you enable it again.`)) return
    pending.current = true; setBusy(true)
    try {
      const { error } = await createClient().from('businesses').update({ status }).eq('id', business.id)
      if (error) throw error
      notify(archive ? 'Business archived. Its data has been kept.' : status === 'active' ? 'Business enabled.' : 'Business disabled.')
      if (archive) router.push('/admin/clients')
      router.refresh()
    } catch { notify('Could not update this business. Please try again.', 'error') }
    finally { pending.current = false; setBusy(false) }
  }
  const style = 'inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d8d6ce] bg-white px-4 py-2.5 text-sm font-semibold'
  const menuItemStyle = 'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[#1d1d1b] hover:bg-[#fafaf7]'
  return <div className="flex flex-wrap items-center gap-2">
    <Link href={`/${business.slug}`} target="_blank" className={style}><Eye size={16}/> View page</Link>
    <Link href={`/admin/clients/${business.id}/edit`} className={style}><Pencil size={16}/> Manage</Link>
    <Link href={`/admin/clients/${business.id}/hub`} className={style}><CalendarClock size={16}/> Services &amp; hours</Link>
    <Link href={`/admin/clients/${business.id}/access`} className={style}><KeyRound size={16}/> Owner access</Link>

    <div ref={moreRef} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)} className={style}>More <ChevronDown size={15} className={`transition-transform ${moreOpen ? 'rotate-180' : ''}`}/></button>
      {moreOpen && <div role="menu" className="absolute right-0 z-10 mt-2 w-56 rounded-2xl border border-[#e4e2da] bg-white p-1.5 shadow-lg">
        <Link role="menuitem" href={`/admin/activity?business=${business.id}`} className={menuItemStyle} onClick={() => setMoreOpen(false)}><Inbox size={16} className="text-[#8b6b3d]"/> Activity</Link>
        <Link role="menuitem" href={`/admin/analytics?business=${business.id}`} className={menuItemStyle} onClick={() => setMoreOpen(false)}><BarChart3 size={16} className="text-[#8b6b3d]"/> Analytics</Link>
      </div>}
    </div>

    <button type="button" disabled={busy} onClick={() => update()} className={style}>{busy ? <Loader2 className="animate-spin" size={16}/> : <Power size={16}/>} {business.status === 'active' ? 'Disable' : 'Enable'}</button>
    <button type="button" disabled={busy} onClick={() => update(true)} className={`${style} text-red-600`}><Archive size={16}/> Archive</button>
  </div>
}
