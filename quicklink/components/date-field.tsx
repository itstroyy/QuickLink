'use client'

import { useRef } from 'react'
import { Calendar } from 'lucide-react'
import { formatDate } from '@/lib/display-format'

/**
 * A native <input type="date"> made to behave like a single clickable
 * button: the whole control opens the calendar (not just the tiny native
 * icon), with a themed icon and a consistently-formatted value on top of it.
 *
 * The real input stays in the DOM (so mobile still gets the OS date sheet,
 * and the value/min/required semantics are all native) but is fully
 * transparent and non-interactive to the mouse — every click is handled
 * once, by the wrapper, which calls showPicker() and falls back to
 * focus()+click() where showPicker isn't supported. Keyboard users tab to
 * the wrapper itself and press Enter/Space to open the picker.
 *
 * Used anywhere Quicklink asks a customer to pick a date (Booking, Request
 * Service) so there's one date-picker pattern, not two.
 */
export function DateField({ value, onChange, onBlur, min, placeholder = 'Choose a date', ariaLabel, invalid, id, required }: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  min?: string
  placeholder?: string
  ariaLabel?: string
  invalid?: boolean
  id?: string
  required?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker() {
    const input = inputRef.current
    if (!input) return
    const withPicker = input as HTMLInputElement & { showPicker?: () => void }
    if (typeof withPicker.showPicker === 'function') {
      try { withPicker.showPicker(); return } catch {}
    }
    // Older/unsupported browsers: focusing (and clicking, for legacy WebKit)
    // the native input is the closest thing to a guaranteed way to surface
    // its own date UI.
    input.focus()
    input.click()
  }
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker() }
  }

  return <div
    className={`client-date-field${invalid ? ' has-error' : ''}`}
    role="button"
    tabIndex={0}
    aria-label={ariaLabel}
    aria-haspopup="dialog"
    onClick={openPicker}
    onKeyDown={handleKeyDown}
  >
    <span className={`client-date-field-value${value ? '' : ' is-placeholder'}`}>{value ? formatDate(value) : placeholder}</span>
    <Calendar size={16} className="client-date-field-icon" aria-hidden="true"/>
    <input
      ref={inputRef}
      id={id}
      type="date"
      className="client-date-field-input"
      value={value}
      min={min}
      required={required}
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  </div>
}
