import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

type NotificationKind = 'order' | 'request_service' | 'booking'
type EmailResult = { sent: boolean; reason?: string }

// Mirrors lib/sms.ts's never-throw pattern: a notification failure must
// never bubble up and make a successfully-saved Supabase record look like a
// failed submission to the customer.
export async function sendBusinessEmail(businessId: string, kind: NotificationKind, subject: string, text: string, html?: string): Promise<EmailResult> {
  try {
    return await sendBusinessEmailInner(businessId, kind, subject, text, html)
  } catch (error) {
    console.error('[Quicklink email] Unexpected error sending notification', { businessId, kind, error })
    return { sent: false, reason: 'Unexpected error while sending email (see server logs)' }
  }
}

async function sendBusinessEmailInner(businessId: string, kind: NotificationKind, subject: string, text: string, html?: string): Promise<EmailResult> {
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
      body: JSON.stringify({ from, to: [data.notification_email], subject, text, ...(html ? { html } : {}), ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}) }),
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

export async function sendCustomerEmail(params: { to: string | null | undefined; subject: string; text: string; html: string; replyTo?: string | null }): Promise<EmailResult> {
  const to = params.to?.trim()
  if (!to) return { sent: false, reason: 'Customer email missing' }
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  if (!apiKey || !from) return { sent: false, reason: 'Resend is not configured' }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: params.subject, text: params.text, html: params.html, ...((params.replyTo || process.env.EMAIL_REPLY_TO) ? { reply_to: params.replyTo || process.env.EMAIL_REPLY_TO } : {}) }),
      cache: 'no-store',
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('[Quicklink email] Resend rejected customer email', { to, status: response.status, detail: detail.slice(0, 500) })
      return { sent: false, reason: `Resend rejected the message (HTTP ${response.status})` }
    }
    return { sent: true }
  } catch (error) {
    console.error('[Quicklink email] Customer email request failed', { to, error })
    return { sent: false, reason: 'Could not reach Resend' }
  }
}

export type EmailLineItem = { name: string; quantity?: number; amount: string }

export function transactionEmailHtml(params: {
  eyebrow: string
  title: string
  businessName: string
  logoUrl?: string | null
  intro?: string
  badge?: string
  reference?: string
  sections?: Array<{ title: string; rows: Array<{ label: string; value: string }> }>
  items?: EmailLineItem[]
  totals?: Array<{ label: string; value: string; strong?: boolean }>
  cta?: { label: string; url: string }
  footer?: string
}) {
  const esc = escapeHtml
  const businessIdentity = params.logoUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" align="right"><tr><td style="padding-right:9px;"><img src="${esc(params.logoUrl)}" width="36" height="36" alt="" style="display:block;width:36px;height:36px;border-radius:9px;object-fit:cover;border:1px solid rgba(255,255,255,.2);" /></td><td style="font-size:12px;color:#d9a878;font-weight:650;">${esc(params.businessName)}</td></tr></table>`
    : `<span style="font-size:12px;color:#d9a878;font-weight:650;">${esc(params.businessName)}</span>`
  const sections = (params.sections || []).map((section) => `<tr><td style="padding-top:24px;border-top:1px solid #ebe7df;"><div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:#837d72;text-transform:uppercase;margin-bottom:10px;">${esc(section.title)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${section.rows.map((row) => `<tr><td style="padding:4px 0;color:#777168;font-size:13px;vertical-align:top;">${esc(row.label)}</td><td align="right" style="padding:4px 0 4px 16px;color:#24221f;font-size:13px;font-weight:600;vertical-align:top;">${esc(row.value)}</td></tr>`).join('')}</table></td></tr>`).join('')
  const items = params.items?.length || params.totals?.length ? `<tr><td style="padding-top:24px;border-top:1px solid #ebe7df;"><div style="font-size:11px;font-weight:700;letter-spacing:.12em;color:#837d72;text-transform:uppercase;margin-bottom:10px;">${params.items?.length ? 'Order' : 'Payment summary'}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${(params.items || []).map((item) => `<tr><td style="padding:7px 0;color:#24221f;font-size:13px;">${item.quantity ? `${item.quantity} × ` : ''}${esc(item.name)}</td><td align="right" style="padding:7px 0 7px 16px;color:#24221f;font-size:13px;font-weight:600;">${esc(item.amount)}</td></tr>`).join('')}${(params.totals || []).map((row) => `<tr><td style="padding:${row.strong ? '12px' : '5px'} 0 5px;border-top:${row.strong ? '1px solid #ebe7df' : '0'};color:#6f6a62;font-size:${row.strong ? '15px' : '13px'};font-weight:${row.strong ? '700' : '400'};">${esc(row.label)}</td><td align="right" style="padding:${row.strong ? '12px' : '5px'} 0 5px 16px;border-top:${row.strong ? '1px solid #ebe7df' : '0'};font-size:${row.strong ? '15px' : '13px'};font-weight:700;color:#24221f;">${esc(row.value)}</td></tr>`).join('')}</table></td></tr>` : ''
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f2ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#24221f;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;background:#f4f2ed;"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e5e0d7;border-radius:18px;overflow:hidden;"><tr><td style="background:#1d1d1b;padding:26px 30px;color:#fff;"><table role="presentation" width="100%"><tr><td style="font-size:18px;font-weight:750;">Quicklink</td><td align="right">${businessIdentity}</td></tr></table></td></tr><tr><td style="padding:34px 30px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td><div style="font-size:11px;font-weight:700;letter-spacing:.14em;color:#9a6339;text-transform:uppercase;">${esc(params.eyebrow)}</div><h1 style="margin:8px 0 0;font-size:25px;line-height:1.25;letter-spacing:-.02em;">${esc(params.title)}</h1>${params.reference ? `<div style="margin-top:8px;font-size:13px;color:#777168;">${esc(params.reference)}</div>` : ''}${params.badge ? `<div style="margin-top:14px;display:inline-block;border:1px solid #d8d2c7;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:.06em;">${esc(params.badge)}</div>` : ''}${params.intro ? `<p style="margin:18px 0 0;color:#625e57;font-size:14px;line-height:1.65;">${esc(params.intro)}</p>` : ''}</td></tr>${items}${sections}${params.cta ? `<tr><td style="padding-top:28px;"><a href="${esc(params.cta.url)}" style="display:inline-block;background:#1d1d1b;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 20px;border-radius:11px;">${esc(params.cta.label)}</a></td></tr>` : ''}</table></td></tr><tr><td style="padding:18px 30px;background:#faf8f4;border-top:1px solid #ebe7df;color:#8b857c;font-size:11px;line-height:1.55;">${esc(params.footer || `Sent securely by Quicklink for ${params.businessName}.`)}</td></tr></table></td></tr></table></body></html>`
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
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
