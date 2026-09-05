import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientPage from '@/components/client-page'
import type { Business, BusinessLink } from '@/lib/types'

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
  const { data: links } = await supabase.from('business_links').select('*').eq('business_id', business.id).eq('enabled', true).order('display_order')
  return <ClientPage business={business as Business} links={(links || []) as BusinessLink[]} />
}
