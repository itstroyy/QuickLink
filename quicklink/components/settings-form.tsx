'use client'

import { useState } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { useFeedback } from '@/components/feedback-provider'
import { createClient } from '@/lib/supabase/client'
import { themeNames, themePresets } from '@/lib/themes'
import { timezoneOptions } from '@/lib/timezones'
import type { SiteSettings } from '@/lib/types'

export default function SettingsForm({ initial, health }: { initial: SiteSettings; health: Record<string,string|boolean> }) {
  const notify = useFeedback()
  const [settings, setSettings] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  function field(name: keyof SiteSettings, value: string) { setSettings((current) => ({ ...current, [name]: value })) }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setSaved(false)
    const { id, ...payload } = settings
    const { error: updateError } = await createClient().from('site_settings').update(payload).eq('id', id)
    setSaving(false)
    if (updateError) setError('Could not save platform settings. Please try again.')
    else { setSaved(true); notify('Settings saved.') }
  }
  return <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
    <form onSubmit={submit} className="grid gap-6 rounded-2xl border border-[#deded7] bg-white p-6">
      <section><h2 className="font-semibold">Platform identity</h2><div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Quicklink name"><input className="form-control" value={settings.business_name} onChange={(event) => field('business_name', event.target.value)}/></Field>
        <Field label="Canonical domain"><input className="form-control" value={settings.main_domain} onChange={(event) => field('main_domain', event.target.value)}/></Field>
        <Field label="Support email"><input className="form-control" type="email" value={settings.support_email||''} onChange={(event) => field('support_email', event.target.value)}/></Field>
        <Field label="Default currency"><input className="form-control uppercase" maxLength={3} value={settings.default_currency} onChange={(event) => field('default_currency', event.target.value.toLowerCase())}/></Field>
        <Field label="Default timezone"><select className="form-control" value={settings.default_timezone} onChange={(event)=>field('default_timezone',event.target.value)}>{!timezoneOptions.some((item)=>item.value===settings.default_timezone)&&<option value={settings.default_timezone}>{settings.default_timezone}</option>}{timezoneOptions.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
        <Field label="Email sender name"><input className="form-control" value={settings.email_sender_name} onChange={(event) => field('email_sender_name', event.target.value)}/></Field>
        <Field label="Reply-to email"><input className="form-control" type="email" value={settings.email_reply_to||''} onChange={(event) => field('email_reply_to', event.target.value)}/></Field>
        <label className="grid gap-2 text-sm font-medium sm:col-span-2">Default client theme<select className="form-control" value={settings.default_theme} onChange={(event) => field('default_theme', event.target.value)}>{themeNames.map((theme) => <option key={theme} value={theme}>{themePresets[theme].label}</option>)}</select></label>
      </div></section>
      <section><h2 className="text-sm font-semibold">Default colors</h2><div className="mt-3 grid gap-3 sm:grid-cols-3"><Color label="Background" value={settings.default_background_color} onChange={(value) => field('default_background_color', value)}/><Color label="Accent" value={settings.default_primary_color} onChange={(value) => field('default_primary_color', value)}/><Color label="Button" value={settings.default_button_color} onChange={(value) => field('default_button_color', value)}/><Color label="Button text" value={settings.default_button_text_color} onChange={(value) => field('default_button_text_color', value)}/><Color label="Text" value={settings.default_text_color} onChange={(value) => field('default_text_color', value)}/></div></section>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}{saved&&<p className="flex items-center gap-2 text-sm text-green-700"><Check size={16}/>Settings saved.</p>}
      <button disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] text-sm font-semibold text-white">{saving?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>}Save settings</button>
    </form>
    <aside className="self-start rounded-2xl border bg-white p-6"><h2 className="font-semibold">Configuration health</h2><div className="mt-4 grid gap-2">{Object.entries(health).map(([key,value])=><div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-[#fafaf7] px-3 py-2 text-sm"><span className="capitalize text-[#77776f]">{key.replace(/([A-Z])/g,' $1').replaceAll('_',' ')}</span><strong className={value===false?'text-amber-700':'text-emerald-700'}>{typeof value==='boolean'?(value?'Configured':'Needs setup'):value}</strong></div>)}</div><p className="mt-4 text-xs leading-5 text-[#77776f]">Secret values are never displayed. Stripe customer payments use no Quicklink platform fee.</p></aside>
  </div>
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="grid gap-2 text-sm font-medium">{label}{children}</label> }
function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-2 text-xs font-medium">{label}<div className="flex items-center gap-2 rounded-xl border p-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-8"/><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 text-xs uppercase outline-none"/></div></label> }
