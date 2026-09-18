import 'server-only'
import type { BusinessHour } from '@/lib/types'

export type BookedRange = { start_time: string; end_time: string }

function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Computes bookable start times for one day. Slots are generated at a fixed
 * step so the UI shows tidy times (9:00, 9:15, 9:30...), then filtered by:
 *  - business hours / closed days
 *  - the service's duration fitting before closing
 *  - buffer time and overlap against already-booked appointments
 *  - minimum notice, when the date is today
 */
export function computeAvailableSlots(options: {
  date: string
  hour: BusinessHour | undefined
  durationMinutes: number
  bufferMinutes: number
  minimumNoticeMinutes: number
  bookedRanges: BookedRange[]
  now?: Date
  stepMinutes?: number
}): string[] {
  const { date, hour, durationMinutes, bufferMinutes, minimumNoticeMinutes, bookedRanges, now = new Date(), stepMinutes = 15 } = options
  if (!hour || hour.closed || !hour.open_time || !hour.close_time) return []

  const openMinutes = toMinutes(hour.open_time)
  const closeMinutes = toMinutes(hour.close_time)
  if (closeMinutes <= openMinutes) return []

  const busy = bookedRanges.map((range) => ({ start: toMinutes(range.start_time) - bufferMinutes, end: toMinutes(range.end_time) + bufferMinutes }))

  // Compare against the caller's local calendar date, not UTC — using
  // toISOString() here compared a UTC date string against a business-local
  // date string, which could misjudge "today" (and the minimum-notice
  // cutoff) near midnight in timezones ahead of or behind UTC.
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isToday = date === localToday
  const earliestAllowed = isToday ? now.getHours() * 60 + now.getMinutes() + minimumNoticeMinutes : -Infinity

  const slots: string[] = []
  for (let start = openMinutes; start + durationMinutes <= closeMinutes; start += stepMinutes) {
    if (start < earliestAllowed) continue
    const end = start + durationMinutes
    const overlaps = busy.some((range) => start < range.end && end > range.start)
    if (!overlaps) slots.push(toTimeString(start))
  }
  return slots
}
