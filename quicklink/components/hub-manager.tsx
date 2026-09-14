'use client'

import { useState } from 'react'
import { ImagePlus, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Announcement, Business, BusinessHour, GalleryItem, LeadForm, LeadSubmission, Promotion, Service } from '@/lib/types'

type HubProps = { business: Business; services: Service[]; promotions: Promotion[]; hours: BusinessHour[]; announcements: Announcement[]; gallery: GalleryItem[]; leadForms: LeadForm[]; leads: LeadSubmission[] }
const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const sectionStyle = 'rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6'
const buttonStyle = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d8d6ce] bg-white px-4 text-sm font-semibold disabled:opacity-50'

// Trimmed down to the main modules for now. Announcements and Lead forms are
// fully implemented (data, API, RLS all still in place) — just hidden here.
// Flip these back to true, or add 'announcements'/'contact_form' back to
// this set, to bring them back into view without touching any other code.
const SHOW_ANNOUNCEMENTS = false
const SHOW_LEAD_FORMS = false

export default function HubManager(props: HubProps) {
  const [services, setServices] = useState(props.services)
  const [promotions, setPromotions] = useState(props.promotions)
  const [hours, setHours] = useState(props.hours)
  const [announcements, setAnnouncements] = useState(props.announcements)
  const [gallery, setGallery] = useState(props.gallery)
  const [leadForms, setLeadForms] = useState(props.leadForms)
  const [leads, setLeads] = useState(props.leads)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const supabase = createClient()
  async function saveRow(table: string, row: Record<string, unknown>, setter: (value: any) => void, items: Array<{ id: string }>) {
    setBusy(`${table}-${row.id}`); setMessage('')
    const payload = { ...row, business_id: props.business.id }
    const { data, error } = await supabase.from(table).upsert(payload).select().single()
    if (error) setMessage(error.message); else setter([...items.filter((item) => item.id !== row.id), data])
    setBusy('')
  }

  async function deleteRow(table: string, id: string, setter: (value: any) => void, items: Array<{ id: string }>) {
    if (!window.confirm('Remove this item?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) setMessage(error.message); else setter(items.filter((item) => item.id !== id))
  }

  async function uploadGallery(file: File) {
    if (file.size > 5 * 1024 * 1024) { setMessage('Image must be smaller than 5 MB.'); return }
    setBusy('gallery-upload')
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${props.business.id}/gallery-${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('business-assets').upload(path, file, { cacheControl: '3600' })
    if (uploadError) setMessage(uploadError.message)
    else {
      const image_url = supabase.storage.from('business-assets').getPublicUrl(path).data.publicUrl
      const { data, error } = await supabase.from('gallery_items').insert({ business_id: props.business.id, image_url, caption: '', enabled: true, display_order: gallery.length }).select().single()
      if (error) setMessage(error.message); else setGallery([...gallery, data as GalleryItem])
    }
    setBusy('')
  }

  async function uploadItemImage(kind: 'service' | 'offer', id: string, file: File) {
    if (file.size > 5 * 1024 * 1024) { setMessage('Image must be smaller than 5 MB.'); return }
    setBusy(`${kind}-image-${id}`); setMessage('')
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${props.business.id}/${kind}-${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('business-assets').upload(path, file, { cacheControl: '3600' })
    if (uploadError) { setMessage(uploadError.message); setBusy(''); return }
    const image_url = supabase.storage.from('business-assets').getPublicUrl(path).data.publicUrl
    if (kind === 'service') {
      const row = services.find((item) => item.id === id)
      if (row) {
        const next = { ...row, image_url }
        const { error } = await supabase.from('services').upsert(next)
        if (error) setMessage(error.message); else setServices(services.map((item) => item.id === id ? next : item))
      }
    } else {
      const row = promotions.find((item) => item.id === id)
      if (row) {
        const next = { ...row, image_url }
        const { error } = await supabase.from('promotions').upsert(next)
        if (error) setMessage(error.message); else setPromotions(promotions.map((item) => item.id === id ? next : item))
      }
    }
    setBusy('')
  }

  function addService() { setServices([...services, { id: crypto.randomUUID(), business_id: props.business.id, name: 'New service', description: '', category: '', price_cents: null, duration_minutes: null, deposit_cents: null, image_url: null, enabled: true, bookable: true, display_order: services.length }]) }
  function addPromotion() { setPromotions([...promotions, { id: crypto.randomUUID(), business_id: props.business.id, title: 'New offer', description: '', badge: '', promo_code: '', image_url: null, starts_at: null, ends_at: null, enabled: true, display_order: promotions.length, action_type: 'none', action_value: null, cta_label: null }]) }
  function addAnnouncement() { setAnnouncements([...announcements, { id: crypto.randomUUID(), business_id: props.business.id, title: 'New announcement', body: '', starts_at: null, ends_at: null, enabled: true, display_order: announcements.length }]) }
  function addLeadForm() { setLeadForms([...leadForms, { id: crypto.randomUUID(), business_id: props.business.id, title: 'Contact us', description: 'Tell us what you need and we will get back to you.', cta_label: 'Send request', fields: ['name','phone','email','message'], enabled: true, display_order: leadForms.length }]) }

  return <div className="grid gap-6">
    {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
    <section id="services" className={sectionStyle}><Heading title="Services" subtitle="Build the public service catalog and choose which active services can be booked. Payments and deposits are not required." action={<button onClick={addService} className={buttonStyle}><Plus size={15}/> Add service</button>}/><div className="grid gap-3">{services.sort((a,b) => a.display_order-b.display_order).map((row) => <EditorRow key={row.id} onSave={() => saveRow('services', row as unknown as Record<string, unknown>, setServices, services)} onDelete={() => deleteRow('services', row.id, setServices, services)} busy={busy === `services-${row.id}`}><label className="grid gap-1 text-xs font-semibold text-[#55554f]">Service name<input className="form-control" value={row.name} onChange={(e) => setServices(services.map((x) => x.id === row.id ? {...x,name:e.target.value}:x))} placeholder="Service name"/></label><label className="grid gap-1 text-xs font-semibold text-[#55554f]">Description<input className="form-control" value={row.description || ''} onChange={(e) => setServices(services.map((x) => x.id === row.id ? {...x,description:e.target.value}:x))} placeholder="Short description"/></label><div className="grid grid-cols-2 gap-2"><label className="grid gap-1 text-xs font-semibold text-[#55554f]">Price<input className="form-control" type="number" min="0" step="0.01" value={row.price_cents == null ? '' : row.price_cents / 100} onChange={(e) => setServices(services.map((x) => x.id === row.id ? {...x,price_cents:e.target.value ? Math.round(Number(e.target.value)*100):null}:x))} placeholder="Optional"/></label><label className="grid gap-1 text-xs font-semibold text-[#55554f]">Duration<input className="form-control" type="number" min="1" value={row.duration_minutes || ''} onChange={(e) => setServices(services.map((x) => x.id === row.id ? {...x,duration_minutes:e.target.value ? Number(e.target.value):null}:x))} placeholder="Minutes"/></label><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={row.enabled} onChange={(e)=>setServices(services.map((x)=>x.id===row.id?{...x,enabled:e.target.checked}:x))}/> Active</label><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={row.bookable !== false} onChange={(e)=>setServices(services.map((x)=>x.id===row.id?{...x,bookable:e.target.checked}:x))}/> Available for booking</label><label className="col-span-2 flex cursor-pointer items-center gap-2 border-t pt-2 text-xs font-medium text-[#77776f]">{row.image_url&&<img src={row.image_url} alt="" className="size-8 rounded-lg object-cover"/>}<ImagePlus size={14}/>{busy===`service-image-${row.id}`?'Uploading…':row.image_url?'Replace service image':'Add service image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e)=>e.target.files?.[0]&&uploadItemImage('service',row.id,e.target.files[0])}/></label></div></EditorRow>)}{services.length === 0 && <Empty text="No services yet."/>}</div></section>

    <section id="offers" className={sectionStyle}><Heading title="Special offers" subtitle="Publish honest promotions with optional codes and an action button." action={<button onClick={addPromotion} className={buttonStyle}><Plus size={15}/> Add offer</button>}/><div className="grid gap-3">{promotions.map((row) => <EditorRow key={row.id} onSave={() => saveRow('promotions', row as unknown as Record<string, unknown>, setPromotions, promotions)} onDelete={() => deleteRow('promotions', row.id, setPromotions, promotions)} busy={busy === `promotions-${row.id}`}>
      <input className="form-control" value={row.title} onChange={(e) => setPromotions(promotions.map((x) => x.id === row.id ? {...x,title:e.target.value}:x))} placeholder="Offer title"/>
      <input className="form-control" value={row.description || ''} onChange={(e) => setPromotions(promotions.map((x) => x.id === row.id ? {...x,description:e.target.value}:x))} placeholder="Description"/>
      <div className="grid grid-cols-2 gap-2"><input className="form-control" value={row.badge || ''} onChange={(e) => setPromotions(promotions.map((x) => x.id === row.id ? {...x,badge:e.target.value}:x))} placeholder="Badge, e.g. Limited"/><input className="form-control" value={row.promo_code || ''} onChange={(e) => setPromotions(promotions.map((x) => x.id === row.id ? {...x,promo_code:e.target.value}:x))} placeholder="Promo code"/></div>
      <div className="grid gap-2 md:col-span-3 md:grid-cols-4">
        <select className="form-control" aria-label="Offer action" value={row.action_type} onChange={(e) => setPromotions(promotions.map((x) => x.id === row.id ? {...x,action_type:e.target.value as typeof x.action_type,action_value:null}:x))}>
          <option value="none">No action (display only)</option>
          <option value="order_now">Order Now</option>
          <option value="booking">Booking</option>
          <option value="request_service">Request Service</option>
          <option value="external_link">External Link</option>
          <option value="call">Call</option>
          <option value="text">Text</option>
        </select>
        {row.action_type === 'booking' && <select className="form-control" aria-label="Related service" value={row.action_value || ''} onChange={(e) => setPromotions(promotions.map((x) => x.id === row.id ? {...x,action_value:e.target.value || null}:x))}>
          <option value="">Any service</option>{services.filter((service)=>service.enabled&&service.bookable!==false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>}
        {row.action_type === 'external_link' && <input className="form-control" value={row.action_value || ''} onChange={(e) => setPromotions(promotions.map((x) => x.id === row.id ? {...x,action_value:e.target.value}:x))} placeholder="https://…"/>}
        {(row.action_type === 'call' || row.action_type === 'text') && <input className="form-control" value={row.action_value || ''} onChange={(e) => setPromotions(promotions.map((x) => x.id === row.id ? {...x,action_value:e.target.value}:x))} placeholder="+15551234567"/>}
        {row.action_type !== 'none' && <input className="form-control" value={row.cta_label || ''} onChange={(e) => setPromotions(promotions.map((x) => x.id === row.id ? {...x,cta_label:e.target.value}:x))} placeholder="Button text, e.g. Claim Deal"/>}
        <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#d8d6ce] bg-white px-3 text-xs font-medium text-[#77776f]">{row.image_url&&<img src={row.image_url} alt="" className="size-7 rounded-md object-cover"/>}<ImagePlus size={14}/>{busy===`offer-image-${row.id}`?'Uploading…':row.image_url?'Replace image':'Add offer image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e)=>e.target.files?.[0]&&uploadItemImage('offer',row.id,e.target.files[0])}/></label>
      </div>
    </EditorRow>)}{promotions.length === 0 && <Empty text="No offers yet."/>}</div></section>

    <section id="hours" className={sectionStyle}><Heading title="Business hours" subtitle="Set a reliable weekly schedule."/><div className="grid gap-2">{days.map((day, index) => { const row = hours.find((item) => item.day_of_week === index) || { id: crypto.randomUUID(), business_id: props.business.id, day_of_week: index, open_time: '09:00', close_time: '17:00', closed: index === 0 }; return <div key={day} className="grid items-center gap-2 rounded-xl border border-[#e4e2da] p-3 sm:grid-cols-[120px_1fr_1fr_auto_auto]"><strong className="text-sm">{day}</strong><input type="time" className="form-control" value={row.open_time?.slice(0,5) || ''} disabled={row.closed} onChange={(e) => setHours([...hours.filter((x) => x.day_of_week !== index), {...row,open_time:e.target.value}])}/><input type="time" className="form-control" value={row.close_time?.slice(0,5) || ''} disabled={row.closed} onChange={(e) => setHours([...hours.filter((x) => x.day_of_week !== index), {...row,close_time:e.target.value}])}/><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={row.closed} onChange={(e) => setHours([...hours.filter((x) => x.day_of_week !== index), {...row,closed:e.target.checked}])}/> Closed</label><button className="icon-button" onClick={() => saveRow('business_hours', row as unknown as Record<string, unknown>, setHours, hours)} aria-label={`Save ${day}`}><Save size={15}/></button></div>})}</div></section>

    {SHOW_ANNOUNCEMENTS && <section id="announcements" className={sectionStyle}><Heading title="Announcements" subtitle="Closures, events and important updates." action={<button onClick={addAnnouncement} className={buttonStyle}><Plus size={15}/> Add announcement</button>}/><div className="grid gap-3">{announcements.map((row) => <EditorRow key={row.id} onSave={() => saveRow('announcements', row as unknown as Record<string, unknown>, setAnnouncements, announcements)} onDelete={() => deleteRow('announcements', row.id, setAnnouncements, announcements)} busy={busy === `announcements-${row.id}`}><input className="form-control" value={row.title} onChange={(e) => setAnnouncements(announcements.map((x) => x.id === row.id ? {...x,title:e.target.value}:x))}/><textarea className="form-control" rows={2} value={row.body || ''} onChange={(e) => setAnnouncements(announcements.map((x) => x.id === row.id ? {...x,body:e.target.value}:x))} placeholder="Details"/></EditorRow>)}{announcements.length === 0 && <Empty text="No announcements yet."/>}</div></section>}

    <section id="gallery" className={sectionStyle}><Heading title="Gallery" subtitle="Upload real business work or product photos." action={<label className={`${buttonStyle} cursor-pointer`}><ImagePlus size={15}/>{busy === 'gallery-upload' ? 'Uploading…' : 'Upload image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && uploadGallery(e.target.files[0])}/></label>}/><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{gallery.map((row) => <figure key={row.id} className="overflow-hidden rounded-xl border"><img src={row.image_url} alt="" className="aspect-square w-full object-cover"/><div className="flex gap-1 p-2"><input className="form-control min-w-0" value={row.caption || ''} onChange={(e) => setGallery(gallery.map((x) => x.id === row.id ? {...x,caption:e.target.value}:x))} placeholder="Caption"/><button className="icon-button" onClick={() => saveRow('gallery_items', row as unknown as Record<string, unknown>, setGallery, gallery)}><Save size={14}/></button><button className="icon-button text-red-600" onClick={() => deleteRow('gallery_items', row.id, setGallery, gallery)}><Trash2 size={14}/></button></div></figure>)}{gallery.length === 0 && <Empty text="No gallery images yet."/>}</div></section>

    {SHOW_LEAD_FORMS && <section id="leads" className={sectionStyle}><Heading title="Lead forms" subtitle="Visitors can contact the business without creating an account." action={<button onClick={addLeadForm} className={buttonStyle}><Plus size={15}/> Add form</button>}/><div className="grid gap-3">{leadForms.map((row) => <EditorRow key={row.id} onSave={() => saveRow('lead_forms', row as unknown as Record<string, unknown>, setLeadForms, leadForms)} onDelete={() => deleteRow('lead_forms', row.id, setLeadForms, leadForms)} busy={busy === `lead_forms-${row.id}`}><input className="form-control" value={row.title} onChange={(e) => setLeadForms(leadForms.map((x) => x.id === row.id ? {...x,title:e.target.value}:x))}/><input className="form-control" value={row.description || ''} onChange={(e) => setLeadForms(leadForms.map((x) => x.id === row.id ? {...x,description:e.target.value}:x))}/><input className="form-control" value={row.cta_label} onChange={(e) => setLeadForms(leadForms.map((x) => x.id === row.id ? {...x,cta_label:e.target.value}:x))} placeholder="Button label"/></EditorRow>)}</div><h3 className="mt-7 text-sm font-semibold">Submissions</h3><div className="mt-3 overflow-hidden rounded-xl border"><div className="divide-y">{leads.map((lead) => <div key={lead.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_160px]"><div><strong className="text-sm">{lead.name || lead.email || lead.phone || 'New lead'}</strong><p className="mt-1 text-xs text-[#77776f]">{lead.phone} {lead.email}</p>{lead.message && <p className="mt-2 text-sm">{lead.message}</p>}<small className="mt-2 block text-[#999991]">{new Date(lead.created_at).toLocaleString()}</small></div><select className="form-control" value={lead.status} onChange={async (e) => { const status = e.target.value as LeadSubmission['status']; const { error } = await supabase.from('lead_submissions').update({status}).eq('id',lead.id); if (!error) setLeads(leads.map((x) => x.id === lead.id ? {...x,status}:x)) }}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></div>)}{leads.length === 0 && <Empty text="No submissions yet."/>}</div></div></section>}
  </div>
}

function Heading({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-[#77776f]">{subtitle}</p></div>{action}</div> }
function Empty({ text }: { text: string }) { return <p className="col-span-full rounded-xl border border-dashed border-[#d8d6ce] px-4 py-7 text-center text-sm text-[#77776f]">{text}</p> }
function EditorRow({ children, onSave, onDelete, busy }: { children: React.ReactNode; onSave: () => void; onDelete: () => void; busy: boolean }) { return <div className="grid gap-3 rounded-xl border border-[#e4e2da] bg-[#fafaf7] p-4 md:grid-cols-[1fr_1fr_1fr_auto]"><>{children}</><div className="flex justify-end gap-1"><button onClick={onSave} className="icon-button" aria-label="Save">{busy ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}</button><button onClick={onDelete} className="icon-button text-red-600" aria-label="Delete"><Trash2 size={15}/></button></div></div> }
