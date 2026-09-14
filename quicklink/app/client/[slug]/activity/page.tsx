import { verifyClientToken } from '@/lib/client-access'
import ClientActivityManager from '@/components/client-activity-manager'
import PushNotificationControl from '@/components/push-notification-control'
import { loadClientActivity } from '@/lib/client-activity-data'

// Private, token-gated activity view for one business. No login, no
// dashboard, no editor — just the activity types the admin chose to show,
// scoped strictly to the business the token resolves to server-side.
export default async function ClientActivityPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string }> }) {
  const { slug } = await params
  const { token } = await searchParams
  const verified = await verifyClientToken(slug, token || '')

  if (!verified) {
    return <main className="mx-auto max-w-lg px-5 py-16 text-center"><h1 className="text-2xl font-semibold">Link not available</h1><p className="mt-3 text-[#77776f]">This activity link is invalid, disabled, or has been regenerated. Ask the business owner for a current link.</p></main>
  }

  const activity = await loadClientActivity(verified.businessId, verified.access)

  return <main className="px-5 py-8 lg:px-10 lg:py-10"><div className="mx-auto max-w-5xl">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b6b3d]">{verified.businessName}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Activity</h1><p className="mt-2 text-[#77776f]">Orders, bookings and service requests for this business only. Nothing here is permanently deleted — you can archive and restore records.</p></div>
    <div className="mt-6"><PushNotificationControl slug={slug} token={token || ''}/></div>
    <div className="mt-8"><ClientActivityManager
      slug={slug}
      token={token || ''}
      access={verified.access}
      initialOrders={activity.orders}
      initialAppointments={activity.appointments}
      initialRequests={activity.requests}
    /></div>
  </div></main>
}
