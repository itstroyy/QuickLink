import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireOwnerContext } from '@/lib/dashboard/business-context'
import OwnerInboxManager from '@/components/dashboard/owner-inbox-manager'
import type { Appointment, CustomerOrder, ServiceRequest } from '@/lib/types'

export const metadata: Metadata = { title: 'Activity — Quicklink', robots: { index: false, follow: false } }

export default async function DashboardActivityPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business: preferred } = await searchParams
  const { business } = await requireOwnerContext(preferred)
  const supabase = await createClient()
  const [orders, appointments, requests] = await Promise.all([
    supabase.from('orders').select('*,order_items(*)').eq('business_id', business.id).order('created_at', { ascending: false }).limit(300),
    supabase.from('appointments').select('*').eq('business_id', business.id).order('appointment_date', { ascending: false }).order('start_time', { ascending: false }).limit(300),
    supabase.from('service_requests').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(300),
  ])

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">{business.name}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Business Inbox</h1>
    <p className="mt-2 text-[#77776f]">Orders, bookings and service requests for this business only. Nothing here is permanently deleted — you can archive and restore records.</p>
    <div className="mt-8"><OwnerInboxManager
      businessId={business.id}
      initialOrders={(orders.data || []) as CustomerOrder[]}
      initialAppointments={(appointments.data || []) as Appointment[]}
      initialRequests={(requests.data || []) as ServiceRequest[]}
    /></div>
  </div></main>
}
