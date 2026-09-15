'use client'

import { useState } from 'react'
import { ImagePlus, Loader2, Save } from 'lucide-react'
import { useFeedback } from '@/components/feedback-provider'
import { createClient } from '@/lib/supabase/client'
import type { Business, BusinessTheme } from '@/lib/types'
import { mutationErrorMessage, reportClientMutationError } from '@/lib/client-errors'

const themes: BusinessTheme[] = ['minimal', 'luxury', 'dark', 'beauty', 'automotive']

// Business profile + appearance for the owner dashboard. Every field here is
// editable by a business member under RLS — the protect_owner_columns
// trigger (202609140001_business_membership.sql) only blocks id, slug,
// status and created_at, which this form never touches.
export default function BusinessProfileForm({ business: initial }: { business: Business }) {
  const [business, setBusiness] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'cover' | ''>('')
  const notify = useFeedback()
  const supabase = createClient()

  function set<K extends keyof Business>(key: K, value: Business[K]) { setBusiness((current) => ({ ...current, [key]: value })) }

  async function save() {
    setSaving(true)
    try {
      const { id, slug, status, created_at, updated_at, ...editable } = business
      const { error } = await supabase.from('businesses').update(editable).eq('id', id)
      if (error) throw error
      notify('Business profile saved.')
    } catch (error) { reportClientMutationError('save business profile', error); notify(mutationErrorMessage('save your profile', error), 'error') }
    finally { setSaving(false) }
  }

  async function upload(kind: 'logo' | 'cover', file: File) {
    if (file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { notify('Choose a PNG, JPEG or WebP image under 5 MB.', 'error'); return }
    setUploading(kind)
    try {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${business.id}/${kind}-${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('business-assets').upload(path, file)
      if (uploadError) throw uploadError
      const url = supabase.storage.from('business-assets').getPublicUrl(path).data.publicUrl
      const field = kind === 'logo' ? 'logo_url' : 'cover_url'
      const { error } = await supabase.from('businesses').update({ [field]: url }).eq('id', business.id)
      if (error) throw error
      set(field, url)
      notify(`${kind === 'logo' ? 'Logo' : 'Cover image'} updated.`)
    } catch (error) { reportClientMutationError(`upload business ${kind}`, error); notify(mutationErrorMessage('upload this image', error), 'error') }
    finally { setUploading('') }
  }

  return <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
    <h2 className="font-semibold">Business profile &amp; appearance</h2>
    <p className="mt-1 text-xs text-[#77776f]">What customers see at the top of your public page.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label="Business name"><input className="form-control" value={business.name} onChange={(event) => set('name', event.target.value)}/></Field>
      <Field label="Category"><input className="form-control" value={business.category || ''} onChange={(event) => set('category', event.target.value)}/></Field>
      <Field label="Tagline"><input className="form-control" value={business.tagline || ''} onChange={(event) => set('tagline', event.target.value)}/></Field>
      <Field label="Phone"><input className="form-control" value={business.phone || ''} onChange={(event) => set('phone', event.target.value)}/></Field>
      <Field label="Text (SMS)"><input className="form-control" value={business.sms || ''} onChange={(event) => set('sms', event.target.value)}/></Field>
      <Field label="Public email"><input className="form-control" type="email" value={business.email || ''} onChange={(event) => set('email', event.target.value)}/></Field>
      <Field label="Address"><input className="form-control" value={business.address || ''} onChange={(event) => set('address', event.target.value)}/></Field>
      <Field label="Theme"><select className="form-control" value={business.theme} onChange={(event) => set('theme', event.target.value as BusinessTheme)}>{themes.map((theme) => <option key={theme} value={theme}>{theme[0].toUpperCase() + theme.slice(1)}</option>)}</select></Field>
      <Field label="Accent color"><input className="form-control h-11" type="color" value={business.primary_color} onChange={(event) => set('primary_color', event.target.value)}/></Field>
    </div>
    <Field label="Description"><textarea className="form-control mt-1" rows={3} value={business.description || ''} onChange={(event) => set('description', event.target.value)}/></Field>
    <div className="mt-4 flex flex-wrap gap-3">
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8d6ce] bg-[#fafaf7] px-3.5 py-2.5 text-xs font-medium text-[#77776f]">{business.logo_url && <img src={business.logo_url} alt="" className="size-7 rounded-md object-cover"/>}<ImagePlus size={14}/>{uploading === 'logo' ? 'Uploading…' : business.logo_url ? 'Replace logo' : 'Add logo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => event.target.files?.[0] && upload('logo', event.target.files[0])}/></label>
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#d8d6ce] bg-[#fafaf7] px-3.5 py-2.5 text-xs font-medium text-[#77776f]">{business.cover_url && <img src={business.cover_url} alt="" className="h-7 w-12 rounded-md object-cover"/>}<ImagePlus size={14}/>{uploading === 'cover' ? 'Uploading…' : business.cover_url ? 'Replace cover' : 'Add cover'}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => event.target.files?.[0] && upload('cover', event.target.files[0])}/></label>
    </div>
    <button type="button" disabled={saving} onClick={save} className="dashboard-primary mt-5 inline-flex items-center gap-2 sm:w-fit">{saving ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>} Save profile</button>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]"><span>{label}</span>{children}</label> }
