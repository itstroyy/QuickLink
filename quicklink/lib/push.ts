import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

type PushPayload = { title: string; body: string; tag: string }

function configured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

export function getPushPublicConfig() {
  return { configured: configured(), publicKey: configured() ? process.env.VAPID_PUBLIC_KEY! : null }
}

export async function sendBusinessPush(businessId: string, payload: PushPayload) {
  if (!configured()) {
    console.warn('[Quicklink push] Skipped because VAPID is not configured', { businessId })
    return { sent: 0, configured: false }
  }
  const admin = createAdminClient()
  if (!admin) {
    console.warn('[Quicklink push] Skipped because the Supabase admin client is unavailable', { businessId })
    return { sent: 0, configured: true }
  }
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
    const [{ data: subscriptions }, { data: business }, { data: access }, { data: settings }] = await Promise.all([
      admin.from('business_push_subscriptions').select('id,endpoint,p256dh,auth').eq('business_id', businessId),
      admin.from('businesses').select('slug').eq('id', businessId).maybeSingle(),
      admin.from('business_client_access').select('activity_access_token,client_activity_enabled').eq('business_id', businessId).maybeSingle(),
      admin.from('business_notification_settings').select('push_notifications_enabled').eq('business_id', businessId).maybeSingle(),
    ])
    if (settings?.push_notifications_enabled === false) return { sent: 0, configured: true }
    const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
    const url = business?.slug && access?.client_activity_enabled && access?.activity_access_token
      ? `${site}/client/${business.slug}/activity?token=${encodeURIComponent(access.activity_access_token)}`
      : site || '/'
    let sent = 0
    await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ ...payload, url }))
        sent += 1
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) await admin.from('business_push_subscriptions').delete().eq('id', subscription.id)
        else console.error('[Quicklink push] Delivery failed', { businessId, statusCode: error?.statusCode })
      }
    }))
    return { sent, configured: true }
  } catch (error) {
    console.error('[Quicklink push] Notification processing failed', { businessId, error })
    return { sent: 0, configured: true }
  }
}
