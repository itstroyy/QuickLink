'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, LayoutDashboard, LogOut, Plus, Settings, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import QuicklinkLogo from '@/components/quicklink-logo'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/clients/new', label: 'Add client', icon: Plus },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  if (pathname === '/admin/login') return children

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/admin/login')
    router.refresh()
  }

  return <div className="min-h-screen bg-[#f6f6f3] text-[#1d1d1b]">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#deded7] bg-white p-6 md:flex">
        <Link href="/"><QuicklinkLogo className="text-lg"/></Link>
        <nav className="mt-12 grid gap-1.5">{nav.map(({ href, label, icon: Icon }) => { const active = pathname === href || (href === '/admin/clients' && pathname.startsWith('/admin/clients/')); return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active ? 'bg-[#eee9df] text-[#1d1d1b]' : 'text-[#77776f] hover:bg-[#f6f6f3]'}`}><Icon size={17}/>{label}</Link> })}</nav>
        <button onClick={signOut} className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#77776f] hover:bg-[#f6f6f3]"><LogOut size={16}/> Sign out</button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#deded7] bg-white/90 px-5 py-4 backdrop-blur md:hidden"><Link href="/admin"><QuicklinkLogo/></Link><div className="flex gap-1"><Link href="/admin/clients" className="rounded-lg p-2" aria-label="Clients"><Users size={18}/></Link><Link href="/admin/clients/new" className="rounded-lg bg-[#1d1d1b] p-2 text-white" aria-label="Add client"><Plus size={18}/></Link></div></header>
        {children}
      </div>
    </div>
  </div>
}
