export const timezoneOptions: Array<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Phoenix', label: 'Mountain Time — no DST (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
]

export function timezoneLabel(iana: string): string {
  return timezoneOptions.find((tz) => tz.value === iana)?.label || iana.replace(/_/g, ' ').replace('/', ' — ')
}
