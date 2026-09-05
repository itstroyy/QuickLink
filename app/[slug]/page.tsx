import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientPage from '@/components/client-page'
import type { Business, BusinessLink } from '@/lib/types'
import { logSupabaseError, throwSupabaseError } from '@/lib/supabase/config'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data, error } = await supabase.from('businesses').select('name, tagline, logo_url').eq('slug', slug).eq('status', 'active').maybeSingle()
  if (error) logSupabaseError('public-page-metadata', error, { slug })
  return { title: data ? `${data.name} | Quicklink` : 'Page not found | Quicklink', description: data?.tagline || 'Connect with this business through Quicklink.', ...(data?.logo_url ? {openGraph:{images:[data.logo_url]}} : {}) }
}

export default async function BusinessPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: business, error: businessError } = await supabase.from('businesses').select('*').eq('slug', slug).eq('status', 'active').maybeSingle()
  if (businessError) throwSupabaseError('public-business-lookup', businessError, { slug })
  if (!business) {
    const { data: unavailable, error: unavailableError } = await supabase.rpc('is_quicklink_unavailable', { requested_slug: slug })
    if (unavailableError) throwSupabaseError('public-business-availability', unavailableError, { slug })
    if (unavailable) return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] px-6 text-center text-[#1d1d1b]"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Quicklink</p><h1 className="mt-4 text-3xl font-semibold">This page is currently unavailable.</h1><p className="mt-3 text-sm text-[#77776f]">Please check back later or contact the business directly.</p></div></main>
    notFound()
  }
  const { data: links, error: linksError } = await supabase.from('business_links').select('*').eq('business_id', business.id).eq('enabled', true).order('display_order')
  if (linksError) throwSupabaseError('public-business-links', linksError, { slug, businessId: business.id })
  return <ClientPage business={business as Business} links={(links || []) as BusinessLink[]} />
}
