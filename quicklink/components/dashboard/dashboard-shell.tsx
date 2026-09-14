'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BarChart3, Home, Inbox, LayoutGrid, LogOut, MoreHorizontal, Settings2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import QuicklinkLogo from '@/components/quicklink-logo'
import type { OwnerBusiness } from '@/lib/dashboard/business-context'

const nav = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/activity', label: 'Activity', icon: Inbox },
  { href: '/dashboard/catalog', label: 'Catalog', icon: LayoutGrid },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/more', label: 'More', icon: MoreHorizontal },
]

// Desktop-only: the mobile bottom bar only has room for 5 items, so Page
// Settings lives one tap into "More" there instead (see the More page).
const secondaryNav = [
  { href: '/dashboard/settings', label: 'Page settings', icon: Settings2 },
]

export default function DashboardShell({ children, businesses, isAdmin }: { children: React.ReactNode; businesses: OwnerBusiness[]; isAdmin: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeId = searchParams.get('business') || businesses[0]?.id
  const active = businesses.find((business) => business.id === activeId) || businesses[0]

  function withBusiness(href: string) {
    if (businesses.length <= 1 || !activeId) return href
    return `${href}?business=${activeId}`
  }

  function switchBusiness(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('business', id)
    router.push(`${pathname}?${params.toString()}`)
    router.refresh()
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const switcher = businesses.length > 1
    ? <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>Business</span><select className="form-control" value={activeId} onChange={(event) => switchBusiness(event.target.value)}>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
    : <p className="truncate text-sm font-semibold">{active?.name}</p>

  return <div className="min-h-screen bg-[#f6f6f3] pb-20 text-[#1d1d1b] md:pb-0">
    <div className="mx-auto flex min-h-screen max-w-[1400px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#deded7] bg-white p-6 md:flex">
        <Link href="/"><QuicklinkLogo className="text-lg"/></Link>
        {isAdmin && <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#eee9df] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#8b6b3d]"><ShieldCheck size={12}/> Admin view</span>}
        <div className="mt-6">{switcher}</div>
        <nav className="mt-8 grid gap-1.5">{nav.map(({ href, label, icon: Icon }) => { const isActive = pathname === href; return <Link key={href} href={withBusiness(href)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-[#eee9df]' : 'text-[#77776f] hover:bg-[#f6f6f3]'}`}><Icon size={17}/>{label}</Link> })}</nav>
        <nav className="mt-1.5 grid gap-1.5 border-t border-[#eee9df] pt-3">{secondaryNav.map(({ href, label, icon: Icon }) => { const isActive = pathname === href; return <Link key={href} href={withBusiness(href)} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-[#eee9df]' : 'text-[#77776f] hover:bg-[#f6f6f3]'}`}><Icon size={17}/>{label}</Link> })}</nav>
        {active && <a href={`/${active.slug}`} target="_blank" rel="noreferrer" className="mt-4 text-sm font-medium text-[#8b6b3d] underline">View public page</a>}
        <button onClick={signOut} className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#77776f] hover:bg-[#f6f6f3]"><LogOut size={16}/> Sign out</button>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#deded7] bg-white/90 px-5 py-4 backdrop-blur md:hidden">
          <Link href="/"><QuicklinkLogo/></Link>
          <span className="truncate text-sm font-semibold">{active?.name}</span>
        </header>
        {businesses.length > 1 && <div className="border-b border-[#deded7] bg-white px-5 py-3 md:hidden"><select className="form-control" value={activeId} onChange={(event) => switchBusiness(event.target.value)}>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></div>}
        <div key={pathname} className="ql-enter">{children}</div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[#deded7] bg-white/95 backdrop-blur md:hidden">{nav.map(({ href, label, icon: Icon }) => { const isActive = pathname === href; return <Link key={href} href={withBusiness(href)} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${isActive ? 'text-[#1d1d1b]' : 'text-[#9a988f]'}`}><Icon size={19}/>{label}</Link> })}</nav>
    </div>
  </div>
}
