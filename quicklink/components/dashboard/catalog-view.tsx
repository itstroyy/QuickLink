'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { useFeedback } from '@/components/feedback-provider'
import { createClient } from '@/lib/supabase/client'
import CommerceManager from '@/components/commerce-manager'
import HubManager from '@/components/hub-manager'
import type { Announcement, Business, BusinessHour, GalleryItem, LeadForm, LeadSubmission, NotificationSettings, Product, Promotion, Service } from '@/lib/types'

// The owner-dashboard Catalog tab: products (Order Now), services, offers,
// hours and gallery, plus the notification preferences CommerceManager
// exposes but leaves to its parent to save (see that component's comment).
// Every mutation here runs through the browser Supabase client, scoped by
// Row Level Security's "Members" policies — the same components the admin
// editor uses (components/commerce-manager.tsx, components/hub-manager.tsx),
// just reused for the authenticated owner/manager session instead.
export default function CatalogView({ business, products, services, promotions, hours, announcements, gallery, leadForms, leads, notifications: initialNotifications }: {
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
}) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [savingNotifications, setSavingNotifications] = useState(false)
  const notify = useFeedback()
  const supabase = createClient()

  async function saveNotifications() {
    setSavingNotifications(true)
    try {
      const { error } = await supabase.from('business_notification_settings').upsert({ ...notifications, business_id: business.id })
      if (error) throw error
      notify('Notification settings saved.')
    } catch { notify('Could not save notification settings. Please try again.', 'error') }
    finally { setSavingNotifications(false) }
  }

  return <div className="grid gap-6">
    <CommerceManager businessId={business.id} ready notifications={notifications} onNotificationsChange={setNotifications} initialProducts={products}/>
    <div className="flex justify-end"><button type="button" disabled={savingNotifications} onClick={saveNotifications} className="dashboard-primary inline-flex w-fit items-center gap-2">{savingNotifications ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} Save notification settings</button></div>
    <HubManager business={business} services={services} promotions={promotions} hours={hours} announcements={announcements} gallery={gallery} leadForms={leadForms} leads={leads}/>
  </div>
}
