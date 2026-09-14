import { notFound } from 'next/navigation'
import OrderManageCard from '@/components/order-manage-card'
import { getManagedOrder } from '@/lib/order-manage'

export const dynamic = 'force-dynamic'

export default async function ManageOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const order = await getManagedOrder(token)
  if (!order) notFound()
  return <OrderManageCard token={token} order={order}/>
}
