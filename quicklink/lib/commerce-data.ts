import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Appointment, BusinessFeature, CustomerOrder, NotificationSettings, Product, Service, ServiceRequest } from '@/lib/types'

export async function loadCommerceData(businessId: string, fallbackPhone?: string | null) {
  const supabase = await createClient()
  const [features, products, services, orders, requests, appointments, notifications] = await Promise.all([
    supabase.from('business_features').select('*').eq('business_id', businessId).in('feature_key', ['ordering', 'request_service', 'booking']).order('display_order'),
    supabase.from('products').select('*').eq('business_id', businessId).order('display_order'),
    supabase.from('services').select('*').eq('business_id', businessId).order('display_order'),
    supabase.from('orders').select('*,order_items(*)').eq('business_id', businessId).order('created_at', { ascending: false }),
    supabase.from('service_requests').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
    supabase.from('appointments').select('*').eq('business_id', businessId).order('appointment_date', { ascending: false }).order('start_time', { ascending: false }),
    supabase.from('business_notification_settings').select('*').eq('business_id', businessId).maybeSingle(),
  ])
  return {
    ready: !features.error && !products.error && !requests.error,
    bookingReady: !appointments.error && !services.error,
    features: (features.data || []) as BusinessFeature[], products: (products.data || []) as Product[],
    services: (services.data || []) as Service[],
    orders: (orders.data || []) as CustomerOrder[], requests: (requests.data || []) as ServiceRequest[],
    appointments: (appointments.data || []) as Appointment[],
    notifications: (notifications.data || { business_id: businessId, notification_phone: fallbackPhone || null, order_sms: false, booking_sms: false, quote_sms: false, delivery_sms: false, notification_email: null, push_notifications_enabled: true, email_notifications_enabled: false, calendar_integration_enabled: false }) as NotificationSettings,
  }
}
