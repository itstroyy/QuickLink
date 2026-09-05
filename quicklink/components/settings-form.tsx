'use client'

import { useState } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { themeNames, themePresets } from '@/lib/themes'
import type { SiteSettings } from '@/lib/types'

export default function SettingsForm({ initial }: { initial: SiteSettings }) {
  const [settings, setSettings] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  function field(name: keyof SiteSettings, value: string) { setSettings((current) => ({ ...current, [name]: value })) }
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(''); setSaved(false); const { id, ...payload } = settings; const { error: updateError } = await createClient().from('site_settings').update(payload).eq('id', id); setSaving(false); if (updateError) setError(updateError.message); else setSaved(true) }
  return <form onSubmit={submit} className="mt-8 grid max-w-2xl gap-6 rounded-2xl border border-[#deded7] bg-white p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Business name<input className="form-control" value={settings.business_name} onChange={(event) => field('business_name', event.target.value)}/></label><label className="grid gap-2 text-sm font-medium">Main domain<input className="form-control" value={settings.main_domain} onChange={(event) => field('main_domain', event.target.value)}/></label><label className="grid gap-2 text-sm font-medium sm:col-span-2">Default client theme<select className="form-control" value={settings.default_theme} onChange={(event) => field('default_theme', event.target.value)}>{themeNames.map((theme) => <option key={theme} value={theme}>{themePresets[theme].label}</option>)}</select></label></div><div><h2 className="text-sm font-semibold">Default colors</h2><div className="mt-3 grid gap-3 sm:grid-cols-3"><Color label="Background" value={settings.default_background_color} onChange={(value) => field('default_background_color', value)}/><Color label="Accent" value={settings.default_primary_color} onChange={(value) => field('default_primary_color', value)}/><Color label="Button" value={settings.default_button_color} onChange={(value) => field('default_button_color', value)}/><Color label="Button text" value={settings.default_button_text_color} onChange={(value) => field('default_button_text_color', value)}/><Color label="Text" value={settings.default_text_color} onChange={(value) => field('default_text_color', value)}/></div></div>{error && <p className="text-sm text-red-700">{error}</p>}{saved && <p className="flex items-center gap-2 text-sm text-green-700"><Check size={16}/> Settings saved.</p>}<button disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] text-sm font-semibold text-white">{saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Save settings</button></form>
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-2 text-xs font-medium">{label}<div className="flex items-center gap-2 rounded-xl border p-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-8"/><input value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 flex-1 text-xs uppercase outline-none"/></div></label> }
