'use client'

import { useState } from 'react'
import { Loader2, LockKeyhole } from 'lucide-react'
import QuicklinkLogo from '@/components/quicklink-logo'

const LOGIN_TIMEOUT_MS = 15000

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS)
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }), signal: controller.signal })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to sign in.')
      window.location.assign('/admin')
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === 'AbortError' ? 'The sign-in request timed out. Please try again.' : caught instanceof Error ? caught.message : 'Unable to reach Supabase. Please try again.')
      setLoading(false)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f6f3] px-6 text-[#1d1d1b]">
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-[#deded7] bg-white p-8 shadow-sm">
      <QuicklinkLogo className="text-lg"/>
      <div className="mt-12"><div className="flex size-11 items-center justify-center rounded-xl bg-[#eee9df] text-[#8b6b3d]"><LockKeyhole size={19}/></div><p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#8b6b3d]">Private admin</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h1><p className="mt-2 text-sm text-[#77776f]">Sign in to manage every Quicklink page.</p></div>
      <div className="mt-8 grid gap-4"><label className="grid gap-2 text-sm font-medium">Email<input required autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-lg border border-[#d9d9d3] px-3 py-3 outline-none focus:border-[#8b6b3d]"/></label><label className="grid gap-2 text-sm font-medium">Password<input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-[#d9d9d3] px-3 py-3 outline-none focus:border-[#8b6b3d]"/></label></div>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1d1d1b] py-3.5 text-sm font-semibold text-white disabled:opacity-60">{loading && <Loader2 size={16} className="animate-spin"/>}{loading ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </main>
}
