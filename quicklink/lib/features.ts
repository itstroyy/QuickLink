import type { FeatureKey } from '@/lib/types'

export const phaseOneFeatures: Array<{ key: FeatureKey; label: string; description: string }> = [
  { key: 'ordering', label: 'Order Now', description: 'Let customers choose products and submit an order.' },
  { key: 'request_service', label: 'Request Service', description: 'Collect delivery, quote, catering, detailing or other custom requests.' },
  { key: 'services', label: 'Services', description: 'Show services, pricing and duration.' },
  { key: 'special_offers', label: 'Special offers', description: 'Publish time-limited promotions and codes.' },
  { key: 'business_hours', label: 'Business hours', description: 'Keep weekly opening hours visible.' },
  { key: 'announcements', label: 'Announcements', description: 'Share closures, events and important updates.' },
  { key: 'gallery', label: 'Gallery', description: 'Show real work, products or the business space.' },
  { key: 'contact_form', label: 'Lead form', description: 'Collect quote requests and customer questions.' },
]

export const futureFeatures: Array<{ key: FeatureKey; label: string; phase: number }> = [
  { key: 'booking', label: 'Native booking', phase: 2 },
  { key: 'loyalty', label: 'Loyalty', phase: 5 },
  { key: 'referrals', label: 'Referrals', phase: 5 },
  { key: 'text_list', label: 'Text list', phase: 5 },
  { key: 'email_list', label: 'Email list', phase: 5 },
  { key: 'reorder', label: 'Reorder', phase: 4 },
]

export const featurePresets: Record<string, FeatureKey[]> = {
  barbershop: ['services', 'request_service', 'special_offers', 'business_hours', 'gallery', 'contact_form'],
  salon: ['services', 'request_service', 'special_offers', 'business_hours', 'gallery', 'contact_form'],
  restaurant: ['ordering', 'request_service', 'special_offers', 'business_hours', 'announcements', 'gallery', 'contact_form'],
  automotive: ['services', 'request_service', 'special_offers', 'business_hours', 'gallery', 'contact_form'],
  retail: ['ordering', 'request_service', 'special_offers', 'business_hours', 'announcements', 'gallery', 'contact_form'],
  default: ['services', 'business_hours', 'announcements', 'gallery', 'contact_form'],
}

export function suggestedFeatures(category?: string | null) {
  const value = category?.toLowerCase() ?? ''
  if (value.includes('barber')) return featurePresets.barbershop
  if (value.includes('nail') || value.includes('salon') || value.includes('beauty')) return featurePresets.salon
  if (value.includes('restaurant') || value.includes('pizza') || value.includes('food')) return featurePresets.restaurant
  if (value.includes('auto') || value.includes('mechanic')) return featurePresets.automotive
  if (value.includes('store') || value.includes('retail')) return featurePresets.retail
  return featurePresets.default
}
