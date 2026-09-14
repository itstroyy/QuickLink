export default function Loading() {
  return <div role="status" aria-label="Loading dashboard" className="mx-auto max-w-7xl p-6 sm:p-10">
    <span className="sr-only">Loading dashboard…</span>
    <div aria-hidden="true"><div className="ql-skeleton h-8 w-48"/><div className="mt-8 grid gap-4 sm:grid-cols-3">{[0,1,2].map((item) => <div key={item} className="ql-skeleton h-28"/>)}</div><div className="ql-skeleton mt-6 h-64"/></div>
  </div>
}
