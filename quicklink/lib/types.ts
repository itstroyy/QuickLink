export type BusinessStatus = 'active' | 'inactive' | 'archived'
export type BusinessTheme = 'minimal' | 'luxury' | 'dark' | 'beauty' | 'automotive'

export type Business = {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  category: string | null
  phone: string | null
  sms: string | null
  email: string | null
  address: string | null
  logo_url: string | null
  cover_url: string | null
  theme: BusinessTheme
  background_color: string
  card_color: string
  primary_color: string
  button_color: string
  button_text_color: string
  text_color: string
  secondary_text_color: string
  border_radius: 'soft' | 'round' | 'sharp'
  background_gradient: string | null
  status: BusinessStatus
  created_at: string
  updated_at: string
}

export type BusinessLink = {
  id: string
  business_id: string
  type: string
  label: string
  url: string
  icon: string | null
  display_order: number
  enabled: boolean
  created_at?: string
}

export type BusinessWithLinks = Business & { business_links: BusinessLink[] }

export type SiteSettings = {
  id: number
  business_name: string
  main_domain: string
  default_theme: BusinessTheme
  default_background_color: string
  default_primary_color: string
  default_button_color: string
  default_button_text_color: string
  default_text_color: string
}
