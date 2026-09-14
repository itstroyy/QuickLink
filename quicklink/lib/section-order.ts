import type { BusinessFeature, FeatureKey } from '@/lib/types'

export type BusinessIndustry = 'general' | 'barber' | 'beauty' | 'detailing' | 'repair' | 'food' | 'cleaning' | 'retail'
export type BusinessPrimaryAction = 'auto' | 'ordering' | 'booking' | 'request_service' | 'phone' | 'none'

/** Must exactly match the `validate_business_preferences` DB trigger's allowed list. */
export const publicSectionKeys = [
  'announcements', 'products', 'services', 'offers', 'booking', 'request',
  'gallery', 'hours', 'reviews', 'contact', 'links', 'lead',
] as const
export type PublicSectionKey = (typeof publicSectionKeys)[number]

export const industryOptions: Array<{ value: BusinessIndustry; label: string; description: string; icon: string }> = [
  { value: 'retail', label: 'Product / Retail', description: 'Sell physical products customers browse and order.', icon: 'ShoppingBag' },
  { value: 'barber', label: 'Barber / Hair', description: 'Haircuts and grooming, booked by appointment.', icon: 'Scissors' },
  { value: 'beauty', label: 'Beauty / Nails', description: 'Salon, spa or nail services, booked by appointment.', icon: 'Sparkles' },
  { value: 'detailing', label: 'Auto Detailing', description: 'Mobile or in-shop detailing, quoted per job.', icon: 'Car' },
  { value: 'repair', label: 'Auto Repair', description: 'Repairs and maintenance, quoted per job.', icon: 'Wrench' },
  { value: 'cleaning', label: 'Cleaning / Home Service', description: 'Home or office service work, quoted per job.', icon: 'SprayCan' },
  { value: 'food', label: 'Restaurant / Food', description: 'Food and drink, ordered for pickup or delivery.', icon: 'Utensils' },
  { value: 'general', label: 'General Service Business', description: "Doesn't fit the categories above — we'll use a balanced default layout.", icon: 'Store' },
]

export const sectionMeta: Record<PublicSectionKey, { label: string; description: string }> = {
  announcements: { label: 'Announcements', description: 'A pinned update or news banner at the top of the page.' },
  products: { label: 'Products', description: 'Show items customers can browse or order.' },
  services: { label: 'Services', description: 'List what you offer, bookable or view-only.' },
  offers: { label: 'Offers', description: 'Promotions and special deals, with optional promo codes.' },
  booking: { label: 'Booking', description: 'Let customers schedule appointments.' },
  request: { label: 'Request / Quote', description: 'Customers tell you what they need and you follow up.' },
  gallery: { label: 'Gallery', description: 'Photos of your work, products or space.' },
  hours: { label: 'Hours', description: 'Your open/closed hours, shown live to customers.' },
  reviews: { label: 'Reviews', description: 'A button so happy customers can leave you a Google review.' },
  contact: { label: 'Contact & Location', description: 'Address, service area, phone and email.' },
  links: { label: 'Links & Social', description: 'Instagram, TikTok, website and other custom links.' },
  lead: { label: 'Contact Form', description: 'A simple form for customers to reach out directly.' },
}

const requestBasedIndustries: BusinessIndustry[] = ['detailing', 'repair', 'cleaning']
const bookingBasedIndustries: BusinessIndustry[] = ['barber', 'beauty']
const orderingBasedIndustries: BusinessIndustry[] = ['retail', 'food']

/** The section order a fresh business of this industry should start with. Action-first, never a dead CTA. */
export const industryDefaultSectionOrder: Record<BusinessIndustry, PublicSectionKey[]> = {
  general: ['announcements', 'services', 'booking', 'request', 'offers', 'products', 'gallery', 'reviews', 'hours', 'contact', 'links', 'lead'],
  retail: ['announcements', 'products', 'offers', 'reviews', 'gallery', 'hours', 'contact', 'links', 'lead'],
  food: ['announcements', 'offers', 'products', 'gallery', 'reviews', 'hours', 'contact', 'links', 'lead'],
  barber: ['announcements', 'booking', 'services', 'offers', 'gallery', 'reviews', 'hours', 'contact', 'links', 'lead'],
  beauty: ['announcements', 'booking', 'services', 'offers', 'gallery', 'reviews', 'hours', 'contact', 'links', 'lead'],
  detailing: ['announcements', 'request', 'services', 'offers', 'gallery', 'reviews', 'hours', 'contact', 'links', 'lead'],
  repair: ['announcements', 'request', 'services', 'offers', 'gallery', 'reviews', 'hours', 'contact', 'links', 'lead'],
  cleaning: ['announcements', 'request', 'services', 'offers', 'gallery', 'reviews', 'hours', 'contact', 'links', 'lead'],
}

/** Industry-aware default heading for the products/showcase section — owners can override with a custom title in Page Settings. */
export const productsSectionTitleByIndustry: Record<BusinessIndustry, string> = {
  retail: 'Shop our products',
  barber: 'Our services',
  beauty: 'Our services',
  detailing: 'Services & packages',
  repair: 'Services & packages',
  cleaning: 'Services & packages',
  food: 'Menu',
  general: 'What we offer',
}

export function productsSectionTitleFor(industry: BusinessIndustry): string {
  return productsSectionTitleByIndustry[industry] || productsSectionTitleByIndustry.general
}

export function defaultPrimaryActionFor(industry: BusinessIndustry): BusinessPrimaryAction {
  if (bookingBasedIndustries.includes(industry)) return 'booking'
  if (requestBasedIndustries.includes(industry)) return 'request_service'
  if (orderingBasedIndustries.includes(industry)) return 'ordering'
  return 'auto'
}

/**
 * Resolves the effective primary action, falling back through what the
 * business has actually enabled so the hero CTA is never dead.
 */
export function resolvePrimaryAction(options: {
  preferred: BusinessPrimaryAction
  industry?: BusinessIndustry
  hasOrdering: boolean
  hasBooking: boolean
  hasRequest: boolean
  hasPhone: boolean
}): Exclude<BusinessPrimaryAction, 'auto'> | null {
  const { preferred, industry, hasOrdering, hasBooking, hasRequest, hasPhone } = options
  const effectivePreferred = preferred === 'auto' ? defaultPrimaryActionFor(industry || 'general') : preferred
  const tryOrder: Array<Exclude<BusinessPrimaryAction, 'auto' | 'none'>> = (() => {
    if (effectivePreferred === 'ordering') return ['ordering', 'booking', 'request_service', 'phone']
    if (effectivePreferred === 'booking') return ['booking', 'request_service', 'ordering', 'phone']
    if (effectivePreferred === 'request_service') return ['request_service', 'booking', 'ordering', 'phone']
    if (effectivePreferred === 'phone') return ['phone', 'booking', 'ordering', 'request_service']
    return ['ordering', 'booking', 'request_service', 'phone']
  })()
  if (preferred === 'none') return null
  for (const action of tryOrder) {
    if (action === 'ordering' && hasOrdering) return 'ordering'
    if (action === 'booking' && hasBooking) return 'booking'
    if (action === 'request_service' && hasRequest) return 'request_service'
    if (action === 'phone' && hasPhone) return 'phone'
  }
  return null
}

/**
 * Builds the final ordered list of sections to render: starts from the
 * owner's saved order (or the industry default), then drops any section
 * whose underlying content/feature isn't actually enabled, and appends any
 * enabled section the saved order forgot (so nothing enabled ever goes
 * missing after a schema/feature change).
 */
export function resolveSectionOrder(options: {
  savedOrder: string[] | null | undefined
  industry: BusinessIndustry
  enabledSections: Set<PublicSectionKey>
}): PublicSectionKey[] {
  const { savedOrder, industry, enabledSections } = options
  const base = (savedOrder && savedOrder.length ? savedOrder : industryDefaultSectionOrder[industry])
    .filter((key): key is PublicSectionKey => (publicSectionKeys as readonly string[]).includes(key))

  const seen = new Set<PublicSectionKey>()
  const ordered: PublicSectionKey[] = []
  for (const key of base) {
    if (enabledSections.has(key) && !seen.has(key)) { ordered.push(key); seen.add(key) }
  }
  for (const key of publicSectionKeys) {
    if (enabledSections.has(key) && !seen.has(key)) { ordered.push(key); seen.add(key) }
  }
  return ordered
}

export function featureEnabled(features: BusinessFeature[], key: FeatureKey): boolean {
  return features.some((f) => f.feature_key === key && f.enabled)
}

/**
 * The single source of truth for "which sections actually have something to
 * show". Used identically by the public page renderer and the owner's
 * section-order editor so the two never disagree about what's on the page.
 */
export function computeEnabledSections(input: {
  hasAnnouncements: boolean
  hasProducts: boolean
  hasOrdering: boolean
  hasServices: boolean
  hasOffers: boolean
  hasBooking: boolean
  hasRequest: boolean
  hasGallery: boolean
  hasHours: boolean
  hasReviewLink: boolean
  hasContactInfo: boolean
  hasSecondaryLinks: boolean
  hasLeadForm: boolean
}): Set<PublicSectionKey> {
  const set = new Set<PublicSectionKey>()
  if (input.hasAnnouncements) set.add('announcements')
  if (input.hasProducts || input.hasOrdering) set.add('products')
  if (input.hasServices) set.add('services')
  if (input.hasOffers) set.add('offers')
  if (input.hasBooking) set.add('booking')
  if (input.hasRequest) set.add('request')
  if (input.hasGallery) set.add('gallery')
  if (input.hasHours) set.add('hours')
  if (input.hasReviewLink) set.add('reviews')
  if (input.hasContactInfo) set.add('contact')
  if (input.hasSecondaryLinks) set.add('links')
  if (input.hasLeadForm) set.add('lead')
  return set
}
