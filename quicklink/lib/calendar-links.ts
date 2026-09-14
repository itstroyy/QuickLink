// Universal "Add to calendar" links. Deliberately dependency-free — no
// Google Calendar API, no OAuth — so booking works today and this file can
// later be extended (e.g. writing external_calendar_event_id back onto the
// appointment) without changing how customers add the event.

export type CalendarEvent = {
  title: string
  description?: string
  location?: string
  startISO: string // e.g. 2026-09-20T14:00:00
  endISO: string
}

function toGoogleDate(iso: string) {
  return iso.replace(/[-:]/g, '').replace(/\.\d+/, '')
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGoogleDate(event.startISO)}/${toGoogleDate(event.endISO)}`,
    details: event.description || '',
    location: event.location || '',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    body: event.description || '',
    location: event.location || '',
    startdt: event.startISO,
    enddt: event.endISO,
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

function icsEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}
function toIcsDate(iso: string) {
  return iso.replace(/[-:]/g, '').replace(/\.\d+/, '')
}

// Works for Apple Calendar and most other calendar apps that don't have a
// URL-based "add event" scheme.
export function icsDataUrl(event: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Quicklink//Booking//EN', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(event.startISO)}`,
    `DTEND:${toIcsDate(event.endISO)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${icsEscape(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${icsEscape(event.location)}`] : []),
    'END:VEVENT', 'END:VCALENDAR',
  ]
  const ics = lines.join('\r\n')
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`
}
