'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import QuicklinkLogo from '@/components/quicklink-logo'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function OwnerLogin({ notice }: { notice?: string } = {}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [showPassword,setShowPassword]=useState(false)
  async function submit(method: 'password' | 'link' | 'reset') {
    if (busy) return
    setBusy(true); setMessage('')
    try {
      const supabase = createClient()
      if (method === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error('The email or password is incorrect.')
        window.location.assign('/dashboard')
      } else {
        const redirectTo = `${window.location.origin}/auth/finish${method === 'reset' ? '?recovery=1' : ''}`
        const result = method === 'reset' ? await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo }) : await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
        if (result.error && !result.error.message.toLowerCase().includes('signup')) throw new Error('Unable to send an email right now. Please try again later.')
        setMessage('If this email has a Quicklink account, a secure link is on its way. Check your inbox and spam folder.')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to sign in.') }
    finally { setBusy(false) }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f5f4ef] p-5"><div className="w-full max-w-md rounded-3xl border border-[#deded7] bg-white p-7 shadow-[0_24px_70px_rgba(38,28,17,.1)] sm:p-9"><QuicklinkLogo/><h1 className="mt-8 text-3xl font-semibold">Welcome back.</h1><p className="mt-2 text-sm text-[#77776f]">Sign in to manage your business.</p>{notice && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</p>}<form onSubmit={(event) => { event.preventDefault(); void submit('password') }} className="mt-7 grid gap-4"><label className="text-sm font-medium">Email<input className="form-control mt-2" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)}/></label><label className="text-sm font-medium">Password<span className="relative mt-2 block"><input className="form-control pr-12" type={showPassword?'text':'password'} required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)}/><button type="button" onClick={()=>setShowPassword(!showPassword)} className="absolute right-1 top-1 grid size-9 place-items-center rounded-lg text-[#77776f]" aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></span></label><button disabled={busy} className="dashboard-primary inline-flex items-center justify-center gap-2 disabled:opacity-50">{busy&&<Loader2 size={16} className="animate-spin"/>}{busy?'Signing in…':'Sign in'}</button></form><div className="mt-4 grid gap-2"><button type="button" disabled={busy || !email.includes('@')} onClick={() => submit('link')} className="dashboard-secondary disabled:opacity-50">Email me a sign-in link</button><button type="button" disabled={busy || !email.includes('@')} onClick={() => submit('reset')} className="min-h-11 text-sm font-medium text-[#6f512f] underline disabled:opacity-50">Forgot password?</button></div><p role="status" className="mt-4 text-sm">{message}</p><p className="mt-6 text-xs text-[#77776f]">New here? Ask your Quicklink administrator to invite your business email.</p><Link href="/" className="mt-4 block text-sm underline">Back to Quicklink</Link></div></main>
}
