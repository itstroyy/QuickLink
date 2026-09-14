'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Calendar, Check, ExternalLink, MessageSquareText, Minus, PackageCheck, Plus, ShoppingBag, Ticket, X } from 'lucide-react'
import type { BookingSettings, Product, RequestServiceSettings, Service } from '@/lib/types'
import { googleCalendarUrl, icsDataUrl, outlookCalendarUrl } from '@/lib/calendar-links'
import { formatDate, formatPhone } from '@/lib/display-format'

const fieldClass = 'client-commerce-field'

export function OrderModule({ businessId, businessName, products, primary, preselectedProductId, onClearPreselected }: { businessId: string; businessName: string; products: Product[]; primary: boolean; preselectedProductId?: string | null; onClearPreselected?: () => void }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [step, setStep] = useState<'products'|'details'|'review'|'done'>('products')
  const [details, setDetails] = useState({ name:'', phone:'', method:'pickup', address:'', notes:'' })
  const [error, setError] = useState(''); const [busy,setBusy]=useState(false)
  const [confirmed,setConfirmed]=useState<{manageUrl:string;orderReference:string;totalCents:number}|null>(null)
  const selected = useMemo(() => products.filter((p) => quantities[p.id] > 0).map((p) => ({ ...p, quantity: quantities[p.id] })), [products, quantities])
  const total = selected.reduce((sum,item) => sum + item.price_cents * item.quantity, 0)
  function quantity(id:string, amount:number){setQuantities((q)=>({...q,[id]:Math.max(0,Math.min(99,(q[id]||0)+amount))}))}
  // A showcase product card can hand off directly into the cart — add one of
  // that item and jump straight to the product step so it feels continuous
  // with browsing, rather than making the customer find it again.
  useEffect(() => {
    if (!preselectedProductId) return
    if (!products.some((p) => p.id === preselectedProductId)) { onClearPreselected?.(); return }
    setQuantities((q) => ({ ...q, [preselectedProductId]: Math.max(1, q[preselectedProductId] || 0) }))
    setStep('products')
    onClearPreselected?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedProductId])
  async function submit(){setBusy(true);setError('');const response=await fetch('/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({businessId,...details,items:selected.map((p)=>({productId:p.id,name:p.name,quantity:p.quantity}))})});const result=await response.json();setBusy(false);if(!response.ok)setError(result.error||'Unable to submit order.');else{setConfirmed({manageUrl:result.manageUrl,orderReference:result.orderReference,totalCents:result.totalCents});setStep('done')}}
  return <section id="quicklink-order" className={`client-module client-commerce ${primary?'client-module-primary':''}`}>
    <div className="client-module-heading"><div><span className="client-module-kicker"><ShoppingBag size={13}/> Order now</span><h2>{step==='done'?'Order received':'Build your order'}</h2></div><span className="client-step">{step==='products'?'1/3':step==='details'?'2/3':step==='review'?'3/3':''}</span></div>
    {step==='products'&&<>{products.length===0?<p className="py-5 text-center text-xs" style={{color:'var(--muted-text)'}}>Products are being added. Please check back soon.</p>:<div className="client-products client-order-cart">{products.map((p)=><div key={p.id} className="client-product">{p.image_url&&<img src={p.image_url} alt=""/>}<div><strong>{p.name}</strong>{p.description&&<small>{p.description}</small>}<b>${(p.price_cents/100).toFixed(2)}</b></div><div className="client-quantity"><button onClick={()=>quantity(p.id,-1)} aria-label={`Remove ${p.name}`}><Minus size={13}/></button><span>{quantities[p.id]||0}</span><button onClick={()=>quantity(p.id,1)} aria-label={`Add ${p.name}`}><Plus size={13}/></button></div></div>)}</div>}<button disabled={!selected.length} className="client-commerce-next" onClick={()=>setStep('details')}>Continue · ${(total/100).toFixed(2)}<ArrowRight size={16}/></button></>}
    {step==='details'&&<div className="client-commerce-form"><input className={fieldClass} placeholder="Name" value={details.name} onChange={(e)=>setDetails({...details,name:e.target.value})}/><input className={fieldClass} type="tel" placeholder="Phone" value={details.phone} onChange={(e)=>setDetails({...details,phone:e.target.value})}/><div className="client-choice"><button className={details.method==='pickup'?'active':''} onClick={()=>setDetails({...details,method:'pickup'})}>Pickup</button><button className={details.method==='delivery'?'active':''} onClick={()=>setDetails({...details,method:'delivery'})}>Delivery</button></div>{details.method==='delivery'&&<input className={fieldClass} placeholder="Delivery address" value={details.address} onChange={(e)=>setDetails({...details,address:e.target.value})}/>}<textarea className={fieldClass} rows={2} placeholder="Notes (optional)" value={details.notes} onChange={(e)=>setDetails({...details,notes:e.target.value})}/><div className="client-commerce-nav"><button onClick={()=>setStep('products')}><ArrowLeft size={15}/> Back</button><button disabled={!details.name||!details.phone||(details.method==='delivery'&&!details.address)} onClick={()=>setStep('review')}>Review order <ArrowRight size={15}/></button></div></div>}
    {step==='review'&&<div className="client-order-review"><div>{selected.map((p)=><p key={p.id}><span>{p.quantity}× {p.name}</span><strong>${((p.price_cents*p.quantity)/100).toFixed(2)}</strong></p>)}</div><p className="total"><span>Total</span><strong>${(total/100).toFixed(2)}</strong></p><small>{details.method==='delivery'?`Delivery to ${details.address}`:'Pickup'} · {details.name} · {formatPhone(details.phone)}</small>{error&&<p className="client-commerce-error">{error}</p>}<div className="client-commerce-nav"><button onClick={()=>setStep('details')}><ArrowLeft size={15}/> Back</button><button disabled={busy} onClick={submit}>{busy?'Submitting…':'Submit order'} <Check size={15}/></button></div></div>}
    {step==='done'&&confirmed&&<div className="client-commerce-success"><PackageCheck size={28}/><strong>Thank you, {details.name}.</strong><p>Your order has been sent to {businessName}.</p><div className="client-confirmation-summary"><span>Order #{confirmed.orderReference}</span><strong>${(confirmed.totalCents/100).toFixed(2)}</strong></div><a className="client-manage-booking" href={confirmed.manageUrl}>View or cancel order <ArrowRight size={14}/></a></div>}
  </section>
}

export function RequestServiceModule({ businessId, businessName, settings, primary }: { businessId:string; businessName:string; settings:RequestServiceSettings; primary:boolean }) {
  const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const[name,setName]=useState('');const[preferredDate,setPreferredDate]=useState('')
  async function submit(formData:FormData){setBusy(true);setError('');const payload={businessId,name:formData.get('name'),phone:formData.get('phone'),email:formData.get('email'),address:formData.get('address'),preferredDate:formData.get('preferredDate'),request:formData.get('request'),notes:formData.get('notes')};const response=await fetch('/api/service-requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const result=await response.json();setBusy(false);if(response.ok)setSent(true);else setError(result.error||'Unable to send request.')}
  return <section id="quicklink-request-service" className={`client-module client-commerce ${primary?'client-module-primary':''}`}><div className="client-module-heading"><div><span className="client-module-kicker"><MessageSquareText size={13}/> {settings.title}</span><h2>{settings.description}</h2></div></div>{sent?<div className="client-commerce-success"><Check size={26}/><strong>Request sent</strong><p>Thanks, {name}. {businessName} has received your request.</p>{preferredDate&&<div className="client-confirmation-summary"><span>Preferred date</span><strong>{formatDate(preferredDate)}</strong></div>}<p>The business will follow up with you.</p></div>:<form action={submit} className="client-commerce-form"><input required name="name" className={fieldClass} placeholder="Name" value={name} onChange={(e)=>setName(e.target.value)}/><input required name="phone" type="tel" className={fieldClass} placeholder="Phone"/>{settings.show_email&&<input required={settings.email_required} name="email" type="email" className={fieldClass} placeholder={settings.email_required?'Email':'Email (optional)'}/>} {settings.show_address&&<input required={settings.address_required} name="address" className={fieldClass} placeholder={settings.address_required?'Address':'Address (optional)'}/>} {settings.show_preferred_date&&<label className="client-date-field"><span>Preferred date</span><input name="preferredDate" aria-label="Preferred date" type="date" min={new Date().toISOString().slice(0,10)} value={preferredDate} onChange={(e)=>setPreferredDate(e.target.value)} className={fieldClass}/>{preferredDate&&<small>{formatDate(preferredDate)}</small>}</label>} {settings.show_request&&<textarea required name="request" className={fieldClass} rows={3} placeholder="Tell us what you need"/>} {settings.show_notes&&<textarea name="notes" className={fieldClass} rows={2} placeholder="Extra notes (optional)"/>}{error&&<p className="client-commerce-error">{error}</p>}<button disabled={busy} className="client-commerce-next">{busy?'Sending…':settings.title}<ArrowRight size={16}/></button></form>}</section>
}

export type SelectedBookingOffer = { title: string; promoCode?: string; serviceId?: string }

export function BookingModule({ businessId, businessName, services, settings, primary, selectedOffer, selectedServiceId, onClearOffer, onSelectService, onClearSelectedService }: { businessId: string; businessName: string; services: Service[]; settings: BookingSettings; primary: boolean; selectedOffer?: SelectedBookingOffer | null; selectedServiceId?: string | null; onClearOffer?: () => void; onSelectService?: (serviceId: string) => void; onClearSelectedService?: () => void }) {
  const bookableServices = useMemo(() => services.filter((service) => service.enabled && service.bookable !== false), [services])
  const preselectedServiceId = selectedOffer?.serviceId || selectedServiceId || undefined
  const preselected = preselectedServiceId && bookableServices.some((service) => service.id === preselectedServiceId) ? preselectedServiceId : bookableServices.length === 1 ? bookableServices[0].id : ''
  const [step, setStep] = useState<'service'|'time'|'details'|'done'>(preselected ? 'time' : bookableServices.length ? 'service' : 'time')
  const [serviceId, setServiceId] = useState<string>(preselected)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [time, setTime] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [details, setDetails] = useState({ name: '', phone: '', notes: '' })
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState<{ date: string; time: string; endTime: string; manageUrl: string | null } | null>(null)
  const service = bookableServices.find((s) => s.id === serviceId)
  const minDate = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (step !== 'time') return
    setLoadingSlots(true); setError(''); setTime('')
    const params = new URLSearchParams({ businessId, date, ...(serviceId ? { serviceId } : {}) })
    fetch(`/api/booking/availability?${params.toString()}`).then((r) => r.json()).then((result) => {
      setSlots(result.slots || [])
      if (result.error) setError(result.error)
    }).catch(() => setError('Unable to load available times.')).finally(() => setLoadingSlots(false))
  }, [step, date, serviceId, businessId])

  useEffect(() => {
    if (!preselectedServiceId) return
    const linkedService = bookableServices.find((service) => service.id === preselectedServiceId)
    if (!linkedService) return
    setServiceId(linkedService.id); setStep('time')
  }, [preselectedServiceId, bookableServices])

  async function submit() {
    setBusy(true); setError('')
    const response = await fetch('/api/booking', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, serviceId: serviceId || null, serviceName: service?.name, date, time, ...details }) })
    const result = await response.json()
    setBusy(false)
    if (!response.ok) { setError(result.error || 'Unable to book that time.'); return }
    setConfirmed({ date, time: result.startTime || time, endTime: result.endTime, manageUrl: result.manageUrl || null })
    setStep('done')
  }

  const calendarEvent = confirmed ? {
    title: `${service?.name ? `${service.name} — ` : ''}${businessName}`,
    description: details.notes || undefined,
    startISO: `${confirmed.date}T${confirmed.time}:00`,
    endISO: `${confirmed.date}T${confirmed.endTime}:00`,
  } : null

  return <section id="quicklink-booking" className={`client-module client-commerce ${primary ? 'client-module-primary' : ''}`}>
    <div className="client-module-heading"><div><span className="client-module-kicker"><Calendar size={13}/> {settings.button_title || 'Book Now'}</span><h2>{step === 'done' ? 'Appointment booked' : step === 'service' ? 'Choose a service' : 'Choose a time'}</h2></div></div>
    {selectedOffer && step !== 'done' && <div className="client-selected-offer"><span className="client-selected-offer-icon"><Ticket size={17}/></span><div><small>Selected offer</small><strong>{selectedOffer.title}</strong>{selectedOffer.promoCode&&<code>{selectedOffer.promoCode}</code>}<p>{service ? `Linked service: ${service.name}` : 'Choose the service you want below'}</p></div><button type="button" onClick={() => { onClearOffer?.(); if (bookableServices.length > 1) { setServiceId(''); setTime(''); setStep('service') } }} aria-label="Remove selected offer"><X size={16}/><span>Clear</span></button></div>}
    {!selectedOffer && selectedServiceId && service && step !== 'done' && <div className="client-selected-service"><span className="client-selected-offer-icon"><Calendar size={17}/></span><div><small>Selected service</small><strong>{service.name}</strong><p>{[service.price_cents != null ? `$${(service.price_cents / 100).toFixed(2)}` : null, service.duration_minutes ? `${service.duration_minutes} min` : null].filter(Boolean).join(' · ')}</p></div>{bookableServices.length > 1&&<button type="button" onClick={() => { onClearSelectedService?.(); setServiceId(''); setTime(''); setStep('service') }}>Change</button>}</div>}

    {step === 'service' && <div className="client-commerce-form">
      <div className="grid gap-2">{bookableServices.map((s) => <button type="button" key={s.id} className="client-service client-service-bookable" onClick={() => { onSelectService?.(s.id); setServiceId(s.id); setStep('time') }}>
        <span className="client-service-main">{s.image_url&&<img className="client-service-thumb" src={s.image_url} alt=""/>}<span><strong>{s.name}</strong>{s.description && <small>{s.description}</small>}</span></span>
        <span className="text-right">{s.price_cents != null && <strong>${(s.price_cents / 100).toFixed(2)}</strong>}{s.duration_minutes && <small>{s.duration_minutes} min</small>}<ArrowRight size={15}/></span>
      </button>)}</div>
    </div>}

    {step === 'time' && <div className="client-commerce-form">
      <input className={fieldClass} type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date"/>
      {loadingSlots && <p className="text-xs" style={{ color: 'var(--muted-text)' }}>Loading available times…</p>}
      {!loadingSlots && !error && slots.length === 0 && <p className="text-xs" style={{ color: 'var(--muted-text)' }}>No times available that day. Try another date.</p>}
      {!loadingSlots && slots.length > 0 && <div className="client-time-grid">{slots.map((slot) => <button type="button" key={slot} className={time === slot ? 'active' : ''} onClick={() => setTime(slot)}>{formatTime(slot)}</button>)}</div>}
      {error && <p className="client-commerce-error">{error}</p>}
      <div className="client-commerce-nav">{bookableServices.length > 1 && <button type="button" onClick={() => setStep('service')}><ArrowLeft size={15}/> Back</button>}<button type="button" disabled={!time} onClick={() => setStep('details')}>Continue <ArrowRight size={15}/></button></div>
    </div>}

    {step === 'details' && <div className="client-commerce-form">
      <p className="text-xs" style={{ color: 'var(--muted-text)' }}>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} at {formatTime(time)}{service ? ` · ${service.name}` : ''}</p>
      <input className={fieldClass} placeholder="Name" value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })}/>
      <input className={fieldClass} type="tel" placeholder="Phone" value={details.phone} onChange={(e) => setDetails({ ...details, phone: e.target.value })}/>
      <textarea className={fieldClass} rows={2} placeholder="Notes (optional)" value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })}/>
      {error && <p className="client-commerce-error">{error}</p>}
      <div className="client-commerce-nav"><button type="button" onClick={() => setStep('time')}><ArrowLeft size={15}/> Back</button><button type="button" disabled={busy || !details.name || !details.phone} onClick={submit}>{busy ? 'Booking…' : 'Confirm booking'} <Check size={15}/></button></div>
    </div>}

    {step === 'done' && confirmed && <div className="client-commerce-success">
      <PackageCheck size={28}/><strong>You're booked, {details.name}.</strong>
      <p>{new Date(`${confirmed.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} at {formatTime(confirmed.time)}{service ? ` · ${service.name}` : ''}</p>
      {calendarEvent && <div className="client-add-to-calendar">
        <a href={googleCalendarUrl(calendarEvent)} target="_blank" rel="noreferrer">Google Calendar <ExternalLink size={13}/></a>
        <a href={outlookCalendarUrl(calendarEvent)} target="_blank" rel="noreferrer">Outlook <ExternalLink size={13}/></a>
        <a href={icsDataUrl(calendarEvent)} download="appointment.ics">Apple / other (.ics)</a>
      </div>}
      {confirmed.manageUrl&&<a className="client-manage-booking" href={confirmed.manageUrl}>View or cancel appointment <ArrowRight size={14}/></a>}
    </div>}
  </section>
}

function formatTime(value: string) {
  const [h, m] = value.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}
