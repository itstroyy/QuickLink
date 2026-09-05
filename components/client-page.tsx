'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Share2, Sparkles } from 'lucide-react'
import { LinkIcon, resolveLinkIcon } from '@/components/link-icon'
import QuicklinkLogo from '@/components/quicklink-logo'
import { themeBackgrounds } from '@/lib/themes'
import type { Business, BusinessLink } from '@/lib/types'

const themeLabels = {
  minimal: 'Quiet confidence',
  luxury: 'Signature experience',
  dark: 'Built different',
  beauty: 'Made for you',
  automotive: 'Ready when you are',
}

const quickActionTypes = ['phone', 'sms', 'tiktok', 'menu', 'website']

export default function ClientPage({ business, links }: { business: Business; links: BusinessLink[] }) {
  const [copied, setCopied] = useState(false)
  const radius = business.border_radius === 'round' ? 'rounded-[2rem]' : business.border_radius === 'sharp' ? 'rounded-lg' : 'rounded-2xl'
  const internalTypes = ['phone', 'sms', 'email']
  const quickActions = useMemo(() => links.filter((link) => quickActionTypes.includes(link.type)).slice(0, 4), [links])
  const quickActionIds = useMemo(() => new Set(quickActions.map((link) => link.id)), [quickActions])
  const mainLinks = useMemo(() => links.filter((link) => !quickActionIds.has(link.id)), [links, quickActionIds])
  const isBarbershop = business.category?.toLowerCase().includes('barber') || business.name.toLowerCase().includes('cutz')
  const backdropUrl = business.cover_url || (isBarbershop ? '/images/barbershop-background.png' : themeBackgrounds[business.theme])

  useEffect(() => {
    fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId: business.id, eventType: 'page_view' }), keepalive: true }).catch(() => {})
  }, [business.id])

  function record(linkId: string) {
    fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ businessId: business.id, linkId, eventType: 'link_click' }), keepalive: true }).catch(() => {})
  }

  async function sharePage() {
    if (navigator.share) {
      await navigator.share({ title: business.name, text: business.tagline || undefined, url: window.location.href }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return <main
    className="client-shell min-h-screen overflow-hidden px-4 py-5 sm:px-6 sm:py-8"
    data-theme={business.theme}
    data-has-cover={backdropUrl ? 'true' : 'false'}
    data-industry={isBarbershop ? 'barbershop' : undefined}
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

    <div className="relative z-10 mx-auto max-w-[590px]">
      <header className="client-topbar mb-5 flex items-center justify-between">
        <QuicklinkLogo className="text-base" markClassName="border border-white/15 bg-black/45 text-[var(--accent)] backdrop-blur-xl"/>
        <div className="flex items-center gap-2">
          <button type="button" onClick={sharePage} className="client-top-icon" aria-label="Share this page">{copied ? <Check size={17}/> : <Share2 size={17}/>}</button>
        </div>
      </header>

      <section className={`client-profile-card ${radius}`}>
        <div className="client-card-glow" aria-hidden="true"/>
        {!backdropUrl && <div className="client-cover-generated"><span>{business.category || themeLabels[business.theme]}</span></div>}

        <div className="relative px-5 pb-7 pt-7 text-center sm:px-8">
          <div className={`client-logo mx-auto ${radius}`} style={{ backgroundColor: business.primary_color, borderColor: business.card_color }}>
            {business.logo_url ? <img src={business.logo_url} alt={`${business.name} logo`} className="h-full w-full object-cover"/> : <span style={{ color: business.button_text_color }}>{business.name.slice(0, 2).toUpperCase()}</span>}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[.28em]" style={{ color: business.primary_color }}><Sparkles size={12}/>{business.category || themeLabels[business.theme]}</div>
            <h1 className="client-title text-[2.45rem] font-semibold leading-none tracking-[-.045em] sm:text-[3rem]">{business.name}</h1>
            {business.tagline && <p className="mt-3 text-[15px] font-medium tracking-wide" style={{ color: 'var(--main-text)' }}>{business.tagline}</p>}
            {business.description && <p className="mx-auto mt-2 max-w-md text-[14px] leading-6" style={{ color: 'var(--muted-text)' }}>{business.description}</p>}
          </div>

          <div className="mt-7 grid gap-3 text-left">
            {mainLinks.map((link, index) => <a
              key={link.id}
              href={link.url}
              onClick={() => record(link.id)}
              target={internalTypes.includes(link.type) ? '_self' : '_blank'}
              rel="noreferrer"
              className={`client-link group ${radius} ${/review/i.test(`${link.label} ${link.url}`) ? 'client-link-featured' : ''}`}
            >
              <span className="client-link-icon"><LinkIcon name={resolveLinkIcon(link)} size={23}/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-semibold sm:text-[15px]">{link.label}</span><span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[.18em] opacity-45">Tap to open</span></span>
              <span className="client-link-number">{String(index + 1).padStart(2, '0')}</span>
              <ArrowRight size={18} className="client-link-arrow"/>
            </a>)}
          </div>

          {quickActions.length > 1 && <div className="client-quick-actions mt-7">
            {quickActions.map((link) => <a key={`quick-${link.id}`} href={link.url} onClick={() => record(link.id)} target={internalTypes.includes(link.type) ? '_self' : '_blank'} rel="noreferrer" className="client-quick-action">
              <span><LinkIcon name={resolveLinkIcon(link)} size={23}/></span>
              <small>{link.type === 'sms' ? 'Text' : link.type === 'phone' ? 'Call' : link.type === 'booking' ? 'Book' : link.label.replace(/^(Follow (us )?on|Visit|View|Our)\s+/i, '').split(' ')[0]}</small>
            </a>)}
          </div>}

          {(business.address || business.email) && <div className="client-details mt-7">
            {business.address && <div><LinkIcon name="directions" size={16}/><span>{business.address}</span></div>}
            {business.email && <div><LinkIcon name="email" size={16}/><span>{business.email}</span></div>}
          </div>}
        </div>
      </section>

      <footer className="mt-5 flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[.16em]"><span>Powered by</span><QuicklinkLogo className="text-[11px] normal-case tracking-tight" markClassName="size-6 rounded-lg border border-white/15 bg-black/45"/></footer>
    </div>
  </main>
}
