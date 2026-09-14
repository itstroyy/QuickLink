import 'server-only'

// Small provider abstraction so Outlook/Apple can be added later without
// touching booking.ts, the booking API routes, or each other. Deliberately
// minimal — just the four operations Quicklink bookings actually need.
export type CalendarEventInput = {
  summary: string
  description: string
  startISO: string
  endISO: string
}

export type CalendarBusyRange = { start: string; end: string }

export type CalendarProvider = {
  getBusyRanges(dateISO: string): Promise<CalendarBusyRange[]>
  createEvent(input: CalendarEventInput): Promise<string | null>
  updateEvent(eventId: string, input: CalendarEventInput): Promise<boolean>
  deleteEvent(eventId: string): Promise<boolean>
}
