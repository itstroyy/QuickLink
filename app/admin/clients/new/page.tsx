import ClientForm from '@/components/client-form'
import { createClient } from '@/lib/supabase/server'
import type { Business, BusinessLink } from '@/lib/types'
import { throwSupabaseError } from '@/lib/supabase/config'

export default async function NewClientPage({ searchParams }: { searchParams: Promise<{ duplicate?: string }> }) {
  const { duplicate } = await searchParams
  if (!duplicate) return <ClientForm/>
  const supabase = await createClient()
  const [{ data: source, error: sourceError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from('businesses').select('*').eq('id', duplicate).maybeSingle(),
    supabase.from('business_links').select('*').eq('business_id', duplicate).order('display_order'),
  ])
  if (sourceError) throwSupabaseError('admin-client-duplicate', sourceError, { businessId: duplicate })
  if (linksError) throwSupabaseError('admin-client-duplicate-links', linksError, { businessId: duplicate })
  if (!source) return <ClientForm/>
  const duplicateDraft = { ...source, id: '', name: '', slug: '', logo_url: null, status: 'inactive' } as Business
  return <ClientForm initialBusiness={undefined} initialLinks={(links ?? []) as BusinessLink[]} duplicateBusiness={duplicateDraft}/>
}
