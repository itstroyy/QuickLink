'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Activity, BarChart3, LayoutDashboard, LogOut, Plus, Settings, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import QuicklinkLogo from '@/components/quicklink-logo'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/activity', label: 'Activity', icon: Activity },
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

  function isActive(href: string) {
    return pathname === href || (href === '/admin/clients' && pathname.startsWith('/admin/clients/'))
  }

  return <div className="min-h-screen bg-[#f6f6f3] pb-20 text-[#1d1d1b] md:pb-0">
    <div className="mx-auto flex min-h-screen max-w-[1600px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#deded7] bg-white p-6 md:flex">
        <Link href="/"><QuicklinkLogo className="text-lg"/></Link>
        <Link href="/admin/clients/new" className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-3 py-2.5 text-sm font-semibold text-white"><Plus size={16}/> Add client</Link>
        <nav className="mt-6 grid gap-1.5">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive(href) ? 'bg-[#eee9df] text-[#1d1d1b]' : 'text-[#77776f] hover:bg-[#f6f6f3]'}`}><Icon size={17}/>{label}</Link>)}</nav>
        <button onClick={signOut} className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#77776f] hover:bg-[#f6f6f3]"><LogOut size={16}/> Sign out</button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#deded7] bg-white/90 px-5 py-4 backdrop-blur md:hidden">
          <Link href="/admin"><QuicklinkLogo/></Link>
          <Link href="/admin/clients/new" className="flex items-center gap-1.5 rounded-full bg-[#1d1d1b] px-3.5 py-2 text-xs font-semibold text-white"><Plus size={15}/> Add client</Link>
        </header>
        <div key={pathname} className="ql-enter">{children}</div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#deded7] bg-white/95 backdrop-blur md:hidden">{nav.map(({ href, label, icon: Icon }) => { const active = isActive(href); return <Link key={href} href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? 'text-[#1d1d1b]' : 'text-[#9a988f]'}`}><Icon size={19}/>{label}</Link> })}</nav>
    </div>
  </div>
}
