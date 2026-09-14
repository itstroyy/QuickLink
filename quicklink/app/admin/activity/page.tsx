import { Suspense } from 'react'
import { loadActivity } from '@/lib/activity-data'
import ActivityManager from '@/components/activity-manager'

export default async function ActivityPage() {
  const activity = await loadActivity()
  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-6xl">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">Admin</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Activity</h1><p className="mt-2 text-[#77776f]">Orders, bookings and service requests across every client. Filter by business or status — nothing here is deleted, it's all still in Supabase.</p></div>
    <div className="mt-8"><Suspense fallback={null}><ActivityManager activity={activity}/></Suspense></div>
  </div></main>
}
