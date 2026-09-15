'use client'

import { useFeedback } from '@/components/feedback-provider'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Calendar, Check as CheckIcon, Copy, Loader2, MessageSquareText, RefreshCw, Save, ShoppingBag } from 'lucide-react'
import CommerceManager from '@/components/commerce-manager'
import { useEditorSave } from '@/components/editor-save-context'
import { createClient } from '@/lib/supabase/client'
import type { Appointment, BookingSettings, BusinessClientAccess, BusinessFeature, CustomerOrder, NotificationSettings, OrderCustomerSettings, Product, RequestServiceSettings, Service, ServiceRequest } from '@/lib/types'
import ConfirmationDialog from '@/components/confirmation-dialog'
import { mutationErrorMessage, reportClientMutationError } from '@/lib/client-errors'
import { orderCustomerSettings } from '@/lib/order-settings'

const modules = [
  { key: 'ordering', label: 'Order Now', description: 'Customers select products, quantities and fulfillment details.', icon: ShoppingBag },
  { key: 'request_service', label: 'Request Service', description: 'A flexible request form for delivery, quotes, catering, detailing and more.', icon: MessageSquareText },
  { key: 'booking', label: 'Booking', description: 'Customers pick a service, date and time and book instantly. No client login.', icon: Calendar },
] as const

const requestDefaults: RequestServiceSettings = {
  title: 'Request Service', description: 'Tell us what you need and we’ll follow up.', show_request: true,
  show_address: false, address_required: false, show_preferred_date: true, preferred_date_required: false,
  show_email: true, email_required: false, show_notes: true, sms_enabled: false,
}

const bookingDefaults: BookingSettings = {
  button_title: 'Book Now', buffer_minutes: 0, minimum_notice_minutes: 60, sms_enabled: false,
}

export type InlineCommerceData = {
  ready: boolean
  bookingReady?: boolean
  features: BusinessFeature[]
  products: Product[]
  services: Service[]
  orders: CustomerOrder[]
  requests: ServiceRequest[]
  appointments: Appointment[]
  notifications: NotificationSettings
}

function requestSettings(feature?: BusinessFeature): RequestServiceSettings {
  return { ...requestDefaults, ...(feature?.settings || {}) }
}
function bookingSettings(feature?: BusinessFeature): BookingSettings {
  return { ...bookingDefaults, ...(feature?.settings || {}) }
}

export default function InlineBusinessFeatures({ businessId, businessSlug, data, initialClientAccess }: { businessId: string; businessSlug: string; data: InlineCommerceData; initialClientAccess: BusinessClientAccess }) {
  const notify = useFeedback()
  const [features, setFeatures] = useState(data.features)
  const [orderConfig, setOrderConfig] = useState(() => orderCustomerSettings(data.features.find((feature) => feature.feature_key === 'ordering')?.settings))
  const [requestConfig, setRequestConfig] = useState(() => requestSettings(data.features.find((feature) => feature.feature_key === 'request_service')))
  const [bookingConfig, setBookingConfig] = useState(() => bookingSettings(data.features.find((feature) => feature.feature_key === 'booking')))
  const [notifications, setNotifications] = useState<NotificationSettings>(data.notifications)
  const [clientAccess, setClientAccess] = useState<BusinessClientAccess>(initialClientAccess)
  const [clientAccessBusy, setClientAccessBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmRegenerate, setConfirmRegenerate] = useState(false)
  const supabase = createClient()
  const enabled = (key: string) => features.some((feature) => feature.feature_key === key && feature.enabled)

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://quicklinkqr.com').replace(/\/$/, '')
  const clientActivityLink = clientAccess.activity_access_token ? `${siteUrl}/client/${businessSlug}/activity?token=${clientAccess.activity_access_token}` : ''

  // Feature toggles/settings, Email/Calendar notification settings, and
  // Client Activity enable/visibility all save together through one button.
  // Connect/Disconnect Calendar, Regenerate link and Copy link stay
  // separate, immediate actions — see those handlers below.
  async function saveChanges() {
    setSaveBusy(true); setMessage('')
    const featurePayloads = modules
      .filter((module) => module.key !== 'booking' || data.bookingReady)
      .map((module, index) => {
        const current = features.find((feature) => feature.feature_key === module.key)
        return {
          business_id: businessId,
          feature_key: module.key,
          enabled: current?.enabled ?? false,
          is_primary: current?.is_primary ?? false,
          display_order: current?.display_order ?? index,
          settings: module.key === 'ordering' ? orderConfig : module.key === 'request_service' ? requestConfig : module.key === 'booking' ? bookingConfig : current?.settings ?? {},
        }
      })
    const clientAccessPayload: Partial<BusinessClientAccess> & { business_id: string } = {
      business_id: businessId, client_activity_enabled: clientAccess.client_activity_enabled,
      client_activity_show_orders: clientAccess.client_activity_show_orders, client_activity_show_bookings: clientAccess.client_activity_show_bookings,
      client_activity_show_service_requests: clientAccess.client_activity_show_service_requests,
    }
    if (clientAccess.activity_access_token) clientAccessPayload.activity_access_token = clientAccess.activity_access_token // preserve the existing token; let the DB generate the first one

    if (featurePayloads.some((feature) => feature.is_primary)) {
      const { error } = await supabase.from('business_features').update({ is_primary: false }).eq('business_id', businessId)
      if (error) {
        const safe = mutationErrorMessage('save business features', error)
        reportClientMutationError('business_features.clear_primary', error)
        setSaveBusy(false); setMessage(safe); throw new Error(safe)
      }
    }

    const [featuresResult, notificationsResult, accessResult] = await Promise.all([
      supabase.from('business_features').upsert(featurePayloads, { onConflict: 'business_id,feature_key' }).select(),
      supabase.from('business_notification_settings').upsert(notifications).select().single(),
      supabase.from('business_client_access').upsert(clientAccessPayload, { onConflict: 'business_id' }).select().single(),
    ])
    setSaveBusy(false)
    const error = featuresResult.error || notificationsResult.error || accessResult.error
    if (error) {
      const safe = mutationErrorMessage('save business features', error)
      reportClientMutationError('business_features.save_bundle', error)
      setMessage(safe); throw new Error(safe)
    }
    if (featuresResult.data) setFeatures(featuresResult.data as BusinessFeature[])
    if (notificationsResult.data) setNotifications(notificationsResult.data as NotificationSettings)
    if (accessResult.data) setClientAccess(accessResult.data as BusinessClientAccess)
    setMessage('Changes saved.')
    notify('Changes saved.')
  }

  const hasParentSave = useEditorSave(saveChanges)

  async function regenerateToken() {
    setClientAccessBusy(true); setMessage('')
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    const activity_access_token = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
    const { data: saved, error } = await supabase.from('business_client_access').upsert({ business_id: businessId, client_activity_enabled: clientAccess.client_activity_enabled, client_activity_show_orders: clientAccess.client_activity_show_orders, client_activity_show_bookings: clientAccess.client_activity_show_bookings, client_activity_show_service_requests: clientAccess.client_activity_show_service_requests, activity_access_token }, { onConflict: 'business_id' }).select().single()
    setClientAccessBusy(false)
    if (error) {
      reportClientMutationError('business_client_access.regenerate', error)
      setMessage(mutationErrorMessage('regenerate the private activity link', error)); setConfirmRegenerate(false); return
    }
    setClientAccess(saved as BusinessClientAccess)
    setConfirmRegenerate(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(clientActivityLink).then(() => { setCopied(true); notify('Private activity link copied.'); setTimeout(() => setCopied(false), 1800) }).catch(() => notify('Could not copy. Select the link and copy it manually.', 'error'))
  }

  function updateFeature(key: typeof modules[number]['key'], changes: Partial<BusinessFeature>) {
    setMessage('')
    if (!data.ready) { setMessage('Run the Request Service migration in Supabase before enabling features.'); return }
    const current = features.find((feature) => feature.feature_key === key)
    const draft: BusinessFeature = current ?? {
      id: `draft-${key}`, business_id: businessId, feature_key: key,
      enabled: false, is_primary: false, display_order: modules.findIndex((module) => module.key === key), settings: {},
    }
    setFeatures((items) => [
      ...items.filter((item) => item.feature_key !== key).map((item) => changes.is_primary ? { ...item, is_primary: false } : item),
      { ...draft, ...changes },
    ])
  }
  function setting<K extends keyof RequestServiceSettings>(key: K, value: RequestServiceSettings[K]) {
    setRequestConfig((current) => ({
      ...current, [key]: value,
      ...(key === 'address_required' && value ? { show_address: true } : {}),
      ...(key === 'email_required' && value ? { show_email: true } : {}),
      ...(key === 'show_address' && !value ? { address_required: false } : {}),
      ...(key === 'show_email' && !value ? { email_required: false } : {}),
      ...(key === 'preferred_date_required' && value ? { show_preferred_date: true } : {}),
      ...(key === 'show_preferred_date' && !value ? { preferred_date_required: false } : {}),
    }))
  }
  function orderSetting<K extends keyof OrderCustomerSettings>(key: K, value: OrderCustomerSettings[K]) {
    setOrderConfig((current) => ({
      ...current, [key]: value,
      ...(key === 'address_required' && value ? { show_address: true } : {}),
      ...(key === 'email_required' && value ? { show_email: true } : {}),
      ...(key === 'show_address' && !value ? { address_required: false } : {}),
      ...(key === 'show_email' && !value ? { email_required: false } : {}),
    }))
  }
  function bookingSetting<K extends keyof BookingSettings>(key: K, value: BookingSettings[K]) {
    setBookingConfig((current) => ({ ...current, [key]: value }))
  }
  function applyPreset(mode:'retail'|'appointment'|'service'|'hybrid') {
    const enabledKeys=mode==='retail'?['ordering']:mode==='appointment'?['booking']:mode==='service'?['request_service']:['ordering','booking','request_service']
    const primaryKey=mode==='retail'?'ordering':mode==='appointment'?'booking':'request_service'
    setFeatures(modules.map((module,index)=>{
      const current=features.find((feature)=>feature.feature_key===module.key)
      return current?{...current,enabled:enabledKeys.includes(module.key),is_primary:module.key===primaryKey}:{id:`draft-${module.key}`,business_id:businessId,feature_key:module.key,enabled:enabledKeys.includes(module.key),is_primary:module.key===primaryKey,display_order:index,settings:{}}
    }))
    notify(`${mode[0].toUpperCase()+mode.slice(1)} preset staged. Save changes to publish it.`)
  }

  return <div className="grid gap-6">
    <section id="business-features" className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8b6b3d]">Business Features</p><h2 className="mt-2 text-xl font-semibold">Choose what customers can do</h2><p className="mt-1 text-sm text-[#77776f]">Only enabled features appear on the public business page.</p></div><Link href={`/admin/activity?business=${businessId}`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#d8d6ce] bg-white px-3.5 py-2 text-xs font-semibold text-[#1d1d1b]">Orders, bookings &amp; requests <ArrowUpRight size={14}/></Link></div>
      {!data.ready && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Database setup required: run <code>202609130003_request_service.sql</code>, then refresh.</p>}
      {message && <p role="status" className={`mb-4 rounded-xl px-4 py-3 text-sm ${message.includes('saved') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{message}</p>}
      <div className="mb-5 rounded-2xl border border-[#e5e0d7] bg-[#faf9f5] p-4"><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#77776f]">Quick presets</p><p className="mt-1 text-xs text-[#77776f]">Use a sensible starting mode, then adjust any feature individually.</p><div className="mt-3 flex flex-wrap gap-2">{([['retail','Retail / product'],['appointment','Appointment'],['service','Service / quote'],['hybrid','Hybrid']] as const).map(([value,label])=><button type="button" key={value} onClick={()=>applyPreset(value)} className="min-h-10 rounded-full border border-[#d8d6ce] bg-white px-4 text-xs font-semibold">{label}</button>)}</div></div>
      <div className="grid gap-3 md:grid-cols-2">{modules.map(({ key, label, description, icon: Icon }) => { const value=features.find((feature)=>feature.feature_key===key); const disabled = !data.ready || (key === 'booking' && !data.bookingReady); return <article key={key} className={`rounded-2xl border p-4 transition ${value?.enabled?'border-[#b78358] bg-[#fbf5ed] shadow-sm':'border-[#e1dfd7] bg-[#fafaf7]'} ${disabled?'opacity-70':''}`}><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#1d1d1b] text-[#d19a6a]"><Icon size={18}/></span><label className="relative inline-flex cursor-pointer items-center"><input disabled={disabled} type="checkbox" className="peer sr-only" aria-label={`Enable ${label}`} checked={value?.enabled??false} onChange={(event)=>updateFeature(key,{enabled:event.target.checked})}/><span className="h-6 w-11 rounded-full bg-[#d3d1ca] transition after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:bg-[#1d1d1b] peer-checked:after:translate-x-5"/></label></div><h3 className="mt-4 font-semibold">{label}</h3><p className="mt-1 min-h-10 text-xs leading-5 text-[#77776f]">{description}</p>{key === 'booking' && !data.bookingReady && <p className="mt-2 text-[11px] font-medium text-amber-700">Run the booking migration first.</p>}<label className="mt-4 flex items-center gap-2 border-t border-[#e2ded5] pt-3 text-xs font-medium text-[#77776f]"><input disabled={disabled} type="radio" name={`primary-${businessId}`} checked={value?.is_primary??false} onChange={()=>updateFeature(key,{enabled:true,is_primary:true})} className="accent-[#1d1d1b]"/> Primary action</label></article>})}</div>

      {enabled('ordering') && <div className="mt-5 rounded-2xl border border-[#dedbd2] bg-[#faf9f5] p-4 sm:p-5">
        <div className="mb-4"><h3 className="font-semibold">Order Now customer information</h3><p className="mt-1 text-xs text-[#77776f]">Choose which details Quicklink collects before checkout. Name is always required.</p></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <FixedField label="Name · required"/>
          <Check label="Phone required" checked={orderConfig.phone_required} onChange={(value)=>orderSetting('phone_required',value)}/>
          <Check label="Show email" checked={orderConfig.show_email} onChange={(value)=>orderSetting('show_email',value)}/>
          <Check label="Email required" checked={orderConfig.email_required} onChange={(value)=>orderSetting('email_required',value)}/>
          <Check label="Show address" checked={orderConfig.show_address} onChange={(value)=>orderSetting('show_address',value)}/>
          <Check label="Address required" checked={orderConfig.address_required} onChange={(value)=>orderSetting('address_required',value)}/>
          <Check label="Show notes" checked={orderConfig.show_notes} onChange={(value)=>orderSetting('show_notes',value)}/>
        </div>
        <p className="mt-3 text-xs text-[#77776f]">Paid online orders always require a valid email, even when optional for Pay Later. Address is requested for delivery and can also be shown for pickup.</p>
      </div>}

      {enabled('request_service') && <div className="mt-5 rounded-2xl border border-[#dedbd2] bg-[#faf9f5] p-4 sm:p-5">
        <div className="mb-4"><h3 className="font-semibold">Request Service settings</h3><p className="mt-1 text-xs text-[#77776f]">Rename and shape this form for any kind of business request.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button title"><input className="form-control" value={requestConfig.title} onChange={(event)=>setting('title',event.target.value)} placeholder="Request Service"/></Field>
          <Field label="Short description"><input className="form-control" value={requestConfig.description} onChange={(event)=>setting('description',event.target.value)} placeholder="Tell us what you need"/></Field>
        </div>
        <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#77776f]">Fields shown</p><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FixedField label="Name"/><FixedField label="Phone"/>
          <Check label="Request details" checked={requestConfig.show_request} onChange={(value)=>setting('show_request',value)}/>
          <Check label="Address" checked={requestConfig.show_address} onChange={(value)=>setting('show_address',value)}/>
          <Check label="Email" checked={requestConfig.show_email} onChange={(value)=>setting('show_email',value)}/>
          <Check label="Preferred date" checked={requestConfig.show_preferred_date} onChange={(value)=>setting('show_preferred_date',value)}/>
          <Check label="Notes" checked={requestConfig.show_notes} onChange={(value)=>setting('show_notes',value)}/>
        </div></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Check label="Address required" checked={requestConfig.address_required} onChange={(value)=>setting('address_required',value)}/>
          <Check label="Email required" checked={requestConfig.email_required} onChange={(value)=>setting('email_required',value)}/>
          <Check label="Preferred date required" checked={requestConfig.preferred_date_required} onChange={(value)=>setting('preferred_date_required',value)}/>
        </div>
        <p className="mt-4 text-xs text-[#77776f]">Saved with the main Save changes button.</p>
      </div>}

      {enabled('booking') && <div className="mt-5 rounded-2xl border border-[#dedbd2] bg-[#faf9f5] p-4 sm:p-5">
        <div className="mb-4"><h3 className="font-semibold">Booking settings</h3><p className="mt-1 text-xs text-[#77776f]">Customers pick from the services and weekly hours below — manage those from <Link href={`/admin/clients/${businessId}/hub`} className="underline">Services &amp; hours</Link>.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Button title"><input className="form-control" value={bookingConfig.button_title} onChange={(event)=>bookingSetting('button_title',event.target.value)} placeholder="Book Now"/></Field>
          <Field label="Buffer time (minutes)"><input className="form-control" type="number" min="0" step="5" value={bookingConfig.buffer_minutes} onChange={(event)=>bookingSetting('buffer_minutes',Math.max(0,Number(event.target.value)||0))}/></Field>
          <Field label="Minimum notice (minutes)"><input className="form-control" type="number" min="0" step="15" value={bookingConfig.minimum_notice_minutes} onChange={(event)=>bookingSetting('minimum_notice_minutes',Math.max(0,Number(event.target.value)||0))}/></Field>
        </div>
        <p className="mt-3 text-xs text-[#77776f]">Buffer time blocks extra minutes before and after each appointment. Minimum notice is how far ahead a customer must book (e.g. 60 = at least an hour from now). Saved with the main Save changes button below.</p>
      </div>}
    </section>
    <CommerceManager businessId={businessId} ready={data.ready} showProducts={enabled('ordering')} initialProducts={data.products} notifications={notifications} onNotificationsChange={setNotifications}/>

    <details id="client-activity-access" className="rounded-2xl border border-[#deded7] bg-white p-5 sm:p-6">
      <summary className="cursor-pointer font-semibold text-[#77776f]">Legacy access (advanced)</summary>
      <div className="mb-5 mt-4 rounded-xl border border-[#eee4c8] bg-[#fbf7e9] px-4 py-3 text-xs text-[#7a6a30]">This is the old token-link method for giving a business owner activity access, from before Quicklink had real owner sign-in. New businesses should be invited to <span className="font-medium">/dashboard</span> instead (see Owner access). Keep this only if a client already has one of these private links in use — existing links keep working, and you can revoke or regenerate them here.</div>
      <h2 className="font-semibold">Client Activity access</h2><p className="mt-1 text-sm text-[#77776f]">Give this business a private link to view and manage their own activity — no login, no dashboard, no access to configuration or other businesses. Enable/visibility saved with the main Save changes button below.</p>
      <label className="mt-4 flex min-h-11 items-center gap-2.5 rounded-xl border border-[#d8d6ce] bg-[#fafaf7] px-3.5 text-sm font-medium"><input type="checkbox" checked={clientAccess.client_activity_enabled} onChange={(event) => setClientAccess({ ...clientAccess, client_activity_enabled: event.target.checked })} className="size-4 accent-[#1d1d1b]"/> Enable private Client Activity access</label>
      {clientAccess.client_activity_enabled && <>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-[#dedbd2] bg-white px-3 text-xs font-medium"><input type="checkbox" checked={clientAccess.client_activity_show_orders} onChange={(event) => setClientAccess({ ...clientAccess, client_activity_show_orders: event.target.checked })} className="accent-[#1d1d1b]"/> Orders</label>
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-[#dedbd2] bg-white px-3 text-xs font-medium"><input type="checkbox" checked={clientAccess.client_activity_show_bookings} onChange={(event) => setClientAccess({ ...clientAccess, client_activity_show_bookings: event.target.checked })} className="accent-[#1d1d1b]"/> Bookings</label>
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-[#dedbd2] bg-white px-3 text-xs font-medium"><input type="checkbox" checked={clientAccess.client_activity_show_service_requests} onChange={(event) => setClientAccess({ ...clientAccess, client_activity_show_service_requests: event.target.checked })} className="accent-[#1d1d1b]"/> Service Requests</label>
        </div>
        {clientAccess.activity_access_token && <div className="mt-4 flex flex-wrap items-center gap-2">
          <input readOnly value={clientActivityLink} className="form-control min-w-0 flex-1" onFocus={(event) => event.target.select()}/>
          <button type="button" onClick={copyLink} disabled={!clientActivityLink} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d8d6ce] bg-white px-4 text-sm font-semibold disabled:opacity-50">{copied ? <CheckIcon size={15}/> : <Copy size={15}/>} {copied ? 'Copied' : 'Copy link'}</button>
          <button type="button" onClick={()=>setConfirmRegenerate(true)} disabled={clientAccessBusy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#d8d6ce] bg-white px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw size={15}/> Regenerate link</button>
        </div>}
        {!clientAccess.activity_access_token && <p className="mt-3 text-xs text-[#77776f]">Select Save changes below to enable this and generate the private link.</p>}
        <p className="mt-2 text-xs text-[#77776f]">Regenerating invalidates the previous link immediately. This business can search, filter, view details, change status, and archive/restore — never permanently delete, edit configuration, or see other businesses.</p>
      </>}
    </details>

    {!hasParentSave && <div className="sticky bottom-4 z-10 flex justify-end">
      <button type="button" onClick={() => void saveChanges().catch(() => {})} disabled={saveBusy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1d1d1b] px-6 text-sm font-semibold text-white shadow-lg disabled:opacity-50">{saveBusy ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>} Save changes</button>
    </div>}
    <ConfirmationDialog open={confirmRegenerate} title="Regenerate private link?" body="The previous private activity link will stop working immediately. Anyone using it will need the new link." confirmLabel="Regenerate link" busy={clientAccessBusy} onCancel={()=>setConfirmRegenerate(false)} onConfirm={regenerateToken}/>
  </div>
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="grid gap-1.5 text-xs font-semibold text-[#55554f]"><span>{label}</span>{children}</label> }
function Check({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}) { return <label className="flex min-h-10 items-center gap-2 rounded-xl border border-[#dedbd2] bg-white px-3 text-xs font-medium"><input type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)} className="accent-[#1d1d1b]"/>{label}</label> }
function FixedField({label}:{label:string}) { return <span className="flex min-h-10 items-center justify-between rounded-xl border border-[#dedbd2] bg-white px-3 text-xs font-medium">{label}<small className="text-[#999991]">Always shown</small></span> }
