import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { requireOwnerContext } from '@/lib/dashboard/business-context'
import PreferencesEditor from '@/components/dashboard/preferences-editor'
import { defaultPrimaryActionFor, industryDefaultSectionOrder, type BusinessIndustry } from '@/lib/section-order'
import type { Business, BusinessLink, BusinessPreferences } from '@/lib/types'

export const metadata: Metadata = { title: 'Page Settings — Quicklink', robots: { index: false, follow: false } }

export default async function DashboardSettingsPage({ searchParams }: { searchParams: Promise<{ business?: string }> }) {
  const { business: preferred } = await searchParams
  const { business } = await requireOwnerContext(preferred)
  const supabase = await createClient()

  const [preferencesResult, featuresResult, linksResult, servicesResult, promotionsResult, hoursResult, announcementsResult, galleryResult, formsResult, productsResult] = await Promise.all([
    supabase.from('business_preferences').select('*').eq('business_id', business.id).maybeSingle(),
    supabase.from('business_features').select('*').eq('business_id', business.id),
    supabase.from('business_links').select('*').eq('business_id', business.id).order('display_order'),
    supabase.from('services').select('id').eq('business_id', business.id).eq('enabled', true).limit(1),
    supabase.from('promotions').select('id').eq('business_id', business.id).eq('enabled', true).limit(1),
    supabase.from('business_hours').select('id').eq('business_id', business.id).limit(1),
    supabase.from('announcements').select('id').eq('business_id', business.id).eq('enabled', true).limit(1),
    supabase.from('gallery_items').select('id').eq('business_id', business.id).eq('enabled', true).limit(1),
    supabase.from('lead_forms').select('id').eq('business_id', business.id).eq('enabled', true).limit(1),
    supabase.from('products').select('id').eq('business_id', business.id).eq('available', true).limit(1),
  ])

  const preferences: BusinessPreferences = (preferencesResult.data as BusinessPreferences | null) || {
    business_id: business.id,
    industry: 'general',
    primary_action: 'auto',
    section_order: industryDefaultSectionOrder.general,
    timezone: 'America/New_York',
    service_area: null,
    fulfillment_text: null,
    products_section_title: null,
    updated_at: business.updated_at,
  }

  const features = featuresResult.data || []
  const enabledFeatureKeys = new Set((features as Array<{ feature_key: string; enabled: boolean }>).filter((f) => f.enabled).map((f) => f.feature_key))
  const links = (linksResult.data || []) as BusinessLink[]

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-4xl">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">{business.name}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Page settings</h1>
    <p className="mt-2 text-[#77776f]">Control how your public Quicklink page is organized — what customers see first, in what order, and how your hours and location are presented.</p>

    <PreferencesEditor
      business={business as Business}
      initialPreferences={preferences}
      links={links}
      availability={{
        hasOrdering: enabledFeatureKeys.has('ordering'),
        hasBooking: enabledFeatureKeys.has('booking'),
        hasRequest: enabledFeatureKeys.has('request_service'),
        hasAnnouncements: (announcementsResult.data?.length || 0) > 0,
        hasProducts: (productsResult.data?.length || 0) > 0,
        hasServices: (servicesResult.data?.length || 0) > 0,
        hasOffers: (promotionsResult.data?.length || 0) > 0,
        hasGallery: (galleryResult.data?.length || 0) > 0,
        hasHours: (hoursResult.data?.length || 0) > 0,
        hasLeadForm: enabledFeatureKeys.has('contact_form') && (formsResult.data?.length || 0) > 0,
      }}
    />
  </div></main>
}
