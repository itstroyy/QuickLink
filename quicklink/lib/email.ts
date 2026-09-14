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

// Branded owner-invitation email, sent directly via Resend so the recipient
// never sees Supabase's own unbrandable auth-invite template. Unrelated to
// sendBusinessEmail above: this isn't a business notification, so it doesn't
// look up business_notification_settings — it goes straight to the invited
// person's email with the accept-invitation link the caller generated.
export async function sendInviteEmail(params: { to: string; businessName: string; acceptUrl: string }): Promise<EmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim()
    const from = process.env.EMAIL_FROM?.trim()
    if (!apiKey || !from) {
      const missing = [!apiKey && 'RESEND_API_KEY', !from && 'EMAIL_FROM'].filter(Boolean).join(', ')
      const reason = `Resend is not configured (missing: ${missing})`
      console.error('[Quicklink email] Invite email skipped', { to: params.to, reason })
      return { sent: false, reason }
    }
    const html = inviteEmailHtml(params.businessName, params.acceptUrl)
    const text = `You've been invited to manage ${params.businessName} on Quicklink.\n\nYou'll be able to manage products, services, orders, bookings, requests, hours, offers, analytics, and your business page.\n\nAccept your invitation: ${params.acceptUrl}\n\nThis invitation expires in 7 days. If you weren't expecting this invitation, you can ignore this email.`
    let response: Response
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to: [params.to], subject: `You've been invited to manage ${params.businessName} on Quicklink`, html, text }),
        cache: 'no-store',
      })
    } catch (networkError) {
      console.error('[Quicklink email] Invite request failed (network error)', { to: params.to, error: networkError instanceof Error ? networkError.message : networkError })
      return { sent: false, reason: 'Could not reach Resend (network error) — see server logs' }
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[Quicklink email] Resend rejected the invite', { to: params.to, status: response.status, detail: detail.slice(0, 500) })
      return { sent: false, reason: `Resend rejected the message (HTTP ${response.status})` }
    }
    return { sent: true }
  } catch (error) {
    console.error('[Quicklink email] Unexpected error sending invite', { to: params.to, error })
    return { sent: false, reason: 'Unexpected error while sending email (see server logs)' }
  }
}

function inviteEmailHtml(businessName: string, acceptUrl: string): string {
  const escapedBusiness = businessName.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f4ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f4ef;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:20px;padding:36px 32px;">
<tr><td style="font-size:20px;font-weight:700;color:#1d1d1b;letter-spacing:-0.01em;">Quicklink</td></tr>
<tr><td style="padding-top:24px;font-size:17px;color:#1d1d1b;line-height:1.5;">You&#39;ve been invited to manage <strong>${escapedBusiness}</strong> on Quicklink.</td></tr>
<tr><td style="padding-top:14px;font-size:14px;color:#77776f;line-height:1.6;">You&#39;ll be able to manage products, services, orders, bookings, requests, hours, offers, analytics, and your business page.</td></tr>
<tr><td style="padding-top:26px;"><a href="${acceptUrl}" style="display:inline-block;background:#1d1d1b;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:12px;">Accept invitation</a></td></tr>
<tr><td style="padding-top:22px;font-size:12px;color:#999991;line-height:1.6;">This invitation expires in 7 days.<br/>If you weren&#39;t expecting this invitation, you can ignore this email.</td></tr>
</table>
</td></tr>
</table>
</body></html>`
}
