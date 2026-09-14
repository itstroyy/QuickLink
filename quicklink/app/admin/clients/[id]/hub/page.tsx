import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import HubManager from '@/components/hub-manager'
import type { Announcement, Business, BusinessHour, GalleryItem, LeadForm, LeadSubmission, Promotion, Service } from '@/lib/types'

export default async function ServicesAndHoursPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: business }, services, promotions, hours, announcements, gallery, leadForms, leads] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('services').select('*').eq('business_id', id).order('display_order'),
    supabase.from('promotions').select('*').eq('business_id', id).order('display_order'),
    supabase.from('business_hours').select('*').eq('business_id', id).order('day_of_week'),
    supabase.from('announcements').select('*').eq('business_id', id).order('display_order'),
    supabase.from('gallery_items').select('*').eq('business_id', id).order('display_order'),
    supabase.from('lead_forms').select('*').eq('business_id', id).order('display_order'),
    supabase.from('lead_submissions').select('*').eq('business_id', id).order('created_at', { ascending: false }),
  ])
  if (!business) notFound()

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <Link href={`/admin/clients/${id}/edit`} className="inline-flex items-center gap-2 text-sm text-[#77776f]"><ArrowLeft size={16}/> Back to editor</Link>
    <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Services &amp; hours</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{(business as Business).name}</h1><p className="mt-2 text-[#77776f]">Services and weekly hours here are also used to build available booking times.</p></div>
    <div className="mt-8"><HubManager
      business={business as Business}
      services={(services.data ?? []) as Service[]}
      promotions={(promotions.data ?? []) as Promotion[]}
      hours={(hours.data ?? []) as BusinessHour[]}
      announcements={(announcements.data ?? []) as Announcement[]}
      gallery={(gallery.data ?? []) as GalleryItem[]}
      leadForms={(leadForms.data ?? []) as LeadForm[]}
      leads={(leads.data ?? []) as LeadSubmission[]}
    /></div>
  </div></main>
}
