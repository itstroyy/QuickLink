import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeAvailableSlots } from '@/lib/booking'
import { getCalendarProvider } from '@/lib/calendar'
import type { BookingSettings, BusinessHour, Service } from '@/lib/types'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const businessId = url.searchParams.get('businessId')
    const date = url.searchParams.get('date')
    const serviceId = url.searchParams.get('serviceId')
    if (!businessId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Missing or invalid date' }, { status: 400 })

    const supabase = await createClient()
    const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
    const [featureResult, hoursResult, bookedResult, serviceResult, calendarProvider] = await Promise.all([
      supabase.from('business_features').select('settings,enabled').eq('business_id', businessId).eq('feature_key', 'booking').maybeSingle(),
      supabase.from('business_hours').select('*').eq('business_id', businessId).eq('day_of_week', dayOfWeek).maybeSingle(),
      supabase.rpc('quicklink_booked_ranges', { p_business_id: businessId, p_date: date }),
      serviceId ? supabase.from('services').select('*').eq('id', serviceId).eq('business_id', businessId).eq('enabled', true).eq('bookable', true).maybeSingle() : Promise.resolve({ data: null, error: null }),
      getCalendarProvider(businessId),
    ])
    if (!featureResult.data?.enabled) return NextResponse.json({ error: 'Booking is not available' }, { status: 400 })
    if (bookedResult.error) { console.error('[Quicklink booking] availability lookup failed', bookedResult.error); return NextResponse.json({ error: 'Unable to load availability' }, { status: 500 }) }

    const settings = (featureResult.data.settings || {}) as Partial<BookingSettings>
    const service = serviceResult.data as Service | null
    if (serviceId && !service) return NextResponse.json({ error: 'That service is not available for booking' }, { status: 400 })
    const bookedRanges = [...(bookedResult.data || [])]

    // If a calendar is connected, its busy events also block times — but a
    // lookup failure here must never block booking entirely, so any error
    // just means the calendar's busy time isn't excluded for this request.
    if (calendarProvider) {
      try {
        const busy = await calendarProvider.getBusyRanges(date)
        for (const range of busy) {
          const start = range.start.slice(11, 16)
          const end = range.end.slice(11, 16)
          if (start && end) bookedRanges.push({ start_time: `${start}:00`, end_time: `${end}:00` })
        }
      } catch (error) {
        console.error('[Quicklink booking] calendar busy-time lookup failed (continuing without it)', error)
      }
    }

    const slots = computeAvailableSlots({
      date,
      hour: (hoursResult.data || undefined) as BusinessHour | undefined,
      durationMinutes: service?.duration_minutes || 30,
      bufferMinutes: settings.buffer_minutes ?? 0,
      minimumNoticeMinutes: settings.minimum_notice_minutes ?? 0,
      bookedRanges,
    })
    return NextResponse.json({ slots })
  } catch (error) {
    console.error('[Quicklink booking] availability error', error)
    return NextResponse.json({ error: 'Unable to load availability' }, { status: 400 })
  }
}
