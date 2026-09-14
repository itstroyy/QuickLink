'use client'

import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, Clock3, Copy, Images, Megaphone, Send, Sparkles } from 'lucide-react'
import type { BookingSettings, PublicHubData, RequestServiceSettings } from '@/lib/types'
import { OrderModule, RequestServiceModule, BookingModule } from '@/components/commerce-modules'

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function event(businessId: string, eventType: string, metadata: Record<string, string> = {}) {
  let visitorId = ''
  try {
    visitorId = localStorage.getItem('quicklink_visitor') || crypto.randomUUID()
    localStorage.setItem('quicklink_visitor', visitorId)
  } catch {}
  fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, eventType, visitorId, metadata }), keepalive: true }).catch(() => {})
}

export default function ClientModules({ businessId, businessName, data }: { businessId: string; businessName: string; data: PublicHubData }) {
  const enabled = new Set(data.features.filter((feature) => feature.enabled).map((feature) => feature.feature_key))
  const primary = data.features.find((feature) => feature.enabled && feature.is_primary)?.feature_key
  const requestFeature = data.features.find((feature) => feature.feature_key === 'request_service')
  const requestSettings = { title: 'Request Service', description: 'Tell us what you need and we’ll follow up.', show_request: true, show_address: false, address_required: false, show_preferred_date: true, show_email: true, email_required: false, show_notes: true, sms_enabled: false, ...(requestFeature?.settings || {}) } as RequestServiceSettings
  const bookingFeature = data.features.find((feature) => feature.feature_key === 'booking')
  const bookingSettings = { button_title: 'Book Now', buffer_minutes: 0, minimum_notice_minutes: 60, sms_enabled: false, ...(bookingFeature?.settings || {}) } as BookingSettings
  const [sent, setSent] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [bookingOffer, setBookingOffer] = useState<{serviceId?:string;title:string;promoCode?:string}|null>(null)
  const [bookingServiceId, setBookingServiceId] = useState<string | null>(null)
  const [copiedPromo, setCopiedPromo] = useState<string | null>(null)

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleOffer(offer: PublicHubData['promotions'][number]) {
    event(businessId, 'promotion_click', { promotionId: offer.id })
    switch (offer.action_type) {
      case 'order_now': scrollTo('quicklink-order'); return
      case 'request_service': scrollTo('quicklink-request-service'); return
      case 'booking':
        // Preselect the offer's related service when one is set, so the
        // customer lands straight on time selection instead of re-picking it.
        setBookingOffer({ serviceId: offer.action_value || undefined, title: offer.title, promoCode: offer.promo_code || undefined })
        setBookingServiceId(null)
        scrollTo('quicklink-booking')
        return
      case 'external_link': if (offer.action_value) window.open(offer.action_value, '_blank', 'noreferrer'); return
      case 'call': if (offer.action_value) window.location.href = `tel:${offer.action_value}`; return
      case 'text': if (offer.action_value) window.location.href = `sms:${offer.action_value}`; return
      default: return
    }
  }

  function selectService(serviceId: string) {
    const service = data.services.find((item) => item.id === serviceId)
    if (!service?.enabled || service.bookable === false || !enabled.has('booking')) return
    event(businessId, 'feature_click', { feature: 'services', serviceId })
    setBookingOffer((offer) => offer?.serviceId && offer.serviceId !== serviceId ? null : offer)
    setBookingServiceId(serviceId)
    scrollTo('quicklink-booking')
  }

  function copyPromo(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedPromo(code)
      window.setTimeout(() => setCopiedPromo(null), 1800)
    }).catch(() => {})
  }

  async function submitLead(formId: string, formData: FormData) {
    setSending(true)
    const response = await fetch('/api/leads', { method: 'POST', body: JSON.stringify({
      businessId, formId, name: formData.get('name'), phone: formData.get('phone'), email: formData.get('email'),
      message: formData.get('message'), website: formData.get('website'),
    }), headers: { 'content-type': 'application/json' } })
    setSending(false)
    if (response.ok) setSent(formId)
  }

  return <div className="client-modules mt-7 grid gap-5 text-left">
    {enabled.has('announcements') && data.announcements.length > 0 && <section className="client-module client-announcement">
      <div className="client-module-kicker"><Megaphone size={13}/> Latest update</div>
      <h2>{data.announcements[0].title}</h2>{data.announcements[0].body && <p>{data.announcements[0].body}</p>}
    </section>}

    {data.promotions.length > 0 && <section className={`client-module ${primary === 'special_offers' ? 'client-module-primary' : ''}`}>
      <div className="client-module-heading"><div><span className="client-module-kicker"><Sparkles size={13}/> Current offers</span><h2>Something special</h2></div></div>
      <div className="grid gap-3">{data.promotions.map((offer) => <article key={offer.id} className="client-offer">{offer.image_url&&<img className="client-offer-image" src={offer.image_url} alt=""/>}<div className="client-offer-body"><span>{offer.badge&&<small>{offer.badge}</small>}<strong>{offer.title}</strong>{offer.description&&<em>{offer.description}</em>}</span><div className="client-offer-actions">{offer.promo_code&&<button type="button" className="client-promo-code" onClick={()=>copyPromo(offer.promo_code!)} aria-label={`Copy promo code ${offer.promo_code}`}><code>{offer.promo_code}</code>{copiedPromo===offer.promo_code?<Check size={12}/>:<Copy size={12}/>}</button>}{offer.action_type!=='none'&&<button type="button" className="client-offer-cta" onClick={()=>handleOffer(offer)}>{offer.cta_label||defaultCtaLabel(offer.action_type)}<ArrowRight size={13}/></button>}</div></div></article>)}</div>
    </section>}

    {data.services.length > 0 && <section className={`client-module ${primary === 'services' ? 'client-module-primary' : ''}`}>
      <div className="client-module-heading"><div><span className="client-module-kicker"><CalendarDays size={13}/> Services</span><h2>Choose what you need</h2></div></div>
      <div className="grid gap-2">{data.services.map((service) => { const bookable = service.bookable !== false && enabled.has('booking'); const content = <><span className="client-service-main">{service.image_url&&<img className="client-service-thumb" src={service.image_url} alt=""/>}<span><strong>{service.name}</strong>{service.description && <small>{service.description}</small>}</span></span><span className="text-right">{service.price_cents != null && <strong>${(service.price_cents / 100).toFixed(2)}</strong>}{service.duration_minutes && <small>{service.duration_minutes} min</small>}{bookable?<ArrowRight size={15}/>:<small className="client-service-view-only">View only</small>}</span></>; return bookable ? <button type="button" key={service.id} onClick={()=>selectService(service.id)} className="client-service client-service-bookable">{content}</button> : <div key={service.id} className="client-service client-service-static">{content}</div> })}</div>
    </section>}

    {enabled.has('booking') && <BookingModule businessId={businessId} businessName={businessName} services={data.services} settings={bookingSettings} primary={primary === 'booking'} selectedOffer={bookingOffer} selectedServiceId={bookingServiceId} onClearOffer={()=>setBookingOffer(null)} onSelectService={selectService} onClearSelectedService={()=>setBookingServiceId(null)}/>} 
    {enabled.has('ordering') && <OrderModule businessId={businessId} businessName={businessName} products={data.products} primary={primary === 'ordering'}/>}
    {enabled.has('request_service') && <RequestServiceModule businessId={businessId} businessName={businessName} settings={requestSettings} primary={primary === 'request_service'}/>}

    {data.gallery.length > 0 && <section className="client-module">
      <div className="client-module-heading"><div><span className="client-module-kicker"><Images size={13}/> Gallery</span><h2>A look at our work</h2></div></div>
      <div className="client-gallery">{data.gallery.map((item) => <figure key={item.id}><img src={item.image_url} alt={item.caption || 'Business gallery image'}/>{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}</div>
    </section>}

    {data.hours.length > 0 && <section className="client-module">
      <div className="client-module-heading"><div><span className="client-module-kicker"><Clock3 size={13}/> Hours</span><h2>Plan your visit</h2></div></div>
      <dl className="client-hours">{data.hours.map((hour) => <div key={hour.id}><dt>{dayNames[hour.day_of_week]}</dt><dd>{hour.closed ? 'Closed' : `${hour.open_time?.slice(0, 5)} – ${hour.close_time?.slice(0, 5)}`}</dd></div>)}</dl>
    </section>}

    {enabled.has('contact_form') && data.leadForms.map((form) => <section key={form.id} className={`client-module ${primary === 'contact_form' ? 'client-module-primary' : ''}`}>
      <div className="client-module-heading"><div><span className="client-module-kicker"><Send size={13}/> Get in touch</span><h2>{form.title}</h2>{form.description && <p>{form.description}</p>}</div></div>
      {sent === form.id ? <div className="client-form-success">Thanks—your request was sent.</div> : <form action={(formData) => submitLead(form.id, formData)} className="client-lead-form">
        <input name="website" tabIndex={-1} autoComplete="off" className="hidden"/>
        {form.fields.includes('name') && <input name="name" placeholder="Name" maxLength={100}/>} {form.fields.includes('phone') && <input name="phone" type="tel" placeholder="Phone" maxLength={40}/>} {form.fields.includes('email') && <input name="email" type="email" placeholder="Email" maxLength={160}/>} {form.fields.includes('message') && <textarea name="message" placeholder="How can we help?" rows={3} maxLength={1500}/>}<button disabled={sending}>{sending ? 'Sending…' : form.cta_label}<ArrowRight size={16}/></button>
      </form>}
    </section>)}
  </div>
}

function defaultCtaLabel(actionType: string) {
  switch (actionType) {
    case 'order_now': return 'Order Now'
    case 'booking': return 'Book Offer'
    case 'request_service': return 'Request Service'
    case 'external_link': return 'Learn More'
    case 'call': return 'Call'
    case 'text': return 'Text'
    default: return ''
  }
}
