import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BellRing, Compass, CreditCard, LayoutTemplate } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireOwnerContext } from '@/lib/dashboard/business-context'
import BusinessProfileForm from '@/components/dashboard/business-profile-form'
import LinksEditor from '@/components/dashboard/links-editor'
import type { Business, BusinessLink } from '@/lib/types'

export const metadata: Metadata = { title: 'Settings — Quicklink', robots: { index: false, follow: false } }

export default async function DashboardMorePage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business: preferred } = await searchParams
  const { business } = await requireOwnerContext(preferred)
  const supabase = await createClient()
  const { data: links } = await supabase.from('business_links').select('*').eq('business_id', business.id).order('display_order')

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-4xl">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">{business.name}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
    <p className="mt-2 text-[#77776f]">Business profile, public-page settings, payments, notifications and integrations.</p>
    <div className="mt-8 grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={`/dashboard/onboarding?business=${business.id}`} className="flex items-center gap-4 rounded-2xl border border-[#deded7] bg-white p-5 transition hover:border-[#8b6b3d]">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#faf6ee] text-[#8b6b3d]"><Compass size={20}/></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">Guided setup</span><span className="block text-xs text-[#77776f]">Step-by-step checklist to get fully launched.</span></span>
          <ArrowRight size={18} className="shrink-0 text-[#9a988f]"/>
        </Link>
        <Link href={`/dashboard/settings?business=${business.id}`} className="flex items-center gap-4 rounded-2xl border border-[#deded7] bg-white p-5 transition hover:border-[#8b6b3d]">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#faf6ee] text-[#8b6b3d]"><LayoutTemplate size={20}/></span>
          <span className="min-w-0 flex-1"><span className="block font-semibold">Page settings</span><span className="block text-xs text-[#77776f]">Business type, primary action, section order, timezone and reviews.</span></span>
          <ArrowRight size={18} className="shrink-0 text-[#9a988f]"/>
        </Link>
        <Link href={`/dashboard/payments?business=${business.id}`} className="flex items-center gap-4 rounded-2xl border border-[#deded7] bg-white p-5 transition hover:border-[#8b6b3d]"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#faf6ee] text-[#8b6b3d]"><CreditCard size={20}/></span><span className="min-w-0 flex-1"><span className="block font-semibold">Payments &amp; policies</span><span className="block text-xs text-[#77776f]">Stripe, deposits, cancellations and refunds.</span></span><ArrowRight size={18} className="shrink-0 text-[#9a988f]"/></Link>
        <Link href={`/dashboard/integrations?business=${business.id}`} className="flex items-center gap-4 rounded-2xl border border-[#deded7] bg-white p-5 transition hover:border-[#8b6b3d]"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#faf6ee] text-[#8b6b3d]"><BellRing size={20}/></span><span className="min-w-0 flex-1"><span className="block font-semibold">Notifications &amp; integrations</span><span className="block text-xs text-[#77776f]">Email, browser push and Google Calendar.</span></span><ArrowRight size={18} className="shrink-0 text-[#9a988f]"/></Link>
      </div>
      <BusinessProfileForm business={business as Business}/>
      <LinksEditor businessId={business.id} links={(links || []) as BusinessLink[]}/>
    </div>
  </div></main>
}
