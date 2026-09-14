import { Scissors, ShoppingBag, Wrench } from 'lucide-react'

/**
 * Shared between the hero's customer-facing phone demo (business-demo.tsx)
 * and the business-side Inbox visualization (business-inbox-demo.tsx) so
 * the homepage tells one continuous story about the same three example
 * businesses instead of two disconnected demos.
 */
export const homepageDemoExamples = [
  {
    name: 'Fresh Cuts', type: 'Barber', icon: Scissors, action: 'Book',
    title: 'Your next great cut.', subtitle: 'Barbershop · By appointment',
    items: [['Signature haircut', '$35 · 30 min'], ['Haircut + beard', '$45 · 45 min']] as const,
    cta: 'Choose a time', choices: ['Tuesday · 10:00 AM', 'Tuesday · 2:30 PM'], confirm: 'Confirm demo booking',
    done: 'Appointment confirmed', activity: 'New booking', detail: 'A new appointment, ready to manage.',
    inboxLabel: 'Booking request', servedLabel: 'Appointment confirmed', accent: '#b77b44',
  },
  {
    name: 'Everyday Goods', type: 'Product seller', icon: ShoppingBag, action: 'Order',
    title: 'Everyday essentials.', subtitle: 'Home goods · Local pickup',
    items: [['Everyday tote', '$24'], ['Ceramic cup', '$18']] as const,
    cta: 'Choose pickup', choices: ['Pickup · Today', 'Pickup · Tomorrow'], confirm: 'Send demo order',
    done: 'Order received', activity: 'New order', detail: 'Items and pickup details in one place.',
    inboxLabel: 'New order', servedLabel: 'Ready for pickup', accent: '#56715c',
  },
  {
    name: 'Good Neighbour', type: 'Service business', icon: Wrench, action: 'Request',
    title: 'A little help at home.', subtitle: 'Home services · Local team',
    items: [['Home cleaning', 'From $90'], ['Garden tidy-up', 'From $65']] as const,
    cta: 'Request a quote', choices: ['This week', 'Next week'], confirm: 'Send demo request',
    done: 'Request received', activity: 'New quote request', detail: 'Follow up and turn interest into work.',
    inboxLabel: 'Quote request', servedLabel: 'Quote sent', accent: '#627383',
  },
] as const
