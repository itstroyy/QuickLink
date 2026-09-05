import {
  ArrowUpRight,
  CalendarDays,
  Globe,
  Link as LinkIconBase,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Star,
  Utensils,
} from 'lucide-react'

export const linkIconOptions = [
  { value: 'default', label: 'Arrow' }, { value: 'google_review', label: 'Google' },
  { value: 'instagram', label: 'Instagram' }, { value: 'zelle', label: 'Zelle' },
  { value: 'cashapp', label: 'Cash App' }, { value: 'venmo', label: 'Venmo' },
  { value: 'facebook', label: 'Facebook' }, { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' }, { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'website', label: 'Website' }, { value: 'booking', label: 'Booking' },
  { value: 'directions', label: 'Directions' }, { value: 'phone', label: 'Phone' },
  { value: 'sms', label: 'Text message' }, { value: 'email', label: 'Email' },
  { value: 'menu', label: 'Menu' }, { value: 'review', label: 'Review star' },
  { value: 'link', label: 'Link' },
] as const

export function resolveLinkIcon(link: { icon?: string | null; type: string; label: string; url: string }) {
  const searchable = `${link.label} ${link.url}`.toLowerCase()
  const brandMatches: Array<[RegExp, string]> = [
    [/instagram\.com|\binstagram\b/, 'instagram'], [/zelle|zellepay/, 'zelle'],
    [/cash\s?app|cash\.app/, 'cashapp'], [/venmo/, 'venmo'], [/facebook\.com|\bfacebook\b/, 'facebook'],
    [/tiktok/, 'tiktok'], [/youtu(?:\.be|be\.com)|\byoutube\b/, 'youtube'], [/whatsapp|wa\.me/, 'whatsapp'],
  ]
  return brandMatches.find(([pattern]) => pattern.test(searchable))?.[1] || link.icon || link.type
}

export function LinkIcon({ name, size = 20 }: { name?: string | null; size?: number }) {
  const key = (name || 'default').toLowerCase()
  const props = { width: size, height: size, 'aria-hidden': true } as const

  if (key === 'instagram') return <svg {...props} viewBox="0 0 24 24" fill="none"><defs><linearGradient id="ig" x1="3" y1="21" x2="21" y2="3"><stop stopColor="#ffd600"/><stop offset=".45" stopColor="#ff0169"/><stop offset="1" stopColor="#7638fa"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig)"/><circle cx="12" cy="12" r="4.25" stroke="white" strokeWidth="1.8"/><circle cx="17.6" cy="6.5" r="1.2" fill="white"/></svg>
  if (key === 'zelle') return <svg {...props} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="#6d1ed4"/><path d="M8.2 7.2h8.1L8.4 16.8h8.2M12 4.8v2.4M12 16.8v2.4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if (key === 'cashapp') return <svg {...props} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="#00d64f"/><path d="M15.7 8.1c-.8-.7-2-1.1-3.4-1.1-1.8 0-3.2.8-3.2 2.2 0 3.2 6.1 1.5 6.1 4.3 0 1.4-1.3 2.3-3.3 2.3-1.5 0-2.9-.5-3.8-1.4M13 5.5l-2 13" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
  if (key === 'venmo') return <svg {...props} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="#008cff"/><path d="M16.8 6.2c.3.7.4 1.5.4 2.4 0 2.8-2.4 6.5-4.4 9H8.3L6.5 7.1l3.9-.4.9 7.4c.8-1.3 1.8-3.4 1.8-4.8 0-.8-.1-1.4-.4-1.9l4.1-1.2Z" fill="white"/></svg>
  if (key === 'facebook') return <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1877f2"/><path d="M14.7 13.1h2.2l.35-2.7H14.7V8.7c0-.78.22-1.31 1.34-1.31h1.43V5a19 19 0 0 0-2.08-.11c-2.06 0-3.47 1.26-3.47 3.57v1.94H9.6v2.7h2.32V20h2.78v-6.9Z" fill="white"/></svg>
  if (key === 'youtube') return <svg {...props} viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0033"/><path d="m10 9 6 3-6 3V9Z" fill="white"/></svg>
  if (key === 'tiktok') return <svg {...props} viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="#101010"/><path d="M14.5 6c.35 1.7 1.3 2.7 3 3v2.25a7 7 0 0 1-3-1v4.25a4 4 0 1 1-3.45-3.96v2.3a1.75 1.75 0 1 0 1.2 1.66V6h2.25Z" fill="white"/></svg>
  if (key === 'whatsapp') return <svg {...props} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#25d366"/><path d="M7.4 17.2 8 15.1a6 6 0 1 1 2 1.7l-2.6.4Zm3.1-8.8c-.2-.5-.4-.5-.7-.5h-.4c-.3 0-.7.3-.7.9 0 2.1 2.2 4.7 5.3 5.6.6.2 1.4-.4 1.7-.9.2-.4.1-.7-.1-.8l-1.6-.8c-.3-.1-.5 0-.7.3l-.5.6c-.1.2-.3.2-.5.1-1.1-.5-2-1.3-2.5-2.4-.1-.2 0-.4.1-.5l.4-.5c.2-.2.2-.4.2-.6l-.6-1.5Z" fill="white"/></svg>
  if (key === 'google_review' || key === 'google') return <svg {...props} viewBox="0 0 24 24"><path d="M21.6 12.2c0-.7-.06-1.4-.18-2H12v3.87h5.38a4.6 4.6 0 0 1-2 3v2.51h3.24c1.9-1.74 2.98-4.31 2.98-7.38Z" fill="#4285f4"/><path d="M12 22c2.7 0 4.98-.9 6.63-2.42l-3.24-2.51c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.59A10 10 0 0 0 12 22Z" fill="#34a853"/><path d="M6.39 13.9A6 6 0 0 1 6.08 12c0-.66.11-1.3.31-1.9V7.51H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.49l3.35-2.59Z" fill="#fbbc05"/><path d="M12 5.97c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.51l3.35 2.59C7.18 7.73 9.39 5.97 12 5.97Z" fill="#ea4335"/></svg>

  const LucideIcon = key === 'booking' ? CalendarDays : key === 'directions' ? MapPin : key === 'phone' ? Phone : key === 'sms' ? MessageSquare : key === 'email' ? Mail : key === 'menu' ? Utensils : key === 'website' ? Globe : key === 'review' ? Star : key === 'link' ? LinkIconBase : ArrowUpRight
  return <LucideIcon size={size} aria-hidden="true" />
}
