import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './polish.css'
import FeedbackProvider from '@/components/feedback-provider'
export const metadata: Metadata = { title: 'Quicklink — Your customer hub.', description: 'One place for customers to book, order and request services from local businesses.', generator: 'Quicklink', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'Quicklink' } }
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f6f6f3', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en" className="bg-[#f6f6f3]" suppressHydrationWarning><body className="antialiased" suppressHydrationWarning><FeedbackProvider>{children}</FeedbackProvider>{process.env.NODE_ENV === 'production' && <Analytics />}</body></html> }
