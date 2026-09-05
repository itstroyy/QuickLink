import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ClientForm from '@/components/client-form'
import type { Business, BusinessLink } from '@/lib/types'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: business }, { data: links }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', id).single(),
    supabase.from('business_links').select('*').eq('business_id', id).order('display_order'),
  ])
  if (!business) notFound()
  return <ClientForm initialBusiness={business as Business} initialLinks={(links ?? []) as BusinessLink[]}/>
}
