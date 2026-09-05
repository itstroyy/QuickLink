export const standardLinks = [
  { type: 'google_review', label: 'Leave us a Google Review', placeholder: 'https://g.page/r/...', icon: 'google_review' },
  { type: 'booking', label: 'Book an appointment', placeholder: 'https://calendly.com/...', icon: 'booking' },
  { type: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/...', icon: 'instagram' },
  { type: 'zelle', label: 'Pay with Zelle', placeholder: 'https://enroll.zellepay.com/...', icon: 'zelle' },
  { type: 'cashapp', label: 'Pay with Cash App', placeholder: 'https://cash.app/$...', icon: 'cashapp' },
  { type: 'venmo', label: 'Pay with Venmo', placeholder: 'https://venmo.com/u/...', icon: 'venmo' },
  { type: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/...', icon: 'facebook' },
  { type: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@...', icon: 'tiktok' },
  { type: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@...', icon: 'youtube' },
  { type: 'whatsapp', label: 'Message on WhatsApp', placeholder: 'https://wa.me/...', icon: 'whatsapp' },
  { type: 'website', label: 'Visit our website', placeholder: 'https://...', icon: 'website' },
  { type: 'directions', label: 'Get directions', placeholder: 'https://maps.google.com/...', icon: 'directions' },
  { type: 'menu', label: 'View our menu', placeholder: 'https://...', icon: 'menu' },
] as const

export function normalizeContactLink(type: string, value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (type === 'phone') return `tel:${trimmed.replace(/[^+\d]/g, '')}`
  if (type === 'sms') return `sms:${trimmed.replace(/[^+\d]/g, '')}`
  if (type === 'email') return `mailto:${trimmed}`
  return trimmed
}

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
