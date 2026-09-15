// Next.js loading UI for the public business page. This is a pure routing
// convention (no data, no business logic) — it renders automatically while
// the async Server Component in page.tsx awaits its data, replacing the
// blank white flash with a skeleton that roughly matches the real layout.
// Reuses the existing .ql-skeleton shimmer utility from app/polish.css
// rather than introducing a new one.
export default function Loading() {
  return (
    <main className="client-shell min-h-screen overflow-hidden px-4 py-5 sm:px-6 sm:py-8" style={{ background: '#f5f4ef' }}>
      <div className="relative z-10 mx-auto max-w-[590px] lg:max-w-[720px]">
        <div className="mb-5 flex items-center justify-between">
          <div className="ql-skeleton h-8 w-28 rounded-full" />
          <div className="ql-skeleton h-10 w-10 rounded-full" />
        </div>
        <section className="rounded-2xl border border-black/5 bg-white/70 p-7 text-center">
          <div className="ql-skeleton mx-auto h-24 w-24 rounded-2xl" />
          <div className="ql-skeleton mx-auto mt-5 h-3 w-24 rounded-full" />
          <div className="ql-skeleton mx-auto mt-3 h-8 w-56 rounded-lg" />
          <div className="ql-skeleton mx-auto mt-3 h-3 w-40 rounded-full" />
          <div className="ql-skeleton mx-auto mt-6 rounded-2xl" style={{ height: 54 }} />
          <div className="mt-7 grid gap-3">
            <div className="ql-skeleton h-24 w-full rounded-2xl" />
            <div className="ql-skeleton h-24 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <div className="ql-skeleton h-16 rounded-2xl" />
              <div className="ql-skeleton h-16 rounded-2xl" />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
