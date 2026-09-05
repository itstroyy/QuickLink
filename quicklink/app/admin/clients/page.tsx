import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ClientList from '@/components/client-list'
import type { Business } from '@/lib/types'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('businesses').select('*').neq('status', 'archived').order('created_at', { ascending: false })

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Client library</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Clients</h1><p className="mt-2 text-[#77776f]">Search, update, duplicate, or pause any Quicklink page.</p></div><Link href="/admin/clients/new" className="flex items-center gap-2 rounded-full bg-[#1d1d1b] px-5 py-3 text-sm font-semibold text-white"><Plus size={16}/> Add client</Link></div>
    {error ? <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Database setup required</h2><p className="mt-2 text-sm leading-6 text-amber-800">Run the Quicklink migration in Supabase SQL Editor, then refresh this page. Details are in the project README.</p></div> : <ClientList initialBusinesses={(data ?? []) as Business[]}/>} 
  </div></main>
}
