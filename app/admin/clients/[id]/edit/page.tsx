import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientForm from '@/components/client-form'
import type { Business, BusinessLink } from '@/lib/types'
import { throwSupabaseError } from '@/lib/supabase/config'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: business, error: businessError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).maybeSingle(),
    supabase.from('business_links').select('*').eq('business_id', id).order('display_order'),
  ])
  if (businessError) throwSupabaseError('admin-client-edit', businessError, { businessId: id })
  if (linksError) throwSupabaseError('admin-client-edit-links', linksError, { businessId: id })
  if (!business) notFound()
  return <ClientForm initialBusiness={business as Business} initialLinks={(links ?? []) as BusinessLink[]}/>
}
