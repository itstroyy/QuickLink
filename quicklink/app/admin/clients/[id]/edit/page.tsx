import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientForm from '@/components/client-form'
import InlineBusinessFeatures from '@/components/inline-business-features'
import { loadCommerceData } from '@/lib/commerce-data'
import { getClientAccess } from '@/lib/client-access'
import type { Business, BusinessLink } from '@/lib/types'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: business }, { data: links }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('business_links').select('*').eq('business_id', id).order('display_order'),
  ])
  if (!business) notFound()
  const commerce = await loadCommerceData(id, business.phone)
  const clientAccess = await getClientAccess(supabase, id)
  return <ClientForm initialBusiness={business as Business} initialLinks={(links ?? []) as BusinessLink[]} businessFeatures={<InlineBusinessFeatures businessId={id} businessSlug={(business as Business).slug} data={commerce} initialClientAccess={clientAccess}/>}/>
}
