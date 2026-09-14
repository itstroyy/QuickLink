import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Appointment, BusinessClientAccess, CustomerOrder, ServiceRequest } from '@/lib/types'

export async function loadClientActivity(businessId: string, access: BusinessClientAccess) {
  const admin = createAdminClient()
  if (!admin) return { orders: [], appointments: [], requests: [] }
  const [orders, appointments, requests] = await Promise.all([
    access.client_activity_show_orders ? admin.from('orders').select('*,order_items(*)').eq('business_id', businessId).order('created_at', { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    access.client_activity_show_bookings ? admin.from('appointments').select('*').eq('business_id', businessId).order('appointment_date', { ascending: false }).order('start_time', { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    access.client_activity_show_service_requests ? admin.from('service_requests').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
  ])
  return {
    orders: (orders.data || []) as CustomerOrder[],
    appointments: (appointments.data || []) as Appointment[],
    requests: (requests.data || []) as ServiceRequest[],
  }
}
