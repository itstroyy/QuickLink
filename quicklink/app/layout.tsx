import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'Quicklink — One scan. Every link.', description: 'Beautiful QR landing pages for local businesses.', generator: 'Quicklink' }
export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f6f6f3', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en" className="bg-[#f6f6f3]" suppressHydrationWarning><body className="antialiased" suppressHydrationWarning>{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html> }
