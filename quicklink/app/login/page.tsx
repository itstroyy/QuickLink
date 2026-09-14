import type { Metadata } from 'next'
import OwnerLogin from '@/components/dashboard/owner-login'
export const metadata: Metadata = { title: 'Sign in — Quicklink', robots: { index: false, follow: false } }
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const message = error === 'expired-link' ? 'That link has expired or already been used. Sign in below, or ask your administrator to resend your invitation.' : error ? 'That link is no longer valid. Please sign in below.' : ''
  return <OwnerLogin notice={message}/>
}
