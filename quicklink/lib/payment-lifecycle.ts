import 'server-only'
import type Stripe from 'stripe'
import { createHash, randomBytes } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCalendarProvider } from '@/lib/calendar'
import { formatDate, formatDateTime, formatPhone, formatTime } from '@/lib/display-format'
import { sendBusinessEmail, sendCustomerEmail, transactionEmailHtml } from '@/lib/email'
import { money, paymentReceipt, publicOrigin } from '@/lib/stripe'
import { orderReference } from '@/lib/order-manage-client'

type PaymentRow = {
  id: string; business_id: string; order_id: string | null; appointment_id: string | null; service_request_id: string | null
  kind: 'order' | 'booking' | 'quote'; stripe_account_id: string; amount_due_cents: number; currency: string
}

export async function fulfillCheckout(stripe: Stripe, session: Stripe.Checkout.Session, connectedAccount: string) {
  const admin = createAdminClient()
  if (!admin) throw new Error('Supabase service client is unavailable')
  const { data: payment } = await admin.from('payments').select('*').eq('stripe_checkout_session_id', session.id).eq('stripe_account_id', connectedAccount).maybeSingle()
  if (!payment) throw new Error(`No Quicklink payment found for Checkout Session ${session.id}`)
  if (payment.status === 'paid' || payment.status === 'deposit_paid') return
  if (session.payment_status !== 'paid') return
  const intentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null
  const receipt = await paymentReceipt(stripe, connectedAccount, intentId)
  const paidStatus = payment.kind === 'booking' && payment.amount_due_cents < Number(payment.metadata?.total_price_cents || payment.amount_due_cents) ? 'deposit_paid' : 'paid'
  const { data: claimed } = await admin.from('payments').update({ status: paidStatus, amount_paid_cents: payment.amount_due_cents, stripe_payment_intent_id: intentId, stripe_charge_id: receipt.chargeId, receipt_url: receipt.receiptUrl }).eq('id', payment.id).eq('status','pending').select('id').maybeSingle()
  if (!claimed) return
  if (payment.order_id) await admin.from('orders').update({ status: 'new', payment_status: 'paid', payment_expires_at: null }).eq('id', payment.order_id)
  if (payment.appointment_id) await admin.from('appointments').update({ status: 'confirmed', payment_status: paidStatus, amount_paid_cents: payment.amount_due_cents, hold_expires_at: null }).eq('id', payment.appointment_id)
  if (payment.service_request_id) await admin.from('service_requests').update({ status: 'paid', payment_status: 'paid', quote_accepted_at: new Date().toISOString() }).eq('id', payment.service_request_id)
  await sendPaidNotifications(payment as PaymentRow, receipt.receiptUrl)
  if (payment.appointment_id) await syncPaidBookingCalendar(payment.appointment_id)
}

export async function failCheckout(session: Stripe.Checkout.Session, status: 'failed' | 'expired') {
  const admin = createAdminClient()
  if (!admin) throw new Error('Supabase service client is unavailable')
  const { data: payment } = await admin.from('payments').select('*').eq('stripe_checkout_session_id', session.id).maybeSingle()
  if (!payment || !['pending'].includes(payment.status)) return
  await admin.from('payments').update({ status }).eq('id', payment.id)
  if (payment.order_id) await admin.from('orders').update({ status: status === 'expired' ? 'expired' : 'payment_failed', payment_status: 'failed', payment_expires_at: null }).eq('id', payment.order_id)
  if (payment.appointment_id) await admin.from('appointments').update({ status: status === 'expired' ? 'expired' : 'payment_failed', payment_status: 'failed', hold_expires_at: null }).eq('id', payment.appointment_id)
  if (payment.service_request_id) await admin.from('service_requests').update({ payment_status: 'failed', status: 'quoted' }).eq('id', payment.service_request_id)
}

export async function applyRefundEvent(refund: Stripe.Refund, connectedAccount: string) {
  const admin = createAdminClient()
  if (!admin) throw new Error('Supabase service client is unavailable')
  const intentId = typeof refund.payment_intent === 'string' ? refund.payment_intent : refund.payment_intent?.id
  if (!intentId) return
  const { data: payment } = await admin.from('payments').select('*').eq('stripe_account_id', connectedAccount).eq('stripe_payment_intent_id', intentId).maybeSingle()
  if (!payment) return
  const refundStatus = refund.status === 'succeeded' ? 'succeeded' : refund.status === 'failed' ? 'failed' : refund.status === 'canceled' ? 'cancelled' : 'pending'
  await admin.from('refunds').upsert({ payment_id: payment.id, business_id: payment.business_id, stripe_refund_id: refund.id, amount_cents: refund.amount, reason: refund.metadata?.quicklink_reason || refund.reason || 'Customer refund', status: refundStatus, failure_reason: refund.failure_reason || null }, { onConflict: 'stripe_refund_id' })
  const { data: succeeded } = await admin.from('refunds').select('amount_cents').eq('payment_id', payment.id).eq('status', 'succeeded')
  const refunded = (succeeded || []).reduce((sum, row) => sum + row.amount_cents, 0)
  const next = refundStatus === 'failed' ? (payment.amount_refunded_cents ? 'partially_refunded' : 'paid') : refundStatus === 'pending' ? 'refund_pending' : refunded >= payment.amount_paid_cents ? 'refunded' : 'partially_refunded'
  await admin.from('payments').update({ amount_refunded_cents: refunded, status: next }).eq('id', payment.id)
  const targetUpdate = { payment_status: next }
  if (payment.order_id) await admin.from('orders').update(targetUpdate).eq('id', payment.order_id)
  if (payment.appointment_id) await admin.from('appointments').update(targetUpdate).eq('id', payment.appointment_id)
  if (payment.service_request_id) await admin.from('service_requests').update(targetUpdate).eq('id', payment.service_request_id)
  if (refundStatus === 'succeeded') await sendRefundNotification(payment as PaymentRow, refund.amount)
}

export async function notifyUnpaidOrder(orderId: string, manageUrl: string) {
  const admin = createAdminClient(); if (!admin) return
  const { data: order } = await admin.from('orders').select('*,order_items(*),businesses(*)').eq('id', orderId).single()
  if (!order) return
  await sendOrderEmails(order, manageUrl, null)
}

export async function notifyConfirmedBooking(appointmentId: string, manageUrl: string) {
  const admin = createAdminClient(); if (!admin) return
  const { data } = await admin.from('appointments').select('*,booking_services(*),businesses(*)').eq('id', appointmentId).single()
  if (data) await sendBookingEmails(data, null, manageUrl)
}

export async function syncConfirmedBookingCalendar(appointmentId: string) {
  return syncPaidBookingCalendar(appointmentId)
}

async function sendPaidNotifications(payment: PaymentRow, receiptUrl: string | null) {
  const admin = createAdminClient(); if (!admin) return
  if (payment.order_id) {
    const { data } = await admin.from('orders').select('*,order_items(*),businesses(*)').eq('id', payment.order_id).single()
    if (data) await sendOrderEmails(data, await createReceiptManageUrl(payment.business_id, 'order', payment.order_id, 'order/manage'), receiptUrl)
  } else if (payment.appointment_id) {
    const { data } = await admin.from('appointments').select('*,booking_services(*),businesses(*)').eq('id', payment.appointment_id).single()
    if (data) await sendBookingEmails(data, receiptUrl, await createReceiptManageUrl(payment.business_id, 'booking', payment.appointment_id, 'booking/manage'))
  } else if (payment.service_request_id) {
    const { data } = await admin.from('service_requests').select('*,businesses(*)').eq('id', payment.service_request_id).single()
    if (data) await sendQuotePaidEmails(data, receiptUrl, await createReceiptManageUrl(payment.business_id, 'request', payment.service_request_id, 'request/manage'))
  }
}

async function sendOrderEmails(order: any, manageUrl: string | null, receiptUrl: string | null) {
  const business = Array.isArray(order.businesses) ? order.businesses[0] : order.businesses
  const reference = orderReference(order.id)
  const items = (order.order_items || []).map((item: any) => ({ name: item.product_name, quantity: item.quantity, amount: money(item.unit_price_cents * item.quantity, order.currency) }))
  const customerSections = [{ title: 'Fulfillment', rows: [{ label: order.fulfillment_method === 'delivery' ? 'Delivery' : 'Pickup', value: order.address || business?.name || 'Business location' }, ...(order.notes ? [{ label: 'Notes', value: order.notes }] : [])] }]
  const customerHtml = transactionEmailHtml({ eyebrow: 'Order confirmed', title: `Thank you, ${order.customer_name}.`, businessName: business?.name || 'Your business', logoUrl: business?.logo_url, reference: `Order #${reference} · ${formatDateTime(order.created_at)}`, badge: order.payment_status === 'not_required' ? 'PAY LATER' : 'PAID', items, totals: [{ label: 'Total', value: money(order.total_cents, order.currency), strong: true }], sections: customerSections, cta: manageUrl ? { label: 'View order', url: manageUrl } : receiptUrl ? { label: 'View payment receipt', url: receiptUrl } : undefined })
  const ownerHtml = transactionEmailHtml({ eyebrow: 'New order', title: `Order #${reference}`, businessName: business?.name || 'Quicklink business', logoUrl: business?.logo_url, badge: order.payment_status === 'not_required' ? 'PAY LATER' : 'PAID', items, totals: [{ label: 'Total', value: money(order.total_cents, order.currency), strong: true }], sections: [{ title: 'Customer information', rows: [{ label: 'Name', value: order.customer_name }, { label: 'Phone', value: formatPhone(order.customer_phone) }, ...(order.customer_email ? [{ label: 'Email', value: order.customer_email }] : [])] }, ...customerSections], cta: { label: 'Open order in Quicklink', url: `${publicOrigin()}/dashboard/activity?business=${order.business_id}` } })
  const text = `ORDER CONFIRMED\n${business?.name || ''}\nOrder #${reference}\n\n${items.map((i: any) => `${i.quantity} × ${i.name}  ${i.amount}`).join('\n')}\nTotal: ${money(order.total_cents, order.currency)}\nPayment: ${order.payment_status === 'not_required' ? 'Pay later' : 'Paid'}${manageUrl ? `\n\nView order: ${manageUrl}` : ''}${receiptUrl ? `\nPayment receipt: ${receiptUrl}` : ''}`
  await Promise.all([
    sendCustomerEmail({ to: order.customer_email, subject: `Order #${reference} confirmed — ${business?.name || 'Quicklink'}`, text, html: customerHtml, replyTo: business?.email }),
    sendBusinessEmail(order.business_id, 'order', `New paid order #${reference}`, text, ownerHtml),
  ])
}

async function sendBookingEmails(appointment: any, receiptUrl: string | null, manageUrl: string | null) {
  const business = Array.isArray(appointment.businesses) ? appointment.businesses[0] : appointment.businesses
  const services = appointment.booking_services || []
  const rows = [{ label: 'Date', value: formatDate(appointment.appointment_date) }, { label: 'Time', value: `${formatTime(appointment.start_time)}–${formatTime(appointment.end_time)}` }, { label: 'Duration', value: `${appointment.duration_minutes || 30} min` }]
  const badge = appointment.payment_status === 'deposit_paid' ? 'DEPOSIT PAID' : appointment.payment_status === 'paid' ? 'PAID' : 'CONFIRMED'
  const html = transactionEmailHtml({ eyebrow: 'Booking confirmed', title: `You're booked, ${appointment.customer_name}.`, businessName: business?.name || 'Your business', logoUrl: business?.logo_url, badge, items: services.map((s: any) => ({ name: s.service_name, amount: money(s.price_cents, appointment.currency) })), totals: [{ label: appointment.payment_status === 'deposit_paid' ? 'Deposit paid' : 'Paid', value: money(appointment.amount_paid_cents, appointment.currency) }, ...(appointment.total_price_cents > appointment.amount_paid_cents ? [{ label: 'Remaining at appointment', value: money(appointment.total_price_cents - appointment.amount_paid_cents, appointment.currency), strong: true }] : [])], sections: [{ title: 'Appointment', rows }], cta: manageUrl ? { label: 'Manage booking', url: manageUrl } : receiptUrl ? { label: 'View payment receipt', url: receiptUrl } : undefined })
  const text = `BOOKING CONFIRMED\n${business?.name || ''}\n${services.map((s: any) => s.service_name).join(', ')}\n${formatDate(appointment.appointment_date)} at ${formatTime(appointment.start_time)}\n${badge}`
  await Promise.all([sendCustomerEmail({ to: appointment.customer_email, subject: `Booking confirmed — ${business?.name || 'Quicklink'}`, text, html, replyTo: business?.email }), sendBusinessEmail(appointment.business_id, 'booking', `New booking — ${appointment.customer_name}`, text, html)])
}

async function sendQuotePaidEmails(request: any, receiptUrl: string | null, manageUrl: string | null) {
  const business = Array.isArray(request.businesses) ? request.businesses[0] : request.businesses
  const total = money(request.quote_amount_cents || 0, request.currency)
  const html = transactionEmailHtml({ eyebrow: 'Quote paid', title: 'Payment received', businessName: business?.name || 'Your business', logoUrl: business?.logo_url, badge: 'PAID', reference: `Request ${request.id.slice(0, 8).toUpperCase()}`, totals: [{ label: 'Paid', value: total, strong: true }], cta: manageUrl ? { label: 'View request', url: manageUrl } : receiptUrl ? { label: 'View payment receipt', url: receiptUrl } : undefined })
  const text = `QUOTE PAID\n${business?.name || ''}\nPaid: ${total}`
  await Promise.all([sendCustomerEmail({ to: request.customer_email, subject: `Payment received — ${business?.name || 'Quicklink'}`, text, html, replyTo: business?.email }), sendBusinessEmail(request.business_id, 'request_service', `Quote paid — ${request.customer_name}`, text, html)])
}

async function sendRefundNotification(payment: PaymentRow, amount: number) {
  const admin = createAdminClient(); if (!admin) return
  const table = payment.order_id ? 'orders' : payment.appointment_id ? 'appointments' : 'service_requests'
  const id = payment.order_id || payment.appointment_id || payment.service_request_id
  const { data } = await admin.from(table).select('customer_email,customer_name,businesses(name,email,logo_url)').eq('id', id!).single()
  if (!data) return
  const business = Array.isArray(data.businesses) ? data.businesses[0] : data.businesses
  const html = transactionEmailHtml({ eyebrow: 'Refund', title: 'Your refund is on the way', businessName: business?.name || 'Your business', logoUrl: business?.logo_url, intro: 'Stripe will return the funds to the original payment method. Bank processing times vary.', badge: 'REFUNDED', totals: [{ label: 'Refund amount', value: money(amount, payment.currency), strong: true }] })
  await sendCustomerEmail({ to: data.customer_email, subject: `Refund issued — ${business?.name || 'Quicklink'}`, text: `A refund of ${money(amount, payment.currency)} was issued to your original payment method.`, html, replyTo: business?.email })
}

async function syncPaidBookingCalendar(appointmentId: string) {
  const admin = createAdminClient(); if (!admin) return
  const { data } = await admin.from('appointments').select('*').eq('id', appointmentId).single()
  if (!data || data.external_calendar_event_id) return
  try {
    const provider = await getCalendarProvider(data.business_id)
    if (!provider) return
    const eventId = await provider.createEvent({ summary: `${data.service_name || 'Appointment'} — ${data.customer_name}`, description: [`Customer: ${data.customer_name}`, `Phone: ${data.customer_phone}`, data.customer_email ? `Email: ${data.customer_email}` : null, data.notes ? `Notes: ${data.notes}` : null, `Quicklink booking ID: ${data.id}`].filter(Boolean).join('\n'), startISO: `${data.appointment_date}T${data.start_time.slice(0, 5)}:00`, endISO: `${data.appointment_date}T${data.end_time.slice(0, 5)}:00` })
    if (eventId) await admin.from('appointments').update({ external_calendar_event_id: eventId, integration_error: null }).eq('id', data.id)
  } catch (error) {
    console.error('[Quicklink calendar] Paid booking sync failed', { appointmentId, error })
    await admin.from('appointments').update({ integration_error: error instanceof Error ? error.message.slice(0, 500) : 'Calendar sync failed' }).eq('id', data.id)
  }
}

async function createReceiptManageUrl(businessId: string, resourceType: 'order' | 'booking' | 'request', resourceId: string, path: string) {
  const admin = createAdminClient(); if (!admin) return null
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const { error } = await admin.from('customer_access_tokens').insert({ business_id: businessId, resource_type: resourceType, resource_id: resourceId, token_hash: tokenHash })
  if (error) { console.error('[Quicklink token] Could not create receipt link', { resourceType, resourceId, error: error.message }); return null }
  return `${publicOrigin()}/${path}/${token}`
}
