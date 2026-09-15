'use client'

import { useFeedback } from '@/components/feedback-provider'
import { useEffect, useState } from 'react'
import { CalendarCheck2, ImagePlus, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { NotificationSettings, Product } from '@/lib/types'
import ConfirmationDialog from '@/components/confirmation-dialog'
import { mutationErrorMessage, reportClientMutationError } from '@/lib/client-errors'

const section = 'rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6'
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d8d6ce] bg-white px-4 text-sm font-semibold disabled:opacity-50'
const label = 'grid gap-1.5 text-[11px] font-semibold uppercase tracking-[.08em] text-[#77776f]'

// Orders, bookings and service-request history live in Admin → Activity now
// (components/activity-manager.tsx) so this editor stays focused on
// configuration. All of that data is still stored and readable in Supabase —
// only the in-editor history lists were removed from here.
//
// Notifications (email + calendar-sync toggle) are controlled by the parent
// (InlineBusinessFeatures) and saved together with Booking/Client Activity
// settings through one "Save changes" button there — this component only
// edits the fields, it doesn't save them. Connect/Disconnect Google
// Calendar stay immediate, separate actions (not part of that save).
export default function CommerceManager({businessId,ready,showProducts=true,showIntegrations=true,initialProducts,notifications,onNotificationsChange}:{businessId:string;ready:boolean;showProducts?:boolean;showIntegrations?:boolean;initialProducts:Product[];notifications:NotificationSettings;onNotificationsChange:(next:NotificationSettings)=>void}) {
  const [products,setProducts]=useState(initialProducts)
  const [priceInputs,setPriceInputs]=useState<Record<string,string>>(()=>Object.fromEntries(initialProducts.map((product)=>[product.id,(product.price_cents/100).toFixed(2)])))
  const [busy,setBusy]=useState('')
  const [message,setMessage]=useState('')
  const [calendarConnected,setCalendarConnected]=useState<boolean|null>(null)
  const supabase=createClient()
  const notify=useFeedback()
  const [calendarError,setCalendarError]=useState(false)
  const [checkingCalendar,setCheckingCalendar]=useState(false)
  const [connecting,setConnecting]=useState(false)
  const [confirmation,setConfirmation]=useState<{kind:'product';id:string;name:string}|{kind:'calendar'}|null>(null)

  async function checkCalendar() {
    setCheckingCalendar(true); setCalendarError(false)
    try {
      const response = await fetch(`/api/admin/calendar/status?businessId=${businessId}`)
      if (!response.ok) throw new Error('Connection check failed')
      const result = await response.json(); setCalendarConnected(Boolean(result.connected))
    } catch { setCalendarError(true) }
    finally { setCheckingCalendar(false) }
  }
  useEffect(() => { if (showIntegrations) void checkCalendar() }, [businessId, showIntegrations])
  if(!ready)return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-900">Feature database setup required</h2><p className="mt-2 text-sm text-amber-800">Run <code className="rounded bg-amber-100 px-1">202609130003_request_service.sql</code>, then refresh.</p></section>

  function addProduct(){
    const id=crypto.randomUUID()
    setProducts([...products,{id,business_id:businessId,name:'New product',description:'',price_cents:0,image_url:null,category:'',available:true,featured:false,archived:false,display_order:products.length}])
    setPriceInputs((current)=>({...current,[id]:'0.00'}))
  }
  function updateProduct(id:string,changes:Partial<Product>){setProducts((rows)=>rows.map((row)=>row.id===id?{...row,...changes}:row))}
  async function saveProduct(row: Product) {
    if (busy) return
    const raw = (priceInputs[row.id] ?? '0').trim()
    if (!/^\d+(\.\d{0,2})?$/.test(raw)) { setMessage('Enter a valid price with no more than two decimal places.'); return }
    const price_cents = Math.round(Number(raw) * 100)
    setBusy(row.id); setMessage('')
    try {
      const { data, error } = await supabase.from('products').upsert({ ...row, price_cents }).select().single()
      if (error) throw error
      setProducts((rows) => rows.map((item) => item.id === row.id ? data as Product : item))
      setPriceInputs((current) => ({ ...current, [row.id]: (price_cents / 100).toFixed(2) }))
      setMessage('Product saved.'); notify('Product saved.')
    } catch (error) { reportClientMutationError('save product', error); setMessage(mutationErrorMessage('save this product', error)) }
    finally { setBusy('') }
  }
  async function removeProduct(id: string) {
    if (busy) return
    setBusy(id); setMessage('')
    try {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
      setProducts((rows) => rows.filter((item) => item.id !== id))
      setPriceInputs((current) => { const next = { ...current }; delete next[id]; return next })
      notify('Product removed.')
    } catch (error) { reportClientMutationError('remove product', error); setMessage(mutationErrorMessage('remove this product', error)) }
    finally { setBusy(''); setConfirmation(null) }
  }  async function upload(row: Product, file: File) {
    if (busy) return
    if (file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setMessage('Choose a PNG, JPEG or WebP image under 5 MB.'); return }
    setBusy(`image-${row.id}`); setMessage('')
    try {
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${businessId}/product-${crypto.randomUUID()}.${extension}`
      const { error } = await supabase.storage.from('business-assets').upload(path, file)
      if (error) throw error
      const image_url = supabase.storage.from('business-assets').getPublicUrl(path).data.publicUrl
      const next = { ...row, image_url }
      const { error: saveError } = await supabase.from('products').upsert(next)
      if (saveError) throw saveError
      setProducts((rows) => rows.map((item) => item.id === row.id ? next : item))
      notify('Product image uploaded and saved.')
    } catch (error) { reportClientMutationError('save product image', error); setMessage(mutationErrorMessage('save this image', error)) }
    finally { setBusy('') }
  }
  async function disconnectCalendar() {
    if (busy) return
    setBusy('calendar'); setMessage('')
    try {
      const response = await fetch('/api/admin/calendar/disconnect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId }) })
      if (!response.ok) throw new Error('Unable to disconnect')
      setCalendarConnected(false); notify('Google Calendar disconnected.')
    } catch { setMessage('Could not disconnect Google Calendar. Please try again.') }
    finally { setBusy(''); setConfirmation(null) }
  }
  return <div className="grid gap-6">
    {message&&<p role="status" className={`rounded-xl px-4 py-3 text-sm ${message.includes('saved')?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700'}`}>{message}</p>}
    {showProducts&&<section id="products" className={section}>
      <Head title="Order Now · Products" subtitle="Add and arrange the products customers can order." action={<button type="button" className={button} onClick={addProduct}><Plus size={15}/> Add Product</button>}/>
      <div className="grid gap-3">{products.map((row)=><article key={row.id} className="rounded-xl border border-[#e1dfd7] bg-[#fafaf7] p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-[1.05fr_1.45fr_.65fr_.85fr_.48fr]">
          <Field labelText="Product name"><input className="form-control" value={row.name} onChange={(event)=>updateProduct(row.id,{name:event.target.value})}/></Field>
          <Field labelText="Description"><input className="form-control" value={row.description||''} onChange={(event)=>updateProduct(row.id,{description:event.target.value})}/></Field>
          <Field labelText="Price"><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#77776f]">$</span><input className="form-control pl-7" aria-label="Product price" inputMode="decimal" value={priceInputs[row.id]??''} onChange={(event)=>setPriceInputs((current)=>({...current,[row.id]:event.target.value}))} placeholder="0.00"/></div></Field>
          <Field labelText="Category"><input className="form-control" value={row.category||''} onChange={(event)=>updateProduct(row.id,{category:event.target.value})}/></Field>
          <Field labelText="Sort order"><input className="form-control" type="number" min="0" value={row.display_order} onChange={(event)=>updateProduct(row.id,{display_order:Number(event.target.value)})}/></Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e2da] pt-3">
          <div className="flex items-center gap-4"><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={row.available} onChange={(event)=>updateProduct(row.id,{available:event.target.checked})} className="accent-[#1d1d1b]"/>Available</label><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={row.featured} onChange={(event)=>updateProduct(row.id,{featured:event.target.checked})} className="accent-[#1d1d1b]"/>Featured</label><label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#77776f]"><ImagePlus size={14}/>{busy===`image-${row.id}`?'Uploading…':row.image_url?'Replace image':'Add image'}<input disabled={Boolean(busy)} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event)=>event.target.files?.[0]&&upload(row,event.target.files[0])}/></label></div>
          <div className="flex gap-2"><button type="button" disabled={Boolean(busy)} aria-busy={busy===row.id} className={button} onClick={()=>saveProduct(row)}>{busy===row.id?<Loader2 className="animate-spin" size={15}/>:<Save size={15}/>} Save</button><button type="button" disabled={Boolean(busy)} className="icon-button text-red-600" onClick={()=>setConfirmation({kind:'product',id:row.id,name:row.name})} aria-label={`Remove ${row.name}`}><Trash2 size={15}/></button></div>
        </div>
      </article>)}{products.length===0&&<p className="rounded-xl border border-dashed p-7 text-center text-sm text-[#77776f]">No products yet. Select Add Product to create the first one.</p>}</div>
    </section>}

    {showIntegrations&&<section id="notifications" className={section}>
      <Head title="Notifications & Integrations" subtitle="Browser push is the primary free notification method. Clients enable it on their private Activity link; email and calendar remain optional."/>
      <div className="grid gap-6">
        <div className="grid gap-3 rounded-xl border border-[#e1dfd7] bg-[#fafaf7] p-4"><div><strong className="text-sm">Browser push notifications</strong><p className="mt-1 text-xs leading-5 text-[#77776f]">Primary phone notification method. The client enables it on each device from their private Activity link.</p></div><NotificationToggle label="Send push notifications for new orders, bookings and service requests" checked={notifications.push_notifications_enabled !== false} onChange={(checked)=>onNotificationsChange({...notifications,push_notifications_enabled:checked})}/></div>
        <div className="grid gap-4 border-t border-[#e5e2da] pt-5"><div><strong className="text-sm">Optional email notifications</strong><p className="mt-1 text-xs text-[#77776f]">Email is a backup channel and is not required for push.</p></div><Field labelText="Notification email address"><input className="form-control max-w-sm" type="email" value={notifications.notification_email||''} onChange={(event)=>onNotificationsChange({...notifications,notification_email:event.target.value})} placeholder="owner@business.com"/></Field><NotificationToggle label="Email me for new orders, bookings and service requests" checked={notifications.email_notifications_enabled} onChange={(checked)=>onNotificationsChange({...notifications,email_notifications_enabled:checked})}/></div>
        <div id="calendar" className="grid gap-4 border-t border-[#e5e2da] pt-5"><div><strong className="text-sm">Optional Google Calendar</strong><p className="mt-1 text-xs text-[#77776f]">When connected, new bookings sync as events and busy times block double-booking.</p></div>
        <NotificationToggle label="Sync bookings to Google Calendar (saved with Save changes below)" checked={notifications.calendar_integration_enabled} onChange={(checked)=>onNotificationsChange({...notifications,calendar_integration_enabled:checked})}/>
        <div className="flex flex-wrap items-center gap-3">
          {checkingCalendar&&<span className="text-xs text-[#77776f]">Checking connection…</span>}
          {!checkingCalendar&&!calendarError&&calendarConnected===true&&<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><CalendarCheck2 size={14}/> Connected</span>}
          {!checkingCalendar&&!calendarError&&calendarConnected===false&&<span className="text-xs text-[#77776f]">Not connected</span>}
          {calendarError&&<span role="status" className="text-xs text-red-700">Could not check connection. <button type="button" className="underline min-h-11" onClick={checkCalendar}>Retry</button></span>}{!checkingCalendar&&!calendarError&&(calendarConnected?<button type="button" className={button} onClick={()=>setConfirmation({kind:'calendar'})} disabled={busy==='calendar'}>{busy==='calendar'?'Disconnecting…':'Disconnect'}</button>:<a onClick={() => setConnecting(true)} href={`/api/admin/calendar/connect?businessId=${businessId}`} className={button}>{connecting?'Connecting…':'Connect Google Calendar'}</a>)}
        </div></div>
      </div>
    </section>}
    <ConfirmationDialog open={Boolean(confirmation)} title={confirmation?.kind==='product'?'Remove product?':'Disconnect Google Calendar?'} body={confirmation?.kind==='product'?`${confirmation.name} will be removed from this business and its public page.`:'New bookings will no longer sync and Google Calendar busy times will no longer block availability.'} confirmLabel={confirmation?.kind==='product'?'Remove product':'Disconnect'} busy={Boolean(busy)} onCancel={()=>setConfirmation(null)} onConfirm={()=>confirmation?.kind==='product'?removeProduct(confirmation.id):disconnectCalendar()}/>
  </div>
}

function Head({title,subtitle,action}:{title:string;subtitle:string;action?:React.ReactNode}){return <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-[#77776f]">{subtitle}</p></div>{action}</div>}
function Field({labelText,children}:{labelText:string;children:React.ReactNode}){return <label className={label}><span>{labelText}</span>{children}</label>}
function NotificationToggle({label:text,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}){return <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-[#d8d6ce] bg-[#fafaf7] px-3.5 text-sm font-medium"><input type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)} className="size-4 accent-[#1d1d1b]"/>{text}</label>}
