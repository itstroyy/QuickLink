import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireOwnerContext } from '@/lib/dashboard/business-context'
import PaymentsSettings from '@/components/dashboard/payments-settings'
import type { BusinessPaymentSettings } from '@/lib/types'
import { stripePlatformConfig } from '@/lib/stripe'

export const metadata:Metadata={title:'Payments — Quicklink',robots:{index:false,follow:false}}
export default async function PaymentsPage({searchParams}:{searchParams:Promise<{business?:string;stripe?:string}>}){const query=await searchParams;const{business}=await requireOwnerContext(query.business);const{data}=await(await createClient()).from('business_payment_settings').select('*').eq('business_id',business.id).single();if(!data)return <main className="px-5 py-10"><p>Run the productization migration to configure payments.</p></main>;return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8b6b3d]">{business.name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Payments &amp; policies</h1><p className="mt-2 text-[#77776f]">Connect Stripe, choose when customers pay, and set clear cancellation rules.</p><PaymentsSettings businessId={business.id} initial={data as BusinessPaymentSettings} platformConfig={stripePlatformConfig()} returned={query.stripe}/></div></main>}
