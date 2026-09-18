'use client'

import { useRef } from 'react'
import { Calendar } from 'lucide-react'
import { formatDate } from '@/lib/display-format'

/**
 * A native <input type="date"> made to look like one clean, whole-field
 * button — while staying a real, fully interactive native date input
 * everywhere it matters.
 *
 * The input covers the entire control (position: absolute; inset: 0) and is
 * kept enabled and pointer-interactive; opacity: 0 only hides its own inline
 * text/icon. That means the user's actual tap or click lands directly on
 * the real input — no synthetic click, no reliance on showPicker() for the
 * main interaction — so iOS opens its native date wheel and Android opens
 * its native date dialog exactly like any other <input type="date">, and
 * desktop browsers open their native calendar the same way they always do
 * for a date input. The formatted value, placeholder, and calendar icon are
 * a purely visual layer underneath (pointer-events: none) so they display
 * the pretty formatting without ever intercepting the tap.
 *
 * showPicker() is kept only as a progressive enhancement for keyboard
 * activation (Enter/Space) on browsers that support it, for people
 * tabbing to the field rather than clicking/tapping it.
 *
 * Used anywhere Quicklink asks a customer to pick a date (Booking, Request
 * Service) so there's one date-picker pattern, not two.
 */
export function DateField({ value, onChange, onBlur, min, placeholder = 'Choose a date', ariaLabel, invalid, id, required, disabled }: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  min?: string
  placeholder?: string
  ariaLabel?: string
  invalid?: boolean
  id?: string
  required?: boolean
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker() {
    const input = inputRef.current
    if (!input || input.disabled) return
    const withPicker = input as HTMLInputElement & { showPicker?: () => void }
    if (typeof withPicker.showPicker === 'function') {
      try { withPicker.showPicker() } catch {}
    }
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // The native input already handles its own click/tap on every platform;
    // this only helps keyboard users who tabbed to the field, on browsers
    // where Enter/Space wouldn't otherwise surface the picker.
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker() }
  }

  return <div className={`client-date-field${invalid ? ' has-error' : ''}${disabled ? ' is-disabled' : ''}`}>
    <span className={`client-date-field-value${value ? '' : ' is-placeholder'}`} aria-hidden="true">{value ? formatDate(value) : placeholder}</span>
    <Calendar size={16} className="client-date-field-icon" aria-hidden="true"/>
    <input
      ref={inputRef}
      id={id}
      type="date"
      className="client-date-field-input"
      value={value}
      min={min}
      required={required}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
    />
  </div>
}
