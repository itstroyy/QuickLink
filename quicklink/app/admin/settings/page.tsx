import { createClient } from '@/lib/supabase/server'
import SettingsForm from '@/components/settings-form'
import type { SiteSettings } from '@/lib/types'

const defaults: SiteSettings = { id: 1, business_name: 'Quicklink', main_domain: 'quicklink.host', default_theme: 'minimal', default_background_color: '#f4f3ef', default_primary_color: '#b48352', default_button_color: '#ffffff', default_button_text_color: '#1d1d1b', default_text_color: '#1d1d1b', support_email:null, default_timezone:'America/New_York', default_currency:'usd', email_sender_name:'Quicklink', email_reply_to:null }

export default async function SettingsPage() {
  const { data } = await (await createClient()).from('site_settings').select('*').eq('id', 1).single()
  const health={supabase:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY),resend:Boolean(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM),stripe:Boolean(process.env.STRIPE_SECRET_KEY),stripeWebhook:Boolean(process.env.STRIPE_WEBHOOK_SECRET),calendar:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),productionUrl:process.env.NEXT_PUBLIC_SITE_URL||'Not configured'}
  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Platform</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Settings</h1><p className="mt-2 text-[#77776f]">Brand, defaults, transactional services and production configuration health.</p><SettingsForm initial={(data ?? defaults) as SiteSettings} health={health}/></div></main>
}
