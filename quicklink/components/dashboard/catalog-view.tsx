'use client'

import { useState } from 'react'
import CommerceManager from '@/components/commerce-manager'
import HubManager from '@/components/hub-manager'
import type { Announcement, Business, BusinessHour, GalleryItem, LeadForm, LeadSubmission, NotificationSettings, Product, Promotion, Service } from '@/lib/types'

// The owner-dashboard Catalog tab: products (Order Now), services, offers,
// and gallery. Operations such as hours, notifications, Calendar and Stripe
// live under Settings rather than being mixed into the catalog.
// Every mutation here runs through the browser Supabase client, scoped by
// Row Level Security's "Members" policies — the same components the admin
// editor uses (components/commerce-manager.tsx, components/hub-manager.tsx),
// just reused for the authenticated owner/manager session instead.
export default function CatalogView({ business, products, services, promotions, hours, announcements, gallery, leadForms, leads, notifications: initialNotifications, enabledFeatures }: {
  business: Business
  products: Product[]
  services: Service[]
  promotions: Promotion[]
  hours: BusinessHour[]
  announcements: Announcement[]
  gallery: GalleryItem[]
  leadForms: LeadForm[]
  leads: LeadSubmission[]
  notifications: NotificationSettings
  enabledFeatures: string[]
}) {
  const [notifications, setNotifications] = useState(initialNotifications)
  return <div className="grid gap-6">
    <CommerceManager businessId={business.id} ready showProducts={enabledFeatures.includes('ordering')} showIntegrations={false} notifications={notifications} onNotificationsChange={setNotifications} initialProducts={products}/>
    <div className={!enabledFeatures.some(key=>key==='booking'||key==='request_service')?'[&_#services]:hidden':''}><HubManager business={business} services={services} promotions={promotions} hours={hours} announcements={announcements} gallery={gallery} leadForms={leadForms} leads={leads} showHours={false}/></div>
  </div>
}
