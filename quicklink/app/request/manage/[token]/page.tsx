import { notFound } from 'next/navigation'
import RequestManageCard from '@/components/request-manage-card'
import { getManagedRequest } from '@/lib/request-manage'

export const dynamic = 'force-dynamic'

export default async function ManageRequestPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ checkout?: string }> }) {
  const { token } = await params
  const request = await getManagedRequest(token)
  if (!request) notFound()
  return <RequestManageCard token={token} request={request} checkout={(await searchParams).checkout}/>
}
