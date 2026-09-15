'use client'

export default function StatusTimeline({ status, steps }: { status: string; steps: Array<{ value: string; label: string }> }) {
  const index = steps.findIndex((step) => step.value === status)
  if (status === 'cancelled') return <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4"><p className="text-xs font-semibold uppercase tracking-[.1em] text-red-700">Timeline</p><p className="mt-2 text-sm font-semibold text-red-800">Cancelled</p></div>
  return <section className="mt-6" aria-label="Status timeline">
    <h3 className="text-xs font-semibold uppercase tracking-[.1em] text-[#77776f]">Timeline</h3>
    <ol className="mt-3 grid grid-cols-2 gap-2 sm:flex">
      {steps.map((step, stepIndex) => {
        const reached = index >= stepIndex
        return <li key={step.value} className="flex flex-1 items-center gap-2 text-xs font-medium">
          <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${reached ? 'border-[#1d1d1b] bg-[#1d1d1b] text-white' : 'border-[#d8d6ce] bg-white text-[#9a988f]'}`}>{reached ? '✓' : stepIndex + 1}</span>
          <span className={reached ? 'text-[#1d1d1b]' : 'text-[#9a988f]'}>{step.label}</span>
        </li>
      })}
    </ol>
  </section>
}
