'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, Eye, KeyRound, Loader2, Pencil, Power } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useFeedback } from '@/components/feedback-provider'
import ConfirmationDialog from '@/components/confirmation-dialog'
import type { Business } from '@/lib/types'

export default function ClientActions({ business }: { business: Business }) {
  const router = useRouter()
  const notify = useFeedback()
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState<'disable'|'archive'|null>(null)

  async function update(archive = false) {
    if (pending.current) return
    const status = archive ? 'archived' : business.status === 'active' ? 'inactive' : 'active'
    pending.current = true; setBusy(true)
    try {
      const { error } = await createClient().from('businesses').update({ status }).eq('id', business.id)
      if (error) throw error
      notify(archive ? 'Business archived. Its data has been kept.' : status === 'active' ? 'Business enabled.' : 'Business disabled.')
      if (archive) router.push('/admin/clients')
      router.refresh()
    } catch { notify('Could not update this business. Please try again.', 'error') }
    finally { pending.current = false; setBusy(false); setPendingAction(null) }
  }

  const style = 'inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d8d6ce] bg-white px-4 py-2.5 text-sm font-semibold'
  return <div className="flex flex-wrap items-center gap-2">
    <Link href={`/${business.slug}`} target="_blank" className={style}><Eye size={16}/>View page</Link>
    <Link href={`/admin/clients/${business.id}/edit`} className={style}><Pencil size={16}/>Manage</Link>
    <Link href={`/admin/clients/${business.id}/access`} className={style}><KeyRound size={16}/>Owner access</Link>
    <button type="button" disabled={busy} onClick={() => business.status === 'active' ? setPendingAction('disable') : update()} className={style}>{busy ? <Loader2 className="animate-spin" size={16}/> : <Power size={16}/>} {business.status === 'active' ? 'Disable' : 'Enable'}</button>
    <button type="button" disabled={busy} onClick={() => setPendingAction('archive')} className={`${style} text-red-600`}><Archive size={16}/>Archive</button>
    <ConfirmationDialog open={Boolean(pendingAction)} title={pendingAction==='archive'?'Archive business?':'Disable business?'} body={pendingAction==='archive'?`${business.name} will become unavailable publicly, but all of its data will be kept.`:`Customers will not be able to use ${business.name}'s public page until it is enabled again.`} confirmLabel={pendingAction==='archive'?'Archive':'Disable'} busy={busy} onCancel={()=>setPendingAction(null)} onConfirm={()=>update(pendingAction==='archive')}/>
  </div>
}
