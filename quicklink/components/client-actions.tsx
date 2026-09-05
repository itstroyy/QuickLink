'use client'

import { useRouter } from 'next/navigation'
import { Archive, Eye, Pencil, Power } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/lib/types'

export default function ClientActions({ business }: { business: Business }) {
  const router = useRouter()
  async function toggle() { await createClient().from('businesses').update({ status: business.status === 'active' ? 'inactive' : 'active' }).eq('id', business.id); router.refresh() }
  async function archive() { if (!window.confirm(`Archive ${business.name}? The page will become unavailable, but its data will be kept.`)) return; await createClient().from('businesses').update({ status: 'archived' }).eq('id', business.id); router.push('/admin/clients'); router.refresh() }
  const style = 'inline-flex items-center gap-2 rounded-full border border-[#d8d6ce] bg-white px-4 py-2.5 text-sm font-semibold'
  return <div className="flex flex-wrap gap-2"><Link href={`/${business.slug}`} target="_blank" className={style}><Eye size={16}/> View page</Link><Link href={`/admin/clients/${business.id}/edit`} className={style}><Pencil size={16}/> Edit</Link><button onClick={toggle} className={style}><Power size={16}/> {business.status === 'active' ? 'Disable' : 'Enable'}</button><button onClick={archive} className={`${style} text-red-650`}><Archive size={16}/> Archive</button></div>
}
