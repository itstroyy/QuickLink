import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CalendarBusyRange, CalendarEventInput, CalendarProvider } from './types'

type Connection = { access_token: string; refresh_token: string; token_expires_at: string; calendar_id: string }

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: string } | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!data.access_token) return null
    const expiresAt = new Date(Date.now() + (Number(data.expires_in) || 3600) * 1000).toISOString()
    return { accessToken: data.access_token, expiresAt }
  } catch (error) {
    console.error('[Quicklink calendar] Failed to refresh Google access token', error)
    return null
  }
}

// Returns a ready-to-use access token for this business's connected Google
// account, refreshing it first if it has expired. Never throws.
async function getFreshAccessToken(businessId: string): Promise<{ accessToken: string; calendarId: string } | null> {
  const admin = createAdminClient()
  if (!admin) return null
  const { data, error } = await admin.from('business_calendar_connections').select('*').eq('business_id', businessId).maybeSingle()
  if (error || !data) return null
  const connection = data as Connection

  const expiresInMs = new Date(connection.token_expires_at).getTime() - Date.now()
  if (expiresInMs > 60_000) return { accessToken: connection.access_token, calendarId: connection.calendar_id }

  const refreshed = await refreshAccessToken(connection.refresh_token)
  if (!refreshed) return null
  await admin.from('business_calendar_connections').update({ access_token: refreshed.accessToken, token_expires_at: refreshed.expiresAt }).eq('business_id', businessId)
  return { accessToken: refreshed.accessToken, calendarId: connection.calendar_id }
}

export function googleCalendarProvider(businessId: string): CalendarProvider {
  return {
    async getBusyRanges(dateISO: string): Promise<CalendarBusyRange[]> {
      try {
        const auth = await getFreshAccessToken(businessId)
        if (!auth) return []
        const timeMin = `${dateISO}T00:00:00Z`
        const timeMax = `${dateISO}T23:59:59Z`
        const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          method: 'POST',
          headers: { authorization: `Bearer ${auth.accessToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({ timeMin, timeMax, items: [{ id: auth.calendarId }] }),
          cache: 'no-store',
        })
        if (!response.ok) { console.error('[Quicklink calendar] freeBusy lookup failed', response.status, await response.text().catch(() => '')); return [] }
        const data = await response.json()
        const busy = data?.calendars?.[auth.calendarId]?.busy || []
        return busy.map((range: { start: string; end: string }) => ({ start: range.start, end: range.end }))
      } catch (error) {
        console.error('[Quicklink calendar] getBusyRanges error (booking still works without Calendar)', error)
        return []
      }
    },

    async createEvent(input: CalendarEventInput): Promise<string | null> {
      try {
        const auth = await getFreshAccessToken(businessId)
        if (!auth) return null
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events`, {
          method: 'POST',
          headers: { authorization: `Bearer ${auth.accessToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({ summary: input.summary, description: input.description, start: { dateTime: input.startISO }, end: { dateTime: input.endISO } }),
          cache: 'no-store',
        })
        if (!response.ok) { console.error('[Quicklink calendar] createEvent failed', response.status, await response.text().catch(() => '')); return null }
        const data = await response.json()
        return data.id || null
      } catch (error) {
        console.error('[Quicklink calendar] createEvent error (booking still saved without a calendar event)', error)
        return null
      }
    },

    async updateEvent(eventId: string, input: CalendarEventInput): Promise<boolean> {
      try {
        const auth = await getFreshAccessToken(businessId)
        if (!auth) return false
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(eventId)}`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${auth.accessToken}`, 'content-type': 'application/json' },
          body: JSON.stringify({ summary: input.summary, description: input.description, start: { dateTime: input.startISO }, end: { dateTime: input.endISO } }),
          cache: 'no-store',
        })
        return response.ok
      } catch (error) {
        console.error('[Quicklink calendar] updateEvent error', error)
        return false
      }
    },

    async deleteEvent(eventId: string): Promise<boolean> {
      try {
        const auth = await getFreshAccessToken(businessId)
        if (!auth) return false
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(auth.calendarId)}/events/${encodeURIComponent(eventId)}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${auth.accessToken}` },
          cache: 'no-store',
        })
        return response.ok || response.status === 410 || response.status === 404
      } catch (error) {
        console.error('[Quicklink calendar] deleteEvent error', error)
        return false
      }
    },
  }
}
