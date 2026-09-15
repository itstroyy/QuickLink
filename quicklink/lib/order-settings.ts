import type { OrderCustomerSettings } from '@/lib/types'

export const defaultOrderCustomerSettings: OrderCustomerSettings = {
  phone_required: true,
  show_email: true,
  email_required: false,
  show_address: true,
  address_required: false,
  show_notes: true,
}

export function orderCustomerSettings(value: unknown): OrderCustomerSettings {
  const input = value && typeof value === 'object' ? value as Partial<OrderCustomerSettings> : {}
  const settings = { ...defaultOrderCustomerSettings, ...input }
  if (settings.email_required) settings.show_email = true
  if (settings.address_required) settings.show_address = true
  return settings
}

export function validCustomerEmail(value: unknown): boolean {
  if (typeof value !== 'string') return false
  const email = value.trim()
  return email.length > 2 && email.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
