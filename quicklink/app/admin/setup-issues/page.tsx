import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, CheckCircle2, TriangleAlert } from 'lucide-react'
import { computeSetupIssues } from '@/lib/setup-issues'

export default async function SetupIssuesPage() {
  const issues = await computeSetupIssues()
  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-3xl">
    <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-[#77776f]"><ArrowLeft size={16}/> Back to dashboard</Link>
    <div className="mt-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Workspace overview</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">All setup issues</h1><p className="mt-2 text-[#77776f]">Every active business with an actionable problem, most important first. Each business shows only its next issue to fix.</p></div>
    <div className="mt-8 rounded-2xl border border-[#deded7] bg-white">
      <div className="flex items-center gap-2 border-b px-5 py-4"><TriangleAlert size={16} className="text-[#8b6b3d]"/><h2 className="font-semibold">Setup issues</h2><span className="ml-auto text-xs text-[#999991]">{issues.length}</span></div>
      {issues.length === 0 ? <div className="flex items-center gap-2.5 px-5 py-8 text-sm text-[#46734d]"><CheckCircle2 size={17}/> All active businesses are ready.</div> :
        <div className="divide-y">{issues.map((issue) => <Link key={issue.businessId} href={issue.href} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#fafaf7]"><span className="min-w-0"><span className="block truncate text-sm font-medium">{issue.businessName}</span><span className="block text-xs text-[#999991]">{issue.label}</span></span><span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[#8b6b3d]">{issue.action} <ArrowUpRight size={14}/></span></Link>)}</div>}
    </div>
  </div></main>
}
