export default function QuicklinkLogo({ className = '', markClassName = '', compact = false }: { className?: string; markClassName?: string; compact?: boolean }) {
  return <span className={`inline-flex items-center gap-2.5 font-semibold tracking-[-0.04em] ${className}`} aria-label="Quicklink">
    <span className={`inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[0.65rem] shadow-sm ${markClassName}`} style={{ backgroundColor: '#f6f1e8' }}>
      <img src="/quicklink-mark.png" alt="" aria-hidden="true" className="size-[88%] object-contain"/>
    </span>
    {!compact && <span>Quicklink</span>}
  </span>
}
