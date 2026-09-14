import type { BusinessHour } from '@/lib/types'

export type OpenStatus = {
  isOpen: boolean
  label: string
  shortLabel: string
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function partsInZone(timezone: string, date: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date)
    const weekdayShort = parts.find((p) => p.type === 'weekday')?.value || ''
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || '0')
    const minute = Number(parts.find((p) => p.type === 'minute')?.value || '0')
    const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekdayShort)
    return { dayOfWeek: weekdayIndex < 0 ? date.getDay() : weekdayIndex, minutes: (hour % 24) * 60 + minute }
  } catch {
    return { dayOfWeek: date.getDay(), minutes: date.getHours() * 60 + date.getMinutes() }
  }
}

function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + (m || 0)
}

function formatTime(time: string): string {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return m ? `${hour12}:${String(m).padStart(2, '0')} ${period}` : `${hour12} ${period}`
}

/**
 * Computes a timezone-correct open/closed label for the public page hero.
 * Falls back to a neutral, honest label when hours haven't been set up yet
 * rather than guessing or implying anything false.
 */
export function computeOpenStatus(hours: BusinessHour[], timezone: string, now: Date = new Date()): OpenStatus | null {
  if (!hours.length) return null

  const { dayOfWeek, minutes } = partsInZone(timezone, now)
  const today = hours.find((h) => h.day_of_week === dayOfWeek)

  if (today && !today.closed && today.open_time && today.close_time) {
    const open = toMinutes(today.open_time)
    const close = toMinutes(today.close_time)
    if (minutes >= open && minutes < close) {
      return { isOpen: true, label: `Open now · Closes ${formatTime(today.close_time)}`, shortLabel: 'Open now' }
    }
    if (minutes < open) {
      return { isOpen: false, label: `Closed · Opens ${formatTime(today.open_time)} today`, shortLabel: 'Closed now' }
    }
  }

  // Find the next open day (up to 7 days out) for a helpful "opens ..." label.
  for (let offset = 1; offset <= 7; offset++) {
    const nextDay = (dayOfWeek + offset) % 7
    const candidate = hours.find((h) => h.day_of_week === nextDay)
    if (candidate && !candidate.closed && candidate.open_time) {
      const dayLabel = offset === 1 ? 'tomorrow' : DAY_NAMES[nextDay]
      return { isOpen: false, label: `Closed · Opens ${formatTime(candidate.open_time)} ${dayLabel}`, shortLabel: 'Closed now' }
    }
  }

  return { isOpen: false, label: 'Closed', shortLabel: 'Closed now' }
}
