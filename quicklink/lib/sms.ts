import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { toE164, isLikelyE164 } from '@/lib/phone'

type NotificationKind = 'order' | 'request_service' | 'booking'
type SmsResult = { sent: boolean; reason?: string }

// Twilio trial accounts can only send to phone numbers that have been
// verified in the Twilio console. That failure mode looks identical to a
// misconfigured account from the outside (SMS silently never arrives), so we
// detect the common Twilio error codes and say so explicitly in the logs.
const TRIAL_RESTRICTION_CODES = new Set([21608, 21610, 21614])

export async function sendBusinessSms(businessId: string, kind: NotificationKind, message: string): Promise<SmsResult> {
  try {
    return await sendBusinessSmsInner(businessId, kind, message)
  } catch (error) {
    // This function must never throw. A thrown error here would bubble up
    // through the calling API route's try/catch and turn a successfully
    // saved order/request/booking into what looks like a failed submission
    // to the customer, even though their record was already saved.
    console.error('[Quicklink SMS] Unexpected error sending notification', { businessId, kind, error })
    return { sent: false, reason: 'Unexpected error while sending SMS (see server logs)' }
  }
}

async function sendBusinessSmsInner(businessId: string, kind: NotificationKind, message: string): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_PHONE_NUMBER?.trim()

  const admin = createAdminClient()
  if (!admin) {
    const reason = 'SUPABASE_SECRET_KEY is not set — cannot read notification settings'
    console.error('[Quicklink SMS] Skipped', { businessId, kind, reason })
    return { sent: false, reason }
  }

  const { data, error } = await admin.from('business_notification_settings').select('*').eq('business_id', businessId).maybeSingle()
  if (error) {
    console.error('[Quicklink SMS] Skipped: could not load notification settings', { businessId, kind, error: error.message })
    return { sent: false, reason: error.message }
  }
  if (!data?.notification_phone) {
    console.warn('[Quicklink SMS] Skipped: no notification phone number is set for this business', { businessId, kind })
    return { sent: false, reason: 'Notification phone missing' }
  }

  let enabled = Boolean(data[`${kind}_sms`])
  if (kind === 'request_service') {
    const { data: feature, error: featureError } = await admin.from('business_features').select('settings').eq('business_id', businessId).eq('feature_key', 'request_service').maybeSingle()
    if (featureError) {
      console.error('[Quicklink SMS] Skipped: could not load request_service settings', { businessId, error: featureError.message })
      return { sent: false, reason: featureError.message }
    }
    enabled = Boolean((feature?.settings as { sms_enabled?: boolean } | null)?.sms_enabled)
  }
  if (!enabled) {
    console.warn('[Quicklink SMS] Skipped: SMS notifications are turned off for this event type', { businessId, kind })
    return { sent: false, reason: 'Notification disabled' }
  }

  if (!accountSid || !authToken || !from) {
    const missing = [!accountSid && 'TWILIO_ACCOUNT_SID', !authToken && 'TWILIO_AUTH_TOKEN', !from && 'TWILIO_PHONE_NUMBER'].filter(Boolean).join(', ')
    const reason = `Twilio is not configured (missing: ${missing})`
    console.error('[Quicklink SMS] Skipped', { businessId, kind, reason })
    return { sent: false, reason }
  }

  const to = toE164(data.notification_phone)
  if (!to || !isLikelyE164(to)) {
    const reason = `Notification phone "${data.notification_phone}" is not a valid phone number`
    console.error('[Quicklink SMS] Skipped', { businessId, kind, reason })
    return { sent: false, reason: 'Notification phone number is invalid — use full international format, e.g. +18455551234' }
  }
  const fromFormatted = toE164(from) || from

  const body = new URLSearchParams({ To: to, From: fromFormatted, Body: message.slice(0, 1500) })

  let response: Response
  try {
    response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
      method: 'POST',
      headers: { authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    })
  } catch (networkError) {
    console.error('[Quicklink SMS] Twilio request failed (network error)', { businessId, kind, error: networkError instanceof Error ? networkError.message : networkError })
    return { sent: false, reason: 'Could not reach Twilio (network error) — see server logs' }
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    let code: number | undefined
    let twilioMessage = ''
    try { const parsed = JSON.parse(detail); code = parsed.code; twilioMessage = parsed.message || '' } catch {}
    const trialRestricted = code !== undefined && TRIAL_RESTRICTION_CODES.has(code)
    console.error('[Quicklink SMS] Twilio rejected the message', { businessId, kind, status: response.status, code, twilioMessage, detail: detail.slice(0, 500) })
    if (trialRestricted) {
      return { sent: false, reason: `Twilio trial account restriction: the destination number is not verified. Verify it in the Twilio console, or upgrade the account. (Twilio error ${code})` }
    }
    return { sent: false, reason: twilioMessage || `Twilio rejected the message (HTTP ${response.status})` }
  }

  return { sent: true }
}
