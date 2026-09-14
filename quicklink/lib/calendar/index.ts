import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { googleCalendarProvider } from './google'
import type { CalendarProvider } from './types'

export type { CalendarEventInput, CalendarBusyRange, CalendarProvider } from './types'

// Resolves the connected calendar provider for a business, or null when no
// calendar is connected / enabled. Booking must keep working either way —
// every caller treats a null provider as "no calendar sync", never an error.
export async function getCalendarProvider(businessId: string): Promise<CalendarProvider | null> {
  try {
    const admin = createAdminClient()
    if (!admin) return null
    const [connection, notifications] = await Promise.all([
      admin.from('business_calendar_connections').select('business_id').eq('business_id', businessId).maybeSingle(),
      admin.from('business_notification_settings').select('calendar_integration_enabled').eq('business_id', businessId).maybeSingle(),
    ])
    if (!connection.data || !notifications.data?.calendar_integration_enabled) return null
    // Only Google is implemented today; the provider is selected here so
    // Outlook/Apple can be added later by branching on a stored "provider"
    // column without changing any caller.
    return googleCalendarProvider(businessId)
  } catch (error) {
    console.error('[Quicklink calendar] getCalendarProvider error (booking still works without Calendar)', error)
    return null
  }
}
