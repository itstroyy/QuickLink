'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Activity, BarChart3, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Plus, Settings, Users } from 'lucide-react'
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
  const [collapsed,setCollapsed]=useState(false)
  useEffect(()=>{setCollapsed(window.localStorage.getItem('quicklink-admin-sidebar')==='collapsed')},[])
  function toggleSidebar(){setCollapsed((current)=>{const next=!current;window.localStorage.setItem('quicklink-admin-sidebar',next?'collapsed':'expanded');return next})}
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
      <aside className={`hidden shrink-0 flex-col border-r border-[#deded7] bg-white p-4 transition-[width] md:flex ${collapsed?'w-20':'w-64'}`}>
        <div className="flex items-center justify-between gap-2"><Link href="/" title="Quicklink">{collapsed?<span className="grid size-10 place-items-center rounded-xl bg-[#1d1d1b] font-bold text-[#d19a6a]">Q</span>:<QuicklinkLogo className="text-lg"/>}</Link><button onClick={toggleSidebar} className="icon-button" aria-label={collapsed?'Expand sidebar':'Collapse sidebar'}>{collapsed?<PanelLeftOpen size={16}/>:<PanelLeftClose size={16}/>}</button></div>
        <Link href="/admin/clients/new" title="Add client" className={`mt-8 flex items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-3 py-2.5 text-sm font-semibold text-white ${collapsed?'px-0':''}`}><Plus size={16}/>{!collapsed&&'Add client'}</Link>
        <nav className="mt-6 grid gap-1.5">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={label} aria-label={label} className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium ${collapsed?'justify-center':'gap-3'} ${isActive(href) ? 'bg-[#eee9df] text-[#1d1d1b]' : 'text-[#77776f] hover:bg-[#f6f6f3]'}`}><Icon size={17}/>{!collapsed&&label}</Link>)}</nav>
        <button onClick={signOut} title="Sign out" className={`mt-auto flex items-center rounded-xl px-3 py-2.5 text-sm font-medium text-[#77776f] hover:bg-[#f6f6f3] ${collapsed?'justify-center':'gap-2'}`}><LogOut size={16}/>{!collapsed&&'Sign out'}</button>
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
