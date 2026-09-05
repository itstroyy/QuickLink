export default function QuicklinkLogo({ className = '', markClassName = '', compact = false }: { className?: string; markClassName?: string; compact?: boolean }) {
  return <span className={`inline-flex items-center gap-2.5 font-semibold tracking-[-0.04em] ${className}`} aria-label="Quicklink">
    <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#171715] text-[#e8c07a] shadow-sm ${markClassName}`}>
      <svg viewBox="0 0 32 32" className="size-[18px]" fill="none" aria-hidden="true"><path d="M18.5 3.8 8.8 17.7h6l-1 10.5 9.7-14.8h-5.8l.8-9.6Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round"/></svg>
    </span>
    {!compact && <span>Quicklink</span>}
  </span>
}
