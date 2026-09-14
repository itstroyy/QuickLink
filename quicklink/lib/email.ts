import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

type NotificationKind = 'order' | 'request_service' | 'booking'
type EmailResult = { sent: boolean; reason?: string }

// Mirrors lib/sms.ts's never-throw pattern: a notification failure must
// never bubble up and make a successfully-saved Supabase record look like a
// failed submission to the customer.
export async function sendBusinessEmail(businessId: string, kind: NotificationKind, subject: string, text: string): Promise<EmailResult> {
  try {
    return await sendBusinessEmailInner(businessId, kind, subject, text)
  } catch (error) {
    console.error('[Quicklink email] Unexpected error sending notification', { businessId, kind, error })
    return { sent: false, reason: 'Unexpected error while sending email (see server logs)' }
  }
}

async function sendBusinessEmailInner(businessId: string, kind: NotificationKind, subject: string, text: string): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()

  const admin = createAdminClient()
  if (!admin) {
    const reason = 'SUPABASE_SECRET_KEY is not set — cannot read notification settings'
    console.error('[Quicklink email] Skipped', { businessId, kind, reason })
    return { sent: false, reason }
  }

  const { data, error } = await admin.from('business_notification_settings').select('*').eq('business_id', businessId).maybeSingle()
  if (error) {
    console.error('[Quicklink email] Skipped: could not load notification settings', { businessId, kind, error: error.message })
    return { sent: false, reason: error.message }
  }
  if (!data?.email_notifications_enabled) {
    console.warn('[Quicklink email] Skipped: email notifications are turned off for this business', { businessId, kind })
    return { sent: false, reason: 'Email notifications disabled' }
  }
  if (!data?.notification_email) {
    console.warn('[Quicklink email] Skipped: no notification email address is set for this business', { businessId, kind })
    return { sent: false, reason: 'Notification email missing' }
  }

  if (!apiKey || !from) {
    const missing = [!apiKey && 'RESEND_API_KEY', !from && 'EMAIL_FROM'].filter(Boolean).join(', ')
    const reason = `Resend is not configured (missing: ${missing})`
    console.error('[Quicklink email] Skipped', { businessId, kind, reason })
    return { sent: false, reason }
  }

  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [data.notification_email], subject, text }),
      cache: 'no-store',
    })
  } catch (networkError) {
    console.error('[Quicklink email] Resend request failed (network error)', { businessId, kind, error: networkError instanceof Error ? networkError.message : networkError })
    return { sent: false, reason: 'Could not reach Resend (network error) — see server logs' }
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[Quicklink email] Resend rejected the message', { businessId, kind, status: response.status, detail: detail.slice(0, 500) })
    return { sent: false, reason: `Resend rejected the message (HTTP ${response.status})` }
  }

  return { sent: true }
}
