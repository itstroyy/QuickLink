import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireOwnerContext } from '@/lib/dashboard/business-context'
import CatalogView from '@/components/dashboard/catalog-view'
import type { Announcement, Business, BusinessHour, GalleryItem, LeadForm, LeadSubmission, NotificationSettings, Product, Promotion, Service } from '@/lib/types'

export const metadata: Metadata = { title: 'Catalog — Quicklink', robots: { index: false, follow: false } }

export default async function DashboardCatalogPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business: preferred } = await searchParams
  const { business } = await requireOwnerContext(preferred)
  const supabase = await createClient()
  const [products, services, promotions, hours, announcements, gallery, leadForms, leads, notifications, features] = await Promise.all([
    supabase.from('products').select('*').eq('business_id', business.id).order('display_order'),
    supabase.from('services').select('*').eq('business_id', business.id).order('display_order'),
    supabase.from('promotions').select('*').eq('business_id', business.id).order('display_order'),
    supabase.from('business_hours').select('*').eq('business_id', business.id).order('day_of_week'),
    supabase.from('announcements').select('*').eq('business_id', business.id).order('display_order'),
    supabase.from('gallery_items').select('*').eq('business_id', business.id).order('display_order'),
    supabase.from('lead_forms').select('*').eq('business_id', business.id).order('display_order'),
    supabase.from('lead_submissions').select('*').eq('business_id', business.id).order('created_at', { ascending: false }),
    supabase.from('business_notification_settings').select('*').eq('business_id', business.id).maybeSingle(),
    supabase.from('business_features').select('feature_key,enabled').eq('business_id',business.id),
  ])

  const defaultNotifications: NotificationSettings = { business_id: business.id, notification_phone: business.phone, order_sms: false, booking_sms: false, quote_sms: false, delivery_sms: false, notification_email: business.email, push_notifications_enabled: true, email_notifications_enabled: false, calendar_integration_enabled: false }

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">{business.name}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Catalog</h1>
    <p className="mt-2 text-[#77776f]">Products, services, offers and gallery — the customer-facing catalog for enabled business features.</p>
    <div className="mt-8"><CatalogView
      business={business as Business}
      products={(products.data || []) as Product[]}
      services={(services.data || []) as Service[]}
      promotions={(promotions.data || []) as Promotion[]}
      hours={(hours.data || []) as BusinessHour[]}
      announcements={(announcements.data || []) as Announcement[]}
      gallery={(gallery.data || []) as GalleryItem[]}
      leadForms={(leadForms.data || []) as LeadForm[]}
      leads={(leads.data || []) as LeadSubmission[]}
      notifications={(notifications.data as NotificationSettings) || defaultNotifications}
      enabledFeatures={(features.data||[]).filter(item=>item.enabled).map(item=>item.feature_key)}
    /></div>
  </div></main>
}
