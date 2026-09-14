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

export type FeatureKey =
  | 'services' | 'special_offers' | 'business_hours' | 'announcements' | 'gallery' | 'contact_form'
  | 'booking' | 'ordering' | 'request_service' | 'pricing' | 'google_reviews'
  | 'loyalty' | 'referrals' | 'text_list' | 'email_list' | 'menu' | 'reorder'

export type BusinessFeature = {
  id: string
  business_id: string
  feature_key: FeatureKey
  enabled: boolean
  is_primary: boolean
  display_order: number
  settings: Record<string, unknown>
}

export type Service = {
  id: string
  business_id: string
  name: string
  description: string | null
  category: string | null
  price_cents: number | null
  duration_minutes: number | null
  deposit_cents: number | null
  image_url: string | null
  enabled: boolean
  bookable: boolean
  display_order: number
}

export type PromotionActionType = 'none' | 'order_now' | 'booking' | 'request_service' | 'external_link' | 'call' | 'text'

export type Promotion = {
  id: string
  business_id: string
  title: string
  description: string | null
  badge: string | null
  promo_code: string | null
  image_url: string | null
  starts_at: string | null
  ends_at: string | null
  enabled: boolean
  display_order: number
  action_type: PromotionActionType
  action_value: string | null
  cta_label: string | null
}

export type BusinessHour = {
  id: string
  business_id: string
  day_of_week: number
  open_time: string | null
  close_time: string | null
  closed: boolean
}

export type Announcement = {
  id: string
  business_id: string
  title: string
  body: string | null
  starts_at: string | null
  ends_at: string | null
  enabled: boolean
  display_order: number
}

export type GalleryItem = {
  id: string
  business_id: string
  image_url: string
  caption: string | null
  display_order: number
  enabled: boolean
}

export type LeadForm = {
  id: string
  business_id: string
  title: string
  description: string | null
  cta_label: string
  fields: Array<'name' | 'phone' | 'email' | 'message'>
  enabled: boolean
  display_order: number
}

export type LeadSubmission = {
  id: string
  business_id: string
  lead_form_id: string
  name: string | null
  phone: string | null
  email: string | null
  message: string | null
  status: 'new' | 'contacted' | 'closed'
  created_at: string
}

export type PublicHubData = {
  features: BusinessFeature[]
  services: Service[]
  promotions: Promotion[]
  hours: BusinessHour[]
  announcements: Announcement[]
  gallery: GalleryItem[]
  leadForms: LeadForm[]
  products: Product[]
}

export type Product = {
  id: string
  business_id: string
  name: string
  description: string | null
  price_cents: number
  image_url: string | null
  category: string | null
  available: boolean
  display_order: number
}

export type RequestServiceSettings = {
  title: string
  description: string
  show_request: boolean
  show_address: boolean
  address_required: boolean
  show_preferred_date: boolean
  show_email: boolean
  email_required: boolean
  show_notes: boolean
  sms_enabled: boolean
}

export type ServiceRequest = {
  id: string
  business_id: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  address: string | null
  preferred_date: string | null
  request_details: string | null
  notes: string | null
  status: 'new' | 'contacted' | 'in_progress' | 'completed' | 'cancelled'
  archived: boolean
  created_at: string
}

export type OrderStatus = 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled'
export type CustomerOrder = {
  id: string
  business_id: string
  customer_name: string
  customer_phone: string
  fulfillment_method: 'pickup' | 'delivery'
  address: string | null
  notes: string | null
  total_cents: number
  status: OrderStatus
  archived: boolean
  manage_token_hash?: string | null
  created_at: string
  order_items?: OrderItem[]
}
export type OrderItem = { id: string; order_id: string; product_id: string | null; product_name: string; unit_price_cents: number; quantity: number }
export type NotificationSettings = {
  business_id: string
  notification_phone: string | null
  order_sms: boolean
  booking_sms: boolean
  quote_sms: boolean
  delivery_sms: boolean
  notification_email: string | null
  push_notifications_enabled: boolean
  email_notifications_enabled: boolean
  calendar_integration_enabled: boolean
}

export type BookingSettings = {
  button_title: string
  buffer_minutes: number
  minimum_notice_minutes: number
  sms_enabled: boolean
}

export type AppointmentStatus = 'confirmed' | 'completed' | 'cancelled'
export type Appointment = {
  id: string
  business_id: string
  service_id: string | null
  service_name: string | null
  customer_name: string
  customer_phone: string
  customer_email: string | null
  notes: string | null
  appointment_date: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  archived: boolean
  external_calendar_event_id: string | null
  manage_token_hash?: string | null
  created_at: string
}

export type BusinessClientAccess = {
  business_id: string
  client_activity_enabled: boolean
  client_activity_show_orders: boolean
  client_activity_show_bookings: boolean
  client_activity_show_service_requests: boolean
  activity_access_token: string
}

export type BusinessPreferences = {
  business_id: string
  industry: 'general' | 'barber' | 'beauty' | 'detailing' | 'repair' | 'food' | 'cleaning' | 'retail'
  primary_action: 'auto' | 'ordering' | 'booking' | 'request_service' | 'phone' | 'none'
  section_order: string[]
  timezone: string
  service_area: string | null
  fulfillment_text: string | null
  products_section_title: string | null
  updated_at: string
}

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
