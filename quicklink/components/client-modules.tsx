'use client'

import { useFeedback } from '@/components/feedback-provider'
import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Clock3, Copy, Images, MapPin, Megaphone, Send, ShoppingBag, Sparkles, Star } from 'lucide-react'
import type { Business, BusinessLink, BusinessPreferences, PublicHubData } from '@/lib/types'
import { LinkIcon, resolveLinkIcon } from '@/components/link-icon'
import type { OpenStatus } from '@/lib/business-hours'
import { computeEnabledSections, productsSectionTitleFor, resolveSectionOrder, type PublicSectionKey } from '@/lib/section-order'
import { OrderModule, RequestServiceModule, BookingModule } from '@/components/commerce-modules'
import type { BookingSettings, OrderCustomerSettings, RequestServiceSettings } from '@/lib/types'
import { orderCustomerSettings } from '@/lib/order-settings'
import { formatPhone } from '@/lib/display-format'
import Reveal from '@/components/reveal'

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const internalLinkTypes = ['phone', 'sms', 'email']

function event(businessId: string, eventType: string, metadata: Record<string, string> = {}) {
  let visitorId = ''
  try {
    visitorId = localStorage.getItem('quicklink_visitor') || crypto.randomUUID()
    localStorage.setItem('quicklink_visitor', visitorId)
  } catch {}
  fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId, eventType, visitorId, metadata }), keepalive: true }).catch(() => {})
}

export default function ClientModules({ business, businessName, links, data, preferences, openStatus }: {
  business: Business
  businessName: string
  links: BusinessLink[]
  data: PublicHubData
  preferences: BusinessPreferences
  openStatus: OpenStatus | null
}) {
  const businessId = business.id
  const notify = useFeedback()
  const enabled = useMemo(() => new Set(data.features.filter((feature) => feature.enabled).map((feature) => feature.feature_key)), [data.features])
  const primary = data.features.find((feature) => feature.enabled && feature.is_primary)?.feature_key
  const orderingFeature = data.features.find((feature) => feature.feature_key === 'ordering')
  const orderingSettings = orderCustomerSettings(orderingFeature?.settings) as OrderCustomerSettings
  const requestFeature = data.features.find((feature) => feature.feature_key === 'request_service')
  const requestSettings = { title: 'Request Service', description: 'Tell us what you need and we’ll follow up.', show_request: true, show_address: false, address_required: false, show_preferred_date: true, preferred_date_required: false, show_email: true, email_required: false, show_notes: true, sms_enabled: false, ...(requestFeature?.settings || {}) } as RequestServiceSettings
  const bookingFeature = data.features.find((feature) => feature.feature_key === 'booking')
  const bookingSettings = { button_title: 'Book Now', buffer_minutes: 0, minimum_notice_minutes: 60, sms_enabled: false, ...(bookingFeature?.settings || {}) } as BookingSettings
  const [sent, setSent] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [bookingOffer, setBookingOffer] = useState<{serviceId?:string;title:string;promoCode?:string}|null>(null)
  const [bookingServiceId, setBookingServiceId] = useState<string | null>(null)
  const [orderPreselectId, setOrderPreselectId] = useState<string | null>(null)
  const productsTitle = preferences.products_section_title?.trim() || productsSectionTitleFor(preferences.industry)
  const [copiedPromo, setCopiedPromo] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const reviewLink = useMemo(() => links.find((link) => link.type === 'google_review' || resolveLinkIcon(link) === 'google_review'), [links])
  const secondaryLinks = useMemo(() => links.filter((link) => link.id !== reviewLink?.id), [links, reviewLink])

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }

  function handleOffer(offer: PublicHubData['promotions'][number]) {
    event(businessId, 'promotion_click', { promotionId: offer.id })
    switch (offer.action_type) {
      case 'order_now': scrollTo('quicklink-order'); return
      case 'request_service': scrollTo('quicklink-request-service'); return
      case 'booking':
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

  function selectProduct(productId: string) {
    if (!enabled.has('ordering')) return
    event(businessId, 'feature_click', { feature: 'products', productId })
    setOrderPreselectId(productId)
    scrollTo('quicklink-order')
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
      notify('Promo code copied.')
      window.setTimeout(() => setCopiedPromo(null), 1800)
    }).catch(() => notify('Could not copy. Select the promo code and copy it manually.', 'error'))
  }

  function copyField(label: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(label)
      notify(`${label} copied.`)
      window.setTimeout(() => setCopiedField(null), 1800)
    }).catch(() => notify('Could not copy.', 'error'))
  }

  function recordLinkClick(link: BusinessLink) {
    const eventType = link.type === 'phone' ? 'call_click' : link.type === 'sms' ? 'text_click' : link.type === 'directions' ? 'directions_click' : link.type === 'google_review' ? 'review_click' : ['instagram', 'facebook', 'tiktok', 'youtube'].includes(link.type) ? 'social_click' : 'link_click'
    event(businessId, eventType, { link_type: link.type, linkId: link.id })
  }

  async function submitLead(formId: string, formData: FormData) {
    if (sending) return
    setSending(true)
    try {
      const response = await fetch('/api/leads', { method: 'POST', body: JSON.stringify({
        businessId, formId, name: formData.get('name'), phone: formData.get('phone'), email: formData.get('email'),
        message: formData.get('message'), website: formData.get('website'),
      }), headers: { 'content-type': 'application/json' } })
      if (!response.ok) throw new Error('Unable to send')
      setSent(formId); notify('Your request was sent.')
    } catch { notify('Could not send your request. Please try again.', 'error') }
    finally { setSending(false) }
  }

  const enabledSections = useMemo(() => computeEnabledSections({
    hasAnnouncements: data.announcements.length > 0,
    hasProducts: data.products.length > 0,
    hasOrdering: enabled.has('ordering'),
    hasServices: enabled.has('services') && data.services.length > 0,
    hasOffers: data.promotions.length > 0,
    hasBooking: enabled.has('booking'),
    hasRequest: enabled.has('request_service'),
    hasGallery: data.gallery.length > 0,
    hasHours: preferences.show_public_hours && data.hours.length > 0,
    hasReviewLink: Boolean(reviewLink),
    hasContactInfo: Boolean(business.address || business.phone || business.email || preferences.service_area || preferences.fulfillment_text) || secondaryLinks.length > 0,
    hasSecondaryLinks: secondaryLinks.length > 0,
    hasLeadForm: enabled.has('contact_form') && data.leadForms.length > 0,
  }), [data, enabled, reviewLink, secondaryLinks, business, preferences])

  const order = useMemo(
    () => resolveSectionOrder({ savedOrder: preferences.section_order, industry: preferences.industry, enabledSections }),
    [preferences, enabledSections],
  )

  function renderSection(key: PublicSectionKey) {
    switch (key) {
      case 'announcements':
        return <section key={key} className="client-module client-announcement">
          <div className="client-module-kicker"><Megaphone size={13}/> Latest update</div>
          <h2>{data.announcements[0].title}</h2>{data.announcements[0].body && <p>{data.announcements[0].body}</p>}
        </section>

      case 'offers':
        return <section key={key} className={`client-module ${primary === 'special_offers' ? 'client-module-primary' : ''}`}>
          <div className="client-module-heading"><div><span className="client-module-kicker"><Sparkles size={13}/> Current offers</span><h2>Something special</h2></div></div>
          <div className="grid gap-3">{data.promotions.map((offer) => <article key={offer.id} className="client-offer">{offer.image_url && <img className="client-offer-image" src={offer.image_url} alt=""/>}<div className="client-offer-body"><span>{offer.badge && <small>{offer.badge}</small>}<strong>{offer.title}</strong>{offer.description && <em>{offer.description}</em>}</span><div className="client-offer-actions">{offer.promo_code && <button type="button" className="client-promo-code" onClick={() => copyPromo(offer.promo_code!)} aria-label={`Copy promo code ${offer.promo_code}`}><code>{offer.promo_code}</code>{copiedPromo === offer.promo_code ? <Check size={12}/> : <Copy size={12}/>}</button>}{offer.action_type !== 'none' && <button type="button" className="client-offer-cta" onClick={() => handleOffer(offer)}>{offer.cta_label || defaultCtaLabel(offer.action_type)}<ArrowRight size={13}/></button>}</div></div></article>)}</div>
        </section>

      case 'products': {
        const canOrder = enabled.has('ordering')
        if (canOrder) return <OrderModule key={key} businessId={businessId} businessName={businessName} products={data.products} settings={orderingSettings} paymentConfig={data.paymentConfig} sectionTitle={productsTitle} primary={primary === 'ordering'} preselectedProductId={orderPreselectId} onClearPreselected={() => setOrderPreselectId(null)} showCategoryFilters={preferences.show_category_filters} layout={preferences.product_layout}/>
        return <div key={key} className="grid gap-5">
          {data.products.length > 0 && <section className="client-module">
            <div className="client-module-heading"><div><span className="client-module-kicker"><ShoppingBag size={13}/> {canOrder ? 'Shop' : 'Browse'}</span><h2>{productsTitle}</h2></div></div>
            <div className={`client-products ${preferences.product_layout === 'list' ? 'client-order-cart' : 'client-product-grid'}`}>{data.products.slice(0, 8).map((product) => {
              const card = <>
                {product.image_url ? <img src={product.image_url} alt=""/> : <span className="client-service-thumb" aria-hidden="true"/>}
                <div className="client-product-body">
                  {product.featured && <span className="client-featured-badge">Featured</span>}
                  <strong>{product.name}</strong>{product.description && <small>{product.description}</small>}
                  <b>${(product.price_cents / 100).toFixed(2)}</b>
                </div>
              </>
              return <div key={product.id} className="client-product">{card}</div>
            })}</div>
          </section>}
        </div>
      }

      case 'services':
        return <section key={key} className={`client-module ${primary === 'services' ? 'client-module-primary' : ''}`}>
          <div className="client-module-heading"><div><span className="client-module-kicker"><CalendarDays size={13}/> Services</span><h2>Choose what you need</h2></div></div>
          <div className="grid gap-2">{data.services.map((service) => { const action=service.action_type||(service.bookable?'bookable':'display_only'); const bookable = action==='bookable' && enabled.has('booking'); const requestable=action==='request_quote'&&enabled.has('request_service'); const content = <><span className="client-service-main">{service.image_url && <img className="client-service-thumb" src={service.image_url} alt=""/>}<span><strong>{service.name}</strong>{service.description && <small>{service.description}</small>}</span></span><span className="text-right">{service.price_cents != null && <strong>${(service.price_cents / 100).toFixed(2)}</strong>}{service.duration_minutes && <small>{service.duration_minutes} min</small>}{bookable||requestable?<ArrowRight size={15}/>:<small className="client-service-view-only">Details</small>}</span></>; return bookable ? <button type="button" key={service.id} onClick={() => selectService(service.id)} className="client-service client-service-bookable">{content}</button> : requestable?<button type="button" key={service.id} onClick={()=>scrollTo('quicklink-request-service')} className="client-service client-service-bookable">{content}</button>:<div key={service.id} className="client-service client-service-static">{content}</div> })}</div>
        </section>

      case 'booking':
        return <BookingModule key={key} businessId={businessId} businessName={businessName} services={data.services} settings={bookingSettings} paymentConfig={data.paymentConfig} primary={primary === 'booking'} selectedOffer={bookingOffer} selectedServiceId={bookingServiceId} onClearOffer={() => setBookingOffer(null)} onSelectService={selectService} onClearSelectedService={() => setBookingServiceId(null)}/>

      case 'request':
        return <RequestServiceModule key={key} businessId={businessId} businessName={businessName} settings={requestSettings} primary={primary === 'request_service'}/>

      case 'gallery':
        return <section key={key} className="client-module">
          <div className="client-module-heading"><div><span className="client-module-kicker"><Images size={13}/> Gallery</span><h2>A look at our work</h2></div></div>
          <div className="client-gallery">{data.gallery.map((item) => <figure key={item.id}><img src={item.image_url} alt={item.caption || 'Business gallery image'}/>{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}</div>
        </section>

      case 'hours':
        return <section key={key} className="client-module">
          <div className="client-module-heading"><div><span className="client-module-kicker"><Clock3 size={13}/> Hours</span><h2>Plan your visit</h2></div>{openStatus && <span className={`client-open-pill ${openStatus.isOpen ? 'is-open' : 'is-closed'}`}>{openStatus.shortLabel}</span>}</div>
          <dl className="client-hours">{data.hours.map((hour) => <div key={hour.id}><dt>{dayNames[hour.day_of_week]}</dt><dd>{hour.closed ? 'Closed' : `${hour.open_time?.slice(0, 5)} – ${hour.close_time?.slice(0, 5)}`}</dd></div>)}</dl>
        </section>

      case 'reviews':
        return reviewLink && <section key={key} className="client-module client-module-reviews">
          <div className="client-module-heading"><div><span className="client-module-kicker"><Star size={13}/> Reviews</span><h2>What customers say</h2></div></div>
          <a href={reviewLink.url} target="_blank" rel="noreferrer" onClick={() => recordLinkClick(reviewLink)} className="client-review-cta">
            <LinkIcon name="google_review" size={26}/>
            <span><strong>Leave us a review on Google</strong><small>Your feedback helps other customers find us.</small></span>
            <ArrowRight size={18} className="client-link-arrow"/>
          </a>
        </section>

      case 'contact': {
        const rows: Array<{ icon: string; label: string; value: string; href?: string; copy?: boolean }> = []
        if (business.address) rows.push({ icon: 'directions', label: 'Address', value: business.address, href: `https://maps.google.com/?q=${encodeURIComponent(business.address)}` })
        if (preferences.service_area) rows.push({ icon: 'directions', label: 'Service area', value: preferences.service_area })
        if (business.phone) rows.push({ icon: 'phone', label: 'Phone', value: formatPhone(business.phone), href: `tel:${business.phone}`, copy: true })
        if (business.email) rows.push({ icon: 'email', label: 'Email', value: business.email, href: `mailto:${business.email}`, copy: true })
        // Merged with the old "More ways to connect" section: one card sized
        // to whatever the business actually has configured, instead of two
        // separate cards (one of which was often mostly empty space).
        if (!rows.length && !preferences.fulfillment_text && secondaryLinks.length === 0) return null
        return <section key={key} className="client-module">
          <div className="client-module-heading"><div><span className="client-module-kicker"><MapPin size={13}/> Contact</span><h2>Get in touch</h2></div></div>
          {preferences.fulfillment_text && <p className="mb-3 text-[12px] leading-5" style={{ color: 'var(--muted-text)' }}>{preferences.fulfillment_text}</p>}
          {rows.length > 0 && <div className="client-details !justify-start !border-0 !pt-0">{rows.map((row) => <div key={row.label}>
            <LinkIcon name={row.icon} size={16}/>
            {row.href ? <a href={row.href} target={row.icon === 'directions' ? '_blank' : undefined} rel={row.icon === 'directions' ? 'noreferrer' : undefined} className="client-contact-value">{row.value}</a> : <span>{row.value}</span>}
            {row.copy && <button type="button" onClick={() => copyField(row.label, row.value)} className="client-top-icon !h-6 !w-6 !min-h-0" aria-label={`Copy ${row.label.toLowerCase()}`}>{copiedField === row.label ? <Check size={12}/> : <Copy size={12}/>}</button>}
          </div>)}</div>}
          {secondaryLinks.length > 0 && <div className={`client-social-bar${rows.length > 0 || preferences.fulfillment_text ? ' mt-3' : ''}`}>{secondaryLinks.map((link) => <a
            key={link.id}
            href={link.url}
            onClick={() => recordLinkClick(link)}
            target={internalLinkTypes.includes(link.type) ? '_self' : '_blank'}
            rel="noreferrer"
            className="client-social-icon"
            title={link.label}
            aria-label={link.label}
          ><LinkIcon name={resolveLinkIcon(link)} size={18}/><span className="client-social-icon-tip">{link.label}</span></a>)}</div>}
        </section>
      }

      // Folded into 'contact' above so the page doesn't show a near-empty
      // second card — kept as a key (rather than removed) so any saved
      // section_order that still references it degrades harmlessly.
      case 'links':
        return null

      case 'lead':
        return data.leadForms.map((form) => <section key={form.id} className={`client-module ${primary === 'contact_form' ? 'client-module-primary' : ''}`}>
          <div className="client-module-heading"><div><span className="client-module-kicker"><Send size={13}/> Get in touch</span><h2>{form.title}</h2>{form.description && <p>{form.description}</p>}</div></div>
          {sent === form.id ? <div className="client-form-success">Thanks—your request was sent.</div> : <form action={(formData) => submitLead(form.id, formData)} className="client-lead-form">
            <input name="website" tabIndex={-1} autoComplete="off" className="hidden"/>
            {form.fields.includes('name') && <input name="name" placeholder="Name" maxLength={100}/>} {form.fields.includes('phone') && <input name="phone" type="tel" placeholder="Phone" maxLength={40}/>} {form.fields.includes('email') && <input name="email" type="email" placeholder="Email" maxLength={160}/>} {form.fields.includes('message') && <textarea name="message" placeholder="How can we help?" rows={3} maxLength={1500}/>}<button disabled={sending}>{sending ? 'Sending…' : form.cta_label}<ArrowRight size={16}/></button>
          </form>}
        </section>)

      default:
        return null
    }
  }

  // Hours and Contact are short, list-style sections that read fine side by
  // side once there's room — everything else stays full-width so the page
  // doesn't turn into a patchwork on desktop.
  const pairedKeys: PublicSectionKey[] = ['hours', 'contact']
  const motionEnabled = preferences.motion_enabled !== false
  return <div className="client-modules mt-7 grid gap-5 text-left sm:grid-cols-2">
    {order.map((key) => {
      const content = renderSection(key)
      if (!content) return null
      const className = pairedKeys.includes(key) ? 'sm:col-span-1' : 'sm:col-span-2'
      return motionEnabled
        ? <Reveal key={key} className={`client-reveal ${className}`}>{content}</Reveal>
        : <div key={key} className={className}>{content}</div>
    })}
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
