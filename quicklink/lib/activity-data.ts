import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Appointment, CustomerOrder, ServiceRequest } from '@/lib/types'

export type ActivityBusiness = { id: string; name: string; slug: string }
export type ActivityOrder = CustomerOrder & { business_name: string }
export type ActivityAppointment = Appointment & { business_name: string }
export type ActivityRequest = ServiceRequest & { business_name: string }

const ACTIVITY_LIMIT = 300

// Cross-business history for the Admin → Activity screen. The client editor
// intentionally no longer shows this — it's here so orders, bookings and
// service requests can be reviewed and filtered across every client from one
// place, without cluttering the per-client configuration screens.
export async function loadActivity() {
  const supabase = await createClient()
  const [businesses, orders, appointments, requests] = await Promise.all([
    supabase.from('businesses').select('id,name,slug').neq('status', 'archived').order('name'),
    supabase.from('orders').select('*,order_items(*),businesses(name)').order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('appointments').select('*,businesses(name)').order('appointment_date', { ascending: false }).order('start_time', { ascending: false }).limit(ACTIVITY_LIMIT),
    supabase.from('service_requests').select('*,businesses(name)').order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT),
  ])

  return {
    ready: !orders.error && !appointments.error && !requests.error,
    businesses: (businesses.data || []) as ActivityBusiness[],
    orders: (orders.data || []).map((row: any) => ({ ...row, business_name: row.businesses?.name || 'Unknown' })) as ActivityOrder[],
    appointments: (appointments.data || []).map((row: any) => ({ ...row, business_name: row.businesses?.name || 'Unknown' })) as ActivityAppointment[],
    requests: (requests.data || []).map((row: any) => ({ ...row, business_name: row.businesses?.name || 'Unknown' })) as ActivityRequest[],
  }
}
