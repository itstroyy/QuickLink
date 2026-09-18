'use client'

import { useFeedback } from '@/components/feedback-provider'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUp, Calendar, Check, Phone, Share2, ShoppingBag, Sparkles, Wrench } from 'lucide-react'
import { LinkIcon, resolveLinkIcon } from '@/components/link-icon'
import QuicklinkLogo from '@/components/quicklink-logo'
import { themeBackgrounds } from '@/lib/themes'
import type { Business, BusinessLink, BusinessPreferences, PublicHubData } from '@/lib/types'
import { resolvePrimaryAction } from '@/lib/section-order'
import type { OpenStatus } from '@/lib/business-hours'
import ClientModules from '@/components/client-modules'

const themeLabels = {
  minimal: 'Quiet confidence',
  luxury: 'Signature experience',
  dark: 'Built different',
  beauty: 'Made for you',
  automotive: 'Ready when you are',
}

const quickActionTypes = ['phone', 'sms']
const QUICKLINK_URL = 'https://quicklink.host'

export default function ClientPage({ business, links, hubData, preferences, openStatus }: {
  business: Business
  links: BusinessLink[]
  hubData?: PublicHubData
  preferences?: BusinessPreferences
  openStatus?: OpenStatus | null
}) {
  const notify = useFeedback()
  const [copied, setCopied] = useState(false)
  // Increments each time the hero "Book an appointment" CTA is clicked, so
  // Booking can distinguish that explicit request from an organic scroll or
  // a service/offer click landing on the same section. Not read anywhere
  // else — it only ever matters to BookingModule, threaded through below.
  const [bookingCtaSignal, setBookingCtaSignal] = useState(0)
  const radius = business.border_radius === 'round' ? 'rounded-[2rem]' : business.border_radius === 'sharp' ? 'rounded-lg' : 'rounded-2xl'
  const internalTypes = ['phone', 'sms', 'email']
  const isBarbershop = business.category?.toLowerCase().includes('barber') || business.name.toLowerCase().includes('cutz')
  const backdropUrl = business.cover_url || (isBarbershop ? '/images/barbershop-background.png' : themeBackgrounds[business.theme])

  const enabled = useMemo(() => new Set((hubData?.features || []).filter((f) => f.enabled).map((f) => f.feature_key)), [hubData])
  const phoneLink = useMemo(() => links.find((l) => l.type === 'phone'), [links])
  const primaryAction = useMemo(() => resolvePrimaryAction({
    preferred: preferences?.primary_action || 'auto',
    industry: preferences?.industry,
    hasOrdering: enabled.has('ordering'),
    hasBooking: enabled.has('booking'),
    hasRequest: enabled.has('request_service'),
    hasPhone: Boolean(phoneLink),
  }), [preferences, enabled, phoneLink])

  const heroCta = useMemo(() => {
    switch (primaryAction) {
      case 'ordering': return { label: 'Order now', icon: ShoppingBag, kind: 'scroll' as const, target: 'quicklink-order' }
      case 'booking': return { label: 'Book an appointment', icon: Calendar, kind: 'scroll' as const, target: 'quicklink-booking' }
      case 'request_service': return { label: 'Request service', icon: Wrench, kind: 'scroll' as const, target: 'quicklink-request-service' }
      case 'phone': return phoneLink ? { label: 'Call now', icon: Phone, kind: 'link' as const, href: phoneLink.url } : null
      default: return null
    }
  }, [primaryAction, phoneLink])

  // Secondary "Call" CTA next to the primary hero button — only when a phone
  // link exists and isn't already the primary CTA itself (avoids duplicating
  // the same action twice in the hero).
  const secondaryCallLink = useMemo(() => (phoneLink && primaryAction !== 'phone' ? phoneLink : null), [phoneLink, primaryAction])
  const quickActions = useMemo(
    () => links.filter((link) => quickActionTypes.includes(link.type) && !(link.type === 'phone' && secondaryCallLink)).slice(0, 2),
    [links, secondaryCallLink],
  )

  // Compact fulfillment badges — parsed from the existing dashboard
  // "Fulfillment note" field (Page settings) rather than any new schema.
  // A business owner controls these by editing or clearing that one field.
  const heroBadges = useMemo(() => {
    const text = preferences?.fulfillment_text?.trim()
    if (!text) return []
    return text.split(/[•|\n]|,\s*| and /i).map((part) => part.trim()).filter(Boolean).slice(0, 3)
  }, [preferences])

  // Hero announcement pill — sourced from the same dashboard-managed
  // Announcements feature (with its own enabled + date-range controls) that
  // powers the full Announcements section further down the page. Shows the
  // single highest-priority announcement currently in its active window.
  const heroAnnouncement = useMemo(() => {
    const list = hubData?.announcements || []
    const now = Date.now()
    return list
      .filter((a) => a.enabled && (!a.starts_at || new Date(a.starts_at).getTime() <= now) && (!a.ends_at || new Date(a.ends_at).getTime() >= now))
      .sort((a, b) => a.display_order - b.display_order)[0] || null
  }, [hubData])

  useEffect(() => {
    let visitorId = ''
    try { visitorId = localStorage.getItem('quicklink_visitor') || crypto.randomUUID(); localStorage.setItem('quicklink_visitor', visitorId) } catch {}
    fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId: business.id, eventType: 'page_view', visitorId }), keepalive: true }).catch(() => {})
  }, [business.id])

  // Small utility affordance only — not a permanent navigation bar. Appears
  // after scrolling well past the hero and just scrolls back up.
  const [showBackToTop, setShowBackToTop] = useState(false)
  useEffect(() => {
    let frame = 0
    function onScroll() {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        setShowBackToTop(window.scrollY > 900)
        frame = 0
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (frame) window.cancelAnimationFrame(frame) }
  }, [])

  function backToTop() {
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  function record(link: BusinessLink) {
    const eventType = link.type === 'phone' ? 'call_click' : link.type === 'sms' ? 'text_click' : link.type === 'directions' ? 'directions_click' : link.type === 'google_review' ? 'review_click' : ['instagram', 'facebook', 'tiktok', 'youtube'].includes(link.type) ? 'social_click' : 'link_click'
    let visitorId = ''
    try { visitorId = localStorage.getItem('quicklink_visitor') || crypto.randomUUID(); localStorage.setItem('quicklink_visitor', visitorId) } catch {}
    fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId: business.id, linkId: link.id, eventType, visitorId, metadata: { link_type: link.type } }), keepalive: true }).catch(() => {})
  }

  function scrollToCta() {
    if (!heroCta || heroCta.kind !== 'scroll') return
    fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId: business.id, eventType: 'feature_click', metadata: { feature: 'hero_cta', target: heroCta.target } }), keepalive: true }).catch(() => {})
    if (heroCta.target === 'quicklink-booking') setBookingCtaSignal((count) => count + 1)
    document.getElementById(heroCta.target)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }

  async function sharePage() {
    if (navigator.share) {
      await navigator.share({ title: business.name, text: business.tagline || undefined, url: window.location.href }).catch(() => {})
      return
    }
    try { await navigator.clipboard.writeText(window.location.href) }
    catch { notify('Could not copy. Copy the page address from your browser.', 'error'); return }
    notify('Page link copied.')
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return <main
    className="client-shell min-h-screen overflow-hidden px-4 py-5 sm:px-6 sm:py-8"
    data-theme={business.theme}
    data-has-cover={backdropUrl ? 'true' : 'false'}
    data-industry={isBarbershop ? 'barbershop' : undefined}
    data-motion={preferences?.motion_enabled === false ? 'off' : 'on'}
    style={{
      '--page-bg': business.background_gradient || business.background_color,
      '--card-bg': business.card_color,
      '--accent': business.primary_color,
      '--button-bg': business.button_color,
      '--button-text': business.button_text_color,
      '--main-text': business.text_color,
      '--muted-text': business.secondary_text_color,
    } as React.CSSProperties}
  >
    {backdropUrl && <div className="client-photo-backdrop" style={{ backgroundImage: `url(${JSON.stringify(backdropUrl)})` }}/>}
    <div className="client-scene" aria-hidden="true"><span/><span/><span/></div>
    <div className="client-noise" aria-hidden="true"/>

    <div className="relative z-10 mx-auto max-w-[590px] lg:max-w-[720px]">
      <header className="client-topbar mb-5 flex items-center justify-between">
        <a href={QUICKLINK_URL} target="_blank" rel="noreferrer" aria-label="Quicklink — powers this page">
          <QuicklinkLogo className="text-base" markClassName="border border-white/15 bg-black/45 text-[var(--accent)] backdrop-blur-xl"/>
        </a>
        <div className="flex items-center gap-2">
          <button type="button" onClick={sharePage} className="client-top-icon" aria-label={copied ? "Copied" : "Share this page"}>{copied ? <Check size={17}/> : <Share2 size={17}/>}</button>
        </div>
      </header>

      <section className={`client-profile-card ${radius}`}>
        <div className="client-card-glow" aria-hidden="true"/>
        {!backdropUrl && <div className="client-cover-generated"><span>{business.category || themeLabels[business.theme]}</span></div>}

        <div className="relative px-5 pb-7 pt-7 text-center sm:px-8">
          <div className={`client-logo client-hero-anim-1 mx-auto ${radius}`} style={{ backgroundColor: business.primary_color, borderColor: business.card_color }}>
            {business.logo_url ? <img src={business.logo_url} alt={`${business.name} logo`} className="h-full w-full object-cover"/> : <span style={{ color: business.button_text_color }}>{business.name.slice(0, 2).toUpperCase()}</span>}
          </div>

          <div className="client-hero-anim-2 mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-[.28em]" style={{ color: business.primary_color }}>
              <Sparkles size={12}/>{business.category || themeLabels[business.theme]}
              {openStatus && <span className={`client-open-pill ${openStatus.isOpen ? 'is-open' : 'is-closed'}`}><span className="client-open-dot" aria-hidden="true"/>{openStatus.label}</span>}
            </div>
            <h1 className="client-title text-[2.45rem] font-semibold leading-none tracking-[-.045em] sm:text-[3rem]">{business.name}</h1>
            {business.tagline && <p className="mt-3 text-[15px] font-medium tracking-wide" style={{ color: 'var(--main-text)' }}>{business.tagline}</p>}
            {business.description && <p className="mx-auto mt-2 max-w-md text-[14px] leading-6" style={{ color: 'var(--muted-text)' }}>{business.description}</p>}
            {preferences?.service_area && <p className="mt-2 text-[11px] font-medium uppercase tracking-[.1em]" style={{ color: 'var(--muted-text)' }}>Serving {preferences.service_area}</p>}
            {heroBadges.length > 0 && <div className="client-hero-badges mt-3">{heroBadges.map((badge, index) => <span key={index} className="client-hero-badge">{badge}</span>)}</div>}
            {heroAnnouncement && <div className="mt-3"><span className="client-hero-announcement">{heroAnnouncement.title}</span></div>}
          </div>

          {(heroCta || secondaryCallLink) && <div className="client-hero-cta-row client-hero-anim-3 mt-6">
            {heroCta && (heroCta.kind === 'scroll'
              ? <button type="button" onClick={scrollToCta} className={`client-hero-cta ${radius}`}><heroCta.icon size={19}/>{heroCta.label}<ArrowRight size={17}/></button>
              : <a href={heroCta.href} onClick={() => phoneLink && record(phoneLink)} className={`client-hero-cta ${radius}`}><heroCta.icon size={19}/>{heroCta.label}</a>)}
            {secondaryCallLink && <a href={secondaryCallLink.url} onClick={() => record(secondaryCallLink)} className={`client-hero-cta-secondary ${radius}`}><Phone size={17}/>Call</a>}
          </div>}

          {quickActions.length > 0 && <div className="client-quick-actions-row mt-4">
            {quickActions.map((link) => <a key={`quick-${link.id}`} href={link.url} onClick={() => record(link)} target={internalTypes.includes(link.type) ? '_self' : '_blank'} rel="noreferrer" className="client-quick-action-pill">
              <LinkIcon name={resolveLinkIcon(link)} size={16}/>
              <span>{link.type === 'sms' ? 'Text' : link.type === 'phone' ? 'Call' : link.label.split(' ')[0]}</span>
            </a>)}
          </div>}

          {hubData && preferences && <ClientModules business={business} businessName={business.name} links={links} data={hubData} preferences={preferences} openStatus={openStatus ?? null} bookingCtaSignal={bookingCtaSignal}/>}
        </div>
      </section>

      <footer className="mt-5 flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[.16em]">
        <span>Powered by</span>
        <a href={QUICKLINK_URL} target="_blank" rel="noreferrer" aria-label="Quicklink — powers this page">
          <QuicklinkLogo className="text-[11px] normal-case tracking-tight" markClassName="size-6 rounded-lg border border-white/15 bg-black/45"/>
        </a>
      </footer>
    </div>

    <button
      type="button"
      onClick={backToTop}
      className={`client-back-to-top ${showBackToTop ? 'is-visible' : ''}`}
      aria-label="Back to top"
      aria-hidden={!showBackToTop}
      tabIndex={showBackToTop ? 0 : -1}
    ><ArrowUp size={18}/></button>
  </main>
}
