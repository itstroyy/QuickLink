import { notFound } from 'next/navigation'
import BookingManageCard from '@/components/booking-manage-card'
import { getManagedAppointment } from '@/lib/booking-manage'

export const dynamic = 'force-dynamic'

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const appointment = await getManagedAppointment(token)
  if (!appointment) notFound()
  const business = Array.isArray(appointment.businesses) ? appointment.businesses[0] : appointment.businesses
  return <BookingManageCard token={token} booking={{
    customerName: appointment.customer_name,
    businessName: business?.name || 'Your business',
    serviceName: appointment.service_name,
    date: appointment.appointment_date,
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    status: appointment.status,
  }}/>
}
