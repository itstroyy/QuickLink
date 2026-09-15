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
  action_type: 'bookable' | 'request_quote' | 'display_only'
  payment_override: 'inherit' | 'full' | 'deposit' | 'none' | null
  deposit_type: 'percent' | 'fixed' | null
  deposit_value: number | null
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
  paymentConfig: PublicPaymentConfig
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
  featured: boolean
  archived: boolean
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

export type OrderCustomerSettings = {
  phone_required: boolean
  show_email: boolean
  email_required: boolean
  show_address: boolean
  address_required: boolean
  show_notes: boolean
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
  status: 'new' | 'contacted' | 'reviewing' | 'quoted' | 'accepted' | 'paid' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'expired'
  quote_amount_cents: number | null
  quote_message: string | null
  quote_notes: string | null
  quote_expires_at: string | null
  quote_sent_at: string | null
  quote_accepted_at: string | null
  payment_required: boolean
  payment_status: PaymentStatus
  currency: string
  archived: boolean
  created_at: string
}

export type PaymentStatus = 'not_required' | 'pending' | 'paid' | 'deposit_paid' | 'refund_pending' | 'partially_refunded' | 'refunded' | 'failed'
export type OrderStatus = 'pending_payment' | 'new' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled' | 'payment_failed' | 'expired'
export type CustomerOrder = {
  id: string
  business_id: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  fulfillment_method: 'pickup' | 'delivery'
  address: string | null
  notes: string | null
  total_cents: number
  status: OrderStatus
  payment_status: PaymentStatus
  currency: string
  payment_expires_at: string | null
  policy_snapshot: Record<string, unknown>
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

export type PublicPaymentConfig = {
  payments_ready: boolean
  currency: string
  order_payment_mode: 'online_required' | 'pay_later'
  booking_payment_mode: 'full' | 'deposit' | 'none'
  deposit_type: 'percent' | 'fixed'
  deposit_value: number
  allow_multiple_services: boolean
  booking_refund_policy: 'window' | 'non_refundable' | 'manual'
  cancellation_window_hours: number
  deposit_refund_policy: 'refundable' | 'non_refundable' | 'follow_window'
  order_cancellation_policy: 'new_only' | 'new_confirmed' | 'never'
}

export type StripeAccountStatus = 'not_connected' | 'onboarding' | 'restricted' | 'enabled' | 'disconnected'
export type StripeAccountApiVersion = 'v1' | 'v2'

export type BusinessPaymentSettings = Omit<PublicPaymentConfig, 'payments_ready'> & {
  business_id: string
  // Legacy columns. A database trigger keeps these mirroring
  // stripe_live_* on every write, so they always describe the LIVE
  // connected account — that's what customer-facing checkout (orders,
  // bookings) is gated on, regardless of which mode the dashboard viewer
  // is currently in.
  stripe_account_id: string | null
  stripe_details_submitted: boolean
  stripe_charges_enabled: boolean
  stripe_payouts_enabled: boolean
  stripe_account_status: StripeAccountStatus
  connected_at: string | null
  // Mode-scoped Stripe Connect state. Test and live connected accounts are
  // tracked independently so local test-mode development can never read,
  // reuse, or clear the production business's live account (and vice
  // versa).
  stripe_test_account_id: string | null
  stripe_test_details_submitted: boolean
  stripe_test_charges_enabled: boolean
  stripe_test_payouts_enabled: boolean
  stripe_test_account_status: StripeAccountStatus
  stripe_test_connected_at: string | null
  // null means the account was created before this column existed, i.e.
  // via Accounts v1 (stripe.accounts.create). Accounts created since use
  // Accounts v2 (POST /v2/core/accounts) and are stamped 'v2' here.
  stripe_test_account_api: StripeAccountApiVersion | null
  stripe_live_account_id: string | null
  stripe_live_details_submitted: boolean
  stripe_live_charges_enabled: boolean
  stripe_live_payouts_enabled: boolean
  stripe_live_account_status: StripeAccountStatus
  stripe_live_connected_at: string | null
  stripe_live_account_api: StripeAccountApiVersion | null
  updated_at: string
}

export type Payment = {
  id: string
  business_id: string
  order_id: string | null
  appointment_id: string | null
  service_request_id: string | null
  kind: 'order' | 'booking' | 'quote'
  stripe_account_id: string
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_charge_id: string | null
  status: Exclude<PaymentStatus, 'not_required'> | 'expired'
  currency: string
  amount_due_cents: number
  amount_paid_cents: number
  amount_refunded_cents: number
  receipt_url: string | null
  created_at: string
  updated_at: string
}

export type AppointmentStatus = 'pending_payment' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'payment_failed' | 'expired'
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
  total_price_cents: number
  amount_due_cents: number
  amount_paid_cents: number
  payment_status: PaymentStatus
  currency: string
  hold_expires_at: string | null
  duration_minutes: number | null
  policy_snapshot: Record<string, unknown>
  integration_error: string | null
  booking_services?: Array<{ service_id: string | null; service_name: string; price_cents: number; duration_minutes: number; display_order: number }>
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
  show_public_hours: boolean
  show_open_status: boolean
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
  support_email: string | null
  default_timezone: string
  default_currency: string
  email_sender_name: string
  email_reply_to: string | null
}
