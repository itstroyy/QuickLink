'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { LinkIcon, linkIconOptions } from '@/components/link-icon'
import { createClient } from '@/lib/supabase/client'
import { normalizeContactLink, slugify, standardLinks } from '@/lib/links'
import { themeBackgrounds, themeNames, themePresets } from '@/lib/themes'
import type { Business, BusinessLink, BusinessTheme } from '@/lib/types'

type DraftLink = Pick<BusinessLink, 'type' | 'label' | 'url' | 'icon' | 'enabled'>

const blankBusiness = {
  name: '', slug: '', tagline: '', description: '', category: '', phone: '', sms: '', email: '', address: '',
  logo_url: '', cover_url: '', theme: 'minimal' as BusinessTheme, status: 'active', background_gradient: '',
  ...themePresets.minimal,
}

export default function ClientForm({ initialBusiness, initialLinks = [], duplicateBusiness }: { initialBusiness?: Business; initialLinks?: BusinessLink[]; duplicateBusiness?: Business }) {
  const router = useRouter()
  const [business, setBusiness] = useState({ ...blankBusiness, ...(duplicateBusiness ?? {}), ...(initialBusiness ?? {}) })
  const [links, setLinks] = useState<DraftLink[]>(() => {
    const contentLinks = initialLinks.filter((link) => !['phone', 'sms', 'email'].includes(link.type))
    if (initialBusiness || duplicateBusiness) return contentLinks.map(({ type, label, url, icon, enabled }) => ({ type, label, url, icon, enabled }))
    return standardLinks.map((link) => ({ type: link.type, label: link.label, url: '', icon: link.icon, enabled: true }))
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isEditing = Boolean(initialBusiness)
  const previewLinks = links.filter((link) => link.enabled && link.url.trim()).slice(0, 4)
  const radius = business.border_radius === 'round' ? 'rounded-3xl' : business.border_radius === 'sharp' ? 'rounded-md' : 'rounded-xl'
  const logoPreview = useMemo(() => logoFile ? URL.createObjectURL(logoFile) : business.logo_url || '', [logoFile, business.logo_url])
  const coverPreview = useMemo(() => coverFile ? URL.createObjectURL(coverFile) : business.cover_url || '', [coverFile, business.cover_url])
  const previewBackground = coverPreview || themeBackgrounds[business.theme]

  function field(name: string, value: string) { setBusiness((current) => ({ ...current, [name]: value })) }
  function nameChanged(value: string) {
    setBusiness((current) => ({ ...current, name: value, slug: !current.slug || current.slug === slugify(current.name) ? slugify(value) : current.slug }))
  }
  function chooseTheme(theme: BusinessTheme) { setBusiness((current) => ({ ...current, theme, ...themePresets[theme] })) }
  function linkChanged(index: number, key: keyof DraftLink, value: string | boolean) { setLinks((current) => current.map((link, itemIndex) => itemIndex === index ? { ...link, [key]: value } : link)) }
  function moveLink(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= links.length) return
    setLinks((current) => { const copy = [...current]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy })
  }
  function addCustomLink() { setLinks((current) => [...current, { type: 'custom', label: 'Custom link', url: '', icon: 'link', enabled: true }]) }

  async function upload(file: File | null, businessId: string, kind: 'logo' | 'cover') {
    if (!file) return null
    if (file.size > 5 * 1024 * 1024) throw new Error(`${kind === 'logo' ? 'Logo' : 'Cover image'} must be smaller than 5 MB.`)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${businessId}/${kind}-${crypto.randomUUID()}.${extension}`
    const supabase = createClient()
    const { error: uploadError } = await supabase.storage.from('business-assets').upload(path, file, { cacheControl: '3600', upsert: false })
    if (uploadError) throw uploadError
    return supabase.storage.from('business-assets').getPublicUrl(path).data.publicUrl
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!business.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(business.slug)) { setError('Use only lowercase letters, numbers, and hyphens in the slug.'); return }
    setSaving(true)
    const supabase = createClient()
    try {
      const payload = {
        name: business.name.trim(), slug: business.slug, tagline: business.tagline || null, description: business.description || null,
        category: business.category || null, phone: business.phone || null, sms: business.sms || null, email: business.email || null,
        address: business.address || null, theme: business.theme, status: business.status, background_color: business.background_color,
        card_color: business.card_color, primary_color: business.primary_color, button_color: business.button_color,
        button_text_color: business.button_text_color, text_color: business.text_color, secondary_text_color: business.secondary_text_color,
        border_radius: business.border_radius, background_gradient: business.background_gradient || null,
      }
      const query = isEditing
        ? supabase.from('businesses').update(payload).eq('id', initialBusiness!.id).select().single()
        : supabase.from('businesses').insert(payload).select().single()
      const { data: saved, error: saveError } = await query
      if (saveError) throw saveError
      const logoUrl = await upload(logoFile, saved.id, 'logo')
      const coverUrl = await upload(coverFile, saved.id, 'cover')
      if (logoUrl || coverUrl) {
        const { error: imageError } = await supabase.from('businesses').update({ ...(logoUrl && { logo_url: logoUrl }), ...(coverUrl && { cover_url: coverUrl }) }).eq('id', saved.id)
        if (imageError) throw imageError
      }
      const contactLinks: DraftLink[] = [
        ...(business.phone ? [{ type: 'phone', label: 'Call us', url: normalizeContactLink('phone', business.phone), icon: 'phone', enabled: true }] : []),
        ...(business.sms ? [{ type: 'sms', label: 'Text us', url: normalizeContactLink('sms', business.sms), icon: 'sms', enabled: true }] : []),
        ...(business.email ? [{ type: 'email', label: 'Email us', url: normalizeContactLink('email', business.email), icon: 'email', enabled: true }] : []),
      ]
      const readyLinks = [...links.filter((link) => link.url.trim()), ...contactLinks]
      if (isEditing) {
        const { error: deleteError } = await supabase.from('business_links').delete().eq('business_id', saved.id)
        if (deleteError) throw deleteError
      }
      if (readyLinks.length) {
        const { error: linkError } = await supabase.from('business_links').insert(readyLinks.map((link, index) => ({ ...link, business_id: saved.id, display_order: index })))
        if (linkError) throw linkError
      }
      router.push(`/admin/clients/${saved.id}`)
      router.refresh()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to save this client.'
      setError(message.includes('businesses_slug_key') ? 'That slug is already being used.' : message)
      setSaving(false)
    }
  }

  return <main className="px-5 py-8 lg:px-10 lg:py-10">
    <div className="mx-auto max-w-6xl">
      <Link href={initialBusiness ? `/admin/clients/${initialBusiness.id}` : '/admin/clients'} className="inline-flex items-center gap-2 text-sm text-[#77776f]"><ArrowLeft size={16}/> Back to clients</Link>
      <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">{isEditing ? 'Edit client' : 'New client'}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{isEditing ? `Edit ${business.name}` : 'Create a Quicklink page'}</h1><p className="mt-2 text-[#77776f]">Everything saves to Supabase—no code or redeployment required.</p></div>
      <form onSubmit={submit} className="mt-9 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-6">
          <FormSection title="Business information"><div className="grid gap-4 sm:grid-cols-2"><TextField label="Business name" value={business.name} onChange={nameChanged} required/><TextField label="URL slug" value={business.slug} onChange={(value) => field('slug', slugify(value))} required hint={`quicklinkqr.com/${business.slug || 'business-name'}`}/><TextField label="Category" value={business.category ?? ''} onChange={(value) => field('category', value)} placeholder="Barbershop"/><TextField label="Tagline" value={business.tagline ?? ''} onChange={(value) => field('tagline', value)} placeholder="Classic cuts. Modern craft."/><div className="sm:col-span-2"><TextArea label="Description" value={business.description ?? ''} onChange={(value) => field('description', value)}/></div><TextField label="Phone" type="tel" value={business.phone ?? ''} onChange={(value) => field('phone', value)}/><TextField label="Text/SMS number" type="tel" value={business.sms ?? ''} onChange={(value) => field('sms', value)}/><TextField label="Email" type="email" value={business.email ?? ''} onChange={(value) => field('email', value)}/><TextField label="Address" value={business.address ?? ''} onChange={(value) => field('address', value)}/></div></FormSection>
          <FormSection title="Branding">
            <fieldset><legend className="text-sm font-medium">Choose a complete visual style</legend><p className="mt-1 text-xs text-[#88877f]">Each option includes a premium background, glass effects, colors and typography. A custom cover image will replace the included background.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{themeNames.map((theme) => <button key={theme} type="button" onClick={() => chooseTheme(theme)} className={`group overflow-hidden rounded-xl border-2 text-left transition ${business.theme === theme ? 'border-[#171715] shadow-lg' : 'border-transparent hover:border-[#c8c4bb]'}`} aria-pressed={business.theme === theme}><span className="relative block h-24 bg-cover bg-center" style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,.72), transparent), url(${themeBackgrounds[theme]})` }}><span className="absolute inset-x-3 bottom-2 text-xs font-semibold text-white">{themePresets[theme].label}</span></span><span className="block min-h-14 bg-[#f8f7f3] px-3 py-2 text-[10px] leading-4 text-[#77776f]">{themePresets[theme].summary}</span></button>)}</div></fieldset>
            <div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="grid gap-2 text-sm font-medium">Status<select value={business.status} onChange={(event) => field('status', event.target.value)} className="form-control"><option value="active">Active</option><option value="inactive">Inactive</option></select></label><ImageField label="Logo" file={logoFile} setFile={setLogoFile}/><ImageField label="Custom cover image" file={coverFile} setFile={setCoverFile}/></div>
            <details className="mt-5 rounded-xl border border-[#e4e2da] bg-[#fafaf7] p-4"><summary className="cursor-pointer text-sm font-semibold">Advanced color controls</summary><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><ColorField label="Background" value={business.background_color} onChange={(value) => field('background_color', value)}/><ColorField label="Card" value={business.card_color} onChange={(value) => field('card_color', value)}/><ColorField label="Accent" value={business.primary_color} onChange={(value) => field('primary_color', value)}/><ColorField label="Button" value={business.button_color} onChange={(value) => field('button_color', value)}/><ColorField label="Button text" value={business.button_text_color} onChange={(value) => field('button_text_color', value)}/><ColorField label="Main text" value={business.text_color} onChange={(value) => field('text_color', value)}/></div></details>
          </FormSection>
          <FormSection title="Links" action={<button type="button" onClick={addCustomLink} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"><Plus size={14}/> Custom link</button>}>
            <p className="mb-4 text-sm text-[#77776f]">Add the destination, choose its logo, and arrange the buttons. Zelle, Instagram, Cash App and other branded icons are built in.</p>
            <div className="grid gap-3">{links.map((link, index) => <div key={`${link.type}-${index}`} className="grid gap-2 rounded-xl border border-[#e4e2da] bg-[#fafaf7] p-3 lg:grid-cols-[180px_1fr_1.4fr_auto]">
              <label className="relative"><span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2"><LinkIcon name={link.icon || link.type} size={20}/></span><select aria-label={`${link.label} icon`} value={link.icon || 'default'} onChange={(event) => linkChanged(index, 'icon', event.target.value)} className="form-control pl-11">{linkIconOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <input aria-label="Button label" value={link.label} onChange={(event) => linkChanged(index, 'label', event.target.value)} className="form-control"/>
              <input aria-label={`${link.label} URL`} value={link.url} onChange={(event) => linkChanged(index, 'url', event.target.value)} className="form-control" placeholder={standardLinks.find((item) => item.type === link.type)?.placeholder || 'https://...'}/>
              <div className="flex items-center justify-end gap-1"><button type="button" onClick={() => moveLink(index, -1)} disabled={index === 0} className="icon-button" aria-label={`Move ${link.label} up`}><ArrowUp size={15}/></button><button type="button" onClick={() => moveLink(index, 1)} disabled={index === links.length - 1} className="icon-button" aria-label={`Move ${link.label} down`}><ArrowDown size={15}/></button>{link.type === 'custom' && <button type="button" onClick={() => setLinks((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="icon-button text-red-600" aria-label={`Delete ${link.label}`}><Trash2 size={15}/></button>}</div>
            </div>)}</div>
          </FormSection>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={saving} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-6 text-sm font-semibold text-white disabled:opacity-60">{saving ? <Loader2 size={17} className="animate-spin"/> : <Save size={17}/>} {saving ? 'Saving client…' : isEditing ? 'Save changes' : 'Create client'}</button>
        </div>
        <aside className="h-fit xl:sticky xl:top-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6b3d]">Live phone preview</p><div className="relative overflow-hidden rounded-[2.25rem] border-[7px] border-[#111] bg-cover bg-center text-white shadow-xl" style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,.35), rgba(0,0,0,.82)), url(${JSON.stringify(previewBackground)})` }}><div className="h-5 bg-black/70"/><div className="px-5 pb-7 pt-7 text-center"><div className={`mx-auto flex size-24 items-center justify-center overflow-hidden border-4 text-xl font-semibold shadow-[0_0_25px_rgba(255,255,255,.18)] ${radius}`} style={{ backgroundColor: business.primary_color, borderColor: '#ffffffcc', color: business.button_text_color }}>{logoPreview ? <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover"/> : business.name.slice(0, 2).toUpperCase() || 'QL'}</div><p className="mt-4 text-[9px] font-semibold uppercase tracking-[.22em]" style={{ color: business.primary_color }}>{themePresets[business.theme].label}</p><h2 className="mt-1 text-2xl font-semibold">{business.name || 'Your business'}</h2><p className="mt-1 text-xs text-white/70">{business.tagline || 'Your tagline goes here.'}</p><div className="mt-6 grid gap-2">{(previewLinks.length ? previewLinks : [{ label: 'Your first link', icon: 'link' }, { label: 'Another action', icon: 'instagram' }]).map((link, index) => <div key={`${link.label}-${index}`} className={`flex items-center gap-3 border border-white/20 bg-black/50 px-3 py-2.5 text-left text-xs font-semibold text-white backdrop-blur ${radius}`}><LinkIcon name={'icon' in link ? link.icon : 'link'} size={20}/>{link.label}</div>)}</div><p className="mt-6 text-center text-[9px] text-white/55">powered by Quicklink</p></div></div></aside>
      </form>
    </div>
  </main>
}

function FormSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-semibold">{title}</h2>{action}</div>{children}</section> }
function TextField({ label, value, onChange, required, type = 'text', placeholder, hint }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string; hint?: string }) { return <label className="grid gap-2 text-sm font-medium">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="form-control"/>{hint && <span className="text-xs font-normal text-[#999991]">{hint}</span>}</label> }
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-medium">{label}<textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="form-control resize-y"/></label> }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="grid gap-2 text-sm font-medium">{label}<div className="flex items-center gap-2 rounded-xl border border-[#d9d9d3] bg-white p-2"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-8 cursor-pointer rounded border-0 bg-transparent p-0"/><input value={value} onChange={(event) => onChange(event.target.value)} pattern="#[0-9a-fA-F]{6}" className="min-w-0 flex-1 bg-transparent text-xs uppercase outline-none"/></div></label> }
function ImageField({ label, file, setFile }: { label: string; file: File | null; setFile: (file: File | null) => void }) { return <label className="grid cursor-pointer gap-2 text-sm font-medium">{label}<span className="flex min-h-11 items-center gap-2 rounded-xl border border-dashed border-[#c9c7be] px-3 text-sm font-normal text-[#77776f]"><ImagePlus size={17}/>{file ? file.name : 'Choose image (max 5 MB)'}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="sr-only"/></label> }
