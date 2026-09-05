import ClientForm from '@/components/client-form'
import { createClient } from '@/lib/supabase/server'
import type { Business, BusinessLink } from '@/lib/types'

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ duplicate?: string }> }) {
  const { duplicate } = await searchParams
  if (!duplicate) return <ClientForm/>
  const supabase = await createClient()
  const [{ data: source }, { data: links }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', duplicate).single(),
    supabase.from('business_links').select('*').eq('business_id', duplicate).order('display_order'),
  ])
  if (!source) return <ClientForm/>
  const duplicateDraft = { ...source, id: '', name: '', slug: '', logo_url: null, status: 'inactive' } as Business
  return <ClientForm initialBusiness={undefined} initialLinks={(links ?? []) as BusinessLink[]} duplicateBusiness={duplicateDraft}/>
}
