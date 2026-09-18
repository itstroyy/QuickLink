'use client'

import { ArrowRight, Check, Copy, Sparkles } from 'lucide-react'
import type { Promotion } from '@/lib/types'

export function defaultCtaLabel(actionType: string) {
  switch (actionType) {
    case 'order_now': return 'Shop offer'
    case 'booking': return 'Book with offer'
    case 'request_service': return 'Claim offer'
    case 'external_link': return 'Learn more'
    case 'call': return 'Call now'
    case 'text': return 'Text now'
    default: return ''
  }
}

/**
 * A single promotion, styled as a small campaign banner rather than a plain
 * text row. Works two ways depending on whether the business uploaded an
 * image: image-forward (the photo fills the card, text sits on a scrim) or
 * gradient-forward (built from the business's own accent color, so it never
 * looks hardcoded to one brand/industry).
 *
 * The whole card is one interactive element — the promo-code chip is the
 * only nested control, and it stops propagation so copying a code doesn't
 * also fire the card's action.
 */
export function PromoCard({ offer, copied, onCopyCode, onActivate, compact }: {
  offer: Promotion
  copied: boolean
  onCopyCode: (code: string) => void
  onActivate: () => void
  compact?: boolean
}) {
  const hasAction = offer.action_type !== 'none'
  const cta = offer.cta_label?.trim() || defaultCtaLabel(offer.action_type)
  const badge = offer.badge?.trim() || (offer.ends_at ? 'Limited time' : null)

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!hasAction) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate() }
  }
  function handleCopyClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (offer.promo_code) onCopyCode(offer.promo_code)
  }

  return <article
    className={`client-promo-card ${offer.image_url ? 'has-image' : 'no-image'} ${hasAction ? 'is-actionable' : ''} ${compact ? 'is-compact' : ''}`}
    role={hasAction ? 'button' : undefined}
    tabIndex={hasAction ? 0 : undefined}
    onClick={hasAction ? onActivate : undefined}
    onKeyDown={handleKeyDown}
    aria-label={hasAction ? `${cta} — ${offer.title}` : undefined}
  >
    {offer.image_url && <img className="client-promo-card-image" src={offer.image_url} alt=""/>}
    <span className="client-promo-card-scrim" aria-hidden="true"/>
    <span className="client-promo-card-sheen" aria-hidden="true"/>
    <div className="client-promo-card-content">
      {badge && <span className="client-promo-badge"><Sparkles size={10}/>{badge}</span>}
      <div className="client-promo-card-main">
        <strong className="client-promo-value">{offer.title}</strong>
        {offer.description && <p className="client-promo-sub">{offer.description}</p>}
      </div>
      <div className="client-promo-card-bottom">
        {offer.promo_code && <button type="button" className="client-promo-card-code" onClick={handleCopyClick} aria-label={`Copy promo code ${offer.promo_code}`}>
          <code>{offer.promo_code}</code>{copied ? <Check size={12}/> : <Copy size={12}/>}
        </button>}
        {hasAction && <span className="client-promo-cta"><span>{cta}</span><ArrowRight size={14} className="client-promo-cta-arrow"/></span>}
      </div>
    </div>
  </article>
}
