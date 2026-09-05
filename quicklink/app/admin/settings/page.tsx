import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/settings-form'
import type { SiteSettings } from '@/lib/types'

const defaults: SiteSettings = { id: 1, business_name: 'Quicklink', main_domain: 'quicklinkqr.com', default_theme: 'minimal', default_background_color: '#f4f3ef', default_primary_color: '#b48352', default_button_color: '#ffffff', default_button_text_color: '#1d1d1b', default_text_color: '#1d1d1b' }

export default async function SettingsPage() {
  const { data } = await (await createClient()).from('site_settings').select('*').eq('id', 1).single()
  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Workspace preferences</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Settings</h1><p className="mt-2 text-[#77776f]">Defaults for new Quicklink pages and your public domain.</p><SettingsForm initial={(data ?? defaults) as SiteSettings}/><div className="mt-6 max-w-2xl rounded-2xl border border-dashed border-[#c9c7be] p-5"><h2 className="text-sm font-semibold">Ready for later</h2><p className="mt-2 text-sm leading-6 text-[#77776f]">Client accounts, subscriptions, custom domains, and automated review requests can be added here when the core service is established.</p></div></div></main>
}
