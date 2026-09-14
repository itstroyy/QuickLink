import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCalendarProvider } from '@/lib/calendar'
import type { AppointmentStatus } from '@/lib/types'

const VALID_STATUSES: AppointmentStatus[] = ['confirmed', 'completed', 'cancelled']

// Shared by the admin Activity page and the private Client Activity page —
// both need the exact same rule: if a booking's status change affects an
// active Google Calendar event, keep the calendar in sync. Cancelling a
// booking removes its calendar event (when one exists); other status
// changes don't move the appointment's time, so nothing to sync there.
export async function applyAppointmentStatus(businessId: string, appointmentId: string, status: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!VALID_STATUSES.includes(status as AppointmentStatus)) return { ok: false, error: 'Invalid status' }
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'Server is not configured.' }

  const { data: appointment, error: fetchError } = await admin.from('appointments').select('id,business_id,external_calendar_event_id,archived').eq('id', appointmentId).eq('business_id', businessId).maybeSingle()
  if (fetchError || !appointment) return { ok: false, error: fetchError?.message || 'Booking not found' }

  const terminal = status === 'completed' || status === 'cancelled'
  const { error: updateError } = await admin.from('appointments').update({ status, archived: terminal ? true : appointment.archived }).eq('id', appointmentId)
  if (updateError) return { ok: false, error: updateError.message }

  if (status === 'cancelled' && appointment.external_calendar_event_id) {
    try {
      const provider = await getCalendarProvider(businessId)
      if (provider) {
        await provider.deleteEvent(appointment.external_calendar_event_id)
        await admin.from('appointments').update({ external_calendar_event_id: null }).eq('id', appointmentId)
      }
    } catch (error) {
      // The status change itself already succeeded — a calendar sync
      // failure here must never be reported back as a failed status update.
      console.error('[Quicklink calendar] Failed to remove calendar event for cancelled booking', error)
    }
  }

  return { ok: true }
}
