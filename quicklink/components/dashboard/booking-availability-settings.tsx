'use client'
import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useFeedback } from '@/components/feedback-provider'
import type { BookingSettings } from '@/lib/types'
import { mutationErrorMessage, reportClientMutationError } from '@/lib/client-errors'

// Owner-facing "Booking availability" controls. This intentionally does NOT
// duplicate business hours (managed just above, in Business hours) — it only
// covers the knobs that shape how Quicklink turns those hours into bookable
// time slots. Booking availability is always computed from Quicklink's own
// business hours, existing bookings, and these settings; Google Calendar
// (below) is optional and only ever removes slots that conflict with an
// external event — it is never required for booking to have any slots.
export default function BookingAvailabilitySettings({ businessId, featureRowId, initial, enabled, isPrimary, displayOrder, hasBookableHours, calendarConnected }: {
  businessId: string
  featureRowId: string | null
  initial: BookingSettings
  enabled: boolean
  isPrimary: boolean
  displayOrder: number
  hasBookableHours: boolean
  calendarConnected: boolean
}) {
  const notify = useFeedback()
  const [settings, setSettings] = useState<BookingSettings>({ slot_interval_minutes: 15, ...initial })
  const [busy, setBusy] = useState(false)

  function set<K extends keyof BookingSettings>(key: K, value: BookingSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  async function save() {
    setBusy(true)
    const { error } = await createClient().from('business_features').upsert(
      { id: featureRowId ?? undefined, business_id: businessId, feature_key: 'booking', enabled, is_primary: isPrimary, display_order: displayOrder, settings },
      { onConflict: 'business_id,feature_key' },
    )
    setBusy(false)
    if (error) {
      reportClientMutationError('save booking availability settings', error)
      notify(mutationErrorMessage('save booking availability settings', error), 'error')
    } else notify('Booking availability settings saved.')
  }

  if (!enabled) return null

  return <div className="mt-8 rounded-2xl border border-[#e5e2da] bg-white p-5">
    <h2 className="font-semibold">Booking availability</h2>
    <p className="mt-1 text-xs text-[#77776f]">Quicklink works out bookable times from your business hours above, each service's duration, and your existing bookings — no Google Calendar connection required. Use business hours (above) to control which days and hours you're open; use the settings below to fine-tune how those hours turn into bookable slots.</p>

    {!hasBookableHours && <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">No open business hours are set for any day yet, so customers won&rsquo;t see any bookable times. Add your hours above to enable booking.</p>}

    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      <label className="grid gap-1 text-xs font-medium text-[#77776f]">Slot interval
        <select className="form-control" value={settings.slot_interval_minutes ?? 15} onChange={(event) => set('slot_interval_minutes', Number(event.target.value))}>
          <option value={15}>Every 15 min</option>
          <option value={30}>Every 30 min</option>
          <option value={60}>Every 60 min</option>
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-[#77776f]">Minimum notice (minutes)
        <input className="form-control" type="number" min={0} step={15} value={settings.minimum_notice_minutes} onChange={(event) => set('minimum_notice_minutes', Math.max(0, Number(event.target.value) || 0))}/>
      </label>
      <label className="grid gap-1 text-xs font-medium text-[#77776f]">Buffer between appointments (minutes)
        <input className="form-control" type="number" min={0} step={5} value={settings.buffer_minutes} onChange={(event) => set('buffer_minutes', Math.max(0, Number(event.target.value) || 0))}/>
      </label>
    </div>

    <p className="mt-4 rounded-lg border border-[#e5e2da] bg-[#faf9f5] px-3 py-2 text-xs text-[#77776f]">
      {calendarConnected
        ? 'Google Calendar is connected — new bookings sync as events and any conflicting events on your calendar are automatically excluded from bookable times.'
        : 'Google Calendar not connected. Quicklink availability is still active. Connect Calendar (below) to sync events and block external conflicts.'}
    </p>

    <button onClick={save} disabled={busy} className="dashboard-primary mt-4 ml-auto inline-flex items-center gap-2">
      {busy ? <Loader2 size={15} className="animate-spin"/> : <Save size={15}/>}Save booking availability
    </button>
  </div>
}
