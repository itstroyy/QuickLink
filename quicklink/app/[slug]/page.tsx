import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientPage from '@/components/client-page'
import type { Business, BusinessLink, BusinessPreferences, PublicHubData } from '@/lib/types'
import { computeOpenStatus } from '@/lib/business-hours'
import { defaultPrimaryActionFor, industryDefaultSectionOrder, type BusinessIndustry } from '@/lib/section-order'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('businesses').select('name, tagline, logo_url').eq('slug', slug).eq('status', 'active').single()
  return { title: data ? `${data.name} | Quicklink` : 'Page not found | Quicklink', description: data?.tagline || 'Connect with this business through Quicklink.', ...(data?.logo_url ? {openGraph:{images:[data.logo_url]}} : {}) }
}

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: business } = await supabase.from('businesses').select('*').eq('slug', slug).eq('status', 'active').single()
  if (!business) {
    const { data: unavailable } = await supabase.rpc('is_quicklink_unavailable', { requested_slug: slug })
    if (unavailable) return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] px-6 text-center text-[#1d1d1b]"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Quicklink</p><h1 className="mt-4 text-3xl font-semibold">This page is currently unavailable.</h1><p className="mt-3 text-sm text-[#77776f]">Please check back later or contact the business directly.</p></div></main>
    notFound()
  }
  const [linksResult, featuresResult, servicesResult, promotionsResult, hoursResult, announcementsResult, galleryResult, formsResult, productsResult, preferencesResult] = await Promise.all([
    supabase.from('business_links').select('*').eq('business_id', business.id).eq('enabled', true).order('display_order'),
    supabase.from('business_features').select('*').eq('business_id', business.id).eq('enabled', true).order('display_order'),
    supabase.from('services').select('*').eq('business_id', business.id).eq('enabled', true).order('display_order'),
    supabase.from('promotions').select('*').eq('business_id', business.id).eq('enabled', true).order('display_order'),
    supabase.from('business_hours').select('*').eq('business_id', business.id).order('day_of_week'),
    supabase.from('announcements').select('*').eq('business_id', business.id).eq('enabled', true).order('display_order'),
    supabase.from('gallery_items').select('*').eq('business_id', business.id).eq('enabled', true).order('display_order'),
    supabase.from('lead_forms').select('*').eq('business_id', business.id).eq('enabled', true).order('display_order'),
    supabase.from('products').select('*').eq('business_id', business.id).eq('available', true).order('display_order'),
    // Best-effort: business_preferences ships in an additive migration. If it hasn't
    // been run yet in this environment, fall back to sane defaults instead of erroring.
    supabase.from('business_preferences').select('*').eq('business_id', business.id).maybeSingle(),
  ])
  const hubData: PublicHubData = {
    features: (featuresResult.data || []) as PublicHubData['features'], services: (servicesResult.data || []) as PublicHubData['services'],
    promotions: (promotionsResult.data || []) as PublicHubData['promotions'], hours: (hoursResult.data || []) as PublicHubData['hours'],
    announcements: (announcementsResult.data || []) as PublicHubData['announcements'], gallery: (galleryResult.data || []) as PublicHubData['gallery'],
    leadForms: (formsResult.data || []) as PublicHubData['leadForms'],
    products: (productsResult.data || []) as PublicHubData['products'],
  }

  const industry = ((preferencesResult.data as BusinessPreferences | null)?.industry || 'general') as BusinessIndustry
  const preferences: BusinessPreferences = (preferencesResult.data as BusinessPreferences | null) || {
    business_id: business.id,
    industry: 'general',
    primary_action: defaultPrimaryActionFor('general'),
    section_order: industryDefaultSectionOrder.general,
    timezone: 'America/New_York',
    service_area: null,
    fulfillment_text: null,
    products_section_title: null,
    updated_at: business.updated_at,
  }
  const openStatus = computeOpenStatus(hubData.hours, preferences.timezone || 'America/New_York')

  return <ClientPage
    business={business as Business}
    links={(linksResult.data || []) as BusinessLink[]}
    hubData={hubData}
    preferences={preferences}
    openStatus={openStatus}
  />
}
