// Normalizes phone numbers to E.164 for Twilio. Twilio's REST API rejects
// anything else (error 21211), which is one of the most common causes of
// "SMS never arrives" even when the account and credentials are fine.
export function toE164(raw: string | null | undefined, defaultCountry = '1'): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '')
    return digits.length >= 8 ? `+${digits}` : null
  }
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  // 10-digit US/CA numbers are the overwhelmingly common case for this app.
  if (digits.length === 10) return `+${defaultCountry}${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (digits.length >= 8) return `+${digits}`
  return null
}

export function isLikelyE164(value: string | null | undefined): boolean {
  return Boolean(value && /^\+[1-9]\d{7,14}$/.test(value))
}
