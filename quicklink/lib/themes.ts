import type { BusinessTheme } from '@/lib/types'

export const themePresets: Record<BusinessTheme, {
  label: string
  summary: string
  background_color: string
  card_color: string
  primary_color: string
  button_color: string
  button_text_color: string
  text_color: string
  secondary_text_color: string
  border_radius: 'soft' | 'round' | 'sharp'
}> = {
  minimal: { label: 'Warm Editorial', summary: 'Cafés, wellness and creative studios', background_color: '#8e6a45', card_color: '#fffaf2', primary_color: '#d4a15d', button_color: '#fffaf0', button_text_color: '#251e18', text_color: '#ffffff', secondary_text_color: '#e7ddd1', border_radius: 'soft' },
  luxury: { label: 'Black & Gold', summary: 'Premium services, lounges and dining', background_color: '#0d0b09', card_color: '#17130f', primary_color: '#d8aa55', button_color: '#12100e', button_text_color: '#ffffff', text_color: '#fff9ec', secondary_text_color: '#c9bda8', border_radius: 'sharp' },
  dark: { label: 'Electric Night', summary: 'Fitness, music, tattoo and nightlife', background_color: '#05070c', card_color: '#0b0e16', primary_color: '#647bff', button_color: '#090c14', button_text_color: '#ffffff', text_color: '#ffffff', secondary_text_color: '#b4b9ce', border_radius: 'soft' },
  beauty: { label: 'Pearl Blush', summary: 'Beauty, nails, skincare and bridal', background_color: '#8e5369', card_color: '#fff7f8', primary_color: '#d28aa5', button_color: '#fff9fa', button_text_color: '#452c36', text_color: '#ffffff', secondary_text_color: '#f1dfe5', border_radius: 'round' },
  automotive: { label: 'Performance Red', summary: 'Auto, detailing, repair and trades', background_color: '#08090b', card_color: '#121417', primary_color: '#ed3f35', button_color: '#0d0f12', button_text_color: '#ffffff', text_color: '#ffffff', secondary_text_color: '#bdc0c5', border_radius: 'sharp' },
}

export const themeNames = Object.keys(themePresets) as BusinessTheme[]

export const themeBackgrounds: Record<BusinessTheme, string> = {
  minimal: '/images/theme-minimal.png',
  luxury: '/images/theme-luxury.png',
  dark: '/images/theme-dark.png',
  beauty: '/images/theme-beauty.png',
  automotive: '/images/theme-automotive.png',
}
